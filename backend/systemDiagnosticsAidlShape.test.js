const assert = require('node:assert/strict');

const adminRouter = require('./routes/admin');
const {
  hasValidCentroidShape,
  determineFactionForDiagnostics,
} = adminRouter.__private__;

const centroids10 = {
  BUY: [-0.1108, -0.1008, 0.1537, 0.3614, -0.2077, 0, 0, 0, 0, 0],
  SELL: [0.1, -0.0614, -0.0543, 0.1123, -0.1666, 0, 0, 0, 0, 0],
  HOLD: [-0.0186, -0.0223, 0.0179, 0.0567, -0.0387, 0, 0, 0, 0, 0],
};

const centroids5 = {
  BUY: [-0.1108, -0.1008, 0.1537, 0.3614, -0.2077],
  SELL: [0.1, -0.0614, -0.0543, 0.1123, -0.1666],
  HOLD: [-0.0186, -0.0223, 0.0179, 0.0567, -0.0387],
};

assert.equal(typeof hasValidCentroidShape, 'function');
assert.equal(hasValidCentroidShape(centroids10), true);
assert.equal(hasValidCentroidShape(centroids5), false);

const dnaWithStoredHint = {
  genome_id: 'AISG-G3-test',
  generation: 3,
  faction_hint: 'EXPRESSION_DOMINANT',
  regulatory_profile: {
    expression_budget: 12,
    dominance_bias: 1,
    decay_resistance: 0.3,
    reactivation_bias: 0.1,
  },
  strategy_genes: [],
  mutation_log: [],
};

assert.equal(typeof determineFactionForDiagnostics, 'function');
assert.equal(
  determineFactionForDiagnostics(dnaWithStoredHint, 'legacy_member'),
  'EXPRESSION_DOMINANT'
);

console.log('ok - diagnostics enforces 10-vector centroids and stored faction hints');
