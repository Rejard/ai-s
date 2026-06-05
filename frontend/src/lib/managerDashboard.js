const DEFAULT_MANAGER_EMAIL = 'lemaiiisk@gmail.com';

export function getManagerIdentityEmail(managerEmail) {
  return (managerEmail || DEFAULT_MANAGER_EMAIL).toLowerCase().trim();
}

export function isMaskedCredential(value) {
  return typeof value === 'string' && value.includes('******');
}

export function buildManagerHeaders({ managerEmail, getStorageItem }) {
  const readStorage = typeof getStorageItem === 'function' ? getStorageItem : () => '';
  const apiKey = readStorage('gateio_api_key') || '';
  const apiSecret = readStorage('gateio_api_secret') || '';

  return {
    headers: {
      'x-manager-email': getManagerIdentityEmail(managerEmail),
      'x-gateio-api-key': isMaskedCredential(apiKey) ? '' : apiKey,
      'x-gateio-api-secret': isMaskedCredential(apiSecret) ? '' : apiSecret,
    },
  };
}

export async function loadManagerDashboardData({
  apiBase,
  managerEmail,
  walletAddress,
  axiosClient,
  ethersLib,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  previousYieldHistory = [],
}) {
  const headers = buildManagerHeaders({ managerEmail, getStorageItem });
  const data = {
    pendingUsers: undefined,
    allUsers: undefined,
    stats: undefined,
    recentPayments: undefined,
    withdrawals: undefined,
    gridSettings: undefined,
    portfolio: undefined,
    walletSutBalance: undefined,
    gateioBalance: undefined,
    performance: undefined,
    yieldHistory: undefined,
    aiLogs: undefined,
    credentialUpdates: {
      clearApiKey: false,
      clearApiSecret: false,
      depositAddress: undefined,
    },
  };

  const pendingRes = await axiosClient.get(`${apiBase}/manager/pending-users`, headers);
  if (pendingRes.data.success) {
    data.pendingUsers = pendingRes.data.users;
  }

  const statsRes = await axiosClient.get(`${apiBase}/manager/stats`, headers);
  if (statsRes.data.success) {
    data.stats = statsRes.data.stats;
    data.recentPayments = statsRes.data.recentPayments;
  }

  const allUsersRes = await axiosClient.get(`${apiBase}/manager/users`, headers);
  if (allUsersRes.data.success) {
    data.allUsers = allUsersRes.data.users;
  }

  const withdrawRes = await axiosClient.get(`${apiBase}/manager/withdrawals`, headers);
  if (withdrawRes.data.success) {
    data.withdrawals = withdrawRes.data.withdrawals;
  }

  const aiRes = await axiosClient.get(`${apiBase}/manager/ai-settings`, headers);
  if (aiRes.data.success) {
    data.gridSettings = aiRes.data.settings;
  }

  if (walletAddress) {
    const portRes = await axiosClient.get(`${apiBase}/investment/portfolio/${walletAddress}`);
    if (portRes.data.success) {
      data.portfolio = portRes.data.portfolio;
    }

    const rpcProvider = new ethersLib.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const sutContractAddress = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55'.toLowerCase();
    const sutAbi = ['function balanceOf(address account) external view returns (uint256)'];
    const sutContract = new ethersLib.Contract(sutContractAddress, sutAbi, rpcProvider);
    const balanceWei = await sutContract.balanceOf(walletAddress);
    data.walletSutBalance = parseFloat(ethersLib.formatUnits(balanceWei, 18));
  }

  try {
    const gateioRes = await axiosClient.get(`${apiBase}/manager/gateio-balance`, headers);
    data.gateioBalance = gateioRes.data.success ? gateioRes.data.balances : null;
  } catch {
    data.gateioBalance = null;
  }

  try {
    const perfRes = await axiosClient.get(`${apiBase}/manager/gateio-performance`, headers);
    if (perfRes.data.success && perfRes.data.isConfigured) {
      data.performance = perfRes.data;

      if (isMaskedCredential(getStorageItem('gateio_api_key'))) {
        removeStorageItem('gateio_api_key');
        data.credentialUpdates.clearApiKey = true;
      }
      if (isMaskedCredential(getStorageItem('gateio_api_secret'))) {
        removeStorageItem('gateio_api_secret');
        data.credentialUpdates.clearApiSecret = true;
      }
      if (!getStorageItem('gateio_deposit_address') && perfRes.data.depositAddress) {
        setStorageItem('gateio_deposit_address', perfRes.data.depositAddress);
        data.credentialUpdates.depositAddress = perfRes.data.depositAddress;
      }

      if (perfRes.data.yieldHistory && perfRes.data.yieldHistory.length > 0) {
        data.yieldHistory = perfRes.data.yieldHistory;
      } else if (perfRes.data.totalBuyUsdt > 0) {
        data.yieldHistory = [...previousYieldHistory, perfRes.data.yieldPercent].slice(-30);
      }
    } else {
      data.performance = null;
      data.yieldHistory = [];
    }
  } catch {
    data.performance = null;
    data.yieldHistory = [];
  }

  try {
    const aiLogsRes = await axiosClient.get(`${apiBase}/manager/ai-logs`, headers);
    if (aiLogsRes.data.success) {
      data.aiLogs = aiLogsRes.data.logs || [];
    }
  } catch {
    data.aiLogs = undefined;
  }

  return data;
}

