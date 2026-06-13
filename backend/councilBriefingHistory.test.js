const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const {
  ensureCouncilBriefingHistorySchema,
  getLatestSuccessfulBriefing,
  startBriefingRefresh,
  finishBriefingRefreshSuccess,
  finishBriefingRefreshFailure,
  createRefreshCoordinator,
  shouldRefreshBriefing,
} = require('./councilBriefingHistory');

const db = new sqlite3.Database(':memory:');
const store = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function onRun(error) {
        if (error) reject(error);
        else resolve({ lastID: this.lastID, changes: this.changes });
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
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
  },
};

async function main() {
  await ensureCouncilBriefingHistorySchema(store);

  const refresh = await startBriefingRefresh(store, {
    scope: 'ADMIN',
    triggeredBy: 'INITIAL',
    evolutionTime: '1718300000000',
    modelName: 'gemini-2.5-pro'
  });

  let latest = await getLatestSuccessfulBriefing(store, 'ADMIN');
  assert.strictEqual(latest, null);

  await finishBriefingRefreshSuccess(store, refresh.id, {
    briefingText: '첫 번째 성공 분석문',
    generatedAt: '2026-06-14 09:00:00'
  });

  latest = await getLatestSuccessfulBriefing(store, 'ADMIN');
  assert.strictEqual(latest.briefingText, '첫 번째 성공 분석문');
  assert.strictEqual(latest.generatedAt, '2026-06-14 09:00:00');

  const failed = await startBriefingRefresh(store, {
    scope: 'ADMIN',
    triggeredBy: 'CACHE_REFRESH',
    evolutionTime: '1718303600000',
    modelName: 'gemini-2.5-pro'
  });

  await finishBriefingRefreshFailure(store, failed.id, 'Gemini timeout');

  latest = await getLatestSuccessfulBriefing(store, 'ADMIN');
  assert.strictEqual(latest.briefingText, '첫 번째 성공 분석문');

  const adminRefresh = await startBriefingRefresh(store, {
    scope: 'ADMIN',
    triggeredBy: 'INITIAL',
    evolutionTime: null,
    modelName: 'gemini-2.5-pro'
  });
  await finishBriefingRefreshSuccess(store, adminRefresh.id, {
    briefingText: '관리자 분석',
    generatedAt: '2026-06-14 09:10:00'
  });

  const investmentRefresh = await startBriefingRefresh(store, {
    scope: 'INVESTMENT',
    triggeredBy: 'INITIAL',
    evolutionTime: null,
    modelName: 'gemini-2.5-pro'
  });
  await finishBriefingRefreshSuccess(store, investmentRefresh.id, {
    briefingText: '투자자 분석',
    generatedAt: '2026-06-14 09:11:00'
  });

  const adminLatest = await getLatestSuccessfulBriefing(store, 'ADMIN');
  const investmentLatest = await getLatestSuccessfulBriefing(store, 'INVESTMENT');
  assert.strictEqual(adminLatest.briefingText, '관리자 분석');
  assert.strictEqual(investmentLatest.briefingText, '투자자 분석');

  const coordinator = createRefreshCoordinator();
  assert.strictEqual(coordinator.isRefreshing('ADMIN'), false);
  assert.strictEqual(coordinator.start('ADMIN'), true);
  assert.strictEqual(coordinator.isRefreshing('ADMIN'), true);
  assert.strictEqual(coordinator.start('ADMIN'), false);
  coordinator.finish('ADMIN');
  assert.strictEqual(coordinator.isRefreshing('ADMIN'), false);

  assert.strictEqual(
    shouldRefreshBriefing({
      latestSuccess: null,
      now: Date.now(),
      lastEvolutionTime: 0,
      cacheDurationMs: 1000
    }),
    true
  );

  assert.strictEqual(
    shouldRefreshBriefing({
      latestSuccess: {
        generatedAt: '2026-06-14T00:00:00.000Z'
      },
      now: new Date('2026-06-14T00:10:00.000Z').getTime(),
      lastEvolutionTime: new Date('2026-06-13T23:00:00.000Z').getTime(),
      cacheDurationMs: 60 * 60 * 1000
    }),
    false
  );

  db.close();
  console.log('councilBriefingHistory tests passed');
}

main().catch((error) => {
  db.close();
  console.error(error);
  process.exitCode = 1;
});
