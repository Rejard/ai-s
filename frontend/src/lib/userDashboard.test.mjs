import assert from 'node:assert/strict';

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

import {
  buildDepositFinalizeUrl,
  buildDepositResumeUrl,
  buildTrustWalletDepositRedirectUrl,
  buildNextPriceHistory,
  finalizePendingDepositTransaction,
  FINALIZE_SUT_DEPOSIT_PARAM,
  FINALIZE_SUT_TX_HASH_PARAM,
  RESUME_SUT_AMOUNT_PARAM,
  loadUserDashboardData,
  loadUserTxHistory,
  submitUserInvestmentTransaction,
} from './userDashboard.js';

assert.equal(
  buildDepositResumeUrl('https://edenai.alonics.com/dashboard?foo=1', '3'),
  'https://edenai.alonics.com/dashboard?foo=1&resume_sut_deposit=1&resume_sut_amount=3'
);
assert.equal(
  buildTrustWalletDepositRedirectUrl('https://edenai.alonics.com/dashboard?foo=1', '3'),
  'trust://open_url?coin_id=966&url=https%3A%2F%2Fedenai.alonics.com%2Fdashboard%3Ffoo%3D1%26resume_sut_deposit%3D1%26resume_sut_amount%3D3'
);
assert.equal(
  buildDepositFinalizeUrl('https://edenai.alonics.com/dashboard?foo=1&resume_sut_deposit=1&resume_sut_amount=3', '3', '0xtx'),
  'https://edenai.alonics.com/dashboard?foo=1&finalize_sut_deposit=1&resume_sut_amount=3&sut_deposit_tx_hash=0xtx'
);

assert.deepEqual(buildNextPriceHistory([], 0.2, [0.18, 0.19]), [0.18, 0.19]);
assert.deepEqual(buildNextPriceHistory([], 0.2, []), [0.2]);
assert.deepEqual(buildNextPriceHistory([0.18, 0.19], 0.2, []), [0.18, 0.19, 0.2]);
assert.equal(buildNextPriceHistory(Array.from({ length: 30 }, (_, i) => i), 30, []).length, 30);
assert.equal(buildNextPriceHistory(Array.from({ length: 30 }, (_, i) => i), 30, [])[29], 30);

console.log('ok - user dashboard price history');

const getCalls = [];
const fakeAxios = {
  async get(url) {
    getCalls.push(url);
    const responses = {
      'https://api.test/investment/portfolio/0xabc': {
        success: true,
        portfolio: {
          sutQuantity: 7,
          sutChange24h: 3.5,
          sutHistory: [0.18, 0.19],
          assets: { SUT: { price: 0.2 } },
        },
      },
      'https://api.test/investment/history/0xabc': {
        success: true,
        history: [{ id: 1, type: 'DEPOSIT' }],
      },
    };
    return { data: responses[url] };
  },
};

const fakeEthersForLoad = {
  JsonRpcProvider: class {},
  Contract: class {
    constructor(address, abi, provider) {
      assert.equal(address, '0x98965474ecbec2f532f1f780ee37b0b05f77ca55');
      assert.equal(abi[0], 'function balanceOf(address account) external view returns (uint256)');
      assert.ok(provider);
    }

    async balanceOf(address) {
      assert.equal(address, '0xabc');
      return 123000000000000000000n;
    }
  },
  formatUnits(value, decimals) {
    assert.equal(value, 123000000000000000000n);
    assert.equal(decimals, 18);
    return '123';
  },
};

const loaded = await loadUserDashboardData({
  apiBase: 'https://api.test',
  walletAddress: '0xabc',
  axiosClient: fakeAxios,
  ethersLib: fakeEthersForLoad,
  previousPriceHistory: [],
});

assert.equal(loaded.portfolio.sutQuantity, 7);
assert.equal(loaded.walletSutBalance, 123);
assert.equal(loaded.sutPrice, 0.2);
assert.equal(loaded.sutChange24h, 3.5);
assert.deepEqual(loaded.priceHistory, [0.18, 0.19]);

const loadedWithoutBalance = await loadUserDashboardData({
  apiBase: 'https://api.test',
  walletAddress: '0xabc',
  axiosClient: fakeAxios,
  ethersLib: {
    JsonRpcProvider: class {},
    Contract: class {
      async balanceOf() {
        throw new Error('rpc down');
      }
    },
    formatUnits() {
      throw new Error('should not format failed balance');
    },
  },
  previousPriceHistory: [],
});

assert.equal(loadedWithoutBalance.portfolio.sutQuantity, 7);
assert.equal(loadedWithoutBalance.walletSutBalance, undefined);

const history = await loadUserTxHistory({
  apiBase: 'https://api.test',
  walletAddress: '0xabc',
  axiosClient: fakeAxios,
});

assert.deepEqual(history, [{ id: 1, type: 'DEPOSIT' }]);
assert.deepEqual(getCalls, [
  'https://api.test/investment/portfolio/0xabc',
  'https://api.test/investment/portfolio/0xabc',
  'https://api.test/investment/history/0xabc',
]);

