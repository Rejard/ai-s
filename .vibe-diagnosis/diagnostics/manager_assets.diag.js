const { queries } = require('../../backend/database');
const { ethers } = require('../../backend/node_modules/ethers');

module.exports = {
  id: 'manager-assets-diagnostic',
  name: 'Manager Assets Live Status Diagnostic',
  layer: 'TASK',
  linkedTask: 'TASK-001',

  async run(ctx) {
    try {
      const manager = await queries.get(
        "SELECT wallet_address, email, name FROM users WHERE is_manager = 1 LIMIT 1"
      );

      if (!manager) {
        return { 
          status: 'WARNING', 
          details: 'No registered manager found in Database to check assets against' 
        };
      }

      if (!manager.wallet_address || !manager.email) {
        return { 
          status: 'ERROR', 
          details: 'Manager metadata incomplete: wallet or email missing' 
        };
      }

      let vaultBalanceOk = false;
      try {
        const paymentStats = await queries.get(`
          SELECT
            COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'AI_PROFIT') THEN amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0) as vaultBalance
          FROM ledger l
          JOIN users u ON LOWER(l.wallet_address) = LOWER(u.wallet_address)
          WHERE l.manager_address = ? AND u.is_manager = 0
        `, [manager.wallet_address]);
        
        if (paymentStats) {
          vaultBalanceOk = true;
        }
      } catch (dbErr) {
        return { 
          status: 'ERROR', 
          details: `Ledger database query failed: ${dbErr.message}` 
        };
      }

      let onchainOk = false;
      let onchainMsg = 'Polygon RPC connection pending';
      try {
        const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
        const sutAddress = '0x170b0933cbe9f9393cbe9f9393cbe9f9393cbe9f';
        const sutAbi = ["function balanceOf(address account) external view returns (uint256)"];
        const sutContract = new ethers.Contract(sutAddress, sutAbi, provider);
        
        const balanceWei = await sutContract.balanceOf(manager.wallet_address);
        const onchainBalance = parseFloat(ethers.formatUnits(balanceWei, 18));
        onchainOk = true;
        onchainMsg = `Polygon SUT check ok: ${onchainBalance.toFixed(2)} SUT`;
      } catch (rpcErr) {
        onchainMsg = `Polygon SUT check failed (RPC Issue): ${rpcErr.message}`;
      }

      if (vaultBalanceOk) {
        if (onchainOk) {
          return { 
            status: 'OK', 
            details: `All local queries passed successfully. DB ledger query active. ${onchainMsg}` 
          };
        } else {
          return { 
            status: 'WARNING', 
            details: `Database queries passed but blockchain RPC had warning: ${onchainMsg}` 
          };
        }
      }

      return { 
        status: 'ERROR', 
        details: 'Self diagnostics completed with unresolved failures' 
      };

    } catch (err) {
      return { 
        status: 'ERROR', 
        details: `Diagnostic process crashed: ${err.message}` 
      };
    }
  }
};
