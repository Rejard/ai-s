const { ethers } = require('ethers');

const rpcUrls = [
  'https://gateway.tenderly.co/public/polygon',
  'https://polygon.meowrpc.com',
  'https://polygon.llamarpc.com',
  'https://rpc.ankr.com/polygon',
  'https://1rpc.io/matic'
];

const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
const sutAbi = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const gateioAddress = "0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818";

const managers = [
  { name: '이명학', address: '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987', email: 'lemaiiisk@gmail.com' },
  { name: 'jae hyun im', address: '0x436af28144f75f8c56a375154f71279ef4f53f6e', email: 'linjaixuan@gmail.com' },
  { name: '박선용', address: '0x4b822b71dfc14e4bb5ffbfd7b1abc7c55dd071f4', email: 'psycyk123456@gmail.com' },
  { name: '임봉준', address: '0x3c491bbb1eed63ca1f0b52ac22d91dcc90dfdd12', email: 'willin888@gmail.com' }
];

async function tryQuery(provider, filter, startBlock, endBlock) {
  const sutContract = new ethers.Contract(sutContractAddress, sutAbi, provider);
  const range = 2000000;
  let logs = [];
  for (let currentStart = startBlock; currentStart < endBlock; currentStart += range) {
    const currentEnd = Math.min(currentStart + range - 1, endBlock);
    const batch = await sutContract.queryFilter(filter, currentStart, currentEnd);
    logs = logs.concat(batch);
  }
  return logs;
}

async function run() {
  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`\n========================================`);
      console.log(`Trying RPC: ${rpcUrl}`);
      const provider = new ethers.JsonRpcProvider(rpcUrl, 137, { staticNetwork: true });
      const latestBlock = await provider.getBlockNumber();
      console.log(`Latest block: ${latestBlock}`);
      
      const totalBlocks = 10000000; 
      const startBlock = Math.max(0, latestBlock - totalBlocks);
      console.log(`Querying from block ${startBlock} to ${latestBlock}...`);

      const sutContract = new ethers.Contract(sutContractAddress, sutAbi, provider);

      for (const manager of managers) {
        console.log(`🔍 Checking ${manager.name} (${manager.address})`);
        
        const filterToGate = sutContract.filters.Transfer(manager.address, gateioAddress);
        const logsToGate = await tryQuery(provider, filterToGate, startBlock, latestBlock);
        if (logsToGate.length > 0) {
          console.log(`  [FOUND] ${manager.name} -> Gate.io SUT Transfers:`);
          for (const log of logsToGate) {
            const amount = ethers.formatUnits(log.args.value, 18);
            console.log(`    Block: ${log.blockNumber} | Amount: ${amount} SUT | TxHash: ${log.transactionHash}`);
          }
        } else {
          console.log(`  No SUT transfers to Gate.io.`);
        }

        const filterFromGate = sutContract.filters.Transfer(gateioAddress, manager.address);
        const logsFromGate = await tryQuery(provider, filterFromGate, startBlock, latestBlock);
        if (logsFromGate.length > 0) {
          console.log(`  [FOUND] Gate.io -> ${manager.name} SUT Transfers:`);
          for (const log of logsFromGate) {
            const amount = ethers.formatUnits(log.args.value, 18);
            console.log(`    Block: ${log.blockNumber} | Amount: ${amount} SUT | TxHash: ${log.transactionHash}`);
          }
        } else {
          console.log(`  No SUT transfers from Gate.io.`);
        }
      }
      
      console.log("✔ Query completed successfully on this RPC node.");
      break;
    } catch (err) {
      console.error(`❌ Failed on RPC ${rpcUrl}: ${err.message}`);
    }
  }
}

run();
