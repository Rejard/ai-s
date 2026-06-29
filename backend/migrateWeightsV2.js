const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { FEATURE_COUNT } = require('./simulationEngine');

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

function padWeights(weights, targetLength) {
  if (!weights || typeof weights !== 'object') return null;
  const padded = {};
  for (const action of ['BUY', 'SELL', 'HOLD']) {
    const arr = Array.isArray(weights[action]) ? weights[action] : [];
    if (arr.length >= targetLength) {
      padded[action] = arr.slice(0, targetLength);
    } else {
      padded[action] = [...arr, ...new Array(targetLength - arr.length).fill(0)];
    }
  }
  return padded;
}

function padDnaWeights(dna, targetLength) {
  if (!dna || typeof dna !== 'object') return dna;
  if (dna.weights) {
    dna.weights = padWeights(dna.weights, targetLength);
  }
  if (Array.isArray(dna.strategy_genes)) {
    for (const gene of dna.strategy_genes) {
      if (!Array.isArray(gene.subgenes)) continue;
      for (const sub of gene.subgenes) {
        if (sub && typeof sub.feature_index === 'number' && sub.feature_index < targetLength) {
          continue;
        }
      }
    }
  }
  return dna;
}

async function migrate() {
  console.log(`[MIGRATION] Opening database: ${dbPath}`);
  console.log(`[MIGRATION] Target feature count: ${FEATURE_COUNT}`);

  const db = new sqlite3.Database(dbPath);

  try {
    const rows = await dbAll(db, `
      SELECT member_id, weights_json, dna_json
      FROM ais_council_members
    `);

    console.log(`[MIGRATION] Found ${rows.length} council members`);

    let migratedWeights = 0;
    let migratedDna = 0;
    let alreadyCorrect = 0;

    for (const row of rows) {
      let weightsUpdated = false;
      let dnaUpdated = false;

      if (row.weights_json) {
        try {
          const weights = JSON.parse(row.weights_json);
          const needsPadding = ['BUY', 'SELL', 'HOLD'].some(
            (action) => Array.isArray(weights[action]) && weights[action].length < FEATURE_COUNT
          );

          if (needsPadding) {
            const padded = padWeights(weights, FEATURE_COUNT);
            await dbRun(db,
              `UPDATE ais_council_members SET weights_json = ? WHERE member_id = ?`,
              [JSON.stringify(padded), row.member_id]
            );
            migratedWeights++;
            weightsUpdated = true;
          }
        } catch (e) {
          console.error(`[MIGRATION] Failed to parse weights for member ${row.member_id}:`, e.message);
        }
      }

      if (row.dna_json) {
        try {
          const dna = JSON.parse(row.dna_json);
          const needsPadding = dna.weights && ['BUY', 'SELL', 'HOLD'].some(
            (action) => Array.isArray(dna.weights[action]) && dna.weights[action].length < FEATURE_COUNT
          );

          if (needsPadding) {
            const paddedDna = padDnaWeights(dna, FEATURE_COUNT);
            await dbRun(db,
              `UPDATE ais_council_members SET dna_json = ? WHERE member_id = ?`,
              [JSON.stringify(paddedDna), row.member_id]
            );
            migratedDna++;
            dnaUpdated = true;
          }
        } catch (e) {
          console.error(`[MIGRATION] Failed to parse DNA for member ${row.member_id}:`, e.message);
        }
      }

      if (!weightsUpdated && !dnaUpdated) {
        alreadyCorrect++;
      }
    }

    console.log(`[MIGRATION] Complete!`);
    console.log(`  weights_json padded: ${migratedWeights}`);
    console.log(`  dna_json padded:     ${migratedDna}`);
    console.log(`  already correct:     ${alreadyCorrect}`);
  } finally {
    db.close();
  }
}

migrate().catch((err) => {
  console.error('[MIGRATION] Fatal error:', err);
  process.exit(1);
});
