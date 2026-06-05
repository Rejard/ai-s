const { ethers } = require('ethers');

async function checkHistory() {
  try {
    const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
    const sutAbi = [
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ];
    const sutContract = new ethers.Contract(sutContractAddress, sutAbi, provider);

    const wallets = [
      { name: "Gate.io 수신처", address: "0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818" }
    ];

    const latestBlock = await provider.getBlockNumber();
    const range = 9500;
    const totalBlocks = 300000;
    let startBlock = latestBlock - totalBlocks;

    console.log(`Querying SUT logs from block ${startBlock} to ${latestBlock}...`);

    for (const wallet of wallets) {
      console.log(`\n--------------------------------------------`);
      console.log(`🔎 조사 대상: ${wallet.name} (${wallet.address})`);

      const filterTo = sutContract.filters.Transfer(null, wallet.address);

      let logsTo = [];

      for (let currentStart = startBlock; currentStart < latestBlock; currentStart += range) {
        const currentEnd = Math.min(currentStart + range - 1, latestBlock);
        try {
          const batchTo = await sutContract.queryFilter(filterTo, currentStart, currentEnd);
          logsTo = logsTo.concat(batchTo);
        } catch (e) {
          console.error(`Error querying batch:`, e.message);
        }
      }

      console.log(`📥 SUT 입금 이력 (RECEIVED):`);
      if (logsTo.length === 0) console.log("  (내역 없음)");
      for (const log of logsTo) {
        const amount = ethers.formatUnits(log.args.value, 18);
        console.log(`  Block: ${log.blockNumber} | From: ${log.args.from} | Amount: ${amount} SUT | TxHash: ${log.transactionHash}`);
      }
    }
    console.log(`--------------------------------------------`);

  } catch (err) {
    console.error(err);
  }
}

checkHistory();
