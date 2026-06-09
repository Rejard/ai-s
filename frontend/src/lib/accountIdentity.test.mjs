import assert from 'node:assert/strict';

import {
  isAdminGoogleAccount,
  isManagerAccount,
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
assert.equal(isManagerAccount({ isManager: true }, 'manager@example.com', ''), true);
assert.equal(isManagerAccount({ is_manager: 1 }, 'manager@example.com', ''), true);
assert.equal(isManagerAccount({ isManager: false }, 'member@example.com', '0x123'), false);
assert.equal(isManagerAccount(null, 'lemaiiisk@gmail.com', ''), true);

console.log('ok - Google account and wallet ownership matching');
