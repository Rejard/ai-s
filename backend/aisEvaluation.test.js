const assert = require('assert');
const {
  LABEL_VERSION,
  evaluateDecision,
  isEvaluationDue,
  isLegacyContaminated,
  assessPromotionEligibility,
  toKstSqliteTimestamp,
  addMinutesToSqliteTimestamp,
} = require('./aisEvaluation');

assert.strictEqual(
  toKstSqliteTimestamp(new Date('2026-06-09T03:00:00.000Z')),
  '2026-06-09 12:00:00'
);
assert.strictEqual(
  addMinutesToSqliteTimestamp('2026-06-09 12:00:00', 5),
  '2026-06-09 12:05:00'
);

assert.strictEqual(
  isEvaluationDue('2026-06-09 12:05:00', '2026-06-09 12:04:59'),
  false
);
assert.strictEqual(
  isEvaluationDue('2026-06-09 12:05:00', '2026-06-09 12:05:00'),
  true
);

assert.strictEqual(evaluateDecision({
  decision: 'BUY',
  currentPrice: 100,
  futurePrice: 100.21,
}).correct, 1);
assert.strictEqual(evaluateDecision({
  decision: 'BUY',
  currentPrice: 100,
  futurePrice: 100.2,
}).correct, 0);
assert.strictEqual(evaluateDecision({
  decision: 'SELL',
  currentPrice: 100,
  futurePrice: 99.79,
}).correct, 1);
assert.strictEqual(evaluateDecision({
  decision: 'HOLD',
  currentPrice: 100,
  futurePrice: 100.2,
}).correct, 1);
assert.strictEqual(evaluateDecision({
  decision: 'HOLD',
  currentPrice: 100,
  futurePrice: 100.21,
}).correct, 0);

assert.strictEqual(isLegacyContaminated({
  currentPrice: 0.15,
  futurePrice: 0.15,
  labelVersion: 1,
}), true);
assert.strictEqual(isLegacyContaminated({
  currentPrice: 0.15,
  futurePrice: 0.15,
  labelVersion: LABEL_VERSION,
}), false);

assert.deepStrictEqual(assessPromotionEligibility({
  labeledCount: 299,
  invalidCount: 0,
  holdoutScore: 60,
  benchmarkScore: 50,
  classCounts: { BUY: 100, SELL: 100, HOLD: 99 },
}), {
  eligible: false,
  reasons: ['MIN_LABELED_OBSERVATIONS'],
});

assert.deepStrictEqual(assessPromotionEligibility({
  labeledCount: 300,
  invalidCount: 0,
  holdoutScore: 52.99,
  benchmarkScore: 50,
  classCounts: { BUY: 100, SELL: 100, HOLD: 100 },
}), {
  eligible: false,
  reasons: ['MIN_BENCHMARK_MARGIN'],
});

assert.deepStrictEqual(assessPromotionEligibility({
  labeledCount: 300,
  invalidCount: 0,
  holdoutScore: 53,
  benchmarkScore: 50,
  classCounts: { BUY: 100, SELL: 100, HOLD: 100 },
}), {
  eligible: true,
  reasons: [],
});

console.log('aisEvaluation tests passed');
