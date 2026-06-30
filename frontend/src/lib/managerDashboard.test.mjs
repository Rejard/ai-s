import assert from 'node:assert/strict';

import {
  buildManagerHeaders,
  getManagerIdentityEmail,
  isMaskedCredential,
  loadManagerDashboardData,
  normalizeManagerGridSettings,
  toggleManagerAutoRangePreview,
  clearManagerGateIoCredentials,
  approveManagerUser,
  approveManagerWithdrawal,
  rejectManagerUser,
  saveManagerAiSettings,
  saveManagerGateIoCredentials,
  sendSutToGateIoDepositAddress,
  submitManagerGateIoOrder,
} from './managerDashboard.js';

assert.equal(getManagerIdentityEmail(' MANAGER@Example.COM '), 'manager@example.com');
assert.equal(getManagerIdentityEmail(''), 'lemaiiisk@gmail.com');
assert.equal(getManagerIdentityEmail(null), 'lemaiiisk@gmail.com');

assert.equal(isMaskedCredential('abc******xyz'), true);
assert.equal(isMaskedCredential('plain-secret'), false);
assert.equal(isMaskedCredential(null), false);

assert.deepEqual(
  normalizeManagerGridSettings(
    { ai_grid_status: 'ON', ai_grid_lower: '0.15' },
    { ai_grid_auto_range: 'ON', ai_grid_upper: '0.30', ai_grid_count: '5', ai_grid_frequency: '5' }
  ),
  {
    ai_grid_status: 'ON',
    ai_grid_lower: '0.15',
    ai_grid_upper: '0.30',
    ai_grid_count: '5',
    ai_grid_frequency: '5',
    ai_grid_auto_range: 'ON',
    hasApiKey: undefined,
    hasApiSecret: undefined,
    hasDepositAddress: undefined,
  }
);

assert.deepEqual(
  toggleManagerAutoRangePreview({
    enabled: true,
    currentSettings: {
      ai_grid_status: 'ON',
      ai_grid_lower: '0.15',
      ai_grid_upper: '0.30',
      ai_grid_auto_range: 'OFF',
      ai_grid_count: '5',
      ai_grid_frequency: '5',
    },
    serverSettings: {
      ai_grid_status: 'ON',
      ai_grid_lower: '0.15',
      ai_grid_upper: '0.30',
      ai_grid_auto_range: 'OFF',
      ai_grid_count: '5',
      ai_grid_frequency: '5',
    },
    latestAiLog: {
      proposed_lower: 0.12,
      proposed_upper: 0.34,
    },
  }),
  {
    ai_grid_status: 'ON',
    ai_grid_lower: '0.12',
    ai_grid_upper: '0.34',
    ai_grid_auto_range: 'ON',
    ai_grid_count: '5',
    ai_grid_frequency: '5',
    hasApiKey: undefined,
    hasApiSecret: undefined,
    hasDepositAddress: undefined,
  }
);

assert.deepEqual(
  toggleManagerAutoRangePreview({
    enabled: false,
    currentSettings: {
      ai_grid_status: 'ON',
      ai_grid_lower: '0.12',
      ai_grid_upper: '0.34',
      ai_grid_auto_range: 'ON',
      ai_grid_count: '5',
      ai_grid_frequency: '5',
    },
    serverSettings: {
      ai_grid_status: 'ON',
      ai_grid_lower: '0.15',
      ai_grid_upper: '0.30',
      ai_grid_auto_range: 'OFF',
      ai_grid_count: '5',
      ai_grid_frequency: '5',
    },
    latestAiLog: {
      proposed_lower: 0.11,
      proposed_upper: 0.35,
    },
  }),
  {
    ai_grid_status: 'ON',
    ai_grid_lower: '0.15',
    ai_grid_upper: '0.30',
    ai_grid_auto_range: 'OFF',
    ai_grid_count: '5',
    ai_grid_frequency: '5',
    hasApiKey: undefined,
    hasApiSecret: undefined,
    hasDepositAddress: undefined,
  }
);

const storage = new Map([
  ['gateio_api_key', 'key-123'],
  ['gateio_api_secret', 'secret-456'],
]);

