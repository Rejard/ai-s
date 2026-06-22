const { getGateIoWithdrawals } = require('./gateioHelper.js');
const { decryptText } = require('./secureCredentials');
const sqlite3 = require('sqlite3').verbose();

async function checkWithdrawals() {
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
      
      console.log(`\n=== Checking live API withdrawals for ${email} ===`);
      try {
        const withdrawals = await getGateIoWithdrawals(key, sec);
        if (withdrawals.success) {
           console.log(`Live withdrawals:`, withdrawals.data);
        } else {
           console.log(`Failed to fetch:`, withdrawals);
        }
      } catch(e) {
        console.log(`Error:`, e.message);
      }

      // Check DB transfers
      const dbTransfers = await query("SELECT * FROM manager_gateio_transfers WHERE manager_email = ?", [email]);
      console.log(`DB Transfers count: ${dbTransfers.length}`);
      const w = dbTransfers.filter(t => t.type === 'WITHDRAW' || t.amount < 0 || t.type.toLowerCase().includes('withdraw'));
      if (w.length > 0) {
        console.log('DB Withdrawals found:', w);
      } else {
        console.log('No withdrawals found in DB.');
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    db.close();
  }
}

checkWithdrawals();
