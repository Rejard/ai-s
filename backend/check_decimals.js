const { ethers } = require('ethers');

async function main() {
  const RPC_URL = 'https://polygon-bor-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  const tokenAddress = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
  const abi = ["function decimals() view returns (uint8)"];
  
  const contract = new ethers.Contract(tokenAddress, abi, provider);
  
  try {
    const decimals = await contract.decimals();
    console.log(`DECIMALS=${decimals}`);
  } catch (err) {
    console.error("Error fetching decimals:", err.message);
  }
}

main();
