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
assert.deepEqual(populated.dnaLineage, {
  activeGenomes: [{ memberId: 'm1', genomeId: 'g1' }],
  recentArchives: [{ memberId: 'm9', genomeId: 'g9' }],
});
assert.equal(populated.dnaStateTotalsAvailable, false);

console.log('aisTrainingView tests passed');