assert.deepEqual(
  buildManagerHeaders({
    managerEmail: ' Boss@Example.COM ',
    getStorageItem: (key) => storage.get(key),
  }),
  {
    headers: {
      'x-manager-email': 'boss@example.com',
      'x-gateio-api-key': 'key-123',
      'x-gateio-api-secret': 'secret-456',
    },
  }
);

storage.set('gateio_api_key', 'api******key');
storage.set('gateio_api_secret', 'secret******masked');

assert.deepEqual(
  buildManagerHeaders({
    managerEmail: undefined,
    getStorageItem: (key) => storage.get(key),
  }),
  {
    headers: {
      'x-manager-email': 'lemaiiisk@gmail.com',
      'x-gateio-api-key': '',
      'x-gateio-api-secret': '',
    },
  }
);

console.log('ok - manager dashboard shared helpers');

const calls = [];
const fakeAxios = {
  async get(url, config) {
    calls.push([url, config]);
    const cleanUrl = url.split('?')[0];
    const responses = {
      'https://api.test/manager/pending-users': { success: true, users: [{ id: 1 }] },
      'https://api.test/manager/stats': { success: true, stats: { users: 1, managerSelfDeposited: 7 }, recentPayments: [{ id: 2 }], managerRecentPayments: [{ id: 9 }] },
      'https://api.test/manager/users': { success: true, users: [{ id: 3 }] },
      'https://api.test/manager/withdrawals': { success: true, withdrawals: [{ id: 4 }] },
      'https://api.test/manager/ai-settings': {
        success: true,
        settings: {
          ai_grid_status: 'ON',
          ai_grid_lower: '0.15',
          ai_grid_upper: '0.30',
          ai_grid_count: '5',
          ai_grid_frequency: '5',
        },
      },
      'https://api.test/investment/portfolio/0xabc': { success: true, portfolio: { total: 10 } },
      'https://api.test/manager/gateio-balance': { success: true, balances: { USDT: 5 } },
      'https://api.test/manager/gateio-performance': {
        success: true,
        isConfigured: true,
        depositAddress: '0xdeposit',
        yieldHistory: [1, 2],
      },
      'https://api.test/manager/ai-logs': { success: true, logs: [{ id: 5 }] },
    };
    return { data: responses[cleanUrl] };
  },
};

const fakeEthers = {
  JsonRpcProvider: class {},
  Contract: class {
    async balanceOf(address) {
      if (address === '0xabc' || address === '0x855c880d538892fd899eecb72d4b1ac5b46089ea') {
        return 123000000000000000000n;
      }
      assert.fail(`Unexpected address in balanceOf: ${address}`);
    }
  },
  formatUnits(value, decimals) {
    assert.equal(value, 123000000000000000000n);
    assert.equal(decimals, 18);
    return '123';
  },
};

const removedKeys = [];
const storedValues = [];
const managerData = await loadManagerDashboardData({
  apiBase: 'https://api.test',
  managerEmail: ' Boss@Example.COM ',
  walletAddress: '0xabc',
  axiosClient: fakeAxios,
  ethersLib: fakeEthers,
  getStorageItem: (key) => {
    if (key === 'gateio_api_key') return 'api******key';
    if (key === 'gateio_api_secret') return 'secret******masked';
    return '';
  },
  setStorageItem: (key, value) => storedValues.push([key, value]),
  removeStorageItem: (key) => removedKeys.push(key),
  previousGridSettings: { ai_grid_auto_range: 'ON' },
});

assert.deepEqual(managerData.pendingUsers, [{ id: 1 }]);
assert.deepEqual(managerData.stats, { users: 1, managerSelfDeposited: 7 });
assert.deepEqual(managerData.recentPayments, [{ id: 2 }]);
assert.deepEqual(managerData.managerRecentPayments, [{ id: 9 }]);
assert.deepEqual(managerData.allUsers, [{ id: 3 }]);
assert.deepEqual(managerData.withdrawals, [{ id: 4 }]);
assert.deepEqual(managerData.gridSettings, {
  ai_grid_status: 'ON',
  ai_grid_lower: '0.15',
  ai_grid_upper: '0.30',
  ai_grid_count: '5',
  ai_grid_frequency: '5',
  ai_grid_auto_range: 'ON',
  hasApiKey: undefined,
  hasApiSecret: undefined,
  hasDepositAddress: undefined,
});
assert.deepEqual(managerData.portfolio, { total: 10 });
assert.equal(managerData.walletSutBalance, 123);
assert.deepEqual(managerData.gateioBalance, { USDT: 5 });
assert.deepEqual(managerData.performance.depositAddress, '0xdeposit');
assert.deepEqual(managerData.yieldHistory, [1, 2]);
assert.deepEqual(managerData.aiLogs, [{ id: 5 }]);
assert.deepEqual(managerData.credentialUpdates, {
  clearApiKey: true,
  clearApiSecret: true,
  depositAddress: '0xdeposit',
});

