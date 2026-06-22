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
    INSERT INTO platform_settings (key, value)
    VALUES ('ais_selection_telemetry', '{"culledCount":12,"offspringCount":6,"mutantCount":6,"archiveCount":12}')
  `);
  await store.run(`
    INSERT INTO platform_settings (key, value)
    VALUES ('ais_runtime_repair_telemetry', '{"accessionRepairCount":4,"contextMaskRepairCount":3,"profileRepairCount":2,"lastRepairedAt":"2026-06-22 11:00:00"}')
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
      name TEXT,
      dna_json TEXT,
      phenotype_json TEXT,
      generation INTEGER,
      status TEXT
    )
  `);
  await store.run(`
    CREATE TABLE ais_genome_archive (
      id INTEGER PRIMARY KEY,
      member_id TEXT,
      genome_id TEXT,
      generation INTEGER,
      archive_reason TEXT,
      dna_json TEXT,
      archived_at TEXT
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
    INSERT INTO ais_council_members (member_id, name, dna_json, phenotype_json, generation, status)
    VALUES (
      'm1',
      'Active Alpha',
      '{"genome_id":"g1","strategy_genes":[{"gene_id":"sg1","state":"A","copy_number":3,"dominance":1.2,"context_mask":["BULL_EXPANSION","BLACK_SWAN"],"subgenes":[{"state":"A"},{"state":"I"},{"state":"D"},{"state":"L"}]}],"lineage":{"parent_ids":["g0"],"ancestor_ids":["seed"],"innovation_ids":[1]},"regulatory_profile":{"expression_budget":12,"dominance_bias":1,"decay_resistance":0.3,"reactivation_bias":0.1},"mutation_log":[{"event":"state_mutation"},{"event":"context_mask_mutation","context_key":"BLACK_SWAN","action":"added"},{"event":"context_mask_mutation","context_key":"BULL_EXPANSION","action":"removed"},{"event":"profile_mutation","profile_key":"decay_resistance","from_value":0.2,"to_value":0.3},{"event":"admin_state_override","gene_id":"sg1","from_state":"I","to_state":"A","pre_validation_score":46,"pre_holdout_score":44,"pre_run_key":"run-1"},{"event":"admin_context_override","gene_id":"sg1","context_key":"BLACK_SWAN","action":"added","from_mask":["BULL_EXPANSION"],"to_mask":["BULL_EXPANSION","BLACK_SWAN"],"pre_validation_score":47,"pre_holdout_score":45,"pre_run_key":"run-1"},{"event":"copy_number_mutation","from_value":2,"to_value":3}],"fitness_history":[{"validationScore":54.2,"holdoutScore":52.1,"runKey":"run-1"},{"validationScore":53.0,"holdoutScore":50.0,"runKey":"run-2"}],"generation":1}',
      '{"BUY":[0,0,0,0,0],"SELL":[0,0,0,0,0],"HOLD":[0,0,0,0,0]}',
      1,
      'ACTIVE'
    )
  `);
  await store.run(`
    INSERT INTO ais_genome_archive VALUES
      (1, 'm9', 'g9', 2, 'CULLED_LOW_PERFORMANCE', '{"strategy_genes":[{"context_mask":["BLACK_SWAN"],"copy_number":2,"dominance":1.1}],"lineage":{"parent_ids":["g7","g8"],"ancestor_ids":["seed"],"innovation_ids":[1]},"regulatory_profile":{"expression_budget":10,"dominance_bias":0.9},"mutation_log":[{"event":"admin_context_override","gene_id":"sg9","context_key":"BLACK_SWAN","action":"added","pre_validation_score":43,"pre_holdout_score":40,"pre_run_key":"run-2"},{"event":"vep_filtered_deleterious_mutation"}],"fitness_history":[{"validationScore":43.0,"holdoutScore":40.0,"runKey":"run-2"},{"validationScore":41.5,"holdoutScore":39.2,"runKey":"run-3"}]}', '2026-06-22 09:00:00'),
      (2, 'm10', 'g10', 3, 'CULLED_LOW_PERFORMANCE', '{"strategy_genes":[{"copy_number":1,"dominance":1.0}],"lineage":{"parent_ids":["g6"],"ancestor_ids":["seed"],"innovation_ids":[1]},"regulatory_profile":{"expression_budget":11,"dominance_bias":1.05},"mutation_log":[{"event":"admin_state_override","gene_id":"sg10","from_state":"I","to_state":"A","pre_validation_score":46,"pre_holdout_score":44,"pre_run_key":"run-3"},{"event":"state_mutation"},{"event":"weight_nudge"}],"fitness_history":[{"validationScore":46.0,"holdoutScore":44.0,"runKey":"run-3"},{"validationScore":47.8,"holdoutScore":45.1,"runKey":"run-4"}]}', '2026-06-22 10:00:00')
  `);
  await store.run(`
    INSERT INTO ais_council_members (member_id, name, dna_json, phenotype_json, generation, status)
    VALUES (
      'm2',
      'Candidate Beta',
      '{"genome_id":"g2","strategy_genes":[{"gene_id":"sg2","state":"A","subgenes":[{"state":"A"},{"state":"A"}]}],"generation":1}',
      '{"BUY":[1,1,1,1,1],"SELL":[0,0,0,0,0],"HOLD":[0,0,0,0,0]}',
      1,
      'CANDIDATE'
    )
  `);
  await store.run(`
    INSERT INTO ais_council_members (member_id, name, dna_json, phenotype_json, generation, status)
    VALUES (
      'm3',
      'Inherited Gamma',
      '{"genome_id":"g3","strategy_genes":[{"gene_id":"sg3","state":"A","copy_number":1,"dominance":1.0,"context_mask":["BULL_EXPANSION"],"subgenes":[{"state":"A"}]}],"lineage":{"parent_ids":["g1"],"ancestor_ids":["seed","g1"],"innovation_ids":[1,2]},"regulatory_profile":{"expression_budget":12,"dominance_bias":1,"decay_resistance":0.3,"reactivation_bias":0.1},"mutation_log":[{"event":"state_mutation"}],"fitness_history":[{"validationScore":52.4,"holdoutScore":49.6,"runKey":"run-5"}],"generation":2}',
      '{"BUY":[0,0,0,0,0],"SELL":[0,0,0,0,0],"HOLD":[0,0,0,0,0]}',
      2,
      'ACTIVE'
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
    active: 4,
    inactive: 1,
    deprecated: 1,
    lethal: 1,
  });
  assert.deepStrictEqual(result.dnaMutationTotals, {
    stateMutation: 2,
    contextMaskMutation: 2,
    contextMutationDetail: {
      blackSwanAdded: 1,
      blackSwanRemoved: 0,
      coreAdded: 0,
      coreRemoved: 1,
    },
    profileMutation: 1,
    profileMutationByKey: {
      expressionBudget: 0,
      dominanceBias: 0,
      decayResistance: 1,
      reactivationBias: 0,
    },
    copyNumberMutation: 1,
    copyNumberDirection: {
      up: 1,
      down: 0,
      flat: 0,
    },
    weightNudge: 0,
    vepFiltered: 0,
  });
  assert.deepStrictEqual(result.selectionTelemetry, {
    culledCount: 12,
    offspringCount: 6,
    mutantCount: 6,
    archiveCount: 12,
  });
  assert.deepStrictEqual(result.dnaOperations, {
    archiveCount: 2,
    averageFitnessHistoryDepth: 1.5,
    latestArchivedAt: '2026-06-22 10:00:00',
  });
  assert.deepStrictEqual(result.dnaRepairTelemetry, {
    accessionRepairCount: 4,
    contextMaskRepairCount: 3,
    profileRepairCount: 2,
    lastRepairedAt: '2026-06-22 11:00:00',
  });
  assert.deepStrictEqual(result.dnaContextSummary, {
    blackSwanStrategyGenes: 1,
    blackSwanActiveGenomes: 1,
    blackSwanArchivedGenomes: 1,
  });
  assert.deepStrictEqual(result.dnaContextPerformance, {
    blackSwanActive: {
      genomeCount: 1,
      averageLatestValidationScore: 53,
      averageLatestHoldoutScore: 50,
      averageMutationEvents: 7,
    },
    coreActive: {
      genomeCount: 1,
      averageLatestValidationScore: 52.4,
      averageLatestHoldoutScore: 49.6,
      averageMutationEvents: 1,
    },
    blackSwanArchive: {
      archiveCount: 1,
      averageGeneration: 2,
      lowPerformanceCount: 1,
      vepFilteredCount: 1,
    },
    coreArchive: {
      archiveCount: 1,
      averageGeneration: 3,
      lowPerformanceCount: 1,
      vepFilteredCount: 0,
    },
  });
  assert.deepStrictEqual(result.dnaContextPathway, {
    blackSwanActive: {
      genomeCount: 1,
      vepFilteredGenomes: 0,
      lastMutationEventCounts: {
        copy_number_mutation: 1,
      },
    },
    coreActive: {
      genomeCount: 1,
      vepFilteredGenomes: 0,
      lastMutationEventCounts: {
        state_mutation: 1,
      },
    },
    blackSwanArchive: {
      archiveCount: 1,
      lowPerformanceCount: 1,
      vepFilteredCount: 1,
      lastMutationEventCounts: {
        vep_filtered_deleterious_mutation: 1,
      },
    },
    coreArchive: {
      archiveCount: 1,
      lowPerformanceCount: 1,
      vepFilteredCount: 0,
      lastMutationEventCounts: {
        weight_nudge: 1,
      },
    },
  });
  assert.deepStrictEqual(result.dnaAdminOverrideTelemetry, {
    stateOverrideCount: 1,
    contextOverrideCount: 1,
    recentEvent: {
      event: 'admin_context_override',
      geneId: 'sg1',
      contextKey: 'BLACK_SWAN',
      action: 'added',
    },
    targetGeneCounts: {
      sg1: 2,
    },
  });
  assert.deepStrictEqual(result.dnaAdminOverrideOutcome, {
    stateOverrideActive: {
      genomeCount: 1,
      averageLatestValidationScore: 53,
      averageLatestHoldoutScore: 50,
    },
    contextOverrideActive: {
      genomeCount: 1,
      averageLatestValidationScore: 53,
      averageLatestHoldoutScore: 50,
    },
    stateOverrideArchive: {
      archiveCount: 1,
      lowPerformanceCount: 1,
      averageLatestValidationScore: 47.8,
      averageLatestHoldoutScore: 45.1,
    },
    contextOverrideArchive: {
      archiveCount: 1,
      lowPerformanceCount: 1,
      averageLatestValidationScore: 41.5,
      averageLatestHoldoutScore: 39.2,
    },
  });
  assert.deepStrictEqual(result.dnaAdminOverrideDelta, {
    stateOverrideDelta: {
      overrideCount: 2,
      averageValidationDelta: 4.4,
      averageHoldoutDelta: 3.55,
    },
    contextOverrideDelta: {
      overrideCount: 2,
      averageValidationDelta: 2.25,
      averageHoldoutDelta: 2.1,
    },
  });
  assert.deepStrictEqual(result.dnaOverrideLineageAttribution, {
    activeInheritedStateCount: 1,
    activeInheritedContextCount: 1,
    archivedInheritedStateCount: 0,
    archivedInheritedContextCount: 0,
  });
  assert.deepStrictEqual(result.dnaAdminOverrideTimeline, {
    stateOverrideRuns: [
      { runKey: 'run-2', genomeCount: 1, averageValidationScore: 53, averageHoldoutScore: 50 },
      { runKey: 'run-4', genomeCount: 1, averageValidationScore: 47.8, averageHoldoutScore: 45.1 },
    ],
    contextOverrideRuns: [
      { runKey: 'run-2', genomeCount: 1, averageValidationScore: 53, averageHoldoutScore: 50 },
      { runKey: 'run-3', genomeCount: 1, averageValidationScore: 41.5, averageHoldoutScore: 39.2 },
    ],
  });
  assert.deepStrictEqual(result.dnaLineage.activeGenomes, [
    {
      memberId: 'm1',
      name: 'Active Alpha',
      genomeId: 'g1',
      generation: 1,
      parentIds: ['g0'],
      ancestorCount: 1,
      mutationEvents: 7,
      lastMutationEvent: 'copy_number_mutation',
      stateSummary: { active: 2, inactive: 1, deprecated: 1, lethal: 1 },
      contextMaskSummary: ['BLACK_SWAN', 'BULL_EXPANSION'],
      expressionBudget: 12,
      dominanceBias: 1,
      decayResistance: 0.3,
      reactivationBias: 0.1,
      averageCopyNumber: 3,
      maxCopyNumber: 3,
      blackSwanEnabled: true,
      inheritedStateOverride: false,
      inheritedContextOverride: false,
    },
    {
      memberId: 'm3',
      name: 'Inherited Gamma',
      genomeId: 'g3',
      generation: 2,
      parentIds: ['g1'],
      ancestorCount: 2,
      mutationEvents: 1,
      lastMutationEvent: 'state_mutation',
      stateSummary: { active: 2, inactive: 0, deprecated: 0, lethal: 0 },
      contextMaskSummary: ['BULL_EXPANSION'],
      expressionBudget: 12,
      dominanceBias: 1,
      decayResistance: 0.3,
      reactivationBias: 0.1,
      averageCopyNumber: 1,
      maxCopyNumber: 1,
      blackSwanEnabled: false,
      inheritedStateOverride: true,
      inheritedContextOverride: true,
    },
  ]);
  assert.deepStrictEqual(result.dnaLineage.recentArchives, [
    {
      memberId: 'm10',
      genomeId: 'g10',
      generation: 3,
      archiveReason: 'CULLED_LOW_PERFORMANCE',
      archivedAt: '2026-06-22 10:00:00',
      parentIds: ['g6'],
      mutationEvents: 3,
      lastMutationEvent: 'weight_nudge',
      contextMaskSummary: [],
      expressionBudget: 11,
      dominanceBias: 1.05,
      decayResistance: 0,
      reactivationBias: 0,
      averageCopyNumber: 1,
      maxCopyNumber: 1,
      blackSwanEnabled: false,
      inheritedStateOverride: false,
      inheritedContextOverride: false,
    },
    {
      memberId: 'm9',
      genomeId: 'g9',
      generation: 2,
      archiveReason: 'CULLED_LOW_PERFORMANCE',
      archivedAt: '2026-06-22 09:00:00',
      parentIds: ['g7', 'g8'],
      mutationEvents: 2,
      lastMutationEvent: 'vep_filtered_deleterious_mutation',
      contextMaskSummary: ['BLACK_SWAN'],
      expressionBudget: 10,
      dominanceBias: 0.9,
      decayResistance: 0,
      reactivationBias: 0,
      averageCopyNumber: 2,
      maxCopyNumber: 2,
      blackSwanEnabled: true,
      inheritedStateOverride: false,
      inheritedContextOverride: false,
    },
  ]);
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

