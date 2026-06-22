const { getGateIoOpenOrders } = require('./gateioHelper.js');
const { decryptText } = require('./secureCredentials');
const sqlite3 = require('sqlite3').verbose();

async function checkOpenOrders() {
  const db = new sqlite3.Database('platform.db');
  const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });

  try {
    const managers = await query("SELECT manager_email, encrypted_api_key, encrypted_api_secret FROM manager_gateio_credentials");
    for (const mgr of managers) {
      const key = decryptText(mgr.encrypted_api_key);
      const sec = decryptText(mgr.encrypted_api_secret);
      
      const orders = await getGateIoOpenOrders(key, sec);
      console.log(`Open orders for ${mgr.manager_email}:`, orders.data || orders);
    }
  } catch (e) {
    console.error(e);
  } finally {
    db.close();
  }
}
checkOpenOrders();
