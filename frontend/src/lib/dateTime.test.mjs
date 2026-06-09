import assert from 'node:assert/strict';

import { formatKoreanDateTime } from './dateTime.js';

assert.equal(
  formatKoreanDateTime('2026-06-08 19:01:38'),
  '2026-06-09 04:01:38 KST'
);
assert.equal(
  formatKoreanDateTime('2026-06-08T19:01:38Z'),
  '2026-06-09 04:01:38 KST'
);
assert.equal(
  formatKoreanDateTime('2026-06-09T04:01:38+09:00'),
  '2026-06-09 04:01:38 KST'
);
assert.equal(formatKoreanDateTime(null), '-');

console.log('ok - Korean date time formatting');
