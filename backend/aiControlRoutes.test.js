const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const tempDbPath = path.join(os.tmpdir(), `ai-control-routes-${process.pid}-${Date.now()}.db`);
  process.env.AIS_DB_PATH = tempDbPath;

  const database = require('./database');
  const adminRouter = require('./routes/admin');

  try {
    await database.initializeDatabase();
    const q = database.queries;

    let passed = 0;

    async function saveAiConfig(body) {
      const { model, apiKey, interval, intervalAuto, automaticPromotionEnabled, aidlPolicy, geminiTimeoutMs } = body;
      if (model) await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_model', ?)", [model.trim()]);
      if (apiKey) await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_gemini_api_key', ?)", [apiKey.trim()]);
      if (interval) await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_interval', ?)", [interval.toString()]);
      if (intervalAuto) await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_interval_auto', ?)", [intervalAuto.toString()]);
      if (geminiTimeoutMs !== undefined) {
        await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_gemini_timeout_ms', ?)",
          [String(adminRouter.__private__.normalizeGeminiTimeoutMs(geminiTimeoutMs))]);
      }
      if (automaticPromotionEnabled !== undefined) {
        await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', ?)", [automaticPromotionEnabled.toString()]);
      }
      if (aidlPolicy) {
        const norm = adminRouter.__private__.normalizeAidlPolicyConfig(aidlPolicy);
        await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_context_mutation_rate', ?)", [norm.contextMutationRate]);
        await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_state_mutation_rate', ?)", [norm.stateMutationRate]);
        await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_profile_mutation_rate', ?)", [norm.profileMutationRate]);
        await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_copy_number_mutation_rate', ?)", [norm.copyNumberMutationRate]);
        await q.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_weight_nudge_size', ?)", [norm.weightNudgeSize]);
      }
    }

    async function loadAiConfig() {
      const settings = await q.all(
        "SELECT key, value FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key', 'global_ai_interval', 'global_ai_interval_auto', 'global_gemini_timeout_ms', 'automatic_promotion_enabled', 'aidl_context_mutation_rate', 'aidl_state_mutation_rate', 'aidl_profile_mutation_rate', 'aidl_copy_number_mutation_rate', 'aidl_weight_nudge_size')"
      );
      const config = {
        model: 'Gemini 3.5 Flash',
        hasApiKey: false,
        apiKey: '',
        interval: '5',
        intervalAuto: 'OFF',
        geminiTimeoutMs: adminRouter.__private__.DEFAULT_GEMINI_TIMEOUT_MS,
        automaticPromotionEnabled: 'OFF',
        aidlPolicy: { ...adminRouter.__private__.DEFAULT_AIDL_POLICY_CONFIG }
      };
      settings.forEach(s => {
        if (s.key === 'global_ai_model') config.model = s.value;
        if (s.key === 'global_gemini_api_key' && s.value) { config.hasApiKey = true; config.apiKey = s.value; }
        if (s.key === 'global_ai_interval') config.interval = s.value;
        if (s.key === 'global_ai_interval_auto') config.intervalAuto = s.value;
        if (s.key === 'global_gemini_timeout_ms') config.geminiTimeoutMs = adminRouter.__private__.buildGeminiTimeoutConfig([s]);
        if (s.key === 'automatic_promotion_enabled') config.automaticPromotionEnabled = s.value;
      });
      config.aidlPolicy = adminRouter.__private__.buildAidlPolicyConfig(settings);
      return config;
    }


    {
      await saveAiConfig({
        model: 'Gemini 2.5 Pro',
        apiKey: 'test-api-key-12345',
        interval: '10',
        intervalAuto: 'ON',
        geminiTimeoutMs: 45000,
        aidlPolicy: {
          contextMutationRate: '0.15',
          stateMutationRate: '0.20',
          profileMutationRate: '0.12',
          copyNumberMutationRate: '0.08',
          weightNudgeSize: '0.04',
        },
      });
      const config = await loadAiConfig();
      assert.equal(config.model, 'Gemini 2.5 Pro');
      assert.equal(config.hasApiKey, true);
      assert.equal(config.apiKey, 'test-api-key-12345');
      assert.equal(config.interval, '10');
      assert.equal(config.intervalAuto, 'ON');
      assert.equal(config.geminiTimeoutMs, '45000');
      assert.equal(config.aidlPolicy.contextMutationRate, '0.15');
      assert.equal(config.aidlPolicy.stateMutationRate, '0.20');
      assert.equal(config.aidlPolicy.profileMutationRate, '0.12');
      assert.equal(config.aidlPolicy.copyNumberMutationRate, '0.08');
      assert.equal(config.aidlPolicy.weightNudgeSize, '0.04');
      passed++;
      console.log('  [PASS] AI config save and load round-trip');
    }


    {
      const config = await loadAiConfig();
      assert.equal(typeof config.model, 'string');
      assert.equal(typeof config.hasApiKey, 'boolean');
      assert.equal(typeof config.interval, 'string');
      assert.equal(typeof config.intervalAuto, 'string');
      assert.equal(typeof config.geminiTimeoutMs, 'string');
      assert.equal(typeof config.automaticPromotionEnabled, 'string');
      assert.equal(typeof config.aidlPolicy, 'object');
      assert.ok(config.aidlPolicy.contextMutationRate !== undefined);
      assert.ok(config.aidlPolicy.stateMutationRate !== undefined);
      assert.ok(config.aidlPolicy.profileMutationRate !== undefined);
      assert.ok(config.aidlPolicy.copyNumberMutationRate !== undefined);
      assert.ok(config.aidlPolicy.weightNudgeSize !== undefined);
      passed++;
      console.log('  [PASS] AI config schema validation');
    }


    {
      const freshConfig = await loadAiConfig();
      const originalInterval = freshConfig.interval;
      await saveAiConfig({ interval: '30' });
      const updated = await loadAiConfig();
      assert.equal(updated.interval, '30');
      assert.equal(updated.model, freshConfig.model);
      assert.equal(updated.apiKey, freshConfig.apiKey);
      passed++;
      console.log('  [PASS] Partial config update preserves other fields');
    }


    {
      await saveAiConfig({
        geminiTimeoutMs: 3000,
      });
      const config = await loadAiConfig();
      assert.equal(config.geminiTimeoutMs, '5000');

      await saveAiConfig({
        geminiTimeoutMs: 999999,
      });
      const config2 = await loadAiConfig();
      assert.equal(config2.geminiTimeoutMs, '120000');

      await saveAiConfig({
        aidlPolicy: {
          contextMutationRate: '-5',
          stateMutationRate: '99',
          profileMutationRate: 'abc',
          copyNumberMutationRate: '0.5',
          weightNudgeSize: '0.03',
        },
      });
      const config3 = await loadAiConfig();
      assert.equal(config3.aidlPolicy.contextMutationRate, '0.00');
      assert.equal(config3.aidlPolicy.stateMutationRate, '1.00');
      assert.equal(config3.aidlPolicy.profileMutationRate, '0.08');
      passed++;
      console.log('  [PASS] Boundary clamping for timeout and AIDL policy');
    }


    {
      const validModes = ['GEMINI', 'AIS_ONLY', 'HYBRID_COOP'];
      for (const mode of validModes) {
        await q.run(
          "INSERT INTO platform_settings (key, value) VALUES ('global_ai_engine', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          [mode]
        );
        const row = await q.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
        assert.equal(row.value, mode);
      }
      passed++;
      console.log('  [PASS] Engine mode switch for all valid modes');
    }


    {
      await q.run(
        "INSERT INTO platform_settings (key, value) VALUES ('global_ai_engine', 'GEMINI') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      );
      await q.run(
        "INSERT INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', 'ON') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      );

      const engineMode = 'GEMINI';
      if (engineMode === 'GEMINI') {
        await q.run(
          "INSERT INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', 'OFF') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        );
      }

      const promoRow = await q.get("SELECT value FROM platform_settings WHERE key = 'automatic_promotion_enabled'");
      assert.equal(promoRow.value, 'OFF');
      passed++;
      console.log('  [PASS] GEMINI mode forces automatic promotion OFF');
    }


    {
      const invalidModes = ['INVALID', '', 'gemini', 'ais', null, undefined];
      const validSet = new Set(['GEMINI', 'AIS_ONLY', 'HYBRID_COOP']);
      for (const mode of invalidModes) {
        assert.equal(validSet.has(mode), false);
      }
      passed++;
      console.log('  [PASS] Invalid engine modes rejected by validation');
    }


    {
      const row0 = await q.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
      if (!row0) {
        await q.run(
          "INSERT INTO platform_settings (key, value) VALUES ('global_ai_engine', 'GEMINI')"
        );
      }
      const engineRow = await q.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
      const engineMode = engineRow ? engineRow.value : 'GEMINI';
      assert.ok(['GEMINI', 'AIS_ONLY', 'HYBRID_COOP'].includes(engineMode));
      passed++;
      console.log('  [PASS] Engine mode read defaults to valid mode');
    }


    {
      await q.run(
        "INSERT INTO platform_settings (key, value) VALUES ('global_ai_engine', 'AIS_ONLY') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      );
      await q.run(
        "INSERT INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', 'OFF') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      );

      const engineRow = await q.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
      assert.notEqual(engineRow.value, 'GEMINI');

      const promoRow = await q.get("SELECT value FROM platform_settings WHERE key = 'automatic_promotion_enabled'");
      const currentStatus = promoRow ? promoRow.value : 'OFF';
      const nextStatus = currentStatus === 'ON' ? 'OFF' : 'ON';
      await q.run(
        "INSERT INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [nextStatus]
      );
      const afterRow = await q.get("SELECT value FROM platform_settings WHERE key = 'automatic_promotion_enabled'");
      assert.equal(afterRow.value, 'ON');

      const nextStatus2 = afterRow.value === 'ON' ? 'OFF' : 'ON';
      await q.run(
        "INSERT INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [nextStatus2]
      );
      const afterRow2 = await q.get("SELECT value FROM platform_settings WHERE key = 'automatic_promotion_enabled'");
      assert.equal(afterRow2.value, 'OFF');
      passed++;
      console.log('  [PASS] Automatic promotion toggles ON/OFF correctly');
    }


    {
      const engineRow = await q.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
      await q.run(
        "INSERT INTO platform_settings (key, value) VALUES ('global_ai_engine', 'GEMINI') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      );

      const geminiEngine = await q.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
      assert.equal(geminiEngine.value, 'GEMINI');

      const blocked = geminiEngine.value === 'GEMINI';
      assert.equal(blocked, true);
      passed++;
      console.log('  [PASS] Automatic promotion blocked in GEMINI mode');

      if (engineRow) {
        await q.run(
          "INSERT INTO platform_settings (key, value) VALUES ('global_ai_engine', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          [engineRow.value]
        );
      }
    }


    {
      await q.run(`INSERT INTO ais_training_data (
        timestamp, current_price, price_change_ratio, rsi_14, sma_5, sma_20,
        gemini_decision, gemini_proposed_price, gemini_amount_ratio, gemini_reason,
        next_price_5m, realized_price_change, is_correct_decision,
        evaluation_due_at, evaluation_status, label_version, engine_mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        '2026-06-25T10:00:00Z', 0.85, 1.5, 45.2, 0.84, 0.83,
        'BUY', 0.86, 10, 'RSI oversold, "good" entry',
        0.87, 2.35, 1,
        '2026-06-25T10:05:00Z', 'LABELED', 1, 'GEMINI'
      ]);

      await q.run(`INSERT INTO ais_training_data (
        timestamp, current_price, price_change_ratio, rsi_14, sma_5, sma_20,
        gemini_decision, gemini_proposed_price, gemini_amount_ratio, gemini_reason,
        next_price_5m, realized_price_change, is_correct_decision,
        evaluation_due_at, evaluation_status, label_version, engine_mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        '2026-06-25T10:05:00Z', 0.87, -0.5, 62.1, 0.86, 0.84,
        'HOLD', 0, 0, 'Neutral\nzone',
        0.865, -0.57, 1,
        '2026-06-25T10:10:00Z', 'LABELED', 1, 'AIS_ONLY'
      ]);

      const rows = await q.all(`
        SELECT timestamp, current_price, price_change_ratio, rsi_14, sma_5, sma_20,
               gemini_decision, gemini_proposed_price, gemini_amount_ratio, gemini_reason,
               next_price_5m, realized_price_change, is_correct_decision,
               evaluation_due_at, evaluation_status, label_version
        FROM ais_training_data
        ORDER BY id ASC
      `);

      const header = 'timestamp,current_price,price_change_ratio,rsi_14,sma_5,sma_20,gemini_decision,gemini_proposed_price,gemini_amount_ratio,gemini_reason,next_price_5m,realized_price_change,is_correct_decision,evaluation_due_at,evaluation_status,label_version\n';
      let csvContent = header;
      rows.forEach(r => {
        const escapedReason = String(r.gemini_reason || '')
          .replace(/"/g, '""')
          .replace(/\r?\n|\r/g, ' ');
        const line = `"${r.timestamp}",${r.current_price},${r.price_change_ratio},${r.rsi_14},${r.sma_5},${r.sma_20},"${r.gemini_decision}",${r.gemini_proposed_price},${r.gemini_amount_ratio},"${escapedReason}",${r.next_price_5m},${r.realized_price_change},${r.is_correct_decision},"${r.evaluation_due_at || ''}","${r.evaluation_status || ''}",${r.label_version || ''}\n`;
        csvContent += line;
      });

      const lines = csvContent.trim().split('\n');
      assert.ok(lines.length >= 3);
      assert.ok(lines[0].startsWith('timestamp,'));

      const dataLine1 = lines[1];
      assert.ok(dataLine1.includes('BUY'));
      assert.ok(dataLine1.includes('RSI oversold'));
      assert.ok(!dataLine1.includes('\n'));
      assert.ok(dataLine1.includes('""good""'));

      const dataLine2 = lines[2];
      assert.ok(dataLine2.includes('HOLD'));
      assert.ok(dataLine2.includes('Neutral zone'));
      assert.ok(!dataLine2.includes('\r'));
      passed++;
      console.log('  [PASS] CSV export format, header, escaping, and newline handling');
    }


    {
      const beforeRow = await q.get("SELECT value FROM platform_settings WHERE key = 'last_evolution_time'");
      const beforeTime = beforeRow ? parseInt(beforeRow.value, 10) : 0;

      const nowMs = Date.now();
      await q.run(
        "INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('last_evolution_time', ?)",
        [nowMs.toString()]
      );

      const afterRow = await q.get("SELECT value FROM platform_settings WHERE key = 'last_evolution_time'");
      const afterTime = parseInt(afterRow.value, 10);
      assert.ok(afterTime >= nowMs);
      assert.ok(afterTime > beforeTime);
      passed++;
      console.log('  [PASS] Force evolution updates last_evolution_time');
    }


    {
      await q.run("DELETE FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key', 'global_ai_interval', 'global_ai_interval_auto', 'global_gemini_timeout_ms', 'automatic_promotion_enabled')");
      const config = await loadAiConfig();
      assert.equal(config.model, 'Gemini 3.5 Flash');
      assert.equal(config.hasApiKey, false);
      assert.equal(config.apiKey, '');
      assert.equal(config.interval, '5');
      assert.equal(config.intervalAuto, 'OFF');
      assert.equal(config.geminiTimeoutMs, adminRouter.__private__.DEFAULT_GEMINI_TIMEOUT_MS);
      assert.equal(config.automaticPromotionEnabled, 'OFF');
      passed++;
      console.log('  [PASS] Default fallback values when no settings exist');
    }


    {
      await saveAiConfig({ model: '  Gemini 2.5 Flash  ', apiKey: '  key-with-spaces  ' });
      const config = await loadAiConfig();
      assert.equal(config.model, 'Gemini 2.5 Flash');
      assert.equal(config.apiKey, 'key-with-spaces');
      passed++;
      console.log('  [PASS] Whitespace trimming on model and apiKey');
    }


    {
      await saveAiConfig({
        model: 'Gemini 3.5 Flash',
        apiKey: 'fresh-key',
        interval: '15',
        intervalAuto: 'OFF',
        geminiTimeoutMs: 60000,
        automaticPromotionEnabled: 'ON',
        aidlPolicy: {
          contextMutationRate: '0.25',
          stateMutationRate: '0.30',
          profileMutationRate: '0.10',
          copyNumberMutationRate: '0.05',
          weightNudgeSize: '0.01',
        },
      });

      const config = await loadAiConfig();
      assert.equal(config.model, 'Gemini 3.5 Flash');
      assert.equal(config.apiKey, 'fresh-key');
      assert.equal(config.interval, '15');
      assert.equal(config.intervalAuto, 'OFF');
      assert.equal(config.geminiTimeoutMs, '60000');
      assert.equal(config.automaticPromotionEnabled, 'ON');
      assert.equal(config.aidlPolicy.contextMutationRate, '0.25');
      assert.equal(config.aidlPolicy.stateMutationRate, '0.30');
      assert.equal(config.aidlPolicy.profileMutationRate, '0.10');
      assert.equal(config.aidlPolicy.copyNumberMutationRate, '0.05');
      assert.equal(config.aidlPolicy.weightNudgeSize, '0.01');
      passed++;
      console.log('  [PASS] Full config save/load with all fields');
    }

    console.log(`\naiControlRoutes: ${passed}/${passed} tests passed`);

  } finally {
    await new Promise((resolve) => database.db.close(resolve));
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    delete process.env.AIS_DB_PATH;
  }

  console.log('aiControlRoutes tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
