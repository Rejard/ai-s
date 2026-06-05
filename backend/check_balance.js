const { ethers } = require('ethers');

async function checkBalance() {
  try {
    const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const walletAddress = '0x0a6ad9C9b86908829E9E4DefC733e27f7DEA69Df';
    
    // Check POL (MATIC) balance
    const balanceWei = await provider.getBalance(walletAddress);
    const balancePol = ethers.formatEther(balanceWei);
    
    // Check SUT token balance
    const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
    const sutAbi = ["function balanceOf(address account) external view returns (uint256)"];
    const sutContract = new ethers.Contract(sutContractAddress, sutAbi, provider);
    
    let balanceSut = "0";
    try {
      const sutWei = await sutContract.balanceOf(walletAddress);
      balanceSut = ethers.formatUnits(sutWei, 18);
    } catch (e) {
      console.log("Could not fetch SUT balance.");
    }
    
    console.log(`Wallet: ${walletAddress}`);
    console.log(`POL Balance: ${balancePol} POL`);
    console.log(`SUT Balance: ${balanceSut} SUT`);
  } catch (err) {
    console.error(err);
  }
}

checkBalance();