assert.deepEqual(removedKeys, ['gateio_api_key', 'gateio_api_secret']);
assert.deepEqual(storedValues, [['gateio_deposit_address', '0xdeposit']]);
assert.equal(calls[0][1].headers['x-manager-email'], 'boss@example.com');

console.log('ok - manager dashboard read-only loader');

const localWrites = [];
const postCalls = [];
const credentialAxios = {
  async post(url, body, config) {
    postCalls.push({ url, body, config });
    return { data: { success: true } };
  },
};

await assert.rejects(
  () => saveManagerGateIoCredentials({
    apiBase: 'https://api.test',
    managerEmail: 'boss@example.com',
    apiKey: ' ',
    apiSecret: 'secret',
    depositAddress: '0xdeposit',
    axiosClient: credentialAxios,
    getStorageItem: () => '',
    setStorageItem: () => {},
  }),
  /missing Gate.io credential/
);

await saveManagerGateIoCredentials({
  apiBase: 'https://api.test',
  managerEmail: 'boss@example.com',
  apiKey: ' key ',
  apiSecret: ' secret ',
  depositAddress: ' address ',
  axiosClient: credentialAxios,
  getStorageItem: () => '',
  setStorageItem: (key, value) => localWrites.push([key, value]),
});

assert.deepEqual(localWrites, [
  ['gateio_api_key', 'key'],
  ['gateio_api_secret', 'secret'],
  ['gateio_deposit_address', 'address'],
]);
assert.deepEqual(postCalls[0].body, {
  apiKey: 'key',
  apiSecret: 'secret',
  depositAddress: 'address',
});
assert.equal(postCalls[0].config.headers['x-manager-email'], 'boss@example.com');

const removedCredentialKeys = [];
await clearManagerGateIoCredentials({
  apiBase: 'https://api.test',
  managerEmail: 'boss@example.com',
  axiosClient: credentialAxios,
  getStorageItem: () => '',
  removeStorageItem: (key) => removedCredentialKeys.push(key),
});

assert.deepEqual(removedCredentialKeys, [
  'gateio_api_key',
  'gateio_api_secret',
  'gateio_deposit_address',
]);
assert.equal(postCalls[1].url, 'https://api.test/manager/clear-gateio-keys');

console.log('ok - manager dashboard credential handlers');

const actionPosts = [];
const actionAxios = {
  async post(url, body, config) {
    actionPosts.push({ url, body, config });
    return { data: { success: true, message: 'ok' } };
  },
};

await approveManagerUser({
  apiBase: 'https://api.test',
  managerEmail: 'boss@example.com',
  walletAddress: '0xuser',
  axiosClient: actionAxios,
  getStorageItem: () => '',
});

await rejectManagerUser({
  apiBase: 'https://api.test',
  managerEmail: 'boss@example.com',
  walletAddress: '0xuser2',
  axiosClient: actionAxios,
  getStorageItem: () => '',
});

await approveManagerWithdrawal({
  apiBase: 'https://api.test',
  managerEmail: 'boss@example.com',
  withdrawalId: 7,
  actualPayoutAmount: '3.25',
  axiosClient: actionAxios,
  getStorageItem: () => '',
});

assert.deepEqual(actionPosts.map((call) => [call.url, call.body]), [
  ['https://api.test/manager/approve-user', { walletAddress: '0xuser' }],
  ['https://api.test/manager/reject-user', { walletAddress: '0xuser2' }],
  ['https://api.test/manager/withdrawals/7/approve', { actualPayoutAmount: 3.25 }],
]);
assert.equal(actionPosts[2].config.headers['x-manager-email'], 'boss@example.com');

console.log('ok - manager dashboard approval handlers');

