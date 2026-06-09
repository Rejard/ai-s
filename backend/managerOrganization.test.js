const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const {
  getManagerAccount,
  getManagedUser,
  getManagedWithdrawal,
} = require('./managerOrganization');

const db = new sqlite3.Database(':memory:');
const store = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function onRun(error) {
        if (error) reject(error);
        else resolve(this);
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (error, row) => {
        if (error) reject(error);
        else resolve(row);
      });
    });
  },
};

async function main() {
  await store.run('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, wallet_address TEXT, manager_address TEXT, status TEXT, is_manager INTEGER)');
  await store.run('CREATE TABLE payments (id INTEGER PRIMARY KEY, wallet_address TEXT, amount REAL, type TEXT, status TEXT)');
  await store.run("INSERT INTO users VALUES (1, 'manager-a@example.com', '0xAAA', 'none', 'APPROVED', 1)");
  await store.run("INSERT INTO users VALUES (2, 'manager-b@example.com', '0xBBB', 'none', 'APPROVED', 1)");
  await store.run("INSERT INTO users VALUES (3, 'member-a@example.com', '0x111', '0xAAA', 'APPROVED', 0)");
  await store.run("INSERT INTO users VALUES (4, 'member-b@example.com', '0x222', '0xBBB', 'APPROVED', 0)");
  await store.run("INSERT INTO payments VALUES (10, '0x111', 5, 'WITHDRAW_REQUEST', 'PENDING')");

  const manager = await getManagerAccount(store, 'MANAGER-A@EXAMPLE.COM');
  assert.strictEqual(manager.wallet_address, '0xAAA');
  assert.ok(await getManagedUser(store, '0xaaa', '0x111'));
  assert.strictEqual(await getManagedUser(store, '0xaaa', '0x222'), undefined);
  assert.strictEqual(await getManagedUser(store, '0xaaa', '0xBBB'), undefined);
  assert.ok(await getManagedWithdrawal(store, '0xaaa', 10));
  assert.strictEqual(await getManagedWithdrawal(store, '0xbbb', 10), undefined);

  db.close();
  console.log('managerOrganization tests passed');
}

main().catch((error) => {
  db.close();
  console.error(error);
  process.exitCode = 1;
});
