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
const emptyDnaLineage = () => ({ activeGenomes: [], recentArchives: [] });

export function normalizeAisTrainingStats(data = {}) {
  const byDecision = data.byDecision || {};
  const dnaStateTotals = data.dnaStateTotals || {};
  const dnaMutationTotals = data.dnaMutationTotals || {};
  const selectionTelemetry = data.selectionTelemetry || {};
  const dnaOperations = data.dnaOperations || {};
  const dnaRepairTelemetry = data.dnaRepairTelemetry || {};
  const dnaContextSummary = data.dnaContextSummary || {};
  const dnaContextPerformance = data.dnaContextPerformance || {};
  const dnaContextPathway = data.dnaContextPathway || {};
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
    dnaLineage: {
      ...emptyDnaLineage(),
      ...dnaLineage,
      activeGenomes: Array.isArray(dnaLineage.activeGenomes) ? dnaLineage.activeGenomes : [],
      recentArchives: Array.isArray(dnaLineage.recentArchives) ? dnaLineage.recentArchives : [],
    },
    dnaStateTotalsAvailable: data.dnaStateTotalsAvailable !== false,
  };
}

