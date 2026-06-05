const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'platform.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, wallet_address, amount, type, status, tx_hash, created_at FROM payments ORDER BY id DESC LIMIT 10", (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows, null, 2));
  db.close();
});
