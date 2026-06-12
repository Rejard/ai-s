import {
  buildTrustWalletOpenUrl,
  resolveWalletTransactionProvider,
} from './walletProvider.js';

const SUT_CONTRACT_ADDRESS = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
const SUT_CONTRACT_ADDRESS_LOWER = SUT_CONTRACT_ADDRESS.toLowerCase();
const SUT_VAULT_ADDRESS = '0x855c880D538892fD899eECb72D4b1Ac5B46089eA';
const POLYGON_RPC_URL = 'https://polygon-bor-rpc.publicnode.com';
const SUT_DECIMALS = 18;
const SUT_TRANSFER_ABI = ['function transfer(address recipient, uint256 amount) external returns (bool)'];
const SUT_BALANCE_ABI = ['function balanceOf(address account) external view returns (uint256)'];
export const RESUME_SUT_DEPOSIT_PARAM = 'resume_sut_deposit';
export const RESUME_SUT_AMOUNT_PARAM = 'resume_sut_amount';
export const FINALIZE_SUT_DEPOSIT_PARAM = 'finalize_sut_deposit';
export const FINALIZE_SUT_TX_HASH_PARAM = 'sut_deposit_tx_hash';

function isMobileUserAgent(userAgent = '') {
  return /iPhone|iPad|iPod|Android/i.test(userAgent);
}

export function buildDepositResumeUrl(currentUrl, amount) {
  const url = new URL(currentUrl);
  url.searchParams.set(RESUME_SUT_DEPOSIT_PARAM, '1');
  url.searchParams.set(RESUME_SUT_AMOUNT_PARAM, String(amount));
  return url.toString();
}

export function buildTrustWalletDepositRedirectUrl(currentUrl, amount) {
  return buildTrustWalletOpenUrl(buildDepositResumeUrl(currentUrl, amount));
}

export function buildDepositFinalizeUrl(currentUrl, amount, txHash) {
  const url = new URL(currentUrl);
  url.searchParams.delete(RESUME_SUT_DEPOSIT_PARAM);
  url.searchParams.delete(RESUME_SUT_AMOUNT_PARAM);
  url.searchParams.set(FINALIZE_SUT_DEPOSIT_PARAM, '1');
  url.searchParams.set(RESUME_SUT_AMOUNT_PARAM, String(amount));
  url.searchParams.set(FINALIZE_SUT_TX_HASH_PARAM, txHash);
  return url.toString();
}

async function waitForDepositTransactionReceipt(tx, ethersLib) {
  const rpcProvider = new ethersLib.JsonRpcProvider(POLYGON_RPC_URL);
  const receipt = await rpcProvider.waitForTransaction(tx.hash, 1);
  if (!receipt || (receipt.status !== undefined && Number(receipt.status) !== 1)) {
    const error = new Error('DEPOSIT_TX_REVERTED');
    error.code = 'DEPOSIT_TX_REVERTED';
    throw error;
  }
  return receipt;
}

export async function finalizePendingDepositTransaction({
  apiBase,
  walletAddress,
  amount,
  txHash,
  axiosClient,
  ethersLib,
}) {
  await waitForDepositTransactionReceipt({ hash: txHash }, ethersLib);

  const parsedFloatAmount = parseFloat(amount);
  if (Number.isNaN(parsedFloatAmount) || parsedFloatAmount <= 0) {
    throw new Error('Enter a valid amount.');
  }

  return axiosClient.post(`${apiBase}/investment/deposit`, {
    walletAddress,
    amount: parsedFloatAmount,
    txHash,
  });
}

async function getActiveWalletAddress(transactionProvider) {
  const accounts = await transactionProvider.request({ method: 'eth_accounts' });
  return Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : '';
}

function assertWalletAddressMatch(loginWalletAddress, activeWalletAddress) {
  if (!activeWalletAddress || activeWalletAddress.toLowerCase() !== loginWalletAddress.toLowerCase()) {
    throw new Error(`Wallet address mismatch. Login wallet: ${loginWalletAddress}, active wallet: ${activeWalletAddress}`);
  }
}

async function submitDepositViaDirectProvider({
  transactionProvider,
  walletAddress,
  amount,
  ethersLib,
}) {
  const signerAddress = await getActiveWalletAddress(transactionProvider);
  assertWalletAddressMatch(walletAddress, signerAddress);

  const parsedAmount = ethersLib.parseUnits(amount.toString(), SUT_DECIMALS);
  const transferInterface = new ethersLib.Interface(SUT_TRANSFER_ABI);
  const txHash = await transactionProvider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: signerAddress,
      to: SUT_CONTRACT_ADDRESS,
      data: transferInterface.encodeFunctionData('transfer', [SUT_VAULT_ADDRESS, parsedAmount]),
    }],
  });

  return { hash: txHash };
}

async function submitDepositViaBrowserProvider({
  transactionProvider,
  walletAddress,
  amount,
  ethersLib,
}) {
  const provider = new ethersLib.BrowserProvider(transactionProvider);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();

  assertWalletAddressMatch(walletAddress, signerAddress);

  const sutContract = new ethersLib.Contract(SUT_CONTRACT_ADDRESS, SUT_TRANSFER_ABI, signer);
  const parsedAmount = ethersLib.parseUnits(amount.toString(), SUT_DECIMALS);
  return sutContract.transfer(SUT_VAULT_ADDRESS, parsedAmount);
}

