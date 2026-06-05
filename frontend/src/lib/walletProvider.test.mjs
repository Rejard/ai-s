import assert from 'node:assert/strict';

import {
  findTrustWalletProvider,
  buildTrustWalletOpenUrl,
  getInjectedProviders,
  getPreferredInjectedProvider,
  isMobileChromeWithoutInjectedWallet,
  normalizeChainId,
} from './walletProvider.js';

const tests = [
  ['returns providers from the EIP-6963-style providers array', () => {
    const trustProvider = { isTrustWallet: true };
    const metaMaskProvider = { isMetaMask: true };
    const ethereum = { providers: [metaMaskProvider, trustProvider] };

    assert.deepEqual(getInjectedProviders(ethereum), [metaMaskProvider, trustProvider]);
  }],

  ['prefers Trust Wallet when multiple injected wallets exist', () => {
    const metaMaskProvider = { isMetaMask: true };
    const trustProvider = { isTrustWallet: true };

    assert.equal(getPreferredInjectedProvider({ providers: [metaMaskProvider, trustProvider] }), trustProvider);
  }],

  ['recognizes Trust Wallet provider variants', () => {
    assert.equal(findTrustWalletProvider([{ isTrust: true }]).isTrust, true);
    assert.equal(findTrustWalletProvider([{ info: { rdns: 'com.trustwallet.app' } }]).info.rdns, 'com.trustwallet.app');
  }],

  ['normalizes chain ids to lowercase hex', () => {
    assert.equal(normalizeChainId('137'), '0x89');
    assert.equal(normalizeChainId('0x0089'), '0x89');
    assert.equal(normalizeChainId(137), '0x89');
    assert.equal(normalizeChainId(''), '');
    assert.equal(normalizeChainId('not-a-chain'), '');
  }],

  ['detects mobile Chrome without an injected wallet', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36';

    assert.equal(isMobileChromeWithoutInjectedWallet(ua, undefined), true);
    assert.equal(isMobileChromeWithoutInjectedWallet(ua, { request() {} }), false);
  }],

  ['builds Trust Wallet universal open_url links', () => {
    const url = buildTrustWalletOpenUrl('https://edenai.alonics.com/register?google_email=a%40b.com');

    assert.equal(
      url,
      'https://link.trustwallet.com/open_url?coin_id=966&url=https%3A%2F%2Fedenai.alonics.com%2Fregister%3Fgoogle_email%3Da%2540b.com'
    );
  }],
];

for (const [name, run] of tests) {
  run();
  console.log(`ok - ${name}`);
}
