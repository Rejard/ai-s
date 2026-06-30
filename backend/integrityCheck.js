const { ethers } = require('ethers');

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

async function verifyTransactionOnChain(provider, sutAddress, txHash, expectedFrom, expectedTo, expectedAmount) {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    return { valid: false, reason: 'Transaction failed or not found' };
  }

  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  for (const log of receipt.logs) {
    if (log.topics[0] !== transferTopic || log.topics.length < 3) continue;
    if (log.address.toLowerCase() !== sutAddress.toLowerCase()) continue;

    const from = '0x' + log.topics[1].slice(26);
    const to = '0x' + log.topics[2].slice(26);
    const amount = parseFloat(ethers.formatUnits(log.data, 18));

    const fromMatch = from.toLowerCase() === expectedFrom.toLowerCase();
    const toMatch = to.toLowerCase() === expectedTo.toLowerCase();
    const amountMatch = Math.abs(amount - expectedAmount) < 0.001;

    if (fromMatch && toMatch && amountMatch) {
      return { valid: true, from, to, amount, blockNumber: receipt.blockNumber };
    }
  }

  return { valid: false, reason: 'No matching SUT Transfer event found' };
}

async function getOnChainBalance(provider, sutAddress, walletAddress) {
  const sut = new ethers.Contract(sutAddress, ERC20_ABI, provider);
  const balance = await sut.balanceOf(walletAddress);
  return parseFloat(ethers.formatUnits(balance, 18));
}

async function checkIntegrity(queries, provider, sutAddress, vaultAddress) {
  const row = await queries.get(`
    SELECT
      COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'AI_PROFIT') THEN amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN type = 'ADJUSTMENT' THEN amount ELSE 0 END), 0)
    AS total
    FROM ledger
  `);

  const dbBalance = row ? row.total : 0;
  const onChainBalance = await getOnChainBalance(provider, sutAddress, vaultAddress);

  const difference = Math.abs(dbBalance - onChainBalance);
  const isConsistent = difference < 0.01;

  const result = {
    dbBalance: parseFloat(dbBalance.toFixed(4)),
    onChainBalance: parseFloat(onChainBalance.toFixed(4)),
    difference: parseFloat(difference.toFixed(4)),
    isConsistent,
    checkedAt: new Date().toISOString()
  };

  if (!isConsistent) {
    await logAudit(queries, 'INTEGRITY_MISMATCH', 'ledger', null, result, 'system');
  }

  return result;
}

async function logAudit(queries, action, tableName, recordId, details, performedBy) {
  const result = await queries.run(`
    INSERT INTO audit_log (action, table_name, record_id, details, performed_by)
    VALUES (?, ?, ?, ?, ?)
  `, [action, tableName, recordId, JSON.stringify(details), performedBy]);
  return result.lastID;
}

async function insertLedgerEntry(queries, { managerAddress, walletAddress, type, amount, txHash, description, verified }) {
  const result = await queries.run(`
    INSERT INTO ledger (manager_address, wallet_address, type, amount, tx_hash, description, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [managerAddress, walletAddress, type, amount, txHash, description || null, verified ? 1 : 0]);

  if (!result || result.lastID === undefined) {
    throw new Error('Failed to insert ledger entry');
  }

  return { id: result.lastID };
}

async function getMemberBalance(queries, walletAddress, managerAddress) {
  const row = await queries.get(`
    SELECT
      COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'AI_PROFIT') THEN amount ELSE 0 END), 0) as totalIn,
      COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0) as totalOut,
      COALESCE(SUM(CASE WHEN type = 'ADJUSTMENT' THEN amount ELSE 0 END), 0) as totalAdjustment
    FROM ledger
    WHERE LOWER(wallet_address) = LOWER(?) AND manager_address = ?
  `, [walletAddress, managerAddress]);

  const totalIn = row ? row.totalIn : 0;
  const totalOut = row ? row.totalOut : 0;
  const totalAdj = row ? row.totalAdjustment : 0;

  return {
    totalIn,
    totalOut,
    totalAdjustment: totalAdj,
    balance: totalIn - totalOut + totalAdj
  };
}

module.exports = {
  verifyTransactionOnChain,
  getOnChainBalance,
  checkIntegrity,
  logAudit,
  insertLedgerEntry,
  getMemberBalance,
};
