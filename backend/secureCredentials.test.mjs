import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { decryptText, encryptText } = require('./secureCredentials');

const secret = 'test-encryption-secret';
const plainText = 'gateio-secret-value';
const encrypted = encryptText(plainText, secret);

assert.notEqual(encrypted, plainText);
assert.match(encrypted, /^v1:/);
assert.equal(decryptText(encrypted, secret), plainText);
assert.notEqual(encryptText(plainText, secret), encrypted);

console.log('ok - secure credential encryption');
