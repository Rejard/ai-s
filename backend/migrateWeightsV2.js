const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const AIDL_FEATURE_ORDER = [
  'price_change_pct',
  'rsi_scaled',
  'sma20_deviation',
  'volume_ratio',
  'volatility',
  'macd_histogram',
  'bollinger_pct_b',
  'atr_ratio',
  'ema_crossover',
  'obv_change',
];
const AIDL_ACTIONS = ['BUY', 'SELL', 'HOLD'];
const TARGET_LENGTH = AIDL_FEATURE_ORDER.length;

const PRESERVED_FEATURES = ['price_change_pct', 'rsi_scaled'];

const defaultDbName = process.env.NODE_ENV === 'development' ? 'platform_dev.db' : 'platform.db';
const dbPath = process.env.AIS_DB_PATH
  ? path.resolve(process.env.AIS_DB_PATH)
  : path.resolve(__dirname, defaultDbName);

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

function dbExec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function remapWeightVector(oldWeights, oldFeatures) {
  const remapped = {};
  const oldFeatureMap = {};
  for (let i = 0; i < oldFeatures.length; i++) {
    oldFeatureMap[oldFeatures[i]] = i;
  }

  for (const action of AIDL_ACTIONS) {
    const oldArr = Array.isArray(oldWeights[action]) ? oldWeights[action] : [];
    const newArr = new Array(TARGET_LENGTH).fill(0);

    for (let i = 0; i < AIDL_FEATURE_ORDER.length; i++) {
      const feature = AIDL_FEATURE_ORDER[i];
      if (PRESERVED_FEATURES.includes(feature) && oldFeatureMap[feature] !== undefined) {
        const oldIdx = oldFeatureMap[feature];
        if (oldIdx < oldArr.length) {
          newArr[i] = oldArr[oldIdx];
        }
      }
    }

    remapped[action] = newArr;
  }
  return remapped;
}

function detectOldFeatures(dna) {
  if (!dna || !Array.isArray(dna.strategy_genes) || !dna.strategy_genes[0]) {
    return null;
  }
  const subgenes = dna.strategy_genes[0].subgenes;
  if (!Array.isArray(subgenes) || subgenes.length === 0) return null;

  const features = [];
  for (const sub of subgenes) {
    if (sub.action === 'BUY' && sub.feature) {
      features.push(sub.feature);
    }
  }
  return features;
}

function remapDna(dna, memberId) {
  const remapped = JSON.parse(JSON.stringify(dna));

  if (!Array.isArray(remapped.strategy_genes) || !remapped.strategy_genes[0]) {
    return remapped;
  }

  const gene = remapped.strategy_genes[0];
  const oldSubgenes = gene.subgenes || [];

  const oldSubgeneMap = {};
  for (const sub of oldSubgenes) {
    const key = sub.action + '::' + sub.feature;
    oldSubgeneMap[key] = sub;
  }

  const newSubgenes = [];
  let innovationId = 2;

  for (const action of AIDL_ACTIONS) {
    for (let i = 0; i < AIDL_FEATURE_ORDER.length; i++) {
      const feature = AIDL_FEATURE_ORDER[i];
      const key = action + '::' + feature;
      const existing = oldSubgeneMap[key];

      if (existing && PRESERVED_FEATURES.includes(feature)) {
        newSubgenes.push({
          gene_id: memberId + '_' + action + '_' + feature,
          innovation_id: innovationId,
          state: existing.state || 'A',
          feature: feature,
          action: action,
          weight: existing.weight,
          threshold: existing.threshold || 0,
          priority: existing.priority || 1,
        });
      } else {
        newSubgenes.push({
          gene_id: memberId + '_' + action + '_' + feature,
          innovation_id: innovationId,
          state: 'A',
          feature: feature,
          action: action,
          weight: 0,
          threshold: 0,
          priority: 1,
        });
      }
      innovationId++;
    }
  }

  gene.subgenes = newSubgenes;
  gene.length = TARGET_LENGTH;

  remapped.lineage = remapped.lineage || {};
  remapped.lineage.innovation_ids = Array.from(
    { length: innovationId - 1 },
    (_, idx) => idx + 1
  );

  return remapped;
}

