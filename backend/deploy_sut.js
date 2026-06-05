require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

async function compileContract(fileName, contractName) {
  const contractPath = path.resolve(__dirname, `../contracts/${fileName}`);
  const source = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      [fileName]: {
        content: source,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const hasError = output.errors.some(e => e.severity === 'error');
    if (hasError) {
      output.errors.forEach((err) => console.error(err.formattedMessage));
      throw new Error(`Failed to compile ${fileName}`);
    }
  }

  const contract = output.contracts[fileName][contractName];
  return {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object
  };
}

async function main() {
  const RPC_URL = process.env.RPC_URL || 'https://polygon-bor-rpc.publicnode.com';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    throw new Error("❌ PRIVATE_KEY is missing in .env!");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`📡 Connecting to Polygon Mainnet...`);
  console.log(`🔑 Deployer Address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Deployer Balance: ${ethers.formatEther(balance)} POL`);

  const vaultBuild = await compileContract('PlatformVault.sol', 'PlatformVault');
  
  fs.writeFileSync(
    path.resolve(__dirname, 'PlatformVaultBuild.json'),
    JSON.stringify(vaultBuild, null, 2)
  );

  const SUT_ADDRESS = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
  console.log(`🚀 Deploying PlatformVault using SUT Token: ${SUT_ADDRESS}`);
  
  const VaultFactory = new ethers.ContractFactory(vaultBuild.abi, vaultBuild.bytecode, wallet);
  const vault = await VaultFactory.deploy(SUT_ADDRESS);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`✅ PlatformVault deployed at: ${vaultAddress}`);

  // .env 파일 자동 업데이트
  const envPath = path.resolve(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('VAULT_CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(/VAULT_CONTRACT_ADDRESS=.*/, `VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
  } else {
    envContent += `\nVAULT_CONTRACT_ADDRESS=${vaultAddress}`;
  }

  if (envContent.includes('USDT_CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(/USDT_CONTRACT_ADDRESS=.*/, `# USDT_CONTRACT_ADDRESS=0xc2132D05D31c914a87C6611C10748AEb04B58e8F\nSUT_CONTRACT_ADDRESS=${SUT_ADDRESS}`);
  } else if (!envContent.includes('SUT_CONTRACT_ADDRESS=')) {
    envContent += `\nSUT_CONTRACT_ADDRESS=${SUT_ADDRESS}`;
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log(`📝 Updated backend/.env with SUT and Vault addresses.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
