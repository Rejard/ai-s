const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.resolve(__dirname, 'platform.db'));

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('global_mock_profit_percent', '0.0')`);

  db.run(`CREATE TABLE IF NOT EXISTS payments_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MEMBERSHIP_FEE', 'MONTHLY_SUBSCRIPTION', 'WITHDRAW_REQUEST')),
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
    tx_hash TEXT,
    distributed_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_address) REFERENCES users (wallet_address)
  )`);

  db.run(`INSERT INTO payments_new SELECT * FROM payments`, (err) => {
    if (err && !err.message.includes("no such table")) {
      console.error(err);
    } else {
      db.run(`DROP TABLE payments`);
      db.run(`ALTER TABLE payments_new RENAME TO payments`);
      console.log("Migration complete.");
    }
  });
});