async function migrate() {
  console.log('[MIGRATION] Target: ' + dbPath);
  console.log('[MIGRATION] Feature count: ' + TARGET_LENGTH);
  console.log('[MIGRATION] Features: ' + AIDL_FEATURE_ORDER.join(', '));

  if (!fs.existsSync(dbPath)) {
    console.error('[MIGRATION] Database file not found: ' + dbPath);
    process.exit(1);
  }

  const backupPath = dbPath.replace(/\.db$/, '.db.before-vector-repair-v2');
  if (!fs.existsSync(backupPath)) {
    console.log('[MIGRATION] Creating backup: ' + backupPath);
    fs.copyFileSync(dbPath, backupPath);
  } else {
    console.log('[MIGRATION] Backup already exists: ' + backupPath);
  }

  const db = new sqlite3.Database(dbPath);

  try {
    await dbExec(db, 'BEGIN TRANSACTION');

    const rows = await dbAll(db,
      'SELECT member_id, weights_json, phenotype_json, dna_json FROM ais_council_members'
    );
    console.log('[MIGRATION] Found ' + rows.length + ' council members');

    let migratedWeights = 0;
    let migratedPhenotype = 0;
    let migratedDna = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const weights = row.weights_json ? JSON.parse(row.weights_json) : null;
        const phenotype = row.phenotype_json ? JSON.parse(row.phenotype_json) : null;
        const dna = row.dna_json ? JSON.parse(row.dna_json) : null;

        if (!weights || !weights.BUY) {
          skipped++;
          continue;
        }

        const alreadyMigrated = weights.BUY.length === TARGET_LENGTH;
        if (alreadyMigrated) {
          skipped++;
          continue;
        }

        const oldFeatures = detectOldFeatures(dna) || [
          'price_change_pct', 'rsi_scaled',
          'sma5_distance_pct', 'sma20_distance_pct', 'sma5_to_sma20_spread_pct'
        ];

        const newWeights = remapWeightVector(weights, oldFeatures);
        const newPhenotype = phenotype
          ? remapWeightVector(phenotype, oldFeatures)
          : newWeights;
        const newDna = dna
          ? remapDna(dna, row.member_id)
          : null;

        await dbRun(db,
          'UPDATE ais_council_members SET weights_json = ?, phenotype_json = ?, dna_json = ? WHERE member_id = ?',
          [
            JSON.stringify(newWeights),
            JSON.stringify(newPhenotype),
            newDna ? JSON.stringify(newDna) : row.dna_json,
            row.member_id,
          ]
        );

        migratedWeights++;
        migratedPhenotype++;
        if (newDna) migratedDna++;
      } catch (e) {
        console.error('[MIGRATION] Error for ' + row.member_id + ': ' + e.message);
        errors++;
      }
    }

    if (errors > 0) {
      await dbExec(db, 'ROLLBACK');
      console.error('[MIGRATION] ROLLED BACK due to ' + errors + ' errors');
      process.exit(1);
    }

    await dbExec(db, 'COMMIT');

    console.log('[MIGRATION] Complete!');
    console.log('  weights_json migrated:   ' + migratedWeights);
    console.log('  phenotype_json migrated: ' + migratedPhenotype);
    console.log('  dna_json migrated:       ' + migratedDna);
    console.log('  skipped (already ok):    ' + skipped);

    console.log('\n[VERIFICATION] Scanning all rows...');
    const verify = await dbAll(db,
      'SELECT member_id, weights_json, phenotype_json, dna_json FROM ais_council_members'
    );
    let ok = 0;
    let bad = 0;
    for (const v of verify) {
      try {
        const w = JSON.parse(v.weights_json);
        const p = JSON.parse(v.phenotype_json);
        const d = v.dna_json ? JSON.parse(v.dna_json) : null;

        let rowOk = true;
        for (const action of AIDL_ACTIONS) {
          if (!w[action] || w[action].length !== TARGET_LENGTH) rowOk = false;
          if (!p[action] || p[action].length !== TARGET_LENGTH) rowOk = false;
        }
        if (d && d.strategy_genes && d.strategy_genes[0]) {
          if (d.strategy_genes[0].length !== TARGET_LENGTH) rowOk = false;
          if (d.strategy_genes[0].subgenes.length !== AIDL_ACTIONS.length * TARGET_LENGTH) rowOk = false;
        }

        if (rowOk) ok++;
        else {
          bad++;
          console.error('[VERIFY] BAD: ' + v.member_id);
        }
      } catch (e) {
        bad++;
        console.error('[VERIFY] PARSE ERROR: ' + v.member_id + ' - ' + e.message);
      }
    }
    console.log('[VERIFICATION] OK=' + ok + '  BAD=' + bad + '  TOTAL=' + verify.length);
    if (bad > 0) {
      console.error('[VERIFICATION] WARNING: Some rows failed verification!');
      process.exit(1);
    }
  } finally {
    db.close();
  }
}

migrate().catch((err) => {
  console.error('[MIGRATION] Fatal error:', err);
  process.exit(1);
});
