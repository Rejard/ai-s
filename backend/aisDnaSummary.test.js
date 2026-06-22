const assert = require('assert');
const { summarizeDnaStates, summarizeMutationLog, extractPhenotype } = require('./aisDnaSummary');

const dna = {
  strategy_genes: [
    {
      state: 'A',
      subgenes: [
        { state: 'A' },
        { state: 'I' },
        { state: 'D' },
        { state: 'L' },
      ],
    },
  ],
};

assert.deepStrictEqual(summarizeDnaStates(dna), {
  active: 2,
  inactive: 1,
  deprecated: 1,
  lethal: 1,
});

assert.deepStrictEqual(summarizeDnaStates('null'), {
  active: 0,
  inactive: 0,
  deprecated: 0,
  lethal: 0,
});

assert.deepStrictEqual(summarizeDnaStates('{"strategy_genes":{"state":"A"}}'), {
  active: 0,
  inactive: 0,
  deprecated: 0,
  lethal: 0,
});

assert.deepStrictEqual(summarizeMutationLog({
  mutation_log: [
    { event: 'context_mask_mutation', context_key: 'BLACK_SWAN', action: 'added' },
    { event: 'context_mask_mutation', context_key: 'BLACK_SWAN', action: 'removed' },
    { event: 'context_mask_mutation', context_key: 'BULL_EXPANSION', action: 'added' },
    { event: 'context_mask_mutation', context_key: 'BEAR_SQUEEZE', action: 'removed' },
  ],
}), {
  stateMutation: 0,
  contextMaskMutation: 4,
  contextMutationDetail: {
    blackSwanAdded: 1,
    blackSwanRemoved: 1,
    coreAdded: 1,
    coreRemoved: 1,
  },
  profileMutation: 0,
  profileMutationByKey: {
    expressionBudget: 0,
    dominanceBias: 0,
    decayResistance: 0,
    reactivationBias: 0,
  },
  copyNumberMutation: 0,
  copyNumberDirection: {
    up: 0,
    down: 0,
    flat: 0,
  },
  weightNudge: 0,
  vepFiltered: 0,
});

assert.deepStrictEqual(
  extractPhenotype('{"BUY":[1,0,0,0,0],"SELL":[0,1,0,0,0],"HOLD":[0,0,1,0,0]}').BUY,
  [1, 0, 0, 0, 0]
);

assert.deepStrictEqual(extractPhenotype('{}'), {
  BUY: [0, 0, 0, 0, 0],
  SELL: [0, 0, 0, 0, 0],
  HOLD: [0, 0, 0, 0, 0],
});

console.log('aisDnaSummary tests passed');
