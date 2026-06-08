import { ethers } from 'ethers';

import {
  resolveWalletTransactionProvider,
  normalizeChainId,
} from './walletProvider.js';

export const POLYGON_MAINNET_CHAIN_ID = '0x89';
export const SUT_TOKEN_ADDRESS = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
export const VAULT_CONTRACT_ADDRESS = '0x855c880D538892fD899eECb72D4b1Ac5B46089eA';
export const SUT_APPROVE_UNITS = '1000000';
export const SUT_APPROVE_DECIMALS = 18;
export const GAS_ESTIMATE_BUFFER_PERCENT = 20n;

const POLYGON_CHAIN_PARAMS = {
  chainId: POLYGON_MAINNET_CHAIN_ID,
  chainName: 'Polygon Mainnet',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: ['https://polygon-bor-rpc.publicnode.com'],
  blockExplorerUrls: ['https://polygonscan.com'],
};

export function isPolygonMainnetChain(chainId) {
  return normalizeChainId(chainId) === POLYGON_MAINNET_CHAIN_ID;
}

export function toSutApprovalAmount(amount = SUT_APPROVE_UNITS) {
  return ethers.parseUnits(String(amount), SUT_APPROVE_DECIMALS);
}

async function ensurePolygonMainnet(provider) {
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (isPolygonMainnetChain(chainId)) return;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_MAINNET_CHAIN_ID }],
    });
  } catch (switchError) {
    if (switchError?.code !== 4902) throw switchError;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [POLYGON_CHAIN_PARAMS],
    });
  }
}

export function addGasEstimateBuffer(gasEstimate, bufferPercent = GAS_ESTIMATE_BUFFER_PERCENT) {
  return gasEstimate + ((gasEstimate * bufferPercent) / 100n);
}

export function calculateRequiredGasWei(gasEstimate, feePerGas) {
  return addGasEstimateBuffer(gasEstimate) * feePerGas;
}

async function assertSufficientPolForApproval(provider, signer, sutContract, approvalAmount) {
  const signerAddress = await signer.getAddress();
  const [balance, gasEstimate, feeData] = await Promise.all([
    provider.getBalance(signerAddress),
    sutContract.approve.estimateGas(VAULT_CONTRACT_ADDRESS, approvalAmount),
    provider.getFeeData(),
  ]);
  const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;

  if (feePerGas === null) {
    return addGasEstimateBuffer(gasEstimate);
  }

  const requiredGasWei = calculateRequiredGasWei(gasEstimate, feePerGas);
  if (balance < requiredGasWei) {
    const error = new Error('INSUFFICIENT_POL_FOR_GAS');
    error.code = 'INSUFFICIENT_POL_FOR_GAS';
    error.balanceWei = balance;
    error.requiredGasWei = requiredGasWei;
    throw error;
  }

  return addGasEstimateBuffer(gasEstimate);
}

export async function waitForSuccessfulApproval(tx) {
  const receipt = await tx.wait(1);
  if (!receipt || (receipt.status !== undefined && Number(receipt.status) !== 1)) {
    const error = new Error('APPROVAL_TX_REVERTED');
    error.code = 'APPROVAL_TX_REVERTED';
    throw error;
  }
  return receipt;
}

export async function approveSutWithdrawalPermission({ ethereum }) {
  const injectedProvider = await resolveWalletTransactionProvider({
    ethereum,
  });

  await injectedProvider.request({ method: 'eth_requestAccounts' });
  await ensurePolygonMainnet(injectedProvider);

  const provider = new ethers.BrowserProvider(injectedProvider);
  const signer = await provider.getSigner();
  const sutContract = new ethers.Contract(
    SUT_TOKEN_ADDRESS,
    ['function approve(address spender, uint256 value) public returns (bool)'],
    signer
  );
  const approvalAmount = toSutApprovalAmount();
  const gasLimit = await assertSufficientPolForApproval(
    provider,
    signer,
    sutContract,
    approvalAmount
  );

  const tx = await sutContract.approve(VAULT_CONTRACT_ADDRESS, approvalAmount, {
    gasLimit,
  });

  return tx;
}
