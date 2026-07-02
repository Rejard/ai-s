import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { writeToChildStdin } from './childProcessStdin.js';

class ClosingStdin extends Writable {
  _write(_chunk, _encoding, callback) {
    callback(Object.assign(new Error('write EOF'), { code: 'EOF' }));
  }
}

const proc = { stdin: new ClosingStdin() };
const result = await writeToChildStdin(proc, 'payload');

assert.equal(result.ok, false);
assert.equal(result.error.code, 'EOF');

console.log('childProcessStdin tests passed');
