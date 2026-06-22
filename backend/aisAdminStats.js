const { LABEL_VERSION } = require('./aisEvaluation');
const { summarizeDnaStates, summarizeMutationLog } = require('./aisDnaSummary');

function emptySelectionTelemetry() {
  return { culledCount: 0, offspringCount: 0, mutantCount: 0, archiveCount: 0 };
}

function emptyDnaOperations() {
  return { archiveCount: 0, averageFitnessHistoryDepth: 0, latestArchivedAt: '' };
}

function emptyDnaRepairTelemetry() {
  return {
    accessionRepairCount: 0,
    contextMaskRepairCount: 0,
    profileRepairCount: 0,
    lastRepairedAt: '',
  };
}

function emptyDnaLineage() {
  return {
    activeGenomes: [],
    recentArchives: [],
  };
}

function emptyDnaContextSummary() {
  return {
    blackSwanStrategyGenes: 0,
    blackSwanActiveGenomes: 0,
    blackSwanArchivedGenomes: 0,
  };
}

function summarizeCopyNumbers(dna) {
  const strategyGenes = Array.isArray(dna?.strategy_genes) ? dna.strategy_genes : [];
  const copyNumbers = strategyGenes
    .map((gene) => Number(gene?.copy_number || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!copyNumbers.length) {
    return { average: 0, max: 0 };
  }
  const total = copyNumbers.reduce((sum, value) => sum + value, 0);
  return {
    average: Number((total / copyNumbers.length).toFixed(2)),
    max: Math.max(...copyNumbers),
  };
}

function summarizeRegulatoryProfile(dna) {
  const profile = dna?.regulatory_profile && typeof dna.regulatory_profile === 'object' ? dna.regulatory_profile : {};
  return {
    expressionBudget: Number(profile.expression_budget || 0),
    dominanceBias: Number(profile.dominance_bias || 0),
    decayResistance: Number(profile.decay_resistance || 0),
    reactivationBias: Number(profile.reactivation_bias || 0),
  };
}

function summarizeContextMasks(dna) {
  const strategyGenes = Array.isArray(dna?.strategy_genes) ? dna.strategy_genes : [];
  return Array.from(new Set(strategyGenes.flatMap((gene) => (
    Array.isArray(gene?.context_mask) ? gene.context_mask.filter((value) => typeof value === 'string' && value) : []
  )))).sort();
}

function hasBlackSwanContext(dna) {
  return summarizeContextMasks(dna).includes('BLACK_SWAN');
}

function countBlackSwanStrategyGenes(dna) {
  const strategyGenes = Array.isArray(dna?.strategy_genes) ? dna.strategy_genes : [];
  return strategyGenes.filter((gene) => Array.isArray(gene?.context_mask) && gene.context_mask.includes('BLACK_SWAN')).length;
}

function safeParseDna(value) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

function buildGenomeLineageEntry(row, dna) {
  const lineage = dna?.lineage && typeof dna.lineage === 'object' ? dna.lineage : {};
  const mutationLog = Array.isArray(dna?.mutation_log) ? dna.mutation_log : [];
  const contextMaskSummary = summarizeContextMasks(dna);
  const copyNumberSummary = summarizeCopyNumbers(dna);
  const regulatoryProfile = summarizeRegulatoryProfile(dna);
  return {
    memberId: row.member_id,
    name: row.name || '',
    genomeId: dna?.genome_id || row.genome_id || '',
    generation: Number(row.generation || dna?.generation || 1),
    parentIds: Array.isArray(lineage.parent_ids) ? lineage.parent_ids : [],
    ancestorCount: Array.isArray(lineage.ancestor_ids) ? lineage.ancestor_ids.length : 0,
    mutationEvents: mutationLog.length,
    lastMutationEvent: mutationLog.length ? String(mutationLog[mutationLog.length - 1].event || '') : '',
    stateSummary: summarizeDnaStates(dna),
    contextMaskSummary,
    expressionBudget: regulatoryProfile.expressionBudget,
    dominanceBias: regulatoryProfile.dominanceBias,
    decayResistance: regulatoryProfile.decayResistance,
    reactivationBias: regulatoryProfile.reactivationBias,
    averageCopyNumber: copyNumberSummary.average,
    maxCopyNumber: copyNumberSummary.max,
    blackSwanEnabled: contextMaskSummary.includes('BLACK_SWAN'),
  };
}

function buildArchivedGenomeEntry(row, dna) {
  const lineage = dna?.lineage && typeof dna.lineage === 'object' ? dna.lineage : {};
  const mutationLog = Array.isArray(dna?.mutation_log) ? dna.mutation_log : [];
  const contextMaskSummary = summarizeContextMasks(dna);
  const copyNumberSummary = summarizeCopyNumbers(dna);
  const regulatoryProfile = summarizeRegulatoryProfile(dna);
  return {
    memberId: row.member_id,
    genomeId: row.genome_id || dna?.genome_id || '',
    generation: Number(row.generation || dna?.generation || 1),
    archiveReason: row.archive_reason || '',
    archivedAt: row.archived_at || '',
    parentIds: Array.isArray(lineage.parent_ids) ? lineage.parent_ids : [],
    mutationEvents: mutationLog.length,
    lastMutationEvent: mutationLog.length ? String(mutationLog[mutationLog.length - 1].event || '') : '',
    contextMaskSummary,
    expressionBudget: regulatoryProfile.expressionBudget,
    dominanceBias: regulatoryProfile.dominanceBias,
    decayResistance: regulatoryProfile.decayResistance,
    reactivationBias: regulatoryProfile.reactivationBias,
    averageCopyNumber: copyNumberSummary.average,
    maxCopyNumber: copyNumberSummary.max,
    blackSwanEnabled: contextMaskSummary.includes('BLACK_SWAN'),
  };
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
  const repairTelemetryRow = await store.get("SELECT value FROM platform_settings WHERE key = 'ais_runtime_repair_telemetry'");
  const automaticPromotionEnabled = promoEnabledRow ? (promoEnabledRow.value === 'ON') : false;
  let selectionTelemetry = emptySelectionTelemetry();
  if (selectionTelemetryRow?.value) {
    try {
      selectionTelemetry = { ...selectionTelemetry, ...JSON.parse(selectionTelemetryRow.value) };
    } catch {
      selectionTelemetry = emptySelectionTelemetry();
    }
  }
  let dnaRepairTelemetry = emptyDnaRepairTelemetry();
  if (repairTelemetryRow?.value) {
    try {
      dnaRepairTelemetry = { ...dnaRepairTelemetry, ...JSON.parse(repairTelemetryRow.value) };
    } catch {
      dnaRepairTelemetry = emptyDnaRepairTelemetry();
    }
  }
  let dnaStateTotalsAvailable = true;
  const activeCouncil = await store.all(`
    SELECT member_id, name, generation, dna_json
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
    totals.profileMutation += summary.profileMutation;
    totals.profileMutationByKey.expressionBudget += summary.profileMutationByKey.expressionBudget;
    totals.profileMutationByKey.dominanceBias += summary.profileMutationByKey.dominanceBias;
    totals.profileMutationByKey.decayResistance += summary.profileMutationByKey.decayResistance;
    totals.profileMutationByKey.reactivationBias += summary.profileMutationByKey.reactivationBias;
    totals.copyNumberMutation += summary.copyNumberMutation;
    totals.copyNumberDirection.up += summary.copyNumberDirection.up;
    totals.copyNumberDirection.down += summary.copyNumberDirection.down;
    totals.copyNumberDirection.flat += summary.copyNumberDirection.flat;
    totals.weightNudge += summary.weightNudge;
    totals.vepFiltered += summary.vepFiltered;
    return totals;
  }, {
    stateMutation: 0,
    contextMaskMutation: 0,
    profileMutation: 0,
    profileMutationByKey: {
      expressionBudget: 0,
      dominanceBias: 0,
      decayResistance: 0,
      reactivationBias: 0,
    },
    copyNumberMutation: 0,
    copyNumberDirection: {
      up: 0,
      down: 0,
      flat: 0,
    },
    weightNudge: 0,
    vepFiltered: 0,
  });
  let dnaOperations = emptyDnaOperations();
  const archiveSummary = await store.get(`
    SELECT COUNT(*) AS archive_count, MAX(archived_at) AS latest_archived_at
    FROM ais_genome_archive
  `).catch(() => null);
  const averageFitnessHistoryDepth = activeCouncil.length
    ? Number((
        activeCouncil.reduce((sum, row) => {
          try {
            const dna = safeParseDna(row.dna_json);
            return sum + (Array.isArray(dna.fitness_history) ? dna.fitness_history.length : 0);
          } catch {
            return sum;
          }
        }, 0) / activeCouncil.length
      ).toFixed(2))
    : 0;
  dnaOperations = {
    archiveCount: Number(archiveSummary?.archive_count || 0),
    averageFitnessHistoryDepth,
    latestArchivedAt: archiveSummary?.latest_archived_at || '',
  };
  const recentArchives = await store.all(`
    SELECT member_id, genome_id, generation, archive_reason, dna_json, archived_at
    FROM ais_genome_archive
    ORDER BY archived_at DESC, id DESC
    LIMIT 5
  `).catch(() => []);
  const allArchiveDnaRows = await store.all(`
    SELECT dna_json
    FROM ais_genome_archive
  `).catch(() => []);
  const dnaContextSummary = {
    blackSwanStrategyGenes: activeCouncil.reduce((sum, row) => sum + countBlackSwanStrategyGenes(safeParseDna(row.dna_json)), 0),
    blackSwanActiveGenomes: activeCouncil.reduce((sum, row) => sum + (hasBlackSwanContext(safeParseDna(row.dna_json)) ? 1 : 0), 0),
    blackSwanArchivedGenomes: allArchiveDnaRows.reduce((sum, row) => sum + (hasBlackSwanContext(safeParseDna(row.dna_json)) ? 1 : 0), 0),
  };
  const dnaLineage = {
    activeGenomes: activeCouncil.slice(0, 5).map((row) => {
      const dna = safeParseDna(row.dna_json);
      return buildGenomeLineageEntry(row, dna);
    }),
    recentArchives: recentArchives.map((row) => {
      const dna = safeParseDna(row.dna_json);
      return buildArchivedGenomeEntry(row, dna);
    }),
  };

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
    dnaOperations,
    dnaRepairTelemetry,
    dnaLineage: { ...emptyDnaLineage(), ...dnaLineage },
    dnaContextSummary: { ...emptyDnaContextSummary(), ...dnaContextSummary },
    dnaStateTotals,
    dnaMutationTotals,
    dnaStateTotalsAvailable,
  };
}

module.exports = {
  getAisTrainingStats,
};

