const assert = require('assert');
const { summarizeDnaStates, extractPhenotype } = require('./aisDnaSummary');

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
