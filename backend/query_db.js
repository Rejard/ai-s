const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'platform.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, wallet_address, email, name, phone, status, manager_address FROM users", (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows, null, 2));
  db.close();
});