const settingsPosts = [];
const settingsAxios = {
  async post(url, body, config) {
    settingsPosts.push({ url, body, config });
    return { data: { success: true } };
  },
};

await saveManagerAiSettings({
  apiBase: 'https://api.test',
  managerEmail: 'boss@example.com',
  settings: {
    status: 'ON',
    lower: '0.15',
    upper: '0.30',
    count: '10',
    frequency: '5',
    autoRange: 'ON',
  },
  axiosClient: settingsAxios,
  getStorageItem: () => '',
});

assert.deepEqual(settingsPosts[0].body, {
  status: 'ON',
  lower: '0.15',
  upper: '0.30',
  count: '10',
  frequency: '5',
  autoRange: 'ON',
});
assert.equal(settingsPosts[0].url, 'https://api.test/manager/ai-settings');
assert.equal(settingsPosts[0].config.headers['x-manager-email'], 'boss@example.com');

console.log('ok - manager dashboard AI settings handler');

const orderPosts = [];
const orderAxios = {
  async post(url, body, config) {
    orderPosts.push({ url, body, config });
    return { data: { success: true, order: { id: 'order-1' } } };
  },
};

await submitManagerGateIoOrder({
  apiBase: 'https://api.test',
  managerEmail: 'boss@example.com',
  side: 'buy',
  amount: '10.5',
  price: '0.15',
  axiosClient: orderAxios,
  getStorageItem: () => '',
});

assert.deepEqual(orderPosts[0].body, {
  side: 'buy',
  amount: 10.5,
  price: 0.15,
});
assert.equal(orderPosts[0].url, 'https://api.test/manager/gateio-order');
assert.equal(orderPosts[0].config.headers['x-manager-email'], 'boss@example.com');

await assert.rejects(
  () => submitManagerGateIoOrder({
    apiBase: 'https://api.test',
    managerEmail: 'boss@example.com',
    side: 'buy',
    amount: '0',
    price: '0.15',
    axiosClient: orderAxios,
    getStorageItem: () => '',
  }),
  /invalid Gate.io order amount/
);

console.log('ok - manager dashboard manual Gate.io order handler');

const walletRequests = [];
const transferCalls = [];
const fakeEthereum = {
  async request(payload) {
    walletRequests.push(payload);
  },
};

class FakeBrowserProvider {
  constructor(ethereum) {
    assert.equal(ethereum, fakeEthereum);
  }

  async getNetwork() {
    return { chainId: 1n };
  }

  async getSigner() {
    return { address: '0xsigner' };
  }
}

class FakeContract {
  constructor(address, abi, signer) {
    assert.equal(address, '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55');
    assert.equal(abi[0], 'function transfer(address recipient, uint256 amount) external returns (bool)');
    assert.deepEqual(signer, { address: '0xsigner' });
  }

  async transfer(address, amount) {
    transferCalls.push([address, amount]);
    return {
      hash: '0xtxhash',
      async wait() {
        return { status: 1 };
      },
    };
  }
}

const fakeTransferEthers = {
  BrowserProvider: FakeBrowserProvider,
  Contract: FakeContract,
  parseUnits(value, decimals) {
    assert.equal(value, '12.5');
    assert.equal(decimals, 18);
    return 12500000000000000000n;
  },
};

const sendResult = await sendSutToGateIoDepositAddress({
  ethereum: fakeEthereum,
  ethersLib: fakeTransferEthers,
  depositAddress: '0x1111111111111111111111111111111111111111',
  amount: '12.5',
});

assert.equal(sendResult.hash, '0xtxhash');
assert.deepEqual(walletRequests, [{
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0x89' }],
}]);
assert.deepEqual(transferCalls, [[
  '0x1111111111111111111111111111111111111111',
  12500000000000000000n,
]]);

await assert.rejects(
  () => sendSutToGateIoDepositAddress({
    ethereum: fakeEthereum,
    ethersLib: fakeTransferEthers,
    depositAddress: 'bad-address',
    amount: '1',
  }),
  /invalid Polygon deposit address/
);

await assert.rejects(
  () => sendSutToGateIoDepositAddress({
    ethereum: null,
    ethersLib: fakeTransferEthers,
    depositAddress: '0x1111111111111111111111111111111111111111',
    amount: '1',
  }),
  /missing injected wallet/
);

console.log('ok - manager dashboard SUT transfer handler');
