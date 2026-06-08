import assert from 'node:assert/strict';

import {
  findTrustWalletProvider,
  buildTrustWalletOpenUrl,
  getInjectedProviders,
  getPreferredInjectedProvider,
  normalizeChainId,
  resolveWalletTransactionProvider,
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

  ['builds direct Trust Wallet app open_url links', () => {
    const url = buildTrustWalletOpenUrl('https://edenai.alonics.com/register?google_email=a%40b.com');

    assert.equal(
      url,
      'trust://open_url?coin_id=966&url=https%3A%2F%2Fedenai.alonics.com%2Fregister%3Fgoogle_email%3Da%2540b.com'
    );
  }],
  ['resolves Trust Wallet from multiple injected providers', async () => {
    const metaMaskProvider = { isMetaMask: true };
    const trustProvider = { isTrustWallet: true };

    assert.equal(
      await resolveWalletTransactionProvider({
        ethereum: { providers: [metaMaskProvider, trustProvider] },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }),
      trustProvider
    );
  }],
  ['rejects missing Trust Wallet provider without alternate wallet fallbacks', async () => {
    await assert.rejects(
      () => resolveWalletTransactionProvider({
        ethereum: undefined,
        userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/26.0 Chrome/125.0 Mobile Safari/537.36',
      }),
      /NO_TRUST_WALLET/
    );
  }],
];

for (const [name, run] of tests) {
  await run();
  console.log(`ok - ${name}`);
}
