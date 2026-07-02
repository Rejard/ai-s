const assert = require('assert');
const { buildDeterministicCouncilDna, bootstrapCouncilDnaPayload } = require('./database');

const VALID_WEIGHTS = {
  BUY: [0.1, 0.2, 0.3, 0.4, 0.5, 0, 0, 0, 0, 0],
  SELL: [0.5, 0.4, 0.3, 0.2, 0.1, 0, 0, 0, 0, 0],
  HOLD: [0.3, 0.3, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0],
};

async function main() {
  const dna = buildDeterministicCouncilDna(VALID_WEIGHTS, 'test_member_01', 'DECAY_RESISTANT', 3);

  assert.ok(dna.genome_id, 'T1: genome_id exists');
  assert.ok(dna.lineage, 'T1: lineage exists');
  assert.ok(dna.regulatory_profile, 'T1: regulatory_profile exists');
  assert.ok(Array.isArray(dna.strategy_genes), 'T1: strategy_genes is array');
  assert.ok(Array.isArray(dna.mutation_log), 'T1: mutation_log is array');
  assert.strictEqual(dna.generation, 3, 'T1: generation matches input');
  assert.strictEqual(dna.faction_hint, 'DECAY_RESISTANT', 'T1: faction_hint matches input');

  assert.ok(/^AISG-G3-[a-f0-9]{8}$/.test(dna.genome_id), 'T2: genome_id format AISG-G{gen}-{hash}');

  const dnaNullFaction = buildDeterministicCouncilDna(VALID_WEIGHTS, 'test_m', null, 1);
  assert.strictEqual(dnaNullFaction.faction_hint, 'UNCLASSIFIED', 'T3: null faction defaults to UNCLASSIFIED');
  const dnaUndefinedFaction = buildDeterministicCouncilDna(VALID_WEIGHTS, 'test_m', undefined, 1);
  assert.strictEqual(dnaUndefinedFaction.faction_hint, 'UNCLASSIFIED', 'T3: undefined faction defaults');

  const dnaGenNull = buildDeterministicCouncilDna(VALID_WEIGHTS, 'test_m', 'X', null);
  assert.strictEqual(dnaGenNull.generation, 1, 'T4: null generation normalizes to 1');
  const dnaGenZero = buildDeterministicCouncilDna(VALID_WEIGHTS, 'test_m', 'X', 0);
  assert.strictEqual(dnaGenZero.generation, 1, 'T4: 0 generation normalizes to 1');
  const dnaGenNeg = buildDeterministicCouncilDna(VALID_WEIGHTS, 'test_m', 'X', -5);
  assert.strictEqual(dnaGenNeg.generation, 1, 'T4: negative generation normalizes to 1');

  const expectedMask = ['BULL_EXPANSION', 'BEAR_SQUEEZE', 'SIDEWAYS_DRIFT', 'BLACK_SWAN', 'LOW_VOLUME'];
  assert.deepStrictEqual(dna.strategy_genes[0].context_mask, expectedMask, 'T5: context_mask has 5 market states');

  const subgenes = dna.strategy_genes[0].subgenes;
  assert.strictEqual(subgenes.length, 30, 'T6: 30 subgenes (3 actions x 10 features)');

  const buySubgenes = subgenes.filter(s => s.action === 'BUY');
  const sellSubgenes = subgenes.filter(s => s.action === 'SELL');
  const holdSubgenes = subgenes.filter(s => s.action === 'HOLD');
  assert.strictEqual(buySubgenes.length, 10, 'T7: 10 BUY subgenes');
  assert.strictEqual(sellSubgenes.length, 10, 'T7: 10 SELL subgenes');
  assert.strictEqual(holdSubgenes.length, 10, 'T7: 10 HOLD subgenes');
  assert.strictEqual(buySubgenes[0].weight, 0.1, 'T7: BUY[0] weight correct');
  assert.strictEqual(sellSubgenes[4].weight, 0.1, 'T7: SELL[4] weight correct');

  const dna2 = buildDeterministicCouncilDna(VALID_WEIGHTS, 'test_member_01', 'DECAY_RESISTANT', 3);
  assert.deepStrictEqual(dna, dna2, 'T8: deterministic - same inputs produce same output');

  const dnaDiff = buildDeterministicCouncilDna(VALID_WEIGHTS, 'different_member', 'DECAY_RESISTANT', 3);
  assert.notStrictEqual(dna.genome_id, dnaDiff.genome_id, 'T9: different memberId produces different genome_id');

  assert.ok(dna.lineage.ancestor_ids.includes('test_member_01'), 'T10: ancestor_ids contains memberId');

  const payload = bootstrapCouncilDnaPayload(VALID_WEIGHTS, 'test_m', 'EXPRESSION_DOMINANT', 2);
  assert.strictEqual(typeof payload.dna_json, 'string', 'T11: dna_json is string');
  assert.strictEqual(typeof payload.phenotype_json, 'string', 'T11: phenotype_json is string');

  const parsedDna = JSON.parse(payload.dna_json);
  assert.ok(parsedDna.genome_id, 'T12: dna_json parses to valid DNA');
  assert.ok(parsedDna.strategy_genes, 'T12: parsed DNA has strategy_genes');

  assert.strictEqual(payload.phenotype_json, JSON.stringify(VALID_WEIGHTS), 'T13: phenotype_json equals JSON.stringify(weights)');

  assert.throws(
    () => bootstrapCouncilDnaPayload({ SELL: [1,2,3,4,5], HOLD: [1,2,3,4,5] }, 'm', 'X', 1),
    /canonical/i,
    'T14: throws on missing BUY key'
  );

  const shortPayload = bootstrapCouncilDnaPayload({ BUY: [1,2,3], SELL: [1,2,3,4,5], HOLD: [1,2,3,4,5] }, 'm', 'X', 1);
  const shortDna = JSON.parse(shortPayload.dna_json);
  assert.ok(shortDna.genome_id, 'T15: shorter arrays are auto-padded and accepted');

  assert.throws(
    () => bootstrapCouncilDnaPayload({ BUY: ['a','b','c','d','e'], SELL: [1,2,3,4,5], HOLD: [1,2,3,4,5] }, 'm', 'X', 1),
    /canonical/i,
    'T16: throws on non-numeric values'
  );

  assert.throws(
    () => bootstrapCouncilDnaPayload(null, 'm', 'X', 1),
    /canonical/i,
    'T17: throws on null weights'
  );

  assert.throws(
    () => bootstrapCouncilDnaPayload({}, 'm', 'X', 1),
    /canonical/i,
    'T18: throws on empty object'
  );

  assert.throws(
    () => bootstrapCouncilDnaPayload([], 'm', 'X', 1),
    /canonical/i,
    'T19: throws on array input'
  );

  assert.throws(
    () => bootstrapCouncilDnaPayload(
      { BUY: [1,2,3,4,5], SELL: [1,2,3,4,5], HOLD: [1,2,3,4,5], EXTRA: [1,2,3,4,5] },
      'm', 'X', 1
    ),
    /canonical/i,
    'T20: throws on extra keys'
  );

  console.log('buildDeterministicDna tests passed');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
