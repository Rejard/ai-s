import assert from 'node:assert/strict';

import {
  buildApprovalRecoveryResumeUrl,
  executeSutApprovalFlow,
  hasApprovalRecoveryResumeFlag,
} from './sutApprovalFlow.js';

const resumeUrl = buildApprovalRecoveryResumeUrl('https://ais.alonics.com/dashboard?foo=1');
assert.equal(
  resumeUrl,
  'https://ais.alonics.com/dashboard?foo=1&recover_sut_approval=1'
);
assert.equal(hasApprovalRecoveryResumeFlag(resumeUrl), true);
assert.equal(hasApprovalRecoveryResumeFlag('https://ais.alonics.com/dashboard'), false);

const alerts = [];
const successSteps = [];

const successResult = await executeSutApprovalFlow({
  ethereum: { isTrustWallet: true },
  currentUrl: 'https://ais.alonics.com/dashboard',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  alertFn(message) {
    alerts.push(message);
  },
  confirmFn() {
    throw new Error('confirm should not run on success');
  },
  setLocationHref() {
    throw new Error('redirect should not run on success');
  },
  approveFn: async ({ ethereum }) => {
    assert.deepEqual(ethereum, { isTrustWallet: true });
    successSteps.push('approve');
    return { hash: '0xapprove' };
  },
  waitFn: async (tx) => {
    assert.equal(tx.hash, '0xapprove');
    successSteps.push('wait');
    return { status: 1 };
  },
  buildOpenUrlFn() {
    throw new Error('open url builder should not run on success');
  },
  onApproved() {
    successSteps.push('approved');
  },
  resolveProviderFn: async () => ({
    async request({ method }) {
      assert.equal(method, 'eth_requestAccounts');
      return ['0xabc'];
    },
  }),
});

assert.equal(successResult.status, 'approved');
assert.deepEqual(successSteps, ['approve', 'wait', 'approved']);
assert.equal(alerts.length, 3);

let redirectedTo = null;
const mobileFallbackResult = await executeSutApprovalFlow({
  ethereum: undefined,
  currentUrl: 'https://ais.alonics.com/dashboard',
  userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  alertFn() {},
  confirmFn(message) {
    assert.match(message, /Trust Wallet/);
    return true;
  },
  setLocationHref(url) {
    redirectedTo = url;
  },
  approveFn: async () => {
    throw new Error('NO_TRUST_WALLET');
  },
  waitFn: async () => {
    throw new Error('wait should not run when wallet is missing');
  },
  buildOpenUrlFn(url) {
    assert.equal(url, 'https://ais.alonics.com/dashboard?recover_sut_approval=1');
    return `trust://open_url?url=${encodeURIComponent(url)}`;
  },
});

assert.equal(mobileFallbackResult.status, 'redirected');
assert.equal(
  redirectedTo,
  'trust://open_url?url=https%3A%2F%2Fais.alonics.com%2Fdashboard%3Frecover_sut_approval%3D1'
);

let approveCalled = false;
const mismatchedWallet = await executeSutApprovalFlow({
  ethereum: { isTrustWallet: true },
  currentUrl: 'https://ais.alonics.com/dashboard',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  expectedWalletAddress: '0xabc',
  alertFn(message) {
    assert.match(message, /다른 지갑|different wallet|가입 지갑/i);
  },
  confirmFn() {
    throw new Error('confirm should not run for wallet mismatch');
  },
  setLocationHref() {
    throw new Error('redirect should not run for wallet mismatch');
  },
  approveFn: async () => {
    approveCalled = true;
    return { hash: '0xapprove' };
  },
  waitFn: async () => {
    throw new Error('wait should not run for wallet mismatch');
  },
  resolveProviderFn: async () => ({
    async request({ method }) {
      assert.equal(method, 'eth_requestAccounts');
      return ['0xdef'];
    },
  }),
});

assert.equal(mismatchedWallet.status, 'wallet_mismatch');
assert.equal(approveCalled, false);

const rejected = await executeSutApprovalFlow({
  ethereum: { isTrustWallet: true },
  currentUrl: 'https://ais.alonics.com/dashboard',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  alertFn() {},
  confirmFn() {
    throw new Error('confirm should not run for rejection');
  },
  setLocationHref() {
    throw new Error('redirect should not run for rejection');
  },
  approveFn: async () => {
    const error = new Error('rejected by user');
    error.code = 'ACTION_REJECTED';
    throw error;
  },
  waitFn: async () => {
    throw new Error('wait should not run for rejection');
  },
  buildOpenUrlFn() {
    throw new Error('open url builder should not run for rejection');
  },
  resolveProviderFn: async () => ({
    async request({ method }) {
      assert.equal(method, 'eth_requestAccounts');
      return ['0xabc'];
    },
  }),
});

assert.equal(rejected.status, 'rejected');

console.log('ok - sut approval flow');