console.log('ok - user dashboard loaders');

const postCalls = [];
let waitCalled = false;
const fakeEthereum = {
  isTrustWallet: true,
  async request({ method }) {
    assert.equal(method, 'eth_requestAccounts');
    return ['0xABC'];
  },
};
class FakeBrowserProvider {
  constructor(ethereum) {
    assert.equal(ethereum, fakeEthereum);
  }

  async getSigner() {
    return {
      async getAddress() {
        return '0xABC';
      },
    };
  }
}

class FakeContract {
  constructor(address, abi, signer) {
    assert.equal(address, '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55');
    assert.equal(abi[0], 'function transfer(address recipient, uint256 amount) external returns (bool)');
    assert.ok(signer);
  }

  async transfer(address, amount) {
    assert.equal(address, '0x855c880D538892fD899eECb72D4b1Ac5B46089eA');
    assert.equal(amount, 3000000000000000000n);
    return {
      hash: '0xtx',
      async wait() {
        waitCalled = true;
      },
    };
  }
}

const fakeEthersForSubmit = {
  BrowserProvider: FakeBrowserProvider,
  Contract: FakeContract,
  JsonRpcProvider: class {
    async waitForTransaction(hash, confirmations) {
      assert.equal(hash, '0xtx');
      assert.equal(confirmations, 1);
      return { status: 1 };
    }
  },
  parseUnits(value, decimals) {
    assert.equal(value, '3');
    assert.equal(decimals, 18);
    return 3000000000000000000n;
  },
};

const fakeAxiosForSubmit = {
  async post(url, body) {
    assert.equal(waitCalled, false);
    postCalls.push({ url, body });
    return { data: { success: true } };
  },
};

const depositResult = await submitUserInvestmentTransaction({
  apiBase: 'https://api.test',
  walletAddress: '0xabc',
  amount: '3',
  type: 'DEPOSIT',
  portfolio: { sutQuantity: 5 },
  ethereum: { providers: [{ isMetaMask: true }, fakeEthereum] },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  axiosClient: fakeAxiosForSubmit,
  ethersLib: fakeEthersForSubmit,
});

assert.equal(depositResult.txHash, '0xtx');
assert.deepEqual(postCalls[0], {
  url: 'https://api.test/investment/deposit',
  body: { walletAddress: '0xabc', amount: 3, txHash: '0xtx' },
});

const finalizedResult = await finalizePendingDepositTransaction({
  apiBase: 'https://api.test',
  walletAddress: '0xabc',
  amount: '4',
  txHash: '0xfin',
  axiosClient: fakeAxiosForSubmit,
  ethersLib: {
    JsonRpcProvider: class {
      async waitForTransaction(hash, confirmations) {
        assert.equal(hash, '0xfin');
        assert.equal(confirmations, 1);
        return { status: 1 };
      }
    },
  },
});

assert.deepEqual(finalizedResult.data, { success: true });
assert.deepEqual(postCalls[1], {
  url: 'https://api.test/investment/deposit',
  body: { walletAddress: '0xabc', amount: 4, txHash: '0xfin' },
});

let directSendTransactionCalled = false;
const fakeTrustWalletMobileEthereum = {
  isTrustWallet: true,
  async request({ method, params }) {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
      return ['0xABC'];
    }
    if (method === 'eth_sendTransaction') {
      directSendTransactionCalled = true;
      assert.equal(params[0].from, '0xABC');
      assert.equal(params[0].to, '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55');
      assert.ok(typeof params[0].data === 'string');
      return '0xdirect';
    }
    throw new Error(`Unexpected method: ${method}`);
  },
};

const fakeEthersForBrokenBrowserProvider = {
  BrowserProvider: class {
    constructor() {}

    async getSigner() {
      throw new Error('could not coalesce error');
    }
  },
  Contract: FakeContract,
  JsonRpcProvider: class {
    async waitForTransaction(hash, confirmations) {
      assert.equal(hash, '0xdirect');
      assert.equal(confirmations, 1);
      return { status: 1 };
    }
  },
  Interface: class {
    encodeFunctionData(name, args) {
      assert.equal(name, 'transfer');
      assert.equal(args[0], '0x855c880D538892fD899eECb72D4b1Ac5B46089eA');
      assert.equal(args[1], 3000000000000000000n);
      return '0xencoded';
    }
  },
  parseUnits(value, decimals) {
    assert.equal(value, '3');
    assert.equal(decimals, 18);
    return 3000000000000000000n;
  },
};

const directDepositResult = await submitUserInvestmentTransaction({
  apiBase: 'https://api.test',
  walletAddress: '0xabc',
  amount: '3',
  type: 'DEPOSIT',
  portfolio: { sutQuantity: 5 },
  ethereum: fakeTrustWalletMobileEthereum,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; TrustWallet)',
  currentUrl: 'https://edenai.alonics.com/dashboard?resume_sut_deposit=1&resume_sut_amount=3',
  axiosClient: fakeAxiosForSubmit,
  ethersLib: fakeEthersForBrokenBrowserProvider,
});

