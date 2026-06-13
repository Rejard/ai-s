import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { applyManagerAutoRangeSettings } = require('./managerAutoRange.js');

const calls = [];
const fakeQueries = {
  async run(sql, params) {
    calls.push({ sql, params });
    return { changes: 2 };
  },
};

const updated = await applyManagerAutoRangeSettings({
  queries: fakeQueries,
  proposedLower: 0.12,
  proposedUpper: 0.31,
});

assert.equal(updated, 2);
assert.equal(calls.length, 1);
assert.match(calls[0].sql, /ai_grid_auto_range = 'ON'/);
assert.deepEqual(calls[0].params, [0.12, 0.31]);

calls.length = 0;

const skipped = await applyManagerAutoRangeSettings({
  queries: fakeQueries,
  proposedLower: Number.NaN,
  proposedUpper: 0.31,
});

assert.equal(skipped, 0);
assert.equal(calls.length, 0);

console.log('ok - manager auto range application');
