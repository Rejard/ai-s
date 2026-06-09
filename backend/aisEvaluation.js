const LABEL_VERSION = 2;
const MOVEMENT_THRESHOLD_PERCENT = 0.2;
const MIN_LABELED_OBSERVATIONS = 300;
const MIN_BENCHMARK_MARGIN = 3;
const MIN_CLASS_OBSERVATIONS = 10;
const COMPARISON_EPSILON = 1e-9;

const normalizeSqliteTimestamp = (value) => String(value || '')
  .trim()
  .replace('T', ' ')
  .replace(/\.\d{3}Z$/, '')
  .replace(/Z$/, '')
  .slice(0, 19);

function toKstSqliteTimestamp(date = new Date()) {
  const instant = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(instant.getTime())) {
    throw new Error('A valid date is required.');
  }
  return new Date(instant.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
}

function addMinutesToSqliteTimestamp(timestamp, minutes) {
  const normalized = normalizeSqliteTimestamp(timestamp);
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
  );
  if (!match || !Number.isFinite(Number(minutes))) {
    throw new Error('A valid SQLite timestamp and minute count are required.');
  }
  const [, year, month, day, hour, minute, second] = match;
  const shifted = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute) + Number(minutes),
    Number(second)
  ));
  return shifted.toISOString().replace('T', ' ').slice(0, 19);
}

function isEvaluationDue(evaluationDueAt, observedAt) {
  const due = normalizeSqliteTimestamp(evaluationDueAt);
  const observed = normalizeSqliteTimestamp(observedAt);
  return Boolean(due && observed && observed >= due);
}

function evaluateDecision({ decision, currentPrice, futurePrice }) {
  const start = Number(currentPrice);
  const end = Number(futurePrice);
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(end) || end <= 0) {
    throw new Error('Valid positive current and future prices are required.');
  }

  const realizedChange = ((end - start) / start) * 100;
  const normalizedDecision = String(decision || '').trim().toUpperCase();
  if (!['BUY', 'SELL', 'HOLD'].includes(normalizedDecision)) {
    throw new Error(`Unsupported AiS decision: ${decision}`);
  }

  const correct = normalizedDecision === 'BUY'
    ? realizedChange > MOVEMENT_THRESHOLD_PERCENT + COMPARISON_EPSILON
    : normalizedDecision === 'SELL'
      ? realizedChange < -MOVEMENT_THRESHOLD_PERCENT - COMPARISON_EPSILON
      : Math.abs(realizedChange) <= MOVEMENT_THRESHOLD_PERCENT + COMPARISON_EPSILON;

  return {
    realizedChange,
    correct: correct ? 1 : 0,
  };
}

function isLegacyContaminated({ currentPrice, futurePrice, labelVersion }) {
  const start = Number(currentPrice);
  const end = Number(futurePrice);
  return Number(labelVersion) === 1
    && Number.isFinite(start)
    && Number.isFinite(end)
    && Math.abs(start - end) < 1e-10;
}

function assessPromotionEligibility({
  labeledCount,
  invalidCount,
  holdoutScore,
  benchmarkScore,
  classCounts = {},
}) {
  const reasons = [];
  if (Number(labeledCount) < MIN_LABELED_OBSERVATIONS) {
    reasons.push('MIN_LABELED_OBSERVATIONS');
  }
  if (Number(invalidCount) > 0) {
    reasons.push('LABEL_INTEGRITY_FAILURE');
  }
  if (Number(holdoutScore) - Number(benchmarkScore) < MIN_BENCHMARK_MARGIN) {
    reasons.push('MIN_BENCHMARK_MARGIN');
  }
  if (['BUY', 'SELL', 'HOLD'].some(
    (decision) => Number(classCounts[decision] || 0) < MIN_CLASS_OBSERVATIONS
  )) {
    reasons.push('MIN_CLASS_COVERAGE');
  }
  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

const sqliteRun = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(error) {
    if (error) reject(error);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const sqliteAll = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => {
    if (error) reject(error);
    else resolve(rows);
  });
});