assert.equal(directDepositResult.txHash, '0xdirect');
assert.equal(directSendTransactionCalled, true);
assert.equal(directDepositResult.code, 'MOBILE_TRUST_WALLET_RETURN');
const directDepositReturnUrl = new URL(directDepositResult.redirectUrl);
assert.equal(directDepositReturnUrl.searchParams.get(FINALIZE_SUT_DEPOSIT_PARAM), '1');
assert.equal(directDepositReturnUrl.searchParams.get(RESUME_SUT_AMOUNT_PARAM), '3');
assert.equal(directDepositReturnUrl.searchParams.get(FINALIZE_SUT_TX_HASH_PARAM), '0xdirect');

directSendTransactionCalled = false;
const directDepositWithoutTrustUa = await submitUserInvestmentTransaction({
  apiBase: 'https://api.test',
  walletAddress: '0xabc',
  amount: '3',
  type: 'DEPOSIT',
  portfolio: { sutQuantity: 5 },
  ethereum: fakeTrustWalletMobileEthereum,
  userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36',
  currentUrl: 'https://edenai.alonics.com/dashboard?resume_sut_deposit=1&resume_sut_amount=3',
  axiosClient: fakeAxiosForSubmit,
  ethersLib: fakeEthersForBrokenBrowserProvider,
});

assert.equal(directDepositWithoutTrustUa.txHash, '0xdirect');
assert.equal(directSendTransactionCalled, true);
assert.equal(directDepositWithoutTrustUa.code, 'MOBILE_TRUST_WALLET_RETURN');

let fallbackReceiptChecked = false;
class FakeContractWithBrokenWait extends FakeContract {
  async transfer(address, amount) {
    await super.transfer(address, amount);
    return {
      hash: '0xfallback',
      async wait() {
        throw new Error('could not coalesce error');
      },
    };
  }
}

const fakeEthersForBrokenWalletWait = {
  BrowserProvider: FakeBrowserProvider,
  Contract: FakeContractWithBrokenWait,
  JsonRpcProvider: class {
    async waitForTransaction(hash, confirmations) {
      fallbackReceiptChecked = true;
      assert.equal(hash, '0xfallback');
      assert.equal(confirmations, 1);
      return { status: 1 };
    }
  },
  parseUnits(value, decimals) {
    assert.equal(value, '3');
    assert.equal(decimals, 18);
    return 3000000000000000000n;
  },
};

const fallbackDepositResult = await submitUserInvestmentTransaction({
  apiBase: 'https://api.test',
  walletAddress: '0xabc',
  amount: '3',
  type: 'DEPOSIT',
  portfolio: { sutQuantity: 5 },
  ethereum: { providers: [{ isMetaMask: true }, fakeEthereum] },
  userAgent: 'Mozilla/5.0 (Linux; Android 14; TrustWallet)',
  axiosClient: fakeAxiosForSubmit,
  ethersLib: fakeEthersForBrokenWalletWait,
});

assert.equal(fallbackDepositResult.txHash, '0xfallback');
assert.equal(fallbackReceiptChecked, true);
assert.deepEqual(postCalls[2], {
  url: 'https://api.test/investment/deposit',
  body: { walletAddress: '0xabc', amount: 3, txHash: '0xfallback' },
});

await submitUserInvestmentTransaction({
  apiBase: 'https://api.test',
  walletAddress: '0xabc',
  amount: '2',
  type: 'WITHDRAW',
  portfolio: { sutQuantity: 5 },
  ethereum: null,
  axiosClient: fakeAxiosForSubmit,
  ethersLib: fakeEthersForSubmit,
});

assert.deepEqual(postCalls[3], {
  url: 'https://api.test/investment/withdraw',
  body: { walletAddress: '0xabc', amount: 2 },
});

await assert.rejects(
  () =>
    submitUserInvestmentTransaction({
      apiBase: 'https://api.test',
      walletAddress: '0xabc',
      amount: '6',
      type: 'WITHDRAW',
      portfolio: { sutQuantity: 5 },
      ethereum: null,
      axiosClient: fakeAxiosForSubmit,
      ethersLib: fakeEthersForSubmit,
    }),
  /exceeds current SUT balance/
);

await assert.rejects(
  async () => {
    await submitUserInvestmentTransaction({
      apiBase: 'https://api.test',
      walletAddress: '0xabc',
      amount: '1',
      type: 'DEPOSIT',
      portfolio: { sutQuantity: 5 },
      ethereum: undefined,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      currentUrl: 'https://edenai.alonics.com/dashboard',
      axiosClient: fakeAxiosForSubmit,
      ethersLib: fakeEthersForSubmit,
    });
  },
  (error) => {
    assert.equal(error.code, 'MOBILE_TRUST_WALLET_REDIRECT');
    assert.equal(
      error.redirectUrl,
      'trust://open_url?coin_id=966&url=https%3A%2F%2Fedenai.alonics.com%2Fdashboard%3Fresume_sut_deposit%3D1%26resume_sut_amount%3D1'
    );
    return true;
  }
);

console.log('ok - user dashboard transactions');
