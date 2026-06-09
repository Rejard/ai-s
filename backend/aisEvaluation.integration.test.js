const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const {
  migrateAisEvaluationSchema,
  labelDueTrainingRows,
} = require('./aisEvaluation');

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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      current_price REAL NOT NULL,
      price_change_ratio REAL NOT NULL,
      rsi_14 REAL NOT NULL,
      sma_5 REAL NOT NULL,
      sma_20 REAL NOT NULL,
      gemini_decision TEXT NOT NULL,
      gemini_proposed_price REAL NOT NULL,
      gemini_amount_ratio REAL NOT NULL,
      gemini_reason TEXT,
      next_price_5m REAL DEFAULT 0.0,
      realized_price_change REAL DEFAULT 0.0,
      is_correct_decision INTEGER DEFAULT -1
    )
  `);
  await store.run(`
    INSERT INTO ais_training_data
      (timestamp, current_price, price_change_ratio, rsi_14, sma_5, sma_20,
       gemini_decision, gemini_proposed_price, gemini_amount_ratio,
       next_price_5m, realized_price_change, is_correct_decision)
    VALUES
      ('2026-06-09 12:00:00', 100, 0, 50, 100, 100, 'BUY', 100, 0.1, 100, 0, 0),
      ('2026-06-09 12:00:00', 100, 0, 50, 100, 100, 'BUY', 100, 0.1, 101, 1, 1),
      ('2026-06-09 12:00:00', 100, 0, 50, 100, 100, 'BUY', 100, 0.1, 0, 0, -1)
  `);

  await migrateAisEvaluationSchema(db);
  await migrateAisEvaluationSchema(db);

  const columns = await store.all('PRAGMA table_info(ais_training_data)');
  assert.strictEqual(columns.filter((column) => column.name === 'evaluation_due_at').length, 1);
  assert.strictEqual(columns.filter((column) => column.name === 'evaluation_status').length, 1);
  assert.strictEqual(columns.filter((column) => column.name === 'label_version').length, 1);

  const migratedRows = await store.all(`
    SELECT id, evaluation_due_at, evaluation_status, label_version
    FROM ais_training_data
    ORDER BY id
  `);
  assert.deepStrictEqual(
    migratedRows.map((row) => row.evaluation_status),
    ['INVALID', 'LABELED', 'PENDING']
  );
  assert.strictEqual(migratedRows[0].label_version, 1);
  assert.strictEqual(migratedRows[2].evaluation_due_at, '2026-06-09 12:05:00');

  await store.run(`
    INSERT INTO ais_training_data
      (timestamp, current_price, price_change_ratio, rsi_14, sma_5, sma_20,
       gemini_decision, gemini_proposed_price, gemini_amount_ratio,
       evaluation_due_at, evaluation_status, label_version)
    VALUES
      ('2026-06-09 12:05:00', 101, 1, 60, 100.5, 100.2, 'SELL', 101, 0.1,
       '2026-06-09 12:10:00', 'PENDING', 2)
  `);

  const beforeDue = await labelDueTrainingRows(
    store,
    '2026-06-09 12:04:59',
    101
  );
  assert.strictEqual(beforeDue.labeled, 0);

  const atDue = await labelDueTrainingRows(
    store,
    '2026-06-09 12:05:00',
    101
  );
  assert.strictEqual(atDue.labeled, 1);

  const finalRows = await store.all(`
    SELECT id, evaluation_status, next_price_5m
    FROM ais_training_data
    ORDER BY id
  `);
  assert.strictEqual(finalRows[2].evaluation_status, 'LABELED');
  assert.strictEqual(finalRows[2].next_price_5m, 101);
  assert.strictEqual(finalRows[3].evaluation_status, 'PENDING');
  assert.strictEqual(finalRows[3].next_price_5m, 0);

  db.close();
  console.log('aisEvaluation integration tests passed');
}

main().catch((error) => {
  db.close();
  console.error(error);
  process.exitCode = 1;
});
