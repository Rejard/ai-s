const assert = require('node:assert/strict');
const { bootstrapCouncilDnaPayload } = require('./database');

const weights = {
  BUY: [-0.5, -0.4, 0.1, 0.0, 0.05],
  SELL: [0.4, 0.3, -0.1, -0.05, 0.02],
  HOLD: [0.0, 0.0, 0.0, 0.0, 0.0],
};

const payload = bootstrapCouncilDnaPayload(
  weights,
  'legacy_member_01',
  'VALUE_SEEKER',
  2
);

const dna = JSON.parse(payload.dna_json);
const phenotype = JSON.parse(payload.phenotype_json);
const strategyGene = dna.strategy_genes[0];

assert.equal(dna.genome_id.startsWith('AISG-G2-'), true);
assert.deepEqual(strategyGene.context_mask, [
  'BULL_EXPANSION',
  'BEAR_SQUEEZE',
  'SIDEWAYS_DRIFT',
  'BLACK_SWAN',
  'LOW_VOLUME',
]);
const expectedPadded = {
  BUY: [-0.5, -0.4, 0.1, 0.0, 0.05, 0, 0, 0, 0, 0],
  SELL: [0.4, 0.3, -0.1, -0.05, 0.02, 0, 0, 0, 0, 0],
  HOLD: [0.0, 0.0, 0.0, 0.0, 0.0, 0, 0, 0, 0, 0],
};
assert.deepEqual(phenotype, expectedPadded);
assert.deepEqual(dna.mutation_log, []);

console.log('database DNA bootstrap tests passed');
