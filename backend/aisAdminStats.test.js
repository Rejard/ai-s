const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const { getAisTrainingStats } = require('./aisAdminStats');

const db = new sqlite3.Database(':memory:');
const store = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function onRun(error) {
        if (error) reject(error);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (error, row) => {
        if (error) reject(error);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
  },
};

async function main() {
  await store.run(`
    CREATE TABLE ais_training_data (
      id INTEGER PRIMARY KEY,
      gemini_decision TEXT,
      is_correct_decision INTEGER,
      evaluation_status TEXT,
      label_version INTEGER
    )
  `);
  await store.run(`
    CREATE TABLE platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await store.run(`
    INSERT INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', 'OFF')
  `);
  await store.run(`
    CREATE TABLE ais_model_runs (
      id INTEGER PRIMARY KEY,
      run_key TEXT,
      status TEXT,
      dataset_count INTEGER,
      train_count INTEGER,
      validation_count INTEGER,
      holdout_count INTEGER,
      validation_score REAL,
      holdout_score REAL,
      benchmark_score REAL,
      generation INTEGER,
      promotion_eligible INTEGER,
      promotion_reasons TEXT,
      error_message TEXT,
      created_at TEXT,
      completed_at TEXT
    )
  `);
  await store.run(`
    INSERT INTO ais_training_data VALUES
      (1, 'BUY', 1, 'LABELED', 2),
      (2, 'BUY', 0, 'LABELED', 2),
      (3, 'SELL', -1, 'PENDING', 2),
      (4, 'HOLD', 1, 'INVALID', 1)
  `);
  await store.run(`
    INSERT INTO ais_model_runs VALUES
      (1, 'run-1', 'SHADOW_CHALLENGER', 100, 60, 20, 20,
       55, 54, 50, 3, 0, '["MIN_LABELED_OBSERVATIONS"]',
       NULL, '2026-06-09 12:00:00', '2026-06-09 12:01:00')
  `);

  const result = await getAisTrainingStats(store);
  assert.strictEqual(result.total, 4);
  assert.strictEqual(result.labeled, 2);
  assert.strictEqual(result.pending, 1);
  assert.strictEqual(result.invalid, 1);
  assert.deepStrictEqual(result.byDecision.BUY, { count: 2, correct: 1, accuracy: 50 });
  assert.deepStrictEqual(result.byDecision.SELL, { count: 0, correct: 0, accuracy: 0 });
  assert.strictEqual(result.latestRun.holdoutScore, 54);
  assert.deepStrictEqual(result.latestRun.promotionReasons, ['MIN_LABELED_OBSERVATIONS']);
  assert.strictEqual(result.shadowOnly, true);
  assert.strictEqual(result.automaticPromotionEnabled, false);

  db.close();
  console.log('aisAdminStats tests passed');
}

main().catch((error) => {
  db.close();
  console.error(error);
  process.exitCode = 1;
});
