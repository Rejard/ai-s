const emptyDecision = () => ({ count: 0, correct: 0, accuracy: 0 });
const emptyDnaStateTotals = () => ({ active: 0, inactive: 0, deprecated: 0, lethal: 0 });
const emptyDnaMutationTotals = () => ({
  stateMutation: 0,
  contextMaskMutation: 0,
  contextMutationDetail: { blackSwanAdded: 0, blackSwanRemoved: 0, coreAdded: 0, coreRemoved: 0 },
  profileMutation: 0,
  profileMutationByKey: { expressionBudget: 0, dominanceBias: 0, decayResistance: 0, reactivationBias: 0 },
  copyNumberMutation: 0,
  copyNumberDirection: { up: 0, down: 0, flat: 0 },
  weightNudge: 0,
  vepFiltered: 0,
});
const emptySelectionTelemetry = () => ({ culledCount: 0, offspringCount: 0, mutantCount: 0, archiveCount: 0 });
const emptyDnaOperations = () => ({ archiveCount: 0, averageFitnessHistoryDepth: 0, latestArchivedAt: '' });
const emptyDnaRepairTelemetry = () => ({ accessionRepairCount: 0, contextMaskRepairCount: 0, profileRepairCount: 0, lastRepairedAt: '' });
const emptyGrowthTelemetry = () => ({
  selectionScore: 0,
  selectionWeights: { utility: 0.85, tradeParticipation: 0.1, actionEntropy: 0.05 },
  candidateTradeParticipationAverage: 0,
  candidateActionEntropyAverage: 0,
  electedTradeParticipationAverage: 0,
  electedActionEntropyAverage: 0,
  holdoutTradeParticipationAverage: 0,
  holdoutActionEntropyAverage: 0,
  benchmarkMargin: 0,
  validationDelta: 0,
  holdoutDelta: 0,
  activeGenerationSpread: { min: 0, max: 0, average: 0 },
  electedOrigins: { mutant: 0, offspring: 0, legacy: 0, other: 0 },
  validationActionMix: { BUY: 0, SELL: 0, HOLD: 0 },
  holdoutActionMix: { BUY: 0, SELL: 0, HOLD: 0 },
});
const emptyDnaContextSummary = () => ({ blackSwanStrategyGenes: 0, blackSwanActiveGenomes: 0, blackSwanArchivedGenomes: 0 });
const emptyDnaContextPerformance = () => ({
  blackSwanActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0, averageMutationEvents: 0 },
  coreActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0, averageMutationEvents: 0 },
  blackSwanArchive: { archiveCount: 0, averageGeneration: 0, lowPerformanceCount: 0, vepFilteredCount: 0 },
  coreArchive: { archiveCount: 0, averageGeneration: 0, lowPerformanceCount: 0, vepFilteredCount: 0 },
});
const emptyDnaContextPathway = () => ({
  blackSwanActive: { genomeCount: 0, vepFilteredGenomes: 0, lastMutationEventCounts: {} },
  coreActive: { genomeCount: 0, vepFilteredGenomes: 0, lastMutationEventCounts: {} },
  blackSwanArchive: { archiveCount: 0, lowPerformanceCount: 0, vepFilteredCount: 0, lastMutationEventCounts: {} },
  coreArchive: { archiveCount: 0, lowPerformanceCount: 0, vepFilteredCount: 0, lastMutationEventCounts: {} },
});
const emptyDnaAdminOverrideTelemetry = () => ({
  stateOverrideCount: 0,
  contextOverrideCount: 0,
  recentEvent: null,
  targetGeneCounts: {},
});
const emptyDnaAdminOverrideOutcome = () => ({
  stateOverrideActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
  contextOverrideActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
  stateOverrideArchive: { archiveCount: 0, lowPerformanceCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
  contextOverrideArchive: { archiveCount: 0, lowPerformanceCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
});
const emptyDnaAdminOverrideDelta = () => ({
  stateOverrideDelta: { overrideCount: 0, averageValidationDelta: 0, averageHoldoutDelta: 0 },
  contextOverrideDelta: { overrideCount: 0, averageValidationDelta: 0, averageHoldoutDelta: 0 },
});
const emptyDnaAdminOverrideSnapshot = () => ({
  stateOverride: {
    overrideCount: 0,
    preAverageValidationScore: 0,
    preAverageHoldoutScore: 0,
    postAverageValidationScore: 0,
    postAverageHoldoutScore: 0,
  },
  contextOverride: {
    overrideCount: 0,
    preAverageValidationScore: 0,
    preAverageHoldoutScore: 0,
    postAverageValidationScore: 0,
    postAverageHoldoutScore: 0,
  },
});
const emptyDnaAdminOverrideCoverage = () => ({
  stateOverride: {
    totalOverrideCount: 0,
    snapshotComparableCount: 0,
    timelineComparableCount: 0,
  },
  contextOverride: {
    totalOverrideCount: 0,
    snapshotComparableCount: 0,
    timelineComparableCount: 0,
  },
});
const emptyDnaOverrideLineageAttribution = () => ({
  activeInheritedStateCount: 0,
  activeInheritedContextCount: 0,
  archivedInheritedStateCount: 0,
  archivedInheritedContextCount: 0,
});
const emptyDnaAdminOverrideTimeline = () => ({
  stateOverrideRuns: [],
  contextOverrideRuns: [],
});
const emptyDnaLineage = () => ({ activeGenomes: [], recentArchives: [] });

export function normalizeAisTrainingStats(data = {}) {
  const byDecision = data.byDecision || {};
  const dnaStateTotals = data.dnaStateTotals || {};
  const dnaMutationTotals = data.dnaMutationTotals || {};
  const selectionTelemetry = data.selectionTelemetry || {};
  const dnaOperations = data.dnaOperations || {};
  const dnaRepairTelemetry = data.dnaRepairTelemetry || {};
  const growthTelemetry = data.growthTelemetry || {};
  const dnaContextSummary = data.dnaContextSummary || {};
  const dnaContextPerformance = data.dnaContextPerformance || {};
  const dnaContextPathway = data.dnaContextPathway || {};
  const dnaAdminOverrideTelemetry = data.dnaAdminOverrideTelemetry || {};
  const dnaAdminOverrideOutcome = data.dnaAdminOverrideOutcome || {};
  const dnaAdminOverrideDelta = data.dnaAdminOverrideDelta || {};
  const dnaAdminOverrideSnapshot = data.dnaAdminOverrideSnapshot || {};
  const dnaAdminOverrideCoverage = data.dnaAdminOverrideCoverage || {};
  const dnaOverrideLineageAttribution = data.dnaOverrideLineageAttribution || {};
  const dnaAdminOverrideTimeline = data.dnaAdminOverrideTimeline || {};
  const dnaLineage = data.dnaLineage || {};
  return {
    total: Number(data.total || data.count || 0),
    labeled: Number(data.labeled || 0),
    pending: Number(data.pending || 0),
    invalid: Number(data.invalid || 0),
    labelVersion: Number(data.labelVersion || 2),
    byDecision: {
      BUY: { ...emptyDecision(), ...(byDecision.BUY || {}) },
      SELL: { ...emptyDecision(), ...(byDecision.SELL || {}) },
      HOLD: { ...emptyDecision(), ...(byDecision.HOLD || {}) },
    },
    byMode: data.byMode || {},
    byModeDecision: data.byModeDecision || {},
    byModeTrade: data.byModeTrade || {},
    byModeLastUpdated: data.byModeLastUpdated || {},
    latestRun: data.latestRun || null,
    shadowOnly: data.shadowOnly !== false,
    automaticPromotionEnabled: data.automaticPromotionEnabled === true,
    dnaStateTotals: { ...emptyDnaStateTotals(), ...dnaStateTotals },
    dnaMutationTotals: {
      ...emptyDnaMutationTotals(),
      ...dnaMutationTotals,
      contextMutationDetail: {
        ...emptyDnaMutationTotals().contextMutationDetail,
        ...(dnaMutationTotals.contextMutationDetail || {}),
      },
      profileMutationByKey: {
        ...emptyDnaMutationTotals().profileMutationByKey,
        ...(dnaMutationTotals.profileMutationByKey || {}),
      },
      copyNumberDirection: {
        ...emptyDnaMutationTotals().copyNumberDirection,
        ...(dnaMutationTotals.copyNumberDirection || {}),
      },
    },
    selectionTelemetry: { ...emptySelectionTelemetry(), ...selectionTelemetry },
    dnaOperations: { ...emptyDnaOperations(), ...dnaOperations },
    dnaRepairTelemetry: { ...emptyDnaRepairTelemetry(), ...dnaRepairTelemetry },
    growthTelemetry: {
      ...emptyGrowthTelemetry(),
      ...growthTelemetry,
      selectionWeights: { ...emptyGrowthTelemetry().selectionWeights, ...(growthTelemetry.selectionWeights || {}) },
      activeGenerationSpread: { ...emptyGrowthTelemetry().activeGenerationSpread, ...(growthTelemetry.activeGenerationSpread || {}) },
      electedOrigins: { ...emptyGrowthTelemetry().electedOrigins, ...(growthTelemetry.electedOrigins || {}) },
      validationActionMix: { ...emptyGrowthTelemetry().validationActionMix, ...(growthTelemetry.validationActionMix || {}) },
      holdoutActionMix: { ...emptyGrowthTelemetry().holdoutActionMix, ...(growthTelemetry.holdoutActionMix || {}) },
    },
    dnaContextSummary: { ...emptyDnaContextSummary(), ...dnaContextSummary },
    dnaContextPerformance: {
      ...emptyDnaContextPerformance(),
      ...dnaContextPerformance,
      blackSwanActive: { ...emptyDnaContextPerformance().blackSwanActive, ...(dnaContextPerformance.blackSwanActive || {}) },
      coreActive: { ...emptyDnaContextPerformance().coreActive, ...(dnaContextPerformance.coreActive || {}) },
      blackSwanArchive: { ...emptyDnaContextPerformance().blackSwanArchive, ...(dnaContextPerformance.blackSwanArchive || {}) },
      coreArchive: { ...emptyDnaContextPerformance().coreArchive, ...(dnaContextPerformance.coreArchive || {}) },
    },
    dnaContextPathway: {
      ...emptyDnaContextPathway(),
      ...dnaContextPathway,
      blackSwanActive: { ...emptyDnaContextPathway().blackSwanActive, ...(dnaContextPathway.blackSwanActive || {}) },
      coreActive: { ...emptyDnaContextPathway().coreActive, ...(dnaContextPathway.coreActive || {}) },
      blackSwanArchive: { ...emptyDnaContextPathway().blackSwanArchive, ...(dnaContextPathway.blackSwanArchive || {}) },
      coreArchive: { ...emptyDnaContextPathway().coreArchive, ...(dnaContextPathway.coreArchive || {}) },
    },
    dnaAdminOverrideTelemetry: {
      ...emptyDnaAdminOverrideTelemetry(),
      ...dnaAdminOverrideTelemetry,
      targetGeneCounts: { ...emptyDnaAdminOverrideTelemetry().targetGeneCounts, ...(dnaAdminOverrideTelemetry.targetGeneCounts || {}) },
    },
    dnaAdminOverrideOutcome: {
      ...emptyDnaAdminOverrideOutcome(),
      ...dnaAdminOverrideOutcome,
      stateOverrideActive: { ...emptyDnaAdminOverrideOutcome().stateOverrideActive, ...(dnaAdminOverrideOutcome.stateOverrideActive || {}) },
      contextOverrideActive: { ...emptyDnaAdminOverrideOutcome().contextOverrideActive, ...(dnaAdminOverrideOutcome.contextOverrideActive || {}) },
      stateOverrideArchive: { ...emptyDnaAdminOverrideOutcome().stateOverrideArchive, ...(dnaAdminOverrideOutcome.stateOverrideArchive || {}) },
      contextOverrideArchive: { ...emptyDnaAdminOverrideOutcome().contextOverrideArchive, ...(dnaAdminOverrideOutcome.contextOverrideArchive || {}) },
    },
    dnaAdminOverrideDelta: {
      ...emptyDnaAdminOverrideDelta(),
      ...dnaAdminOverrideDelta,
      stateOverrideDelta: { ...emptyDnaAdminOverrideDelta().stateOverrideDelta, ...(dnaAdminOverrideDelta.stateOverrideDelta || {}) },
      contextOverrideDelta: { ...emptyDnaAdminOverrideDelta().contextOverrideDelta, ...(dnaAdminOverrideDelta.contextOverrideDelta || {}) },
    },
    dnaAdminOverrideSnapshot: {
      ...emptyDnaAdminOverrideSnapshot(),
      ...dnaAdminOverrideSnapshot,
      stateOverride: { ...emptyDnaAdminOverrideSnapshot().stateOverride, ...(dnaAdminOverrideSnapshot.stateOverride || {}) },
      contextOverride: { ...emptyDnaAdminOverrideSnapshot().contextOverride, ...(dnaAdminOverrideSnapshot.contextOverride || {}) },
    },
    dnaAdminOverrideCoverage: {
      ...emptyDnaAdminOverrideCoverage(),
      ...dnaAdminOverrideCoverage,
      stateOverride: { ...emptyDnaAdminOverrideCoverage().stateOverride, ...(dnaAdminOverrideCoverage.stateOverride || {}) },
      contextOverride: { ...emptyDnaAdminOverrideCoverage().contextOverride, ...(dnaAdminOverrideCoverage.contextOverride || {}) },
    },
    dnaOverrideLineageAttribution: {
      ...emptyDnaOverrideLineageAttribution(),
      ...dnaOverrideLineageAttribution,
    },
    dnaAdminOverrideTimeline: {
      ...emptyDnaAdminOverrideTimeline(),
      ...dnaAdminOverrideTimeline,
      stateOverrideRuns: Array.isArray(dnaAdminOverrideTimeline.stateOverrideRuns) ? dnaAdminOverrideTimeline.stateOverrideRuns : [],
      contextOverrideRuns: Array.isArray(dnaAdminOverrideTimeline.contextOverrideRuns) ? dnaAdminOverrideTimeline.contextOverrideRuns : [],
    },
    dnaLineage: {
      ...emptyDnaLineage(),
      ...dnaLineage,
      activeGenomes: Array.isArray(dnaLineage.activeGenomes) ? dnaLineage.activeGenomes : [],
      recentArchives: Array.isArray(dnaLineage.recentArchives) ? dnaLineage.recentArchives : [],
    },
    dnaStateTotalsAvailable: data.dnaStateTotalsAvailable !== false,
  };
}

