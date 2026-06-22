const sqlite3 = require('sqlite3').verbose();
const { getGateIoBalances } = require('./gateioHelper.js');
const { decryptText } = require('./secureCredentials');

async function checkPerformances() {
  const db = new sqlite3.Database('platform.db');
  
  const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });

  try {
    const sutPrice = 0.19; // Current fallback or test price

    const managers = await query("SELECT manager_email, encrypted_api_key, encrypted_api_secret FROM manager_gateio_credentials");
    for (const mgr of managers) {
      const email = mgr.manager_email;
      const key = decryptText(mgr.encrypted_api_key);
      const sec = decryptText(mgr.encrypted_api_secret);
      
      const balanceRes = await getGateIoBalances(key, sec).catch(e => ({ success: false }));
      const sutBalance = balanceRes.success && balanceRes.balances ? (balanceRes.balances.SUT || 0) : 0;
      const usdtBalance = balanceRes.success && balanceRes.balances ? (balanceRes.balances.USDT || 0) : 0;

      const transfers = await query(`SELECT * FROM manager_gateio_transfers WHERE LOWER(manager_email) = LOWER(?)`, [email]);
      
      let totalDepositUsdt = 0;
      let totalWithdrawUsdt = 0;

      transfers.forEach(tr => {
        const amt = tr.amount;
        let val = 0;
        if (tr.currency === 'USDT') val = amt;
        else if (tr.currency === 'SUT') val = amt * sutPrice;
        else val = amt;

        if (tr.type === 'DEPOSIT') totalDepositUsdt += val;
        else if (tr.type === 'WITHDRAW') totalWithdrawUsdt += val;
      });

      const sutCurrentValue = sutBalance * sutPrice;
      const totalBuyUsdt = totalDepositUsdt;
      const currentValue = sutCurrentValue + usdtBalance;

      let yieldPercent = 0;
      if (totalBuyUsdt > 0) {
        const netProfit = currentValue - totalBuyUsdt + totalWithdrawUsdt;
        yieldPercent = (netProfit / totalBuyUsdt) * 100;
      }

      console.log(`Manager: ${email}`);
      console.log(`  sutBalance: ${sutBalance}, usdtBalance: ${usdtBalance}`);
      console.log(`  totalDepositUsdt: ${totalDepositUsdt.toFixed(2)}, totalWithdrawUsdt: ${totalWithdrawUsdt.toFixed(2)}`);
      console.log(`  currentValue: ${currentValue.toFixed(2)}, totalBuyUsdt: ${totalBuyUsdt.toFixed(2)}`);
      console.log(`  => yieldPercent: ${yieldPercent.toFixed(2)}%`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    db.close();
  }
}

checkPerformances();
