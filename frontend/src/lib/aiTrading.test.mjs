import assert from 'node:assert/strict';

import {
  isFreshAiStrategy,
  parseAiLogCreatedAt,
} from './aiTrading.js';

const sqliteUtcTimestamp = '2026-06-05 17:09:03';
const fiveMinutesLaterKst = new Date('2026-06-06T02:14:03+09:00').getTime();

assert.equal(
  parseAiLogCreatedAt(sqliteUtcTimestamp),
  Date.parse('2026-06-05T17:09:03Z')
);

assert.equal(
  isFreshAiStrategy(sqliteUtcTimestamp, fiveMinutesLaterKst),
  true
);

assert.equal(
  isFreshAiStrategy(sqliteUtcTimestamp, fiveMinutesLaterKst + 16 * 60 * 1000),
  false
);

console.log('ok - AI trading strategy timestamp freshness');
