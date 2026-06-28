const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const tempDbPath = path.join(os.tmpdir(), `diagnostics-${process.pid}-${Date.now()}.db`);
  process.env.AIS_DB_PATH = tempDbPath;

  const database = require('./database');
  const adminRouter = require('./routes/admin');

  try {
    await database.initializeDatabase();
    const q = database.queries;

    let passed = 0;
    const EXPECTED_NODE_COUNT = 35;

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      assert.equal(result.success, true);
      assert.ok(result.diagnostics);
      assert.ok(result.timestamp);
      assert.ok(result.overallStatus);
      assert.ok(Array.isArray(result.diagnostics));
      assert.ok(Array.isArray(result.errors));
      assert.ok(Array.isArray(result.warnings));
      assert.ok(typeof result.details === 'object');
      passed++;
      console.log('  [PASS] performSystemDiagnostics returns valid structure');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      assert.equal(result.diagnostics.length, EXPECTED_NODE_COUNT,
        `Expected ${EXPECTED_NODE_COUNT} diagnostics but got ${result.diagnostics.length}`);
      passed++;
      console.log(`  [PASS] Diagnostics count matches expected (${EXPECTED_NODE_COUNT})`);
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const validStatuses = new Set(['OK', 'WARNING', 'ERROR']);
      for (const d of result.diagnostics) {
        assert.ok(d.name, `Diagnostic item missing name`);
        assert.ok(validStatuses.has(d.status), `Invalid status "${d.status}" for "${d.name}"`);
        assert.ok(typeof d.percentage === 'number', `Non-number percentage for "${d.name}"`);
        assert.ok(d.percentage >= 0 && d.percentage <= 100, `Out-of-range percentage ${d.percentage} for "${d.name}"`);
        assert.ok(typeof d.details === 'string', `Non-string details for "${d.name}"`);
        assert.ok(d.details.length > 0, `Empty details for "${d.name}"`);
      }
      passed++;
      console.log('  [PASS] All diagnostic items have valid schema (name, status, percentage, details)');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const names = result.diagnostics.map(d => d.name);
      const uniqueNames = new Set(names);
      assert.equal(names.length, uniqueNames.size, `Duplicate diagnostic names found: ${names.filter((n, i) => names.indexOf(n) !== i)}`);
      passed++;
      console.log('  [PASS] All diagnostic names are unique');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      assert.ok(['EXCELLENT', 'WARNING', 'ERROR'].includes(result.overallStatus),
        `Invalid overallStatus: ${result.overallStatus}`);

      const hasError = result.diagnostics.some(d => d.status === 'ERROR');
      const hasWarning = result.diagnostics.some(d => d.status === 'WARNING');

      if (hasError) {
        assert.equal(result.overallStatus, 'ERROR');
      } else if (hasWarning) {
        assert.equal(result.overallStatus, 'WARNING');
      } else {
        assert.equal(result.overallStatus, 'EXCELLENT');
      }
      passed++;
      console.log(`  [PASS] overallStatus (${result.overallStatus}) consistent with individual statuses`);
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      for (const d of result.diagnostics) {
        if (d.status === 'OK') {
          assert.equal(d.percentage, 100, `OK status but percentage is ${d.percentage} for "${d.name}"`);
        }
        if (d.status === 'ERROR') {
          assert.ok(d.percentage <= 50, `ERROR status but percentage is ${d.percentage} for "${d.name}"`);
        }
      }
      passed++;
      console.log('  [PASS] Status-percentage consistency (OK=100, ERROR<=50)');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const ts = new Date(result.timestamp);
      assert.ok(!isNaN(ts.getTime()), 'Invalid ISO timestamp');
      const now = Date.now();
      const diff = Math.abs(now - ts.getTime());
      assert.ok(diff < 60000, `Timestamp drift too large: ${diff}ms`);
      passed++;
      console.log('  [PASS] Timestamp is valid ISO and within 60s of current time');
    }

    {
      const expectedNames = [
        'API 관문 및 어드민 코어',
        'AI 실거래 매매 집행기',
        'AI 유전자 진화 엔진',
        'AI 이상 변이 사전 필터 (AI-VEP)',
        '보조지표 수학 가공기',
        '의회 진단 및 건강 분석기',
        '프론트엔드 UI 대시보드',
        '영구 데이터베이스',
        '의회 스케줄러 동작 무결성',
        'Gate.io API 실시간 잔고',
        'Web3 가스비 잔액 (POL)',
        '서버 물리 자원 & 디스크',
        '학습 데이터 유입 속도',
        'Gemini API 호출 속도',
        'PM2 프로세스 생존성',
        '외부 망 레이턴시 벤치마크',
        'SQLite3 DB I/O 속도',
        '의회 Faction 쏠림 (HHI)',
        'SSL 인증서 보안 검증',
        'AI 의회 투표 활성도',
        'AiS 총선 정기 실행',
        '500인 후보군 풀 정족수',
        '11인 의원 정족수',
        '도태·생성 사이클 건전성',
        'Faction 미할당(NULL) 오염',
        'DNA/Phenotype 누락 검사',
        '가중치 벡터 형태 검증',
        'Gemini API Key 설정 상태',
        '엔진↔승격 정합성 검증',
        '학습 데이터 라벨링 적체',
        'Gemini 매매 분석 정상 가동',
        'AiS 의회 매매 분석 정상 가동',
        'Hybrid 합의 분석 정상 가동',
        '모드별 적중률 데이터 충분성',
        'AiS 진화 학습 정기 실행'
      ];

      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const actualNames = result.diagnostics.map(d => d.name);

      for (let i = 0; i < expectedNames.length; i++) {
        assert.equal(actualNames[i], expectedNames[i],
          `Index ${i}: expected "${expectedNames[i]}" but got "${actualNames[i]}"`);
      }
      assert.equal(actualNames.length, expectedNames.length);
      passed++;
      console.log('  [PASS] All 35 diagnostic nodes present in correct order');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const sections = {
        algorithm: { start: 0, end: 9 },
        infrastructure: { start: 9, end: 14 },
        security: { start: 14, end: 19 },
        council: { start: 19, end: 30 },
        shadow: { start: 30, end: 35 }
      };

      for (const [name, range] of Object.entries(sections)) {
        const slice = result.diagnostics.slice(range.start, range.end);
        assert.equal(slice.length, range.end - range.start,
          `Section "${name}" expected ${range.end - range.start} items but got ${slice.length}`);
        for (const item of slice) {
          assert.ok(item.name, `Section "${name}" has item with missing name`);
        }
      }
      passed++;
      console.log('  [PASS] Section boundaries (algorithm:9, infra:5, security:5, council:11, shadow:5) correct');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const detailKeys = Object.keys(result.details);
      assert.ok(detailKeys.length >= 20, `Too few detail keys: ${detailKeys.length}`);

      const expectedDetailKeys = [
        'envCheck', 'dbCheck', 'fileCheck', 'traderCheck',
        'councilCheck', 'councilSchedulerCheck',
        'councilNullFactionCheck', 'councilDnaIntegrityCheck', 'councilWeightsShapeCheck',
        'geminiApiKeyCheck', 'enginePromoConsistencyCheck'
      ];
      for (const key of expectedDetailKeys) {
        assert.ok(result.details[key], `Missing detail key: ${key}`);
        assert.ok(result.details[key].status, `Detail "${key}" missing status`);
        assert.ok(result.details[key].message, `Detail "${key}" missing message`);
      }
      passed++;
      console.log('  [PASS] Details object contains all expected keys with status/message');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);

      if (result.overallStatus === 'ERROR') {
        assert.ok(result.errors.length > 0, 'CRITICAL status but no errors');
      }
      if (result.overallStatus === 'WARNING') {
        assert.ok(result.warnings.length > 0 || result.errors.length > 0,
          'WARNING status but no warnings or errors');
      }
      if (result.overallStatus === 'EXCELLENT') {
        assert.equal(result.errors.length, 0, 'EXCELLENT but has errors');
      }
      passed++;
      console.log(`  [PASS] errors/warnings arrays consistent with overallStatus (${result.overallStatus})`);
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(true);
      assert.equal(result.success, true);
      assert.equal(result.diagnostics.length, EXPECTED_NODE_COUNT);
      passed++;
      console.log('  [PASS] Heavy test mode (runHeavyTests=true) runs without crash');
    }

    {
      await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_engine', 'AIS_ONLY')");
      await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', 'OFF')");
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const promoItem = result.diagnostics.find(d => d.name === '엔진↔승격 정합성 검증');
      assert.ok(promoItem);
      assert.equal(promoItem.status, 'OK');
      assert.ok(promoItem.details.includes('AIS_ONLY'));
      passed++;
      console.log('  [PASS] Engine-promotion consistency OK when AIS_ONLY + promo OFF');
    }

    {
      await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_engine', 'GEMINI')");
      await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', 'ON')");
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const promoItem = result.diagnostics.find(d => d.name === '엔진↔승격 정합성 검증');
      assert.ok(promoItem);
      assert.equal(promoItem.status, 'WARNING');
      passed++;
      console.log('  [PASS] Engine-promotion consistency WARNING when GEMINI + promo ON');

      await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', 'OFF')");
    }

    {
      await q.run("DELETE FROM platform_settings WHERE key = 'global_gemini_api_key'");
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const keyItem = result.diagnostics.find(d => d.name === 'Gemini API Key 설정 상태');
      assert.ok(keyItem);
      assert.equal(keyItem.status, 'ERROR');
      assert.ok(keyItem.details.includes('미설정'));
      passed++;
      console.log('  [PASS] API Key check ERROR when key is missing');
    }

    {
      await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_gemini_api_key', 'AIza-test-key-123')");
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const keyItem = result.diagnostics.find(d => d.name === 'Gemini API Key 설정 상태');
      assert.ok(keyItem);
      assert.equal(keyItem.status, 'OK');
      assert.ok(keyItem.details.includes('AIza-t'));
      passed++;
      console.log('  [PASS] API Key check OK when key is present (shows prefix)');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const dbItem = result.diagnostics.find(d => d.name === '영구 데이터베이스');
      assert.ok(dbItem);
      assert.equal(dbItem.status, 'OK');
      passed++;
      console.log('  [PASS] Database health check OK');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const nullItem = result.diagnostics.find(d => d.name === 'Faction 미할당(NULL) 오염');
      assert.ok(nullItem);
      assert.equal(nullItem.status, 'OK');
      passed++;
      console.log('  [PASS] Null faction check OK on clean DB');
    }

    {
      const result = await adminRouter.__private__.performSystemDiagnostics(false);
      const dnaItem = result.diagnostics.find(d => d.name === 'DNA/Phenotype 누락 검사');
      assert.ok(dnaItem);
      assert.equal(dnaItem.status, 'OK');
      passed++;
      console.log('  [PASS] DNA integrity check OK on clean DB');
    }

    console.log(`\nsystemDiagnostics: ${passed}/${passed} tests passed`);

  } finally {
    await new Promise((resolve) => database.db.close(resolve));
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    delete process.env.AIS_DB_PATH;
  }

  console.log('systemDiagnostics tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
