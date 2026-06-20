const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
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
    CREATE TABLE ais_council_members (
      member_id TEXT PRIMARY KEY,
      dna_json TEXT,
      phenotype_json TEXT,
      generation INTEGER,
      status TEXT
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
  await store.run(`
    INSERT INTO ais_council_members (member_id, dna_json, phenotype_json, generation, status)
    VALUES (
      'm1',
      '{"genome_id":"g1","strategy_genes":[{"gene_id":"sg1","state":"A","subgenes":[{"state":"A"},{"state":"I"},{"state":"D"},{"state":"L"}]}],"lineage":{"parent_ids":[],"ancestor_ids":["seed"],"innovation_ids":[1]},"regulatory_profile":{"expression_budget":12,"dominance_bias":1,"decay_resistance":0.3,"reactivation_bias":0.1},"mutation_log":[],"generation":1}',
      '{"BUY":[0,0,0,0,0],"SELL":[0,0,0,0,0],"HOLD":[0,0,0,0,0]}',
      1,
      'ACTIVE'
    )
  `);
  await store.run(`
    INSERT INTO ais_council_members (member_id, dna_json, phenotype_json, generation, status)
    VALUES (
      'm2',
      '{"genome_id":"g2","strategy_genes":[{"gene_id":"sg2","state":"A","subgenes":[{"state":"A"},{"state":"A"}]}],"generation":1}',
      '{"BUY":[1,1,1,1,1],"SELL":[0,0,0,0,0],"HOLD":[0,0,0,0,0]}',
      1,
      'CANDIDATE'
    )
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
  assert.strictEqual(result.dnaStateTotalsAvailable, true);
  assert.deepStrictEqual(result.dnaStateTotals, {
    active: 2,
    inactive: 1,
    deprecated: 1,
    lethal: 1,
  });
  await verifyDatabaseDnaMigration();

  db.close();
  console.log('aisAdminStats tests passed');
}

async function verifyDatabaseDnaMigration() {
  const tempDbPath = path.join(os.tmpdir(), `ais-dna-migration-${process.pid}-${Date.now()}.db`);
  process.env.AIS_DB_PATH = tempDbPath;
  const database = require('./database');

  try {
    await database.initializeDatabase();
    const columns = await database.queries.all("PRAGMA table_info(ais_council_members)");
    const names = columns.map((column) => column.name);
    assert.ok(names.includes('dna_json'));
    assert.ok(names.includes('phenotype_json'));

    const seeded = await database.queries.get(`
      SELECT dna_json, phenotype_json
      FROM ais_council_members
      WHERE member_id = 'ais_member_01'
    `);
    assert.ok(seeded.dna_json);
    assert.ok(seeded.phenotype_json);
  } finally {
    await new Promise((resolve) => database.db.close(resolve));
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  }
}

main().catch((error) => {
  db.close();
  console.error(error);
  process.exitCode = 1;
});
