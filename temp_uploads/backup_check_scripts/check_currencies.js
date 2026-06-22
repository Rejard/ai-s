const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('platform.db');
db.all("SELECT manager_email, currency, SUM(amount) as total FROM manager_gateio_transfers WHERE type = 'DEPOSIT' GROUP BY manager_email, currency", (err, rows) => {
  console.log(rows);
  db.close();
});