export async function saveManagerGateIoCredentials({
  apiBase,
  managerEmail,
  apiKey,
  apiSecret,
  depositAddress,
  axiosClient,
  getStorageItem,
  setStorageItem,
}) {
  const nextApiKey = (apiKey || '').trim();
  const nextApiSecret = (apiSecret || '').trim();
  const nextDepositAddress = (depositAddress || '').trim();

  if (!nextApiKey || !nextApiSecret || !nextDepositAddress) {
    throw new Error('missing Gate.io credential fields');
  }

  setStorageItem('gateio_api_key', nextApiKey);
  setStorageItem('gateio_api_secret', nextApiSecret);
  setStorageItem('gateio_deposit_address', nextDepositAddress);

  return axiosClient.post(`${apiBase}/manager/save-gateio-keys`, {
    apiKey: nextApiKey,
    apiSecret: nextApiSecret,
    depositAddress: nextDepositAddress,
  }, buildManagerHeaders({ managerEmail, getStorageItem }));
}

export async function clearManagerGateIoCredentials({
  apiBase,
  managerEmail,
  axiosClient,
  getStorageItem,
  removeStorageItem,
}) {
  removeStorageItem('gateio_api_key');
  removeStorageItem('gateio_api_secret');
  removeStorageItem('gateio_deposit_address');

  return axiosClient.post(
    `${apiBase}/manager/clear-gateio-keys`,
    {},
    buildManagerHeaders({ managerEmail, getStorageItem })
  );
}

export async function approveManagerUser({
  apiBase,
  managerEmail,
  walletAddress,
  axiosClient,
  getStorageItem,
}) {
  return axiosClient.post(
    `${apiBase}/manager/approve-user`,
    { walletAddress },
    buildManagerHeaders({ managerEmail, getStorageItem })
  );
}

export async function rejectManagerUser({
  apiBase,
  managerEmail,
  walletAddress,
  axiosClient,
  getStorageItem,
}) {
  return axiosClient.post(
    `${apiBase}/manager/reject-user`,
    { walletAddress },
    buildManagerHeaders({ managerEmail, getStorageItem })
  );
}

export async function approveManagerWithdrawal({
  apiBase,
  managerEmail,
  withdrawalId,
  actualPayoutAmount,
  axiosClient,
  getStorageItem,
}) {
  return axiosClient.post(
    `${apiBase}/manager/withdrawals/${withdrawalId}/approve`,
    { actualPayoutAmount: parseFloat(actualPayoutAmount) },
    buildManagerHeaders({ managerEmail, getStorageItem })
  );
}

export async function saveManagerAiSettings({
  apiBase,
  managerEmail,
  settings,
  axiosClient,
  getStorageItem,
}) {
  return axiosClient.post(
    `${apiBase}/manager/ai-settings`,
    settings,
    buildManagerHeaders({ managerEmail, getStorageItem })
  );
}

export async function submitManagerGateIoOrder({
  apiBase,
  managerEmail,
  side,
  amount,
  price,
  axiosClient,
  getStorageItem,
}) {
  const parsedAmount = parseFloat(amount);
  const parsedPrice = parseFloat(price);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error('invalid Gate.io order amount');
  }
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    throw new Error('invalid Gate.io order price');
  }

  return axiosClient.post(
    `${apiBase}/manager/gateio-order`,
    {
      side,
      amount: parsedAmount,
      price: parsedPrice,
    },
    buildManagerHeaders({ managerEmail, getStorageItem })
  );
}
