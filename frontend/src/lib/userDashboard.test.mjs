import assert from 'node:assert/strict';

import {
  buildNextPriceHistory,
  loadUserDashboardData,
  loadUserTxHistory,
  submitUserInvestmentTransaction,
} from './userDashboard.js';

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
const fakeEthereum = {};
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
  parseUnits(value, decimals) {
    assert.equal(value, '3');
    assert.equal(decimals, 18);
    return 3000000000000000000n;
  },
};

const fakeAxiosForSubmit = {
  async post(url, body) {
    assert.equal(waitCalled, true);
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
  ethereum: fakeEthereum,
  axiosClient: fakeAxiosForSubmit,
  ethersLib: fakeEthersForSubmit,
});

assert.equal(depositResult.txHash, '0xtx');
assert.deepEqual(postCalls[0], {
  url: 'https://api.test/investment/deposit',
  body: { walletAddress: '0xabc', amount: 3, txHash: '0xtx' },
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

assert.deepEqual(postCalls[1], {
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

console.log('ok - user dashboard transactions');
