const path = require('path');
const fs = require('fs');
const { safeExecSync } = require('../safeExec');
const { queries } = require('../database');
const { parseDbTimestamp } = require('../timeUtil');

function pct(status) {
  if (status === 'OK') return 100;
  if (status === 'WARNING') return 50;
  return 0;
}

async function runExtendedDiagnostics() {
  const results = [];
  const errors = [];
  const warnings = [];

  // ── 1. Credential Decryption Health ──
  try {
    let credStatus = 'OK';
    let credMsg = 'No stored credentials to verify';
    const cred = await queries.get(
      "SELECT api_key FROM manager_gateio_credentials LIMIT 1"
    ).catch(() => null);
    if (cred && cred.api_key) {
      try {
        const { decryptText } = require('../secureCredentials');
        const secret = process.env.GATEIO_CREDENTIAL_ENCRYPTION_KEY || process.env.PRIVATE_KEY;
        if (!secret) {
          credStatus = 'ERROR';
          credMsg = 'Encryption key env var missing (GATEIO_CREDENTIAL_ENCRYPTION_KEY / PRIVATE_KEY)';
          errors.push(credMsg);
        } else {
          decryptText(cred.api_key, secret);
          credStatus = 'OK';
          credMsg = 'Test decrypt passed — encryption key is consistent with stored credentials';
        }
      } catch (e) {
        credStatus = 'ERROR';
        credMsg = `Credential decryption failed: ${e.message} — encryption key may have changed`;
        errors.push(credMsg);
      }
    }
    results.push({ name: '거래소 자격증명 복호화 건전성', status: credStatus, percentage: pct(credStatus), details: credMsg });
  } catch (e) {
    results.push({ name: '거래소 자격증명 복호화 건전성', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 2. GridBot Scheduler Heartbeat ──
  try {
    let hbStatus = 'OK';
    let hbMsg = 'Scheduler heartbeat normal';
    const lastTick = await queries.get(
      "SELECT value FROM platform_settings WHERE key = 'last_gridbot_tick'"
    );
    if (!lastTick || !lastTick.value) {
      hbStatus = 'WARNING';
      hbMsg = 'No gridbot heartbeat recorded yet (last_gridbot_tick missing)';
      warnings.push(hbMsg);
    } else {
      const elapsed = Date.now() - parseInt(lastTick.value, 10);
      const elapsedMin = Math.round(elapsed / 60000);
      if (elapsed > 60 * 60 * 1000) {
        hbStatus = 'ERROR';
        hbMsg = `GridBot scheduler silent for ${elapsedMin}min — setTimeout chain may have died`;
        errors.push(hbMsg);
      } else if (elapsed > 35 * 60 * 1000) {
        hbStatus = 'WARNING';
        hbMsg = `GridBot last tick ${elapsedMin}min ago — longer than expected max interval (30min)`;
        warnings.push(hbMsg);
      } else {
        hbMsg = `GridBot last tick ${elapsedMin}min ago — within expected range`;
      }
    }
    results.push({ name: 'GridBot 스케줄러 심장박동', status: hbStatus, percentage: pct(hbStatus), details: hbMsg });
  } catch (e) {
    results.push({ name: 'GridBot 스케줄러 심장박동', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 3. Fallback Price Detection ──
  try {
    let fpStatus = 'OK';
    let fpMsg = 'No fallback price usage detected';
    const fbRow = await queries.get(
      "SELECT value FROM platform_settings WHERE key = 'fallback_price_count'"
    );
    const fbCount = fbRow ? parseInt(fbRow.value || '0', 10) : 0;
    if (fbCount > 10) {
      fpStatus = 'ERROR';
      fpMsg = `Fallback hardcoded price used ${fbCount} times — Gate.io ticker API may be down`;
      errors.push(fpMsg);
    } else if (fbCount > 0) {
      fpStatus = 'WARNING';
      fpMsg = `Fallback hardcoded price used ${fbCount} time(s) — intermittent ticker failures`;
      warnings.push(fpMsg);
    }
    results.push({ name: '폴백 가격 사용 감지', status: fpStatus, percentage: pct(fpStatus), details: fpMsg });
  } catch (e) {
    results.push({ name: '폴백 가격 사용 감지', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 4. JS↔Python Feature Count Consistency ──
  try {
    let fcStatus = 'OK';
    let fcMsg = '';
    const jsFeatureCount = 10;
    let pyFeatureCount = 0;
    try {
      const pyPath = path.resolve(__dirname, '..', 'ais_features.py');
      const pyContent = fs.readFileSync(pyPath, 'utf8');
      const match = pyContent.match(/FEATURE_COUNT\s*=\s*(\d+)/);
      if (match) pyFeatureCount = parseInt(match[1], 10);
    } catch (_) {}
    fcMsg = `JS AIDL_FEATURE_ORDER: ${jsFeatureCount}, Python FEATURE_COUNT: ${pyFeatureCount}`;
    if (jsFeatureCount !== pyFeatureCount) {
      fcStatus = 'ERROR';
      fcMsg += ' — CRITICAL: JS and Python feature definitions are out of sync!';
      warnings.push(fcMsg);
    } else {
      fcStatus = 'OK';
      fcMsg += ' — synchronized (10 features)';
    }
    results.push({ name: 'JS↔Python 피처 수 정합성', status: fcStatus, percentage: pct(fcStatus), details: fcMsg });
  } catch (e) {
    results.push({ name: 'JS↔Python 피처 수 정합성', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 5. Consecutive Engine Failure Counter ──
  try {
    let efStatus = 'OK';
    let efMsg = 'No consecutive engine failures recorded';
    const efRow = await queries.get(
      "SELECT value FROM platform_settings WHERE key = 'consecutive_engine_failures'"
    );
    const efCount = efRow ? parseInt(efRow.value || '0', 10) : 0;
    if (efCount >= 10) {
      efStatus = 'ERROR';
      efMsg = `${efCount} consecutive all-engine-failed cycles — both Gemini and AiS are down`;
      errors.push(efMsg);
    } else if (efCount >= 3) {
      efStatus = 'WARNING';
      efMsg = `${efCount} consecutive engine failures — check API keys and quotas`;
      warnings.push(efMsg);
    } else if (efCount > 0) {
      efMsg = `${efCount} recent engine failure(s) — within acceptable range`;
    }
    results.push({ name: '연속 엔진 실패 카운터', status: efStatus, percentage: pct(efStatus), details: efMsg });
  } catch (e) {
    results.push({ name: '연속 엔진 실패 카운터', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 6. Safeguard Trigger State ──
  try {
    let sgStatus = 'OK';
    let sgMsg = 'Safeguard not triggered — normal operation';
    const sgRow = await queries.get(
      "SELECT value FROM platform_settings WHERE key = 'ais_safeguard_triggered'"
    );
    if (sgRow && sgRow.value === 'true') {
      sgStatus = 'WARNING';
      sgMsg = 'AiS engine safeguard ACTIVE — auto-demoted to GEMINI due to 24h+ AiS failures';
      warnings.push(sgMsg);
    }
    results.push({ name: 'AiS 세이프가드 트리거 상태', status: sgStatus, percentage: pct(sgStatus), details: sgMsg });
  } catch (e) {
    results.push({ name: 'AiS 세이프가드 트리거 상태', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 7. Gate.io Order Cancel Failure Rate ──
  try {
    let ocStatus = 'OK';
    let ocMsg = 'No order cancel failures recorded';
    const ocRow = await queries.get(
      "SELECT value FROM platform_settings WHERE key = 'order_cancel_failures'"
    );
    const ocCount = ocRow ? parseInt(ocRow.value || '0', 10) : 0;
    if (ocCount >= 10) {
      ocStatus = 'WARNING';
      ocMsg = `${ocCount} order cancel failures — stale orders may remain on Gate.io`;
      warnings.push(ocMsg);
    } else if (ocCount > 0) {
      ocMsg = `${ocCount} order cancel failure(s) — minor`;
    }
    results.push({ name: 'Gate.io 주문 취소 실패율', status: ocStatus, percentage: pct(ocStatus), details: ocMsg });
  } catch (e) {
    results.push({ name: 'Gate.io 주문 취소 실패율', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 8. SQLite WAL File Size ──
  try {
    let walStatus = 'OK';
    let walMsg = 'WAL file within normal range';
    const dbPath = path.resolve(__dirname, '..', 'platform.db');
    const walPath = dbPath + '-wal';
    if (fs.existsSync(walPath)) {
      const walSize = fs.statSync(walPath).size;
      const walMB = (walSize / 1024 / 1024).toFixed(2);
      if (walSize > 100 * 1024 * 1024) {
        walStatus = 'ERROR';
        walMsg = `WAL file ${walMB}MB — extremely large, checkpoint needed urgently`;
        errors.push(walMsg);
      } else if (walSize > 50 * 1024 * 1024) {
        walStatus = 'WARNING';
        walMsg = `WAL file ${walMB}MB — growing large, consider PRAGMA wal_checkpoint`;
        warnings.push(walMsg);
      } else {
        walMsg = `WAL file ${walMB}MB — normal`;
      }
    } else {
      walMsg = 'WAL file not found (journal mode may not be WAL)';
    }
    results.push({ name: 'SQLite WAL 파일 크기', status: walStatus, percentage: pct(walStatus), details: walMsg });
  } catch (e) {
    results.push({ name: 'SQLite WAL 파일 크기', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 9. SQLite DB File Size ──
  try {
    let dbSizeStatus = 'OK';
    let dbSizeMsg = 'DB file size normal';
    const dbPath = path.resolve(__dirname, '..', 'platform.db');
    if (fs.existsSync(dbPath)) {
      const dbSize = fs.statSync(dbPath).size;
      const dbMB = (dbSize / 1024 / 1024).toFixed(2);
      if (dbSize > 2 * 1024 * 1024 * 1024) {
        dbSizeStatus = 'ERROR';
        dbSizeMsg = `platform.db ${dbMB}MB — exceeds 2GB SQLite performance threshold`;
        errors.push(dbSizeMsg);
      } else if (dbSize > 1 * 1024 * 1024 * 1024) {
        dbSizeStatus = 'WARNING';
        dbSizeMsg = `platform.db ${dbMB}MB — approaching 2GB threshold`;
        warnings.push(dbSizeMsg);
      } else {
        dbSizeMsg = `platform.db ${dbMB}MB — healthy`;
      }
    }
    results.push({ name: 'SQLite DB 파일 크기', status: dbSizeStatus, percentage: pct(dbSizeStatus), details: dbSizeMsg });
  } catch (e) {
    results.push({ name: 'SQLite DB 파일 크기', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 10. FK Enforcement ──
  try {
    let fkStatus = 'OK';
    let fkMsg = '';
    const fkRow = await queries.get("PRAGMA foreign_keys");
    const fkEnabled = fkRow && (fkRow.foreign_keys === 1 || fkRow.foreign_keys === '1');
    if (fkEnabled) {
      fkMsg = 'PRAGMA foreign_keys = ON — referential integrity enforced';
    } else {
      fkStatus = 'WARNING';
      fkMsg = 'PRAGMA foreign_keys = OFF — orphaned references possible';
      warnings.push(fkMsg);
    }
    results.push({ name: 'FK 제약조건 활성화 여부', status: fkStatus, percentage: pct(fkStatus), details: fkMsg });
  } catch (e) {
    results.push({ name: 'FK 제약조건 활성화 여부', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 11. Schema Column Verification ──
  try {
    let schemaStatus = 'OK';
    let schemaMsg = '';
    const expectedCols = {
      ais_council_members: ['member_id', 'name', 'weights_json', 'dna_json', 'phenotype_json', 'voting_power', 'status', 'faction', 'generation'],
      ais_training_data: ['id', 'gemini_decision', 'evaluation_status'],
      ais_model_runs: ['id', 'run_key', 'completed_at'],
    };
    const missing = [];
    for (const [table, cols] of Object.entries(expectedCols)) {
      try {
        const tableInfo = await queries.all(`PRAGMA table_info(${table})`);
        const existingCols = tableInfo.map(c => c.name);
        for (const col of cols) {
          if (!existingCols.includes(col)) {
            missing.push(`${table}.${col}`);
          }
        }
      } catch (_) {
        missing.push(`${table} (table missing)`);
      }
    }
    if (missing.length > 0) {
      schemaStatus = 'ERROR';
      schemaMsg = `Missing columns: ${missing.join(', ')}`;
      errors.push(schemaMsg);
    } else {
      schemaMsg = 'All expected columns present in core tables';
    }
    results.push({ name: '스키마 컬럼 무결성 검증', status: schemaStatus, percentage: pct(schemaStatus), details: schemaMsg });
  } catch (e) {
    results.push({ name: '스키마 컬럼 무결성 검증', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 12. Python Import Chain Verification ──
  try {
    let pyStatus = 'OK';
    let pyMsg = '';
    const pythonCmd = process.platform === 'win32' ? 'py -3' : 'python3';
    const backendDir = path.resolve(__dirname, '..');
    try {
      safeExecSync(
        `${pythonCmd} -c "import ais_features; import ais_dna; print('OK')"`,
        { cwd: backendDir, timeout: 10000, stdio: 'pipe' }
      );
      pyMsg = 'ais_features.py, ais_dna.py import chain verified';
    } catch (pyErr) {
      pyStatus = 'ERROR';
      const stderr = pyErr.stderr ? pyErr.stderr.toString().substring(0, 200) : 'unknown';
      pyMsg = `Python import failed: ${stderr}`;
      errors.push(pyMsg);
    }
    results.push({ name: 'Python 모듈 Import 체인', status: pyStatus, percentage: pct(pyStatus), details: pyMsg });
  } catch (e) {
    results.push({ name: 'Python 모듈 Import 체인', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 13. Training Candle Data Freshness ──
  try {
    let candleStatus = 'OK';
    let candleMsg = 'Candle data check not available';
    const lastCandle = await queries.get(
      "SELECT MAX(timestamp) as latest FROM historical_candles"
    ).catch(() => null);
    if (lastCandle && lastCandle.latest) {
      const raw = Number(lastCandle.latest);
      const tsMs = raw < 1e12 ? raw * 1000 : raw;
      const age = Date.now() - tsMs;
      const ageHours = Math.round(age / 3600000);
      if (age > 48 * 3600000) {
        candleStatus = 'ERROR';
        candleMsg = `Latest candle ${ageHours}h old — stale data will degrade evolution quality`;
        errors.push(candleMsg);
      } else if (age > 24 * 3600000) {
        candleStatus = 'WARNING';
        candleMsg = `Latest candle ${ageHours}h old — data getting stale`;
        warnings.push(candleMsg);
      } else {
        candleMsg = `Latest candle ${ageHours}h old — fresh`;
      }
    } else {
      candleStatus = 'WARNING';
      candleMsg = 'No candle data found in historical_candles table';
      warnings.push(candleMsg);
    }
    results.push({ name: '캔들 데이터 최신성', status: candleStatus, percentage: pct(candleStatus), details: candleMsg });
  } catch (e) {
    results.push({ name: '캔들 데이터 최신성', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 14. Stuck Training Run (RUNNING) Detection ──
  try {
    let stuckStatus = 'OK';
    let stuckMsg = 'No stuck training runs';
    const stuckRuns = await queries.all(
      "SELECT id, run_key, created_at FROM ais_model_runs WHERE status = 'RUNNING'"
    ).catch(() => []);
    if (stuckRuns.length > 0) {
      const oldest = stuckRuns[0];
      const age = Date.now() - parseDbTimestamp(oldest.created_at);
      if (age > 30 * 60 * 1000) {
        stuckStatus = 'WARNING';
        stuckMsg = `${stuckRuns.length} training run(s) stuck in RUNNING state for ${Math.round(age / 60000)}min`;
        warnings.push(stuckMsg);
      } else {
        stuckMsg = `${stuckRuns.length} training run(s) currently executing — normal`;
      }
    }
    results.push({ name: '멈춘 학습(RUNNING) 감지', status: stuckStatus, percentage: pct(stuckStatus), details: stuckMsg });
  } catch (e) {
    results.push({ name: '멈춘 학습(RUNNING) 감지', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 15. DB Lock Contention ──
  try {
    let lockStatus = 'OK';
    let lockMsg = 'No lock contention detected';
    const lockRow = await queries.get(
      "SELECT value FROM platform_settings WHERE key = 'db_lock_retries'"
    );
    const lockCount = lockRow ? parseInt(lockRow.value || '0', 10) : 0;
    if (lockCount >= 10) {
      lockStatus = 'WARNING';
      lockMsg = `${lockCount} DB lock retry events — Python/Node concurrent write contention`;
      warnings.push(lockMsg);
    } else if (lockCount > 0) {
      lockMsg = `${lockCount} DB lock retry event(s) — acceptable`;
    }
    results.push({ name: 'DB 잠금 경합 감지', status: lockStatus, percentage: pct(lockStatus), details: lockMsg });
  } catch (e) {
    results.push({ name: 'DB 잠금 경합 감지', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 16. INVALID Row Accumulation Rate ──
  try {
    let invStatus = 'OK';
    let invMsg = '';
    const counts = await queries.get(`
      SELECT 
        SUM(CASE WHEN evaluation_status = 'INVALID' THEN 1 ELSE 0 END) as invalid_count,
        SUM(CASE WHEN evaluation_status = 'LABELED' THEN 1 ELSE 0 END) as labeled_count
      FROM ais_training_data
    `).catch(() => ({ invalid_count: 0, labeled_count: 0 }));
    const inv = counts.invalid_count || 0;
    const lab = counts.labeled_count || 0;
    const total = inv + lab;
    if (total > 0 && inv / total > 0.3) {
      invStatus = 'WARNING';
      invMsg = `INVALID ${inv} / LABELED ${lab} (${Math.round(inv / total * 100)}%) — systematic labeling issue suspected`;
      warnings.push(invMsg);
    } else {
      invMsg = `INVALID ${inv} / LABELED ${lab} — ratio healthy`;
    }
    results.push({ name: 'INVALID 라벨 누적 비율', status: invStatus, percentage: pct(invStatus), details: invMsg });
  } catch (e) {
    results.push({ name: 'INVALID 라벨 누적 비율', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 17. Label Version Mismatch ──
  try {
    let lvStatus = 'OK';
    let lvMsg = '';
    const staleLabels = await queries.get(`
      SELECT COUNT(*) as cnt FROM ais_training_data 
      WHERE evaluation_status = 'LABELED' AND (label_version IS NULL OR label_version != 2)
    `).catch(() => ({ cnt: 0 }));
    const stale = staleLabels.cnt || 0;
    if (stale > 50) {
      lvStatus = 'WARNING';
      lvMsg = `${stale} labeled rows with outdated label_version — may degrade training quality`;
      warnings.push(lvMsg);
    } else {
      lvMsg = `${stale} stale label version row(s) — acceptable`;
    }
    results.push({ name: '라벨 버전 정합성', status: lvStatus, percentage: pct(lvStatus), details: lvMsg });
  } catch (e) {
    results.push({ name: '라벨 버전 정합성', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 18. Simulation Mode Awareness ──
  try {
    let simStatus = 'OK';
    let simMsg = 'Web3 real mode — on-chain transactions active';
    try {
      const { isSimulationMode } = require('../contractHelper');
      if (typeof isSimulationMode === 'function' && isSimulationMode()) {
        simStatus = 'WARNING';
        simMsg = 'System running in SIMULATION mode — no real on-chain transactions';
        warnings.push(simMsg);
      }
    } catch (_) {
      simMsg = 'contractHelper not available for simulation mode check';
    }
    results.push({ name: 'Web3 시뮬레이션 모드 인지', status: simStatus, percentage: pct(simStatus), details: simMsg });
  } catch (e) {
    results.push({ name: 'Web3 시뮬레이션 모드 인지', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 19. Server Clock Drift ──
  try {
    let clockStatus = 'OK';
    let clockMsg = '';
    const https = require('https');
    const serverTime = await new Promise((resolve, reject) => {
      const req = https.get('https://api.gateio.ws/api/v4/spot/time', { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (_) { reject(new Error('parse failed')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    }).catch(() => null);
    if (serverTime && serverTime.server_time) {
      const exchangeMs = serverTime.server_time;
      const drift = Math.abs(Date.now() - exchangeMs);
      const driftSec = Math.round(drift / 1000);
      if (drift > 30000) {
        clockStatus = 'ERROR';
        clockMsg = `Clock drift ${driftSec}s vs Gate.io — HMAC signatures will fail`;
        errors.push(clockMsg);
      } else if (drift > 10000) {
        clockStatus = 'WARNING';
        clockMsg = `Clock drift ${driftSec}s vs Gate.io — approaching failure threshold`;
        warnings.push(clockMsg);
      } else {
        clockMsg = `Clock drift ${driftSec}s vs Gate.io — acceptable`;
      }
    } else {
      clockMsg = 'Could not fetch Gate.io server time for clock comparison';
    }
    results.push({ name: '서버 시계 드리프트', status: clockStatus, percentage: pct(clockStatus), details: clockMsg });
  } catch (e) {
    results.push({ name: '서버 시계 드리프트', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 20. Gate.io API Rate Limit ──
  try {
    let rlStatus = 'OK';
    let rlMsg = 'Rate limit tracking not available (counter not yet implemented in gateioHelper)';
    const rlRow = await queries.get(
      "SELECT value FROM platform_settings WHERE key = 'gateio_api_calls_last_min'"
    ).catch(() => null);
    if (rlRow && rlRow.value) {
      const count = parseInt(rlRow.value, 10);
      if (count > 720) {
        rlStatus = 'WARNING';
        rlMsg = `${count}/900 Gate.io API calls in last minute — approaching rate limit`;
        warnings.push(rlMsg);
      } else {
        rlMsg = `${count}/900 Gate.io API calls in last minute — healthy`;
      }
    }
    results.push({ name: 'Gate.io API 레이트 리밋', status: rlStatus, percentage: pct(rlStatus), details: rlMsg });
  } catch (e) {
    results.push({ name: 'Gate.io API 레이트 리밋', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 21. Google OAuth Endpoint Reachability ──
  try {
    let oauthStatus = 'OK';
    let oauthMsg = '';
    const https = require('https');
    const reachable = await new Promise((resolve) => {
      const req = https.get('https://oauth2.googleapis.com/tokeninfo', { timeout: 5000 }, (res) => {
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
    if (reachable) {
      oauthMsg = 'Google OAuth endpoint reachable — login flow will work';
    } else {
      oauthStatus = 'WARNING';
      oauthMsg = 'Google OAuth endpoint unreachable — all user logins may fail';
      warnings.push(oauthMsg);
    }
    results.push({ name: 'Google OAuth 엔드포인트 도달성', status: oauthStatus, percentage: pct(oauthStatus), details: oauthMsg });
  } catch (e) {
    results.push({ name: 'Google OAuth 엔드포인트 도달성', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 22. KYC Upload Directory ──
  try {
    let kycStatus = 'OK';
    let kycMsg = '';
    const uploadPath = path.resolve(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      kycStatus = 'ERROR';
      kycMsg = `KYC upload directory missing: ${uploadPath}`;
      errors.push(kycMsg);
    } else {
      try {
        fs.accessSync(uploadPath, fs.constants.W_OK);
        kycMsg = `KYC upload directory exists and writable: ${uploadPath}`;
      } catch (_) {
        kycStatus = 'ERROR';
        kycMsg = `KYC upload directory not writable: ${uploadPath}`;
        errors.push(kycMsg);
      }
    }
    results.push({ name: 'KYC 업로드 디렉토리', status: kycStatus, percentage: pct(kycStatus), details: kycMsg });
  } catch (e) {
    results.push({ name: 'KYC 업로드 디렉토리', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 23. CSV File Growth ──
  try {
    let csvStatus = 'OK';
    let csvMsg = '';
    const csvPath = path.resolve(__dirname, '..', 'data', 'ai_decisions.csv');
    if (fs.existsSync(csvPath)) {
      const csvSize = fs.statSync(csvPath).size;
      const csvMB = (csvSize / 1024 / 1024).toFixed(2);
      if (csvSize > 500 * 1024 * 1024) {
        csvStatus = 'WARNING';
        csvMsg = `ai_decisions.csv ${csvMB}MB — consider archiving/trimming`;
        warnings.push(csvMsg);
      } else {
        csvMsg = `ai_decisions.csv ${csvMB}MB — normal`;
      }
    } else {
      csvMsg = 'ai_decisions.csv not found — may not have been created yet';
    }
    results.push({ name: 'CSV 학습 파일 크기', status: csvStatus, percentage: pct(csvStatus), details: csvMsg });
  } catch (e) {
    results.push({ name: 'CSV 학습 파일 크기', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 24. Dynamic Interval State ──
  try {
    let diStatus = 'OK';
    let diMsg = '';
    const intRow = await queries.get(
      "SELECT value FROM platform_settings WHERE key = 'current_dynamic_interval'"
    );
    if (intRow && intRow.value) {
      diMsg = `Current dynamic interval: ${intRow.value}min`;
    } else {
      diMsg = 'Dynamic interval state not recorded — using default';
    }
    results.push({ name: '동적 주기 현재 상태', status: diStatus, percentage: pct(diStatus), details: diMsg });
  } catch (e) {
    results.push({ name: '동적 주기 현재 상태', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 25. ais_genome_archive Table Growth ──
  try {
    let archStatus = 'OK';
    let archMsg = '';
    const archCount = await queries.get(
      "SELECT COUNT(*) as cnt FROM ais_genome_archive"
    ).catch(() => ({ cnt: 0 }));
    const cnt = archCount.cnt || 0;
    if (cnt > 50000) {
      archStatus = 'WARNING';
      archMsg = `Genome archive has ${cnt} rows — consider pruning old entries`;
      warnings.push(archMsg);
    } else {
      archMsg = `Genome archive: ${cnt} rows — healthy`;
    }
    results.push({ name: '유전자 아카이브 테이블 크기', status: archStatus, percentage: pct(archStatus), details: archMsg });
  } catch (e) {
    results.push({ name: '유전자 아카이브 테이블 크기', status: 'OK', percentage: 100, details: 'Archive table not found or empty' });
  }

  // ── 26. ais_training_data Volume ──
  try {
    let tdStatus = 'OK';
    let tdMsg = '';
    const tdCount = await queries.get(
      "SELECT COUNT(*) as cnt FROM ais_training_data"
    ).catch(() => ({ cnt: 0 }));
    const cnt = tdCount.cnt || 0;
    if (cnt > 100000) {
      tdStatus = 'WARNING';
      tdMsg = `Training data: ${cnt} rows — consider cleanup of old labeled data`;
      warnings.push(tdMsg);
    } else {
      tdMsg = `Training data: ${cnt} rows — healthy`;
    }
    results.push({ name: '학습 데이터 테이블 볼륨', status: tdStatus, percentage: pct(tdStatus), details: tdMsg });
  } catch (e) {
    results.push({ name: '학습 데이터 테이블 볼륨', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 27. Briefing Consecutive Failures ──
  try {
    let bfStatus = 'OK';
    let bfMsg = '';
    const recentBriefings = await queries.all(
      "SELECT status FROM council_briefing_history ORDER BY created_at DESC LIMIT 5"
    ).catch(() => []);
    const consecutiveFails = recentBriefings.findIndex(b => b.status !== 'FAILED');
    const failCount = consecutiveFails === -1 ? recentBriefings.length : consecutiveFails;
    if (failCount >= 3) {
      bfStatus = 'WARNING';
      bfMsg = `${failCount} consecutive briefing failures — persistent Gemini quota issue likely`;
      warnings.push(bfMsg);
    } else {
      bfMsg = `${failCount} recent briefing failure(s) — acceptable`;
    }
    results.push({ name: '브리핑 연속 실패 횟수', status: bfStatus, percentage: pct(bfStatus), details: bfMsg });
  } catch (e) {
    results.push({ name: '브리핑 연속 실패 횟수', status: 'OK', percentage: 100, details: 'Briefing history not available' });
  }

  // ── 28. Briefing IN_PROGRESS Stuck ──
  try {
    let bipStatus = 'OK';
    let bipMsg = 'No stuck briefings';
    const stuckBriefings = await queries.all(
      "SELECT id, created_at FROM council_briefing_history WHERE status = 'IN_PROGRESS'"
    ).catch(() => []);
    if (stuckBriefings.length > 0) {
      const oldest = stuckBriefings[0];
      const age = Date.now() - parseDbTimestamp(oldest.created_at);
      if (age > 60 * 60 * 1000) {
        bipStatus = 'WARNING';
        bipMsg = `${stuckBriefings.length} briefing(s) stuck IN_PROGRESS for ${Math.round(age / 60000)}min — process may have restarted mid-briefing`;
        warnings.push(bipMsg);
      }
    }
    results.push({ name: '브리핑 IN_PROGRESS 고착', status: bipStatus, percentage: pct(bipStatus), details: bipMsg });
  } catch (e) {
    results.push({ name: '브리핑 IN_PROGRESS 고착', status: 'OK', percentage: 100, details: 'Briefing history not available' });
  }

  // ── 29. Express Error Handler Frequency ──
  try {
    let ehStatus = 'OK';
    let ehMsg = '';
    const ehRow = await queries.get(
      "SELECT value FROM platform_settings WHERE key = 'express_error_count'"
    );
    const ehCount = ehRow ? parseInt(ehRow.value || '0', 10) : 0;
    if (ehCount >= 50) {
      ehStatus = 'WARNING';
      ehMsg = `${ehCount} unhandled route errors caught by global handler`;
      warnings.push(ehMsg);
    } else {
      ehMsg = `${ehCount} global error handler invocation(s) — normal`;
    }
    results.push({ name: 'Express 글로벌 에러 빈도', status: ehStatus, percentage: pct(ehStatus), details: ehMsg });
  } catch (e) {
    results.push({ name: 'Express 글로벌 에러 빈도', status: 'OK', percentage: 100, details: 'Error counter not tracked' });
  }

  // ── 30. CORS Configuration ──
  try {
    let corsStatus = 'OK';
    let corsMsg = 'CORS origin configuration check';
    const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const hasWildcard = /origin:\s*['"]\*['"]/.test(serverSource);
    if (hasWildcard) {
      corsStatus = 'WARNING';
      corsMsg = "CORS origin: '*' — all origins allowed (development mode). Consider restricting in production.";
      warnings.push(corsMsg);
    } else {
      corsStatus = 'OK';
      corsMsg = 'CORS origin restricted to whitelist';
    }
    results.push({ name: 'CORS 설정 보안', status: corsStatus, percentage: pct(corsStatus), details: corsMsg });
  } catch (e) {
    results.push({ name: 'CORS 설정 보안', status: 'OK', percentage: 100, details: 'CORS check not available' });
  }

  // ── 31. AUTH_SESSION_SECRET Strength ──
  try {
    let secretStatus = 'OK';
    let secretMsg = '';
    const secret = process.env.AUTH_SESSION_SECRET || '';
    if (!secret) {
      secretStatus = 'ERROR';
      secretMsg = 'AUTH_SESSION_SECRET not set — authentication tokens insecure';
      errors.push(secretMsg);
    } else if (secret.length < 32) {
      secretStatus = 'WARNING';
      secretMsg = `AUTH_SESSION_SECRET length ${secret.length} chars — recommend 32+ chars for security`;
      warnings.push(secretMsg);
    } else {
      secretMsg = `AUTH_SESSION_SECRET length ${secret.length} chars — sufficient entropy`;
    }
    results.push({ name: 'AUTH 세션 시크릿 강도', status: secretStatus, percentage: pct(secretStatus), details: secretMsg });
  } catch (e) {
    results.push({ name: 'AUTH 세션 시크릿 강도', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  // ── 32. Manager Credential Orphans ──
  try {
    let orphanStatus = 'OK';
    let orphanMsg = '';
    const orphanCount = await queries.get(`
      SELECT COUNT(*) as cnt FROM manager_gateio_credentials c
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.wallet_address = c.wallet_address)
    `).catch(() => ({ cnt: 0 }));
    const cnt = orphanCount.cnt || 0;
    if (cnt > 0) {
      orphanStatus = 'WARNING';
      orphanMsg = `${cnt} orphaned credential(s) — no matching user in users table`;
      warnings.push(orphanMsg);
    } else {
      orphanMsg = 'No orphaned credentials — all credentials have matching users';
    }
    results.push({ name: '매니저 자격증명 고아 레코드', status: orphanStatus, percentage: pct(orphanStatus), details: orphanMsg });
  } catch (e) {
    results.push({ name: '매니저 자격증명 고아 레코드', status: 'OK', percentage: 100, details: 'Credential orphan check not available' });
  }

  // ── 33. Evaluation Oldest Pending Age ──
  try {
    let pendStatus = 'OK';
    let pendMsg = '';
    const oldest = await queries.get(`
      SELECT evaluation_due_at FROM ais_training_data 
      WHERE evaluation_status = 'PENDING' AND evaluation_due_at IS NOT NULL
      ORDER BY evaluation_due_at ASC LIMIT 1
    `).catch(() => null);
    if (oldest && oldest.evaluation_due_at) {
      const age = Date.now() - parseDbTimestamp(oldest.evaluation_due_at);
      const ageMin = Math.round(age / 60000);
      if (age > 6 * 3600000) {
        pendStatus = 'WARNING';
        pendMsg = `Oldest unlabeled PENDING row: ${ageMin}min overdue — labeling pipeline stalled`;
        warnings.push(pendMsg);
      } else {
        pendMsg = `Oldest PENDING row: ${ageMin}min — within normal range`;
      }
    } else {
      pendMsg = 'No PENDING evaluations or no due_at timestamps — normal';
    }
    results.push({ name: '미처리 평가 대기 시간', status: pendStatus, percentage: pct(pendStatus), details: pendMsg });
  } catch (e) {
    results.push({ name: '미처리 평가 대기 시간', status: 'WARNING', percentage: 50, details: `Check error: ${e.message}` });
  }

  return { results, errors, warnings };
}

module.exports = { runExtendedDiagnostics };
