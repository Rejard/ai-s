const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('platform.db');

db.all("SELECT manager_email, side, SUM(deal) as total_deal, SUM(amount) as total_sut, AVG(price) as avg_price FROM manager_gateio_trades GROUP BY manager_email, side", (err, rows) => {
  if (err) console.error(err);
  else console.log(rows);
  db.close();
});
