import assert from 'node:assert/strict';
import { normalizeAisTrainingStats } from './aisTrainingView.js';

const empty = normalizeAisTrainingStats({});
assert.equal(empty.total, 0);
assert.equal(empty.shadowOnly, true);
assert.equal(empty.automaticPromotionEnabled, false);
assert.equal(empty.latestRun, null);
assert.deepEqual(empty.byDecision.BUY, { count: 0, correct: 0, accuracy: 0 });
assert.deepEqual(empty.dnaStateTotals, { active: 0, inactive: 0, deprecated: 0, lethal: 0 });
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
  dnaStateTotalsAvailable: false,
});
assert.equal(populated.latestRun.holdoutScore, 54);
assert.deepEqual(populated.latestRun.promotionReasons, ['MIN_LABELED_OBSERVATIONS']);
assert.deepEqual(populated.dnaStateTotals, { active: 1, inactive: 2, deprecated: 3, lethal: 4 });
assert.equal(populated.dnaStateTotalsAvailable, false);

console.log('aisTrainingView tests passed');
