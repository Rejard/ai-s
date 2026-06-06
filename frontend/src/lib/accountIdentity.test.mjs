import assert from 'node:assert/strict';

import {
  isAdminGoogleAccount,
  isWalletOwnedByGoogleAccount,
  normalizeAccountEmail,
} from './accountIdentity.js';

assert.equal(normalizeAccountEmail('  User@Example.COM '), 'user@example.com');
assert.equal(
  isWalletOwnedByGoogleAccount({ email: 'user@example.com' }, 'USER@example.com'),
  true
);
assert.equal(
  isWalletOwnedByGoogleAccount({ email: 'first@example.com' }, 'second@example.com'),
  false
);
assert.equal(isWalletOwnedByGoogleAccount({ email: 'first@example.com' }, ''), false);
assert.equal(isAdminGoogleAccount('lemaiiisk@gmail.com'), true);
assert.equal(isAdminGoogleAccount(' LEMAIIISK@GMAIL.COM '), true);
assert.equal(isAdminGoogleAccount('member@example.com'), false);

console.log('ok - Google account and wallet ownership matching');
