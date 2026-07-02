import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const pageFile of ['../pages/manager_dashboard.jsx']) {
  const source = await readFile(new URL(pageFile, import.meta.url), 'utf8');

  assert.equal(
    source.includes('EditUserModal'),
    true,
    `${pageFile} must render the member edit modal`
  );
  assert.equal(
    source.includes('setEditingUserWallet(user.wallet_address)'),
    true,
    `${pageFile} must open the edit modal when a member is clicked`
  );
  assert.equal(
    source.includes('/manager/edit-user/'),
    false,
    `${pageFile} must not navigate to the removed edit-user route`
  );
}

console.log('ok - manager member edit modal wiring');
