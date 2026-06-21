const { LABEL_VERSION } = require('./aisEvaluation');
const { summarizeDnaStates, summarizeMutationLog } = require('./aisDnaSummary');

function emptySelectionTelemetry() {
  return { culledCount: 0, offspringCount: 0, mutantCount: 0, archiveCount: 0 };
}

async function getAisTrainingStats(store) {
  const totals = await store.get(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN evaluation_status = 'LABELED' THEN 1 ELSE 0 END) AS labeled,
      SUM(CASE WHEN evaluation_status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN evaluation_status = 'INVALID' THEN 1 ELSE 0 END) AS invalid
    FROM ais_training_data
  `);
  const decisionRows = await store.all(`
    SELECT
      gemini_decision AS decision,
      COUNT(*) AS count,
      SUM(CASE WHEN is_correct_decision = 1 THEN 1 ELSE 0 END) AS correct
    FROM ais_training_data
    WHERE evaluation_status = 'LABELED'
      AND label_version = ?
    GROUP BY gemini_decision
  `, [LABEL_VERSION]);
  const latest = await store.get(`
    SELECT *
    FROM ais_model_runs
    ORDER BY id DESC
    LIMIT 1
  `);

  const byDecision = {
    BUY: { count: 0, correct: 0, accuracy: 0 },
    SELL: { count: 0, correct: 0, accuracy: 0 },
    HOLD: { count: 0, correct: 0, accuracy: 0 },
  };
  for (const row of decisionRows) {
    const decision = String(row.decision || '').toUpperCase();
    if (!byDecision[decision]) continue;
    const count = Number(row.count || 0);
    const correct = Number(row.correct || 0);
    byDecision[decision] = {
      count,
      correct,
      accuracy: count ? Number(((correct / count) * 100).toFixed(2)) : 0,
    };
  }

  let latestRun = null;
  if (latest) {
    let promotionReasons = [];
    try {
      promotionReasons = JSON.parse(latest.promotion_reasons || '[]');
    } catch {
      promotionReasons = ['INVALID_PROMOTION_METADATA'];
    }
    latestRun = {
      id: latest.id,
      runKey: latest.run_key,
      status: latest.status,
      datasetCount: Number(latest.dataset_count || 0),
      trainCount: Number(latest.train_count || 0),
      validationCount: Number(latest.validation_count || 0),
      holdoutCount: Number(latest.holdout_count || 0),
      validationScore: Number(latest.validation_score || 0),
      holdoutScore: Number(latest.holdout_score || 0),
      benchmarkScore: Number(latest.benchmark_score || 0),
      generation: Number(latest.generation || 1),
      promotionEligible: latest.promotion_eligible === 1,
      promotionReasons,
      errorMessage: latest.error_message || '',
      createdAt: latest.created_at,
      completedAt: latest.completed_at,
    };
  }

  const promoEnabledRow = await store.get("SELECT value FROM platform_settings WHERE key = 'automatic_promotion_enabled'");
  const selectionTelemetryRow = await store.get("SELECT value FROM platform_settings WHERE key = 'ais_selection_telemetry'");
  const automaticPromotionEnabled = promoEnabledRow ? (promoEnabledRow.value === 'ON') : false;
  let selectionTelemetry = emptySelectionTelemetry();
  if (selectionTelemetryRow?.value) {
    try {
      selectionTelemetry = { ...selectionTelemetry, ...JSON.parse(selectionTelemetryRow.value) };
    } catch {
      selectionTelemetry = emptySelectionTelemetry();
    }
  }
  let dnaStateTotalsAvailable = true;
  const activeCouncil = await store.all(`
    SELECT dna_json
    FROM ais_council_members
    WHERE status = 'ACTIVE'
      AND dna_json IS NOT NULL
      AND dna_json != ''
  `).catch(() => {
    dnaStateTotalsAvailable = false;
    return [];
  });
  const dnaStateTotals = activeCouncil.reduce((totals, row) => {
    const summary = summarizeDnaStates(row.dna_json);
    totals.active += summary.active;
    totals.inactive += summary.inactive;
    totals.deprecated += summary.deprecated;
    totals.lethal += summary.lethal;
    return totals;
  }, { active: 0, inactive: 0, deprecated: 0, lethal: 0 });
  const dnaMutationTotals = activeCouncil.reduce((totals, row) => {
    const summary = summarizeMutationLog(row.dna_json);
    totals.stateMutation += summary.stateMutation;
    totals.contextMaskMutation += summary.contextMaskMutation;
    totals.weightNudge += summary.weightNudge;
    totals.vepFiltered += summary.vepFiltered;
    return totals;
  }, { stateMutation: 0, contextMaskMutation: 0, weightNudge: 0, vepFiltered: 0 });

  return {
    total: Number(totals?.total || 0),
    labeled: Number(totals?.labeled || 0),
    pending: Number(totals?.pending || 0),
    invalid: Number(totals?.invalid || 0),
    byDecision,
    latestRun,
    labelVersion: LABEL_VERSION,
    shadowOnly: true,
    automaticPromotionEnabled,
    selectionTelemetry,
    dnaStateTotals,
    dnaMutationTotals,
    dnaStateTotalsAvailable,
  };
}

module.exports = {
  getAisTrainingStats,
};
