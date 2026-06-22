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

function emptyDnaAdminOverrideTelemetry() {
  return {
    stateOverrideCount: 0,
    contextOverrideCount: 0,
    recentEvent: null,
    targetGeneCounts: {},
  };
}

function emptyOverrideActiveOutcome() {
  return {
    genomeCount: 0,
    averageLatestValidationScore: 0,
    averageLatestHoldoutScore: 0,
  };
}

function emptyOverrideArchiveOutcome() {
  return {
    archiveCount: 0,
    lowPerformanceCount: 0,
    averageLatestValidationScore: 0,
    averageLatestHoldoutScore: 0,
  };
}

function emptyDnaAdminOverrideOutcome() {
  return {
    stateOverrideActive: emptyOverrideActiveOutcome(),
    contextOverrideActive: emptyOverrideActiveOutcome(),
    stateOverrideArchive: emptyOverrideArchiveOutcome(),
    contextOverrideArchive: emptyOverrideArchiveOutcome(),
  };
}

function emptyCohortActivePerformance() {
  return {
    genomeCount: 0,
    averageLatestValidationScore: 0,
    averageLatestHoldoutScore: 0,
    averageMutationEvents: 0,
  };
}

function emptyCohortArchivePerformance() {
  return {
    archiveCount: 0,
    averageGeneration: 0,
    lowPerformanceCount: 0,
    vepFilteredCount: 0,
  };
}

function emptyDnaContextPerformance() {
  return {
    blackSwanActive: emptyCohortActivePerformance(),
    coreActive: emptyCohortActivePerformance(),
    blackSwanArchive: emptyCohortArchivePerformance(),
    coreArchive: emptyCohortArchivePerformance(),
  };
}

function emptyActivePathway() {
  return {
    genomeCount: 0,
    vepFilteredGenomes: 0,
    lastMutationEventCounts: {},
  };
}

function emptyArchivePathway() {
  return {
    archiveCount: 0,
    lowPerformanceCount: 0,
    vepFilteredCount: 0,
    lastMutationEventCounts: {},
  };
}

