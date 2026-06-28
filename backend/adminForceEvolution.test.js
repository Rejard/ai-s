const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const tempDbPath = path.join(os.tmpdir(), `force-evolution-${process.pid}-${Date.now()}.db`);
  process.env.AIS_DB_PATH = tempDbPath;

  const database = require('./database');
  const adminRouter = require('./routes/admin');

  try {
    await database.initializeDatabase();
    const q = database.queries;

    let passed = 0;

    {
      const before = await q.get("SELECT value FROM platform_settings WHERE key = 'last_evolution_time'");
      const result = await adminRouter.__private__.runForceEvolution({
        execFileAsync: async (command, args, options) => {
          assert.equal(command, 'py');
          assert.deepEqual(args, ['-3', 'train_ais.py']);
          assert.ok(options);
          assert.equal(options.cwd, path.resolve(__dirname));
          return { stdout: 'ok', stderr: '' };
        },
        queries: q,
        now: () => 1234567890,
      });

      const after = await q.get("SELECT value FROM platform_settings WHERE key = 'last_evolution_time'");
      assert.equal(result.success, true);
      assert.equal(result.stats.stdout, 'ok');
      assert.equal(result.stats.stderr, '');
      assert.equal(after.value, '1234567890');
      assert.equal(before, undefined);
      passed++;
      console.log('  [PASS] runForceEvolution executes train_ais.py and updates last_evolution_time');
    }

    console.log(`\nadminForceEvolution: ${passed}/${passed} tests passed`);
  } finally {
    await new Promise((resolve) => database.db.close(resolve));
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    delete process.env.AIS_DB_PATH;
  }

  console.log('adminForceEvolution tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
