import assert from 'node:assert/strict';
import { normalizeAisTrainingStats } from './aisTrainingView.js';

const empty = normalizeAisTrainingStats({});
assert.equal(empty.total, 0);
assert.equal(empty.shadowOnly, true);
assert.equal(empty.automaticPromotionEnabled, false);
assert.equal(empty.latestRun, null);
assert.deepEqual(empty.byDecision.BUY, { count: 0, correct: 0, accuracy: 0 });

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
});
assert.equal(populated.latestRun.holdoutScore, 54);
assert.deepEqual(populated.latestRun.promotionReasons, ['MIN_LABELED_OBSERVATIONS']);

console.log('aisTrainingView tests passed');