function emptyDnaContextPathway() {
  return {
    blackSwanActive: emptyActivePathway(),
    coreActive: emptyActivePathway(),
    blackSwanArchive: emptyArchivePathway(),
    coreArchive: emptyArchivePathway(),
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

function summarizeLatestFitness(dna) {
  const fitnessHistory = Array.isArray(dna?.fitness_history) ? dna.fitness_history : [];
  if (!fitnessHistory.length) {
    return { validationScore: 0, holdoutScore: 0 };
  }
  const latest = fitnessHistory[fitnessHistory.length - 1] || {};
  return {
    validationScore: Number(latest.validationScore || 0),
    holdoutScore: Number(latest.holdoutScore || 0),
  };
}

function roundMetric(value) {
  return Number(value.toFixed(2));
}

function buildActivePerformance(rows) {
  if (!rows.length) {
    return emptyCohortActivePerformance();
  }
  const totals = rows.reduce((sum, row) => {
    const dna = safeParseDna(row.dna_json);
    const latestFitness = summarizeLatestFitness(dna);
    const mutationLog = Array.isArray(dna?.mutation_log) ? dna.mutation_log : [];
    sum.validationScore += latestFitness.validationScore;
    sum.holdoutScore += latestFitness.holdoutScore;
    sum.mutationEvents += mutationLog.length;
    return sum;
  }, { validationScore: 0, holdoutScore: 0, mutationEvents: 0 });
  return {
    genomeCount: rows.length,
    averageLatestValidationScore: roundMetric(totals.validationScore / rows.length),
    averageLatestHoldoutScore: roundMetric(totals.holdoutScore / rows.length),
    averageMutationEvents: roundMetric(totals.mutationEvents / rows.length),
  };
}

function buildArchivePerformance(rows) {
  if (!rows.length) {
    return emptyCohortArchivePerformance();
  }
  const totals = rows.reduce((sum, row) => {
    const dna = safeParseDna(row.dna_json);
    const mutationLog = Array.isArray(dna?.mutation_log) ? dna.mutation_log : [];
    const hasVepFiltered = mutationLog.some((entry) => entry?.event === 'vep_filtered_deleterious_mutation');
    sum.generation += Number(row.generation || dna?.generation || 0);
    if (row.archive_reason === 'CULLED_LOW_PERFORMANCE') sum.lowPerformanceCount += 1;
    if (hasVepFiltered) sum.vepFilteredCount += 1;
    return sum;
  }, { generation: 0, lowPerformanceCount: 0, vepFilteredCount: 0 });
  return {
    archiveCount: rows.length,
    averageGeneration: roundMetric(totals.generation / rows.length),
    lowPerformanceCount: totals.lowPerformanceCount,
    vepFilteredCount: totals.vepFilteredCount,
  };
}

function incrementEventCount(target, event) {
  if (typeof event !== 'string' || !event) return;
  target[event] = (target[event] || 0) + 1;
}

function buildActivePathway(rows) {
  if (!rows.length) {
    return emptyActivePathway();
  }
  return rows.reduce((summary, row) => {
    const dna = safeParseDna(row.dna_json);
    const mutationLog = Array.isArray(dna?.mutation_log) ? dna.mutation_log : [];
    const hasVepFiltered = mutationLog.some((entry) => entry?.event === 'vep_filtered_deleterious_mutation');
    const lastEvent = mutationLog.length ? String(mutationLog[mutationLog.length - 1].event || '') : '';
    summary.genomeCount += 1;
    if (hasVepFiltered) summary.vepFilteredGenomes += 1;
    incrementEventCount(summary.lastMutationEventCounts, lastEvent);
    return summary;
  }, emptyActivePathway());
}

function buildArchivePathway(rows) {
  if (!rows.length) {
    return emptyArchivePathway();
  }
  return rows.reduce((summary, row) => {
    const dna = safeParseDna(row.dna_json);
    const mutationLog = Array.isArray(dna?.mutation_log) ? dna.mutation_log : [];
    const hasVepFiltered = mutationLog.some((entry) => entry?.event === 'vep_filtered_deleterious_mutation');
    const lastEvent = mutationLog.length ? String(mutationLog[mutationLog.length - 1].event || '') : '';
    summary.archiveCount += 1;
    if (row.archive_reason === 'CULLED_LOW_PERFORMANCE') summary.lowPerformanceCount += 1;
    if (hasVepFiltered) summary.vepFilteredCount += 1;
    incrementEventCount(summary.lastMutationEventCounts, lastEvent);
    return summary;
  }, emptyArchivePathway());
}

function buildAdminOverrideTelemetry(rows) {
  const summary = emptyDnaAdminOverrideTelemetry();
  let latestGeneration = -1;

  for (const row of rows) {
    const dna = safeParseDna(row.dna_json);
    const mutationLog = Array.isArray(dna?.mutation_log) ? dna.mutation_log : [];
    for (const entry of mutationLog) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.event === 'admin_state_override') {
        summary.stateOverrideCount += 1;
      } else if (entry.event === 'admin_context_override') {
        summary.contextOverrideCount += 1;
      } else {
        continue;
      }

      const geneId = typeof entry.gene_id === 'string' ? entry.gene_id : '';
      if (geneId) {
        summary.targetGeneCounts[geneId] = (summary.targetGeneCounts[geneId] || 0) + 1;
      }

      const generation = Number(entry.generation || 0);
      if (generation >= latestGeneration) {
        latestGeneration = generation;
        summary.recentEvent = {
          event: entry.event,
          geneId: geneId || '',
          contextKey: typeof entry.context_key === 'string' ? entry.context_key : '',
          action: typeof entry.action === 'string' ? entry.action : '',
        };
      }
    }
  }

  return summary;
}

function hasOverrideEvent(dna, eventName) {
  const mutationLog = Array.isArray(dna?.mutation_log) ? dna.mutation_log : [];
  return mutationLog.some((entry) => entry?.event === eventName);
}

function buildOverrideActiveOutcome(rows, eventName) {
  const matched = rows
    .map((row) => ({ row, dna: safeParseDna(row.dna_json) }))
    .filter(({ dna }) => hasOverrideEvent(dna, eventName));
  if (!matched.length) {
    return emptyOverrideActiveOutcome();
  }
  const totals = matched.reduce((sum, item) => {
    const latestFitness = summarizeLatestFitness(item.dna);
    sum.validationScore += latestFitness.validationScore;
    sum.holdoutScore += latestFitness.holdoutScore;
    return sum;
  }, { validationScore: 0, holdoutScore: 0 });
  return {
    genomeCount: matched.length,
    averageLatestValidationScore: roundMetric(totals.validationScore / matched.length),
    averageLatestHoldoutScore: roundMetric(totals.holdoutScore / matched.length),
  };
}

