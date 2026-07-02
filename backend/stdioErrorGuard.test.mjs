import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachStdioErrorGuard } from './stdioErrorGuard.js';

const streams = [new EventEmitter(), new EventEmitter()];
let unexpectedError = null;

attachStdioErrorGuard(streams, (error) => {
  unexpectedError = error;
});

assert.doesNotThrow(() => streams[0].emit('error', Object.assign(new Error('write EOF'), { code: 'EOF' })));
assert.doesNotThrow(() => streams[1].emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' })));
assert.equal(unexpectedError, null);

const otherError = Object.assign(new Error('disk full'), { code: 'ENOSPC' });
streams[0].emit('error', otherError);
assert.equal(unexpectedError, otherError);

console.log('stdioErrorGuard tests passed');