async function migrateAisEvaluationSchema(db) {
  const columns = await sqliteAll(db, 'PRAGMA table_info(ais_training_data)');
  const names = new Set(columns.map((column) => column.name));
  const legacySchema = !names.has('label_version');

  if (!names.has('evaluation_due_at')) {
    await sqliteRun(db, 'ALTER TABLE ais_training_data ADD COLUMN evaluation_due_at TEXT');
  }
  if (!names.has('evaluation_status')) {
    await sqliteRun(
      db,
      "ALTER TABLE ais_training_data ADD COLUMN evaluation_status TEXT DEFAULT 'PENDING'"
    );
  }
  if (!names.has('label_version')) {
    await sqliteRun(
      db,
      `ALTER TABLE ais_training_data ADD COLUMN label_version INTEGER DEFAULT ${LABEL_VERSION}`
    );
  }

  await sqliteRun(db, `
    CREATE TABLE IF NOT EXISTS ais_model_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_key TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      dataset_count INTEGER NOT NULL DEFAULT 0,
      train_count INTEGER NOT NULL DEFAULT 0,
      validation_count INTEGER NOT NULL DEFAULT 0,
      holdout_count INTEGER NOT NULL DEFAULT 0,
      validation_score REAL NOT NULL DEFAULT 0,
      holdout_score REAL NOT NULL DEFAULT 0,
      benchmark_score REAL NOT NULL DEFAULT 0,
      generation INTEGER NOT NULL DEFAULT 1,
      promotion_eligible INTEGER NOT NULL DEFAULT 0,
      promotion_reasons TEXT NOT NULL DEFAULT '[]',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  if (legacySchema) {
    await sqliteRun(db, `
      UPDATE ais_training_data
      SET evaluation_status = 'INVALID',
          label_version = 1
      WHERE next_price_5m > 0
        AND ABS(next_price_5m - current_price) < 0.0000000001
    `);
    await sqliteRun(db, `
      UPDATE ais_training_data
      SET evaluation_status = 'LABELED',
          label_version = 1
      WHERE next_price_5m > 0
        AND evaluation_status != 'INVALID'
    `);
    await sqliteRun(db, `
      UPDATE ais_training_data
      SET evaluation_due_at = datetime(timestamp, '+5 minutes'),
          evaluation_status = 'PENDING',
          label_version = ${LABEL_VERSION}
      WHERE next_price_5m <= 0
    `);
  }

  await sqliteRun(
    db,
    'CREATE INDEX IF NOT EXISTS IDX_AIS_TRAINING_EVALUATION ON ais_training_data(evaluation_status, evaluation_due_at)'
  );
}

async function labelDueTrainingRows(store, observedAt, observedPrice) {
  const normalizedObservedAt = normalizeSqliteTimestamp(observedAt);
  const price = Number(observedPrice);
  if (!normalizedObservedAt || !Number.isFinite(price) || price <= 0) {
    throw new Error('A valid observation time and price are required.');
  }

  const dueRows = await store.all(`
    SELECT id, current_price, gemini_decision
    FROM ais_training_data
    WHERE evaluation_status = 'PENDING'
      AND evaluation_due_at IS NOT NULL
      AND evaluation_due_at <= ?
    ORDER BY evaluation_due_at ASC, id ASC
  `, [normalizedObservedAt]);

  let labeled = 0;
  for (const row of dueRows) {
    const result = evaluateDecision({
      decision: row.gemini_decision,
      currentPrice: row.current_price,
      futurePrice: price,
    });
    const update = await store.run(`
      UPDATE ais_training_data
      SET next_price_5m = ?,
          realized_price_change = ?,
          is_correct_decision = ?,
          evaluation_status = 'LABELED',
          label_version = ?
      WHERE id = ?
        AND evaluation_status = 'PENDING'
    `, [
      price,
      Number(result.realizedChange.toFixed(6)),
      result.correct,
      LABEL_VERSION,
      row.id,
    ]);
    labeled += Number(update.changes || 0);
  }

  return { labeled, observedAt: normalizedObservedAt, observedPrice: price };
}

module.exports = {
  LABEL_VERSION,
  MOVEMENT_THRESHOLD_PERCENT,
  MIN_LABELED_OBSERVATIONS,
  MIN_BENCHMARK_MARGIN,
  MIN_CLASS_OBSERVATIONS,
  normalizeSqliteTimestamp,
  toKstSqliteTimestamp,
  addMinutesToSqliteTimestamp,
  isEvaluationDue,
  evaluateDecision,
  isLegacyContaminated,
  assessPromotionEligibility,
  migrateAisEvaluationSchema,
  labelDueTrainingRows,
};
