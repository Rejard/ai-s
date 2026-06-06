import assert from 'node:assert/strict';

import {
  POLYGON_MAINNET_CHAIN_ID,
  SUT_APPROVE_DECIMALS,
  SUT_APPROVE_UNITS,
  addGasEstimateBuffer,
  approveSutWithdrawalPermission,
  calculateRequiredGasWei,
  getWalletConnectProjectId,
  isPolygonMainnetChain,
  toSutApprovalAmount,
  waitForSuccessfulApproval,
} from './sutApproval.js';

assert.equal(POLYGON_MAINNET_CHAIN_ID, '0x89');
assert.equal(SUT_APPROVE_DECIMALS, 18);
assert.equal(isPolygonMainnetChain('0x89'), true);
assert.equal(isPolygonMainnetChain('137'), true);
assert.equal(isPolygonMainnetChain('0x1'), false);
assert.equal(toSutApprovalAmount().toString(), '1000000000000000000000000');
assert.equal(toSutApprovalAmount('2').toString(), '2000000000000000000');
assert.equal(SUT_APPROVE_UNITS, '1000000');
assert.equal(addGasEstimateBuffer(100000n), 120000n);
assert.equal(calculateRequiredGasWei(100000n, 30n), 3600000n);
assert.equal(getWalletConnectProjectId({ VITE_WALLETCONNECT_PROJECT_ID: 'abc123' }), 'abc123');
assert.equal(getWalletConnectProjectId({}), '');

assert.deepEqual(
  await waitForSuccessfulApproval({ wait: async () => ({ status: 1, hash: '0xabc' }) }),
  { status: 1, hash: '0xabc' }
);

await assert.rejects(
  () => waitForSuccessfulApproval({ wait: async () => ({ status: 0 }) }),
  /APPROVAL_TX_REVERTED/
);

await assert.rejects(
  () => approveSutWithdrawalPermission({
    ethereum: undefined,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0 Safari/537.36',
  }),
  /NO_INJECTED_WALLET/
);

await assert.rejects(
  () => approveSutWithdrawalPermission({
    ethereum: undefined,
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36',
  }),
  /MOBILE_CHROME_REQUIRES_WALLET_APP/
);

console.log('ok - sut approval configuration');
