const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('platform.db');
db.all("SELECT * FROM manager_gateio_transfers WHERE manager_email = 'psycyk123456@gmail.com'", (err, rows) => {
  console.log(rows);
  db.close();
});
