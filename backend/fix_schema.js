const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.resolve(__dirname, 'platform.db'));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function columnExists(table, column) {
  const columns = await all(`PRAGMA table_info(${table})`);
  return columns.some((row) => row.name === column);
}

async function migratePaymentsCheck() {
  const [{ sql = '' } = {}] = await all("SELECT sql FROM sqlite_master WHERE type='table' AND name='payments'");
  if (sql.includes('AI_TRADING_PROFIT')) {
    return 'payments already supports AI_TRADING_PROFIT';
  }

  await run('DROP TABLE IF EXISTS payments_new');
  try {
    await run('BEGIN IMMEDIATE TRANSACTION');
    await run(`ALTER TABLE payments RENAME TO payments_old`);
    await run(`
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('MEMBERSHIP_FEE', 'MONTHLY_SUBSCRIPTION', 'WITHDRAW_REQUEST', 'AI_TRADING_PROFIT')),
        status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
        tx_hash TEXT,
        distributed_amount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wallet_address) REFERENCES users (wallet_address)
      )
    `);
    await run(`
      INSERT INTO payments (id, wallet_address, amount, type, status, tx_hash, distributed_amount, created_at)
      SELECT id, wallet_address, amount, type, status, tx_hash, distributed_amount, created_at
      FROM payments_old
    `);
    await run('DROP TABLE payments_old');
    await run('COMMIT');
    return 'payments migrated to support AI_TRADING_PROFIT';
  } catch (err) {
    try {
      await run('ROLLBACK');
    } catch {

    }
    throw err;
  }
}

async function main() {
  if (!(await columnExists('users', 'referrer_address'))) {
    await run("ALTER TABLE users ADD COLUMN referrer_address TEXT NOT NULL DEFAULT 'none'");
  }

  await run("UPDATE users SET referrer_address = 'none' WHERE referrer_address IS NULL OR referrer_address = ''");
  const paymentsResult = await migratePaymentsCheck();

  console.log(JSON.stringify({
    usersReferrerAddress: 'ready',
    payments: paymentsResult,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
