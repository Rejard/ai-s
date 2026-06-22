import assert from 'node:assert/strict';
import { normalizeAisTrainingStats } from './aisTrainingView.js';

const empty = normalizeAisTrainingStats({});
assert.equal(empty.total, 0);
assert.equal(empty.shadowOnly, true);
assert.equal(empty.automaticPromotionEnabled, false);
assert.equal(empty.latestRun, null);
assert.deepEqual(empty.byDecision.BUY, { count: 0, correct: 0, accuracy: 0 });
assert.deepEqual(empty.dnaStateTotals, { active: 0, inactive: 0, deprecated: 0, lethal: 0 });
assert.deepEqual(empty.dnaMutationTotals, {
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
assert.deepEqual(empty.selectionTelemetry, { culledCount: 0, offspringCount: 0, mutantCount: 0, archiveCount: 0 });
assert.deepEqual(empty.dnaOperations, { archiveCount: 0, averageFitnessHistoryDepth: 0, latestArchivedAt: '' });
assert.deepEqual(empty.dnaRepairTelemetry, { accessionRepairCount: 0, contextMaskRepairCount: 0, profileRepairCount: 0, lastRepairedAt: '' });
assert.deepEqual(empty.dnaContextSummary, { blackSwanStrategyGenes: 0, blackSwanActiveGenomes: 0, blackSwanArchivedGenomes: 0 });
assert.deepEqual(empty.dnaContextPerformance, {
  blackSwanActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0, averageMutationEvents: 0 },
  coreActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0, averageMutationEvents: 0 },
  blackSwanArchive: { archiveCount: 0, averageGeneration: 0, lowPerformanceCount: 0, vepFilteredCount: 0 },
  coreArchive: { archiveCount: 0, averageGeneration: 0, lowPerformanceCount: 0, vepFilteredCount: 0 },
});
assert.deepEqual(empty.dnaContextPathway, {
  blackSwanActive: { genomeCount: 0, vepFilteredGenomes: 0, lastMutationEventCounts: {} },
  coreActive: { genomeCount: 0, vepFilteredGenomes: 0, lastMutationEventCounts: {} },
  blackSwanArchive: { archiveCount: 0, lowPerformanceCount: 0, vepFilteredCount: 0, lastMutationEventCounts: {} },
  coreArchive: { archiveCount: 0, lowPerformanceCount: 0, vepFilteredCount: 0, lastMutationEventCounts: {} },
});
assert.deepEqual(empty.dnaAdminOverrideTelemetry, {
  stateOverrideCount: 0,
  contextOverrideCount: 0,
  recentEvent: null,
  targetGeneCounts: {},
});
assert.deepEqual(empty.dnaAdminOverrideOutcome, {
  stateOverrideActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
  contextOverrideActive: { genomeCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
  stateOverrideArchive: { archiveCount: 0, lowPerformanceCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
  contextOverrideArchive: { archiveCount: 0, lowPerformanceCount: 0, averageLatestValidationScore: 0, averageLatestHoldoutScore: 0 },
});
assert.deepEqual(empty.dnaAdminOverrideDelta, {
  stateOverrideDelta: { overrideCount: 0, averageValidationDelta: 0, averageHoldoutDelta: 0 },
  contextOverrideDelta: { overrideCount: 0, averageValidationDelta: 0, averageHoldoutDelta: 0 },
});
assert.deepEqual(empty.dnaAdminOverrideSnapshot, {
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
assert.deepEqual(empty.dnaAdminOverrideCoverage, {
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
assert.deepEqual(empty.dnaOverrideLineageAttribution, {
  activeInheritedStateCount: 0,
  activeInheritedContextCount: 0,
  archivedInheritedStateCount: 0,
  archivedInheritedContextCount: 0,
});
assert.deepEqual(empty.dnaAdminOverrideTimeline, {
  stateOverrideRuns: [],
  contextOverrideRuns: [],
});
assert.deepEqual(empty.dnaLineage, { activeGenomes: [], recentArchives: [] });
assert.equal(empty.dnaStateTotalsAvailable, true);

const populated = normalizeAisTrainingStats({
  total: 10,
  labeled: 6,
  pending: 3,
  invalid: 1,
  latestRun: {
    status: 'SHADOW_CHALLENGER',
    holdoutScore: 54,
    benchmarkScore: 50,
    promotionReasons: ['MIN_LABELED_OBSERVATIONS'],
  },
  dnaStateTotals: { active: 1, inactive: 2, deprecated: 3, lethal: 4 },
  dnaMutationTotals: {
    stateMutation: 5,
    contextMaskMutation: 6,
    contextMutationDetail: { blackSwanAdded: 2, blackSwanRemoved: 1, coreAdded: 4, coreRemoved: 3 },
    profileMutation: 7,
    profileMutationByKey: { expressionBudget: 1, dominanceBias: 2, decayResistance: 3, reactivationBias: 1 },
    copyNumberMutation: 8,
    copyNumberDirection: { up: 6, down: 2, flat: 0 },
    weightNudge: 9,
    vepFiltered: 10,
  },
  selectionTelemetry: { culledCount: 12, offspringCount: 6, mutantCount: 6, archiveCount: 12 },
  dnaOperations: { archiveCount: 2, averageFitnessHistoryDepth: 1.5, latestArchivedAt: '2026-06-22 10:00:00' },
  dnaRepairTelemetry: { accessionRepairCount: 4, contextMaskRepairCount: 3, profileRepairCount: 2, lastRepairedAt: '2026-06-22 11:00:00' },
  dnaContextSummary: { blackSwanStrategyGenes: 1, blackSwanActiveGenomes: 2, blackSwanArchivedGenomes: 3 },
  dnaContextPerformance: {
    blackSwanActive: { genomeCount: 2, averageLatestValidationScore: 51.5, averageLatestHoldoutScore: 49.3, averageMutationEvents: 4 },
    coreActive: { genomeCount: 3, averageLatestValidationScore: 55.1, averageLatestHoldoutScore: 53.2, averageMutationEvents: 2 },
    blackSwanArchive: { archiveCount: 5, averageGeneration: 4.2, lowPerformanceCount: 3, vepFilteredCount: 2 },
    coreArchive: { archiveCount: 6, averageGeneration: 3.1, lowPerformanceCount: 4, vepFilteredCount: 1 },
  },
  dnaContextPathway: {
    blackSwanActive: { genomeCount: 2, vepFilteredGenomes: 1, lastMutationEventCounts: { copy_number_mutation: 1 } },
    coreActive: { genomeCount: 3, vepFilteredGenomes: 0, lastMutationEventCounts: { state_mutation: 2 } },
    blackSwanArchive: { archiveCount: 5, lowPerformanceCount: 3, vepFilteredCount: 2, lastMutationEventCounts: { vep_filtered_deleterious_mutation: 2 } },
    coreArchive: { archiveCount: 6, lowPerformanceCount: 4, vepFilteredCount: 1, lastMutationEventCounts: { weight_nudge: 3 } },
  },
  dnaAdminOverrideTelemetry: {
    stateOverrideCount: 4,
    contextOverrideCount: 3,
    recentEvent: { event: 'admin_context_override', geneId: 'sg1', contextKey: 'BLACK_SWAN', action: 'added' },
    targetGeneCounts: { sg1: 4, sg2: 3 },
  },
  dnaAdminOverrideOutcome: {
    stateOverrideActive: { genomeCount: 2, averageLatestValidationScore: 52.2, averageLatestHoldoutScore: 49.8 },
    contextOverrideActive: { genomeCount: 1, averageLatestValidationScore: 50.1, averageLatestHoldoutScore: 48.4 },
    stateOverrideArchive: { archiveCount: 3, lowPerformanceCount: 2, averageLatestValidationScore: 45.6, averageLatestHoldoutScore: 42.9 },
    contextOverrideArchive: { archiveCount: 2, lowPerformanceCount: 1, averageLatestValidationScore: 41.3, averageLatestHoldoutScore: 39.7 },
  },
  dnaAdminOverrideDelta: {
    stateOverrideDelta: { overrideCount: 5, averageValidationDelta: 2.4, averageHoldoutDelta: 1.8 },
    contextOverrideDelta: { overrideCount: 3, averageValidationDelta: -0.7, averageHoldoutDelta: -0.3 },
  },
  dnaAdminOverrideSnapshot: {
    stateOverride: {
      overrideCount: 5,
      preAverageValidationScore: 49.8,
      preAverageHoldoutScore: 47.3,
      postAverageValidationScore: 52.2,
      postAverageHoldoutScore: 49.1,
    },
    contextOverride: {
      overrideCount: 3,
      preAverageValidationScore: 48.5,
      preAverageHoldoutScore: 46.2,
      postAverageValidationScore: 47.8,
      postAverageHoldoutScore: 45.9,
    },
  },
  dnaAdminOverrideCoverage: {
    stateOverride: {
      totalOverrideCount: 5,
      snapshotComparableCount: 4,
      timelineComparableCount: 3,
    },
    contextOverride: {
      totalOverrideCount: 3,
      snapshotComparableCount: 2,
      timelineComparableCount: 1,
    },
  },
  dnaOverrideLineageAttribution: {
    activeInheritedStateCount: 4,
    activeInheritedContextCount: 3,
    archivedInheritedStateCount: 2,
    archivedInheritedContextCount: 1,
  },
  dnaAdminOverrideTimeline: {
    stateOverrideRuns: [
      { runKey: 'run-7', genomeCount: 2, averageValidationScore: 52.2, averageHoldoutScore: 49.8 },
    ],
    contextOverrideRuns: [
      { runKey: 'run-8', genomeCount: 1, averageValidationScore: 50.1, averageHoldoutScore: 48.4 },
    ],
  },
  dnaLineage: {
    activeGenomes: [{ memberId: 'm1', genomeId: 'g1' }],
    recentArchives: [{ memberId: 'm9', genomeId: 'g9' }],
  },
  dnaStateTotalsAvailable: false,
});
assert.equal(populated.latestRun.holdoutScore, 54);
assert.deepEqual(populated.latestRun.promotionReasons, ['MIN_LABELED_OBSERVATIONS']);
assert.deepEqual(populated.dnaStateTotals, { active: 1, inactive: 2, deprecated: 3, lethal: 4 });
assert.deepEqual(populated.dnaMutationTotals, {
  stateMutation: 5,
  contextMaskMutation: 6,
  contextMutationDetail: { blackSwanAdded: 2, blackSwanRemoved: 1, coreAdded: 4, coreRemoved: 3 },
  profileMutation: 7,
  profileMutationByKey: { expressionBudget: 1, dominanceBias: 2, decayResistance: 3, reactivationBias: 1 },
  copyNumberMutation: 8,
  copyNumberDirection: { up: 6, down: 2, flat: 0 },
  weightNudge: 9,
  vepFiltered: 10,
});
assert.deepEqual(populated.selectionTelemetry, { culledCount: 12, offspringCount: 6, mutantCount: 6, archiveCount: 12 });
assert.deepEqual(populated.dnaOperations, { archiveCount: 2, averageFitnessHistoryDepth: 1.5, latestArchivedAt: '2026-06-22 10:00:00' });
assert.deepEqual(populated.dnaRepairTelemetry, { accessionRepairCount: 4, contextMaskRepairCount: 3, profileRepairCount: 2, lastRepairedAt: '2026-06-22 11:00:00' });
assert.deepEqual(populated.dnaContextSummary, { blackSwanStrategyGenes: 1, blackSwanActiveGenomes: 2, blackSwanArchivedGenomes: 3 });
assert.deepEqual(populated.dnaContextPerformance, {
  blackSwanActive: { genomeCount: 2, averageLatestValidationScore: 51.5, averageLatestHoldoutScore: 49.3, averageMutationEvents: 4 },
  coreActive: { genomeCount: 3, averageLatestValidationScore: 55.1, averageLatestHoldoutScore: 53.2, averageMutationEvents: 2 },
  blackSwanArchive: { archiveCount: 5, averageGeneration: 4.2, lowPerformanceCount: 3, vepFilteredCount: 2 },
  coreArchive: { archiveCount: 6, averageGeneration: 3.1, lowPerformanceCount: 4, vepFilteredCount: 1 },
});
assert.deepEqual(populated.dnaContextPathway, {
  blackSwanActive: { genomeCount: 2, vepFilteredGenomes: 1, lastMutationEventCounts: { copy_number_mutation: 1 } },
  coreActive: { genomeCount: 3, vepFilteredGenomes: 0, lastMutationEventCounts: { state_mutation: 2 } },
  blackSwanArchive: { archiveCount: 5, lowPerformanceCount: 3, vepFilteredCount: 2, lastMutationEventCounts: { vep_filtered_deleterious_mutation: 2 } },
  coreArchive: { archiveCount: 6, lowPerformanceCount: 4, vepFilteredCount: 1, lastMutationEventCounts: { weight_nudge: 3 } },
});
assert.deepEqual(populated.dnaAdminOverrideTelemetry, {
  stateOverrideCount: 4,
  contextOverrideCount: 3,
  recentEvent: { event: 'admin_context_override', geneId: 'sg1', contextKey: 'BLACK_SWAN', action: 'added' },
  targetGeneCounts: { sg1: 4, sg2: 3 },
});
assert.deepEqual(populated.dnaAdminOverrideOutcome, {
  stateOverrideActive: { genomeCount: 2, averageLatestValidationScore: 52.2, averageLatestHoldoutScore: 49.8 },
  contextOverrideActive: { genomeCount: 1, averageLatestValidationScore: 50.1, averageLatestHoldoutScore: 48.4 },
  stateOverrideArchive: { archiveCount: 3, lowPerformanceCount: 2, averageLatestValidationScore: 45.6, averageLatestHoldoutScore: 42.9 },
  contextOverrideArchive: { archiveCount: 2, lowPerformanceCount: 1, averageLatestValidationScore: 41.3, averageLatestHoldoutScore: 39.7 },
});
assert.deepEqual(populated.dnaAdminOverrideDelta, {
  stateOverrideDelta: { overrideCount: 5, averageValidationDelta: 2.4, averageHoldoutDelta: 1.8 },
  contextOverrideDelta: { overrideCount: 3, averageValidationDelta: -0.7, averageHoldoutDelta: -0.3 },
});
assert.deepEqual(populated.dnaAdminOverrideSnapshot, {
  stateOverride: {
    overrideCount: 5,
    preAverageValidationScore: 49.8,
    preAverageHoldoutScore: 47.3,
    postAverageValidationScore: 52.2,
    postAverageHoldoutScore: 49.1,
  },
  contextOverride: {
    overrideCount: 3,
    preAverageValidationScore: 48.5,
    preAverageHoldoutScore: 46.2,
    postAverageValidationScore: 47.8,
    postAverageHoldoutScore: 45.9,
  },
});
assert.deepEqual(populated.dnaAdminOverrideCoverage, {
  stateOverride: {
    totalOverrideCount: 5,
    snapshotComparableCount: 4,
    timelineComparableCount: 3,
  },
  contextOverride: {
    totalOverrideCount: 3,
    snapshotComparableCount: 2,
    timelineComparableCount: 1,
  },
});
assert.deepEqual(populated.dnaOverrideLineageAttribution, {
  activeInheritedStateCount: 4,
  activeInheritedContextCount: 3,
  archivedInheritedStateCount: 2,
  archivedInheritedContextCount: 1,
});
assert.deepEqual(populated.dnaAdminOverrideTimeline, {
  stateOverrideRuns: [
    { runKey: 'run-7', genomeCount: 2, averageValidationScore: 52.2, averageHoldoutScore: 49.8 },
  ],
  contextOverrideRuns: [
    { runKey: 'run-8', genomeCount: 1, averageValidationScore: 50.1, averageHoldoutScore: 48.4 },
  ],
});
assert.deepEqual(populated.dnaLineage, {
  activeGenomes: [{ memberId: 'm1', genomeId: 'g1' }],
  recentArchives: [{ memberId: 'm9', genomeId: 'g9' }],
});
assert.equal(populated.dnaStateTotalsAvailable, false);

console.log('aisTrainingView tests passed');