function shouldFallbackToDirectMobileDeposit(error, userAgent = '') {
  if (!isMobileUserAgent(userAgent)) return false;
  const message = String(error?.message || '');
  return (
    message.includes('could not coalesce error') ||
    message.includes('eth_blockNumber') ||
    error?.code === 'UNKNOWN_ERROR'
  );
}

export async function loadUserDashboardData({
  apiBase,
  walletAddress,
  axiosClient,
  ethersLib,
}) {
  const data = {
    portfolio: undefined,
    walletSutBalance: undefined,
    sutPrice: undefined,
    sutChange24h: undefined,
    priceHistory: undefined,
  };

  const portRes = await axiosClient.get(`${apiBase}/investment/portfolio/${walletAddress}`);
  if (portRes.data.success) {
    const portfolio = portRes.data.portfolio;
    const currentPrice = portfolio.assets.SUT.price;
    data.portfolio = portfolio;
    data.sutPrice = currentPrice;
    data.sutChange24h = portfolio.sutChange24h || 0;
    data.sutHigh24h = portfolio.sutHigh24h;
    data.sutLow24h = portfolio.sutLow24h;
    data.priceHistory = portfolio.sutHistory || [];
  }

  try {
    const rpcProvider = new ethersLib.JsonRpcProvider(POLYGON_RPC_URL);
    const sutContract = new ethersLib.Contract(SUT_CONTRACT_ADDRESS_LOWER, SUT_BALANCE_ABI, rpcProvider);
    const balanceWei = await sutContract.balanceOf(walletAddress);
    data.walletSutBalance = parseFloat(ethersLib.formatUnits(balanceWei, SUT_DECIMALS));
  } catch {
    data.walletSutBalance = undefined;
  }

  return data;
}

export async function loadUserTxHistory({ apiBase, walletAddress, axiosClient }) {
  const res = await axiosClient.get(`${apiBase}/investment/history/${walletAddress}`);
  return res.data.success ? res.data.history : [];
}

export function buildNextPriceHistory(previousHistory = [], currentPrice, apiHistory = []) {
  if (apiHistory.length > 0) return apiHistory;

  const nextHistory = previousHistory.length > 0
    ? [...previousHistory, currentPrice]
    : [currentPrice];

  return nextHistory.slice(-30);
}

export async function submitUserInvestmentTransaction({
  apiBase,
  walletAddress,
  amount,
  type,
  portfolio,
  ethereum,
  userAgent = '',
  currentUrl = '',
  axiosClient,
  ethersLib,
}) {
  const parsedFloatAmount = parseFloat(amount);
  if (!amount || Number.isNaN(parsedFloatAmount) || parsedFloatAmount <= 0) {
    throw new Error('Enter a valid amount.');
  }

  if (type === 'DEPOSIT') {
    const isResumeFlow = currentUrl && new URL(currentUrl).searchParams.get(RESUME_SUT_DEPOSIT_PARAM) === '1';
    let transactionProvider;
    try {
      transactionProvider = await resolveWalletTransactionProvider({
        ethereum,
        userAgent,
      });
    } catch (error) {
      if (
        error?.message === 'NO_TRUST_WALLET' &&
        currentUrl &&
        isMobileUserAgent(userAgent)
      ) {
        const redirectError = new Error('MOBILE_TRUST_WALLET_REDIRECT');
        redirectError.code = 'MOBILE_TRUST_WALLET_REDIRECT';
        redirectError.redirectUrl = buildTrustWalletDepositRedirectUrl(currentUrl, amount);
        throw redirectError;
      }
      throw error;
    }
    await transactionProvider.request({ method: 'eth_requestAccounts' });
    let tx;
    try {
      tx = await submitDepositViaBrowserProvider({
        transactionProvider,
        walletAddress,
        amount,
        ethersLib,
      });
    } catch (error) {
      if (!shouldFallbackToDirectMobileDeposit(error, userAgent)) {
        throw error;
      }
      tx = await submitDepositViaDirectProvider({
        transactionProvider,
        walletAddress,
        amount,
        ethersLib,
      });
    }

    if (isResumeFlow && isMobileUserAgent(userAgent)) {
      return {
        code: 'MOBILE_TRUST_WALLET_RETURN',
        redirectUrl: buildDepositFinalizeUrl(currentUrl, amount, tx.hash),
        txHash: tx.hash,
      };
    }

    await waitForDepositTransactionReceipt(tx, ethersLib);

    const res = await finalizePendingDepositTransaction({
      apiBase,
      walletAddress,
      amount,
      txHash: tx.hash,
      axiosClient,
      ethersLib,
    });

    return { response: res, txHash: tx.hash };
  }

  if (portfolio && parsedFloatAmount > portfolio.sutQuantity) {
    throw new Error('Withdrawal amount exceeds current SUT balance.');
  }

  const res = await axiosClient.post(`${apiBase}/investment/withdraw`, {
    walletAddress,
    amount: parsedFloatAmount,
  });

  return { response: res };
}