function buildOverrideArchiveOutcome(rows, eventName) {
  const matched = rows
    .map((row) => ({ row, dna: safeParseDna(row.dna_json) }))
    .filter(({ dna }) => hasOverrideEvent(dna, eventName));
  if (!matched.length) {
    return emptyOverrideArchiveOutcome();
  }
  const totals = matched.reduce((sum, item) => {
    const latestFitness = summarizeLatestFitness(item.dna);
    sum.validationScore += latestFitness.validationScore;
    sum.holdoutScore += latestFitness.holdoutScore;
    if (item.row.archive_reason === 'CULLED_LOW_PERFORMANCE') sum.lowPerformanceCount += 1;
    return sum;
  }, { validationScore: 0, holdoutScore: 0, lowPerformanceCount: 0 });
  return {
    archiveCount: matched.length,
    lowPerformanceCount: totals.lowPerformanceCount,
    averageLatestValidationScore: roundMetric(totals.validationScore / matched.length),
    averageLatestHoldoutScore: roundMetric(totals.holdoutScore / matched.length),
  };
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
    totals.contextMutationDetail.blackSwanAdded += summary.contextMutationDetail.blackSwanAdded;
    totals.contextMutationDetail.blackSwanRemoved += summary.contextMutationDetail.blackSwanRemoved;
    totals.contextMutationDetail.coreAdded += summary.contextMutationDetail.coreAdded;
    totals.contextMutationDetail.coreRemoved += summary.contextMutationDetail.coreRemoved;
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
    contextMutationDetail: {
      blackSwanAdded: 0,
      blackSwanRemoved: 0,
      coreAdded: 0,
      coreRemoved: 0,
    },
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
  const blackSwanActiveRows = activeCouncil.filter((row) => hasBlackSwanContext(safeParseDna(row.dna_json)));
  const coreActiveRows = activeCouncil.filter((row) => !hasBlackSwanContext(safeParseDna(row.dna_json)));
  const allArchiveRows = await store.all(`
    SELECT member_id, genome_id, generation, archive_reason, dna_json, archived_at
    FROM ais_genome_archive
  `).catch(() => []);
  const blackSwanArchiveCohort = allArchiveRows.filter((row) => hasBlackSwanContext(safeParseDna(row.dna_json)));
  const coreArchiveCohort = allArchiveRows.filter((row) => !hasBlackSwanContext(safeParseDna(row.dna_json)));
  const dnaContextPerformance = {
    blackSwanActive: buildActivePerformance(blackSwanActiveRows),
    coreActive: buildActivePerformance(coreActiveRows),
    blackSwanArchive: buildArchivePerformance(blackSwanArchiveCohort),
    coreArchive: buildArchivePerformance(coreArchiveCohort),
  };
  const dnaContextPathway = {
    blackSwanActive: buildActivePathway(blackSwanActiveRows),
    coreActive: buildActivePathway(coreActiveRows),
    blackSwanArchive: buildArchivePathway(blackSwanArchiveCohort),
    coreArchive: buildArchivePathway(coreArchiveCohort),
  };
  const dnaAdminOverrideTelemetry = buildAdminOverrideTelemetry(activeCouncil);
  const dnaAdminOverrideOutcome = {
    stateOverrideActive: buildOverrideActiveOutcome(activeCouncil, 'admin_state_override'),
    contextOverrideActive: buildOverrideActiveOutcome(activeCouncil, 'admin_context_override'),
    stateOverrideArchive: buildOverrideArchiveOutcome(allArchiveRows, 'admin_state_override'),
    contextOverrideArchive: buildOverrideArchiveOutcome(allArchiveRows, 'admin_context_override'),
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
    dnaContextPerformance: { ...emptyDnaContextPerformance(), ...dnaContextPerformance },
    dnaContextPathway: { ...emptyDnaContextPathway(), ...dnaContextPathway },
    dnaAdminOverrideTelemetry: { ...emptyDnaAdminOverrideTelemetry(), ...dnaAdminOverrideTelemetry },
    dnaAdminOverrideOutcome: { ...emptyDnaAdminOverrideOutcome(), ...dnaAdminOverrideOutcome },
    dnaStateTotals,
    dnaMutationTotals,
    dnaStateTotalsAvailable,
  };
}

module.exports = {
  getAisTrainingStats,
};

