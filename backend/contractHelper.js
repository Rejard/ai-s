const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const RPC_URL = process.env.RPC_URL || 'https://polygon-bor-rpc.publicnode.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const MockUSDT_ABI = [
  "constructor()",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
  "function approve(address, uint256) returns (bool)",
  "function transferFrom(address, address, uint256) returns (bool)",
  "function mint(address, uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

const MockUSDT_BYTECODE = "0x608060405234801561001057600080fd5b506103e86000540160005530600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282540192505081905550506103e8306001600033";

const PlatformVault_ABI = [
  "constructor(address _usdtTokenAddress)",
  "function owner() view returns (address)",
  "function usdtToken() view returns (address)",
  "function collectAndDistribute(address user, address referrer1, address referrer2, uint256 amount) external returns (bool)",
  "function changeOwner(address _newOwner) external",
  "function emergencyWithdrawToken(address tokenAddress, uint256 amount) external",
  "event CollectedAndDistributed(address indexed user, address indexed referrer1, address indexed referrer2, uint256 amount, uint256 ref1Amount, uint256 ref2Amount, uint256 ownerAmount)",
  "event OwnerChanged(address indexed oldOwner, address indexed newOwner)"
];

let provider;
let wallet;
let isSimulationMode = false;

let usdtAddress = process.env.USDT_CONTRACT_ADDRESS;
let vaultAddress = process.env.VAULT_CONTRACT_ADDRESS;

try {
  provider = new ethers.JsonRpcProvider(RPC_URL, 137, { staticNetwork: true });
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`📡 Ethers Connected. Operator Address: ${wallet.address}`);
} catch (e) {
  console.log("⚠ Web3 provider connection failed. Switched to SIMULATION MODE (No gas fee required).");
  isSimulationMode = true;
}

async function autoDeployContracts() {
  if (isSimulationMode) return { usdtAddress: 'MOCK_USDT_ADDR', vaultAddress: 'MOCK_VAULT_ADDR', simulated: true };

  if (usdtAddress && vaultAddress) {
    console.log(`✔ Smart Contracts already deployed at:\n  USDT: ${usdtAddress}\n  Vault: ${vaultAddress}`);
    return { usdtAddress, vaultAddress, simulated: false };
  }

  try {
    const balance = await Promise.race([
      provider.getBalance(wallet.address),
      new Promise((_, reject) => setTimeout(() => reject(new Error("RPC Timeout")), 3000))
    ]);
    const balanceEth = ethers.formatEther(balance);
    console.log(`Operator POL Balance: ${balanceEth} POL`);

    if (parseFloat(balanceEth) < 0.05) {
      console.log("⚠ Operator POL balance too low (< 0.05 POL). Initializing in SIMULATION MODE to save your costs.");
      isSimulationMode = true;
      usdtAddress = '0x1234567890123456789012345678901234567890';
      vaultAddress = '0x0987654321098765432109876543210987654321';
      return { usdtAddress, vaultAddress, simulated: true };
    }

      console.log(`🚀 Starting deployment on Polygon Mainnet...`);

      console.log(`✔ 수동 지급 관리형 아키텍처로 인해 스마트 컨트랙트 볼트 확인 절차를 생략합니다.`);
  } catch (err) {
    console.error("⚠ Error checking contracts on Mainnet:", err.message);
  }
}

async function triggerOnChainDistribution(userWallet, referrer1, referrer2, amountSut) {

  const amountInDecimals = ethers.parseUnits(amountSut.toString(), 18);

  if (isSimulationMode) {
    const mockTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    console.log(`[SIMULATED TX] Distributed ${amountSut} SUT. User: ${userWallet}, Ref1: ${referrer1}, Ref2: ${referrer2}, TxHash: ${mockTxHash}`);
    return {
      success: true,
      txHash: mockTxHash,
      simulated: true,
      ref1Share: 0,
      ref2Share: 0,
      ownerShare: amountSut
    };
  }

  try {
    const vaultContract = new ethers.Contract(vaultAddress, PlatformVault_ABI, wallet);

    const r1 = referrer1 === 'none' ? ethers.ZeroAddress : referrer1;
    const r2 = referrer2 === 'none' ? ethers.ZeroAddress : referrer2;

    console.log(`[ON-CHAIN TX] Charging ${amountSut} SUT from ${userWallet}...`);

    const tx = await vaultContract.collectAndDistribute(userWallet, r1, r2, amountInDecimals, {
      gasLimit: 300000
    });

    console.log(`Transaction sent. Hash: ${tx.hash}. Waiting for confirmation...`);
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);

    return {
      success: true,
      txHash: tx.hash,
      simulated: false,
      ref1Share: 0,
      ref2Share: 0,
      ownerShare: amountSut
    };
  } catch (err) {
    console.error("❌ On-chain transaction failed:", err.message);

    // For user demo continuity, perform fallback processing and mock the logic as successful with a warning.
    throw new Error(`On-chain transaction execution failed: ${err.message}`);
  }
}

const SUT_CONTRACT_ADDRESS = process.env.SUT_CONTRACT_ADDRESS || '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';

async function serverTransferSutFrom(fromAddress, toAddress, amountStr) {
  if (isSimulationMode) {
    throw new Error('서버가 시뮬레이션 모드입니다. 온체인 전송을 수행할 수 없습니다.');
  }

  const sutAbi = [
    "function transferFrom(address, address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)"
  ];
  const sutContract = new ethers.Contract(SUT_CONTRACT_ADDRESS, sutAbi, wallet);
  const amount = ethers.parseUnits(String(amountStr), 18);

  const allowance = await sutContract.allowance(fromAddress, wallet.address);
  if (allowance < amount) {
    const error = new Error('INSUFFICIENT_ALLOWANCE');
    error.code = 'INSUFFICIENT_ALLOWANCE';
    error.currentAllowance = ethers.formatUnits(allowance, 18);
    error.requiredAmount = amountStr;
    throw error;
  }

  const gasEstimate = await sutContract.transferFrom.estimateGas(fromAddress, toAddress, amount);
  const gasLimit = gasEstimate + (gasEstimate * 20n / 100n);

  const tx = await sutContract.transferFrom(fromAddress, toAddress, amount, { gasLimit });
  const receipt = await tx.wait(1);

  if (!receipt || (receipt.status !== undefined && Number(receipt.status) !== 1)) {
    throw new Error('transferFrom 트랜잭션이 체인에서 실패했습니다.');
  }

  return { txHash: tx.hash, receipt };
}

function getOperatorAddress() {
  if (isSimulationMode || !wallet) return null;
  return wallet.address;
}

module.exports = {
  autoDeployContracts,
  triggerOnChainDistribution,
  isSimulationMode: () => isSimulationMode,
  getAddresses: () => ({ usdtAddress, vaultAddress }),
  getOperatorAddress,
  serverTransferSutFrom,
  MockUSDT_ABI,
  PlatformVault_ABI
};
