const emptyDecision = () => ({ count: 0, correct: 0, accuracy: 0 });
const emptyDnaStateTotals = () => ({ active: 0, inactive: 0, deprecated: 0, lethal: 0 });
const emptyDnaMutationTotals = () => ({
  stateMutation: 0,
  contextMaskMutation: 0,
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
const emptyDnaLineage = () => ({ activeGenomes: [], recentArchives: [] });

export function normalizeAisTrainingStats(data = {}) {
  const byDecision = data.byDecision || {};
  const dnaStateTotals = data.dnaStateTotals || {};
  const dnaMutationTotals = data.dnaMutationTotals || {};
  const selectionTelemetry = data.selectionTelemetry || {};
  const dnaOperations = data.dnaOperations || {};
  const dnaRepairTelemetry = data.dnaRepairTelemetry || {};
  const dnaContextSummary = data.dnaContextSummary || {};
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
    dnaLineage: {
      ...emptyDnaLineage(),
      ...dnaLineage,
      activeGenomes: Array.isArray(dnaLineage.activeGenomes) ? dnaLineage.activeGenomes : [],
      recentArchives: Array.isArray(dnaLineage.recentArchives) ? dnaLineage.recentArchives : [],
    },
    dnaStateTotalsAvailable: data.dnaStateTotalsAvailable !== false,
  };
}

