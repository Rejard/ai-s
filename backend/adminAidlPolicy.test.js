const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const tempDbPath = path.join(os.tmpdir(), `admin-aidl-policy-${process.pid}-${Date.now()}.db`);
  process.env.AIS_DB_PATH = tempDbPath;

  const database = require('./database');
  const adminRouter = require('./routes/admin');

  try {
    await database.initializeDatabase();

    const settings = await database.queries.all(`
      SELECT key, value
      FROM platform_settings
      WHERE key IN (
        'aidl_context_mutation_rate',
        'aidl_state_mutation_rate',
        'aidl_weight_nudge_size'
      )
      ORDER BY key
    `);

    const policy = adminRouter.__private__.buildAidlPolicyConfig(settings);

    assert.deepEqual(policy, {
      contextMutationRate: '0.10',
      stateMutationRate: '0.10',
      weightNudgeSize: '0.02',
    });
  } finally {
    await new Promise((resolve) => database.db.close(resolve));
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    delete process.env.AIS_DB_PATH;
  }

  console.log('adminAidlPolicy tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
