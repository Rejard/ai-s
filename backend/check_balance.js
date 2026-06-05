const { ethers } = require('ethers');

async function checkBalance() {
  try {
    const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
    const sutAbi = ["function balanceOf(address account) external view returns (uint256)"];
    const sutContract = new ethers.Contract(sutContractAddress, sutAbi, provider);

    const wallets = [
      { name: "마스터 계정 (lemaiiisk)", address: "0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987" },
      { name: "서브 계정 (lemaiiiaiii)", address: "0x0a6ad9C9b86908829E9E4DefC733e27f7DEA69Df" }
    ];

    for (const wallet of wallets) {
      const balanceWei = await provider.getBalance(wallet.address);
      const balancePol = ethers.formatEther(balanceWei);
      
      let balanceSut = "0";
      try {
        const sutWei = await sutContract.balanceOf(wallet.address);
        balanceSut = ethers.formatUnits(sutWei, 18);
      } catch (e) {
        balanceSut = "N/A";
      }
      
      console.log(`=============================`);
      console.log(`Name: ${wallet.name}`);
      console.log(`Address: ${wallet.address}`);
      console.log(`POL Balance: ${balancePol} POL`);
      console.log(`SUT Balance: ${balanceSut} SUT`);
    }
    console.log(`=============================`);
  } catch (err) {
    console.error(err);
  }
}

checkBalance();
