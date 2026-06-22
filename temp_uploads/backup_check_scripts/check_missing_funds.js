const sqlite3 = require('sqlite3').verbose();
const { getGateIoBalances } = require('./gateioHelper.js');
const { decryptText } = require('./secureCredentials');

async function analyzeMissing() {
  const db = new sqlite3.Database('platform.db');
  const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });

  try {
    const managers = await query("SELECT manager_email, encrypted_api_key, encrypted_api_secret FROM manager_gateio_credentials");
    
    for (const mgr of managers) {
      const email = mgr.manager_email;
      const key = decryptText(mgr.encrypted_api_key);
      const sec = decryptText(mgr.encrypted_api_secret);
      
      const balanceRes = await getGateIoBalances(key, sec).catch(()=>({success:false}));
      const actualUsdt = balanceRes.success && balanceRes.balances ? parseFloat(balanceRes.balances.USDT || 0) : 0;

      const transfers = await query("SELECT * FROM manager_gateio_transfers WHERE LOWER(manager_email) = LOWER(?)", [email]);
      const totalDepositUsdt = transfers.filter(t => t.type === 'DEPOSIT' && t.currency === 'USDT').reduce((acc, t) => acc + parseFloat(t.amount), 0);
      const totalWithdrawUsdt = transfers.filter(t => t.type === 'WITHDRAW' && t.currency === 'USDT').reduce((acc, t) => acc + parseFloat(t.amount), 0);

      const trades = await query("SELECT * FROM manager_gateio_trades WHERE LOWER(manager_email) = LOWER(?)", [email]);
      
      let totalBuyUsdt = 0;
      let totalSellUsdt = 0;
      let totalFeeUsdt = 0;

      trades.forEach(tr => {
        if (tr.side === 'buy') {
          totalBuyUsdt += parseFloat(tr.deal);
        } else if (tr.side === 'sell') {
          totalSellUsdt += parseFloat(tr.deal);
        }
        
        if (tr.fee_currency === 'USDT') {
          totalFeeUsdt += parseFloat(tr.fee);
        }
      });

      const theoreticalUsdt = totalDepositUsdt - totalWithdrawUsdt - totalBuyUsdt + totalSellUsdt - totalFeeUsdt;
      const missingUsdt = theoreticalUsdt - actualUsdt;

      console.log(`\n=== Manager: ${email} ===`);
      console.log(`[+] Total USDT Deposits: ${totalDepositUsdt.toFixed(2)}`);
      console.log(`[-] Total USDT Withdrawals (DB): ${totalWithdrawUsdt.toFixed(2)}`);
      console.log(`[-] Total USDT Spent on Buys: ${totalBuyUsdt.toFixed(2)}`);
      console.log(`[+] Total USDT Gained from Sells: ${totalSellUsdt.toFixed(2)}`);
      console.log(`[-] Total USDT Trading Fees: ${totalFeeUsdt.toFixed(2)}`);
      console.log(`----------------------------------------`);
      console.log(`=> Theoretical USDT Balance: ${theoreticalUsdt.toFixed(2)}`);
      console.log(`=> Actual Gate.io Spot USDT Balance: ${actualUsdt.toFixed(2)}`);
      console.log(`=> Missing / Unaccounted USDT: ${missingUsdt.toFixed(2)}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    db.close();
  }
}

analyzeMissing();
