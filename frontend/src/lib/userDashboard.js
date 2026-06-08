import { resolveWalletTransactionProvider } from './walletProvider.js';

const SUT_CONTRACT_ADDRESS = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
const SUT_CONTRACT_ADDRESS_LOWER = SUT_CONTRACT_ADDRESS.toLowerCase();
const SUT_VAULT_ADDRESS = '0x855c880D538892fD899eECb72D4b1Ac5B46089eA';
const POLYGON_RPC_URL = 'https://polygon-bor-rpc.publicnode.com';
const SUT_DECIMALS = 18;
const SUT_TRANSFER_ABI = ['function transfer(address recipient, uint256 amount) external returns (bool)'];
const SUT_BALANCE_ABI = ['function balanceOf(address account) external view returns (uint256)'];

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

export async function submitUserInvestmentTransaction({
  apiBase,
  walletAddress,
  amount,
  type,
  portfolio,
  ethereum,
  userAgent = '',
  walletConnectProjectId = '',
  axiosClient,
  ethersLib,
}) {
  const parsedFloatAmount = parseFloat(amount);
  if (!amount || Number.isNaN(parsedFloatAmount) || parsedFloatAmount <= 0) {
    throw new Error('Enter a valid amount.');
  }

  if (type === 'DEPOSIT') {
    const transactionProvider = await resolveWalletTransactionProvider({
      ethereum,
      userAgent,
      walletConnectProjectId,
    });
    await transactionProvider.request({ method: 'eth_requestAccounts' });

    const provider = new ethersLib.BrowserProvider(transactionProvider);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error(`Wallet address mismatch. Login wallet: ${walletAddress}, active wallet: ${signerAddress}`);
    }

    const sutContract = new ethersLib.Contract(SUT_CONTRACT_ADDRESS, SUT_TRANSFER_ABI, signer);
    const parsedAmount = ethersLib.parseUnits(amount.toString(), SUT_DECIMALS);
    const tx = await sutContract.transfer(SUT_VAULT_ADDRESS, parsedAmount);
    await tx.wait();

    const res = await axiosClient.post(`${apiBase}/investment/deposit`, {
      walletAddress,
      amount: parsedFloatAmount,
      txHash: tx.hash,
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
