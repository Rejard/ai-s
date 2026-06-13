# Council Briefing History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist council briefing generations in SQLite and serve the latest successful briefing immediately while background refreshes continue without replacing visible text with an in-progress placeholder.

**Architecture:** Add a small persistence helper for briefing history reads and writes, migrate SQLite with an additive table, and refactor both council-stats routes to read the latest successful row from DB while using only a minimal in-memory refresh guard. Extend the admin and investment responses with timestamp and refresh metadata, then render that metadata in the admin briefing card without adding a history browser yet.

**Tech Stack:** Node.js, Express, sqlite3, existing `queries` wrapper, React, plain Node assertion tests

---

## File Structure

- Modify: `backend/database.js`
  - Add `council_briefing_history` table creation and indexes during DB initialization.
- Create: `backend/councilBriefingHistory.js`
  - Centralize history table reads and writes plus refresh state helpers.
- Create: `backend/councilBriefingHistory.test.js`
  - Cover latest-success lookup, in-progress insertion, success completion, and failed refresh retention.
- Modify: `backend/routes/admin.js`
  - Replace visible-text memory cache with DB-backed latest-success lookup and metadata response.
- Modify: `backend/routes/investment.js`
  - Mirror the admin route behavior for shared council briefing semantics.
- Modify: `frontend/src/hooks/useAdminLogic.js`
  - Preserve new API fields in admin state.
- Modify: `frontend/src/pages/AdminDashboard.jsx`
  - Show generated time and updating status without hiding the current briefing text.
- Modify: `frontend/src/pages/CouncilPage.jsx`
  - Preserve new API fields in state, even if the page does not render extra metadata yet.
- Modify: `frontend/src/pages/Dashboard.jsx`
  - Preserve new briefing metadata from the investment route.

### Task 1: Add the Briefing History Persistence Layer

**Files:**
- Modify: `backend/database.js`
- Create: `backend/councilBriefingHistory.js`
- Test: `backend/councilBriefingHistory.test.js`

- [ ] **Step 1: Write the failing persistence test**

```js
const assert = require('assert');
const sqlite3 = require('sqlite3').verbose();
const {
  ensureCouncilBriefingHistorySchema,
  getLatestSuccessfulBriefing,
  startBriefingRefresh,
  finishBriefingRefreshSuccess,
  finishBriefingRefreshFailure,
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

  db.close();
  console.log('councilBriefingHistory tests passed');
}

main().catch((error) => {
  db.close();
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node backend/councilBriefingHistory.test.js`
Expected: FAIL with `Cannot find module './councilBriefingHistory'`

- [ ] **Step 3: Add the schema helper in `backend/councilBriefingHistory.js`**

```js
async function ensureCouncilBriefingHistorySchema(store) {
  await store.run(`
    CREATE TABLE IF NOT EXISTS council_briefing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL CHECK (scope IN ('ADMIN', 'INVESTMENT')),
      briefing_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'IN_PROGRESS')),
      triggered_by TEXT NOT NULL,
      evolution_time TEXT,
      model_name TEXT,
      error_message TEXT,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      generated_at DATETIME
    )
  `);
  await store.run(`
    CREATE INDEX IF NOT EXISTS idx_council_briefing_history_scope_status_generated
    ON council_briefing_history(scope, status, generated_at DESC)
  `);
  await store.run(`
    CREATE INDEX IF NOT EXISTS idx_council_briefing_history_scope_started
    ON council_briefing_history(scope, started_at DESC)
  `);
}

module.exports = {
  ensureCouncilBriefingHistorySchema,
};
```

- [ ] **Step 4: Add the CRUD helpers in `backend/councilBriefingHistory.js`**

```js
async function getLatestSuccessfulBriefing(store, scope) {
  const row = await store.get(`
    SELECT
      id,
      scope,
      briefing_text AS briefingText,
      status,
      triggered_by AS triggeredBy,
      evolution_time AS evolutionTime,
      model_name AS modelName,
      started_at AS startedAt,
      generated_at AS generatedAt
    FROM council_briefing_history
    WHERE scope = ? AND status = 'SUCCESS'
    ORDER BY datetime(generated_at) DESC, id DESC
    LIMIT 1
  `, [scope]);
  return row || null;
}

async function startBriefingRefresh(store, { scope, triggeredBy, evolutionTime, modelName }) {
  const result = await store.run(`
    INSERT INTO council_briefing_history (
      scope, briefing_text, status, triggered_by, evolution_time, model_name
    ) VALUES (?, '', 'IN_PROGRESS', ?, ?, ?)
  `, [scope, triggeredBy, evolutionTime || null, modelName || null]);
  return { id: result.lastID };
}

async function finishBriefingRefreshSuccess(store, id, { briefingText, generatedAt }) {
  await store.run(`
    UPDATE council_briefing_history
    SET status = 'SUCCESS',
        briefing_text = ?,
        generated_at = ?,
        error_message = NULL
    WHERE id = ?
  `, [briefingText, generatedAt, id]);
}

async function finishBriefingRefreshFailure(store, id, errorMessage) {
  await store.run(`
    UPDATE council_briefing_history
    SET status = 'FAILED',
        error_message = ?
    WHERE id = ?
  `, [errorMessage, id]);
}

module.exports = {
  ensureCouncilBriefingHistorySchema,
  getLatestSuccessfulBriefing,
  startBriefingRefresh,
  finishBriefingRefreshSuccess,
  finishBriefingRefreshFailure,
};
```

- [ ] **Step 5: Wire the schema into `backend/database.js`**

```js
const { ensureCouncilBriefingHistorySchema } = require('./councilBriefingHistory');
```

```js
      db.run(`
        CREATE TABLE IF NOT EXISTS ais_council_voting_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          member_id TEXT NOT NULL,
          decision_vote TEXT NOT NULL,
          weight_at_vote REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (member_id) REFERENCES ais_council_members (member_id)
        )
      `, async (err) => {
        if (err) return reject(err);
        try {
          await ensureCouncilBriefingHistorySchema(queries);
          await migrateAisEvaluationSchema(db);
          console.log('SQLite Database initialized successfully with Root Referrers.');
          resolve();
        } catch (migrationError) {
          reject(migrationError);
        }
      });
```

- [ ] **Step 6: Run the persistence test to verify it passes**

Run: `node backend/councilBriefingHistory.test.js`
Expected: PASS with `councilBriefingHistory tests passed`

- [ ] **Step 7: Commit**

```bash
git add backend/database.js backend/councilBriefingHistory.js backend/councilBriefingHistory.test.js
git commit -m "feat: persist council briefing history"
```

### Task 2: Refactor the Admin Council Route to Serve Latest Success While Refreshing

**Files:**
- Modify: `backend/routes/admin.js`
- Test: `backend/councilBriefingHistory.test.js`

- [ ] **Step 1: Extend the test with refresh-state coverage**

```js
const { createRefreshCoordinator } = require('./councilBriefingHistory');

async function refreshCoordinatorScenario() {
  const coordinator = createRefreshCoordinator();

  assert.strictEqual(coordinator.isRefreshing('ADMIN'), false);
  assert.strictEqual(coordinator.start('ADMIN'), true);
  assert.strictEqual(coordinator.isRefreshing('ADMIN'), true);
  assert.strictEqual(coordinator.start('ADMIN'), false);
  coordinator.finish('ADMIN');
  assert.strictEqual(coordinator.isRefreshing('ADMIN'), false);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node backend/councilBriefingHistory.test.js`
Expected: FAIL with `createRefreshCoordinator is not a function`

- [ ] **Step 3: Add refresh guard and route helper support in `backend/councilBriefingHistory.js`**

```js
function createRefreshCoordinator() {
  const refreshingScopes = new Set();

  return {
    isRefreshing(scope) {
      return refreshingScopes.has(scope);
    },
    start(scope) {
      if (refreshingScopes.has(scope)) return false;
      refreshingScopes.add(scope);
      return true;
    },
    finish(scope) {
      refreshingScopes.delete(scope);
    }
  };
}

function shouldRefreshBriefing({ latestSuccess, now, lastEvolutionTime, cacheDurationMs }) {
  if (!latestSuccess) return true;
  const generatedAtMs = latestSuccess.generatedAt ? new Date(latestSuccess.generatedAt).getTime() : 0;
  if (!generatedAtMs) return true;
  if ((now - generatedAtMs) > cacheDurationMs) return true;
  return generatedAtMs < lastEvolutionTime;
}
```

- [ ] **Step 4: Replace the admin route memory cache with DB-backed lookup**

```js
const {
  createRefreshCoordinator,
  getLatestSuccessfulBriefing,
  shouldRefreshBriefing,
  startBriefingRefresh,
  finishBriefingRefreshSuccess,
  finishBriefingRefreshFailure
} = require('../councilBriefingHistory');

const briefingRefreshCoordinator = createRefreshCoordinator();
const BRIEFING_SCOPE = 'ADMIN';
```

```js
    const latestBriefing = await getLatestSuccessfulBriefing(queries, BRIEFING_SCOPE);
    const refreshing = briefingRefreshCoordinator.isRefreshing(BRIEFING_SCOPE);
    const refreshNeeded = shouldRefreshBriefing({
      latestSuccess: latestBriefing,
      now,
      lastEvolutionTime: lastEvoTime,
      cacheDurationMs: BRIEFING_CACHE_DURATION
    });

    if (refreshNeeded && briefingRefreshCoordinator.start(BRIEFING_SCOPE)) {
      const modelName = modelRow && modelRow.value ? modelRow.value : null;
      const refreshRow = await startBriefingRefresh(queries, {
        scope: BRIEFING_SCOPE,
        triggeredBy: latestBriefing ? 'CACHE_REFRESH' : 'INITIAL',
        evolutionTime: lastEvoTime ? String(lastEvoTime) : null,
        modelName
      });

      generateCouncilOpinionBriefing(factionStats, activeMembers, generationStats)
        .then(async (result) => {
          await finishBriefingRefreshSuccess(queries, refreshRow.id, {
            briefingText: result,
            generatedAt: new Date().toISOString()
          });
        })
        .catch(async (error) => {
          await finishBriefingRefreshFailure(queries, refreshRow.id, error.message);
        })
        .finally(() => {
          briefingRefreshCoordinator.finish(BRIEFING_SCOPE);
        });
    }
```

- [ ] **Step 5: Return metadata from the admin route**

```js
    const visibleBriefing = latestBriefing
      ? latestBriefing.briefingText
      : generateFallbackBriefing(factionStats, activeMembers, generationStats);

    res.json({
      success: true,
      totalCount,
      factionStats,
      activeMembers,
      recentVotes,
      briefing: visibleBriefing,
      briefingGeneratedAt: latestBriefing ? latestBriefing.generatedAt : null,
      briefingStatus: latestBriefing ? latestBriefing.status : 'FALLBACK',
      briefingRefreshing: refreshNeeded || briefingRefreshCoordinator.isRefreshing(BRIEFING_SCOPE),
      healthReport
    });
```

- [ ] **Step 6: Run the test suite that covers the helper layer**

Run: `node backend/councilBriefingHistory.test.js`
Expected: PASS with `councilBriefingHistory tests passed`

- [ ] **Step 7: Commit**

```bash
git add backend/routes/admin.js backend/councilBriefingHistory.js backend/councilBriefingHistory.test.js
git commit -m "feat: keep admin briefing visible during refresh"
```

### Task 3: Mirror the Investment Council Route Behavior

**Files:**
- Modify: `backend/routes/investment.js`
- Modify: `backend/councilBriefingHistory.js`
- Test: `backend/councilBriefingHistory.test.js`

- [ ] **Step 1: Extend the test with per-scope independence**

```js
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
```

- [ ] **Step 2: Run the test to verify it passes before route edits**

Run: `node backend/councilBriefingHistory.test.js`
Expected: PASS

- [ ] **Step 3: Apply the same DB-backed refresh flow to `backend/routes/investment.js`**

```js
const investmentBriefingRefreshCoordinator = createRefreshCoordinator();
const BRIEFING_SCOPE = 'INVESTMENT';
```

```js
    const latestBriefing = await getLatestSuccessfulBriefing(queries, BRIEFING_SCOPE);
    const refreshNeeded = shouldRefreshBriefing({
      latestSuccess: latestBriefing,
      now,
      lastEvolutionTime: lastEvoTime,
      cacheDurationMs: BRIEFING_CACHE_DURATION
    });

    if (refreshNeeded && investmentBriefingRefreshCoordinator.start(BRIEFING_SCOPE)) {
      const refreshRow = await startBriefingRefresh(queries, {
        scope: BRIEFING_SCOPE,
        triggeredBy: latestBriefing ? 'CACHE_REFRESH' : 'INITIAL',
        evolutionTime: lastEvoTime ? String(lastEvoTime) : null,
        modelName: modelRow && modelRow.value ? modelRow.value : null
      });

      generateCouncilOpinionBriefing(factionStats, activeMembers, generationStats)
        .then(async (result) => {
          await finishBriefingRefreshSuccess(queries, refreshRow.id, {
            briefingText: result,
            generatedAt: new Date().toISOString()
          });
        })
        .catch(async (error) => {
          await finishBriefingRefreshFailure(queries, refreshRow.id, error.message);
        })
        .finally(() => {
          investmentBriefingRefreshCoordinator.finish(BRIEFING_SCOPE);
        });
    }
```

- [ ] **Step 4: Return the same metadata contract from the investment route**

```js
    const visibleBriefing = latestBriefing
      ? latestBriefing.briefingText
      : generateFallbackBriefing(factionStats, activeMembers, generationStats);

    res.json({
      success: true,
      totalCount,
      factionStats,
      activeMembers,
      recentVotes,
      briefing: visibleBriefing,
      briefingGeneratedAt: latestBriefing ? latestBriefing.generatedAt : null,
      briefingStatus: latestBriefing ? latestBriefing.status : 'FALLBACK',
      briefingRefreshing: refreshNeeded || investmentBriefingRefreshCoordinator.isRefreshing(BRIEFING_SCOPE)
    });
```

- [ ] **Step 5: Run the helper test again**

Run: `node backend/councilBriefingHistory.test.js`
Expected: PASS with `councilBriefingHistory tests passed`

- [ ] **Step 6: Commit**

```bash
git add backend/routes/investment.js backend/councilBriefingHistory.js backend/councilBriefingHistory.test.js
git commit -m "feat: align investment briefing refresh behavior"
```

### Task 4: Surface Briefing Metadata in the Admin UI

**Files:**
- Modify: `frontend/src/hooks/useAdminLogic.js`
- Modify: `frontend/src/pages/AdminDashboard.jsx`
- Modify: `frontend/src/pages/CouncilPage.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Update admin and investment state mapping**

```js
setCouncilStats({
  totalCount: res.data.totalCount || 0,
  factionStats: res.data.factionStats || [],
  activeMembers: res.data.activeMembers || [],
  recentVotes: res.data.recentVotes || [],
  briefing: res.data.briefing || '',
  briefingGeneratedAt: res.data.briefingGeneratedAt || '',
  briefingStatus: res.data.briefingStatus || '',
  briefingRefreshing: Boolean(res.data.briefingRefreshing),
  healthReport: res.data.healthReport || null
});
```

```js
setCouncilStats({
  factionStats: res.data.factionStats,
  activeMembers: res.data.activeMembers,
  recentVotes: res.data.recentVotes,
  briefing: res.data.briefing || '',
  briefingGeneratedAt: res.data.briefingGeneratedAt || '',
  briefingStatus: res.data.briefingStatus || '',
  briefingRefreshing: Boolean(res.data.briefingRefreshing)
});
```

- [ ] **Step 2: Add admin card metadata rendering**

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
  {councilStats.briefingGeneratedAt && (
    <span>분석 일시: {new Date(councilStats.briefingGeneratedAt).toLocaleString('ko-KR')}</span>
  )}
  {councilStats.briefingRefreshing && (
    <span style={{
      padding: '2px 8px',
      borderRadius: '999px',
      background: 'rgba(59, 130, 246, 0.12)',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      color: '#60A5FA'
    }}>
      업데이트 중
    </span>
  )}
</div>
<div style={{ wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>{councilStats.briefing}</div>
```

- [ ] **Step 3: Preserve the same response shape in investment consumers**

```js
setCouncilStats({
  totalCount: res.data.totalCount,
  factionStats: res.data.factionStats,
  activeMembers: res.data.activeMembers,
  recentVotes: res.data.recentVotes,
  briefing: res.data.briefing,
  briefingGeneratedAt: res.data.briefingGeneratedAt || '',
  briefingStatus: res.data.briefingStatus || '',
  briefingRefreshing: Boolean(res.data.briefingRefreshing)
});
```

- [ ] **Step 4: Run the frontend production build**

Run: `npm run build`
Workdir: `C:\home\ai-s\frontend`
Expected: PASS with Vite build output and no JSX errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useAdminLogic.js frontend/src/pages/AdminDashboard.jsx frontend/src/pages/CouncilPage.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat: show council briefing generation status"
```

### Task 5: Final Verification

**Files:**
- Modify: none
- Test: `backend/councilBriefingHistory.test.js`

- [ ] **Step 1: Run backend helper tests**

Run: `node backend/councilBriefingHistory.test.js`
Expected: PASS with `councilBriefingHistory tests passed`

- [ ] **Step 2: Run existing council briefing tests**

Run: `node backend/councilBriefing.test.mjs`
Expected: PASS with `councilBriefing tests passed`

- [ ] **Step 3: Run existing admin stats tests**

Run: `node backend/aisAdminStats.test.js`
Expected: PASS with `aisAdminStats tests passed`

- [ ] **Step 4: Run frontend build**

Run: `npm run build`
Workdir: `C:\home\ai-s\frontend`
Expected: PASS with generated `dist` assets

- [ ] **Step 5: Manually verify the response contract**

Run: `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4000/api/admin/council-stats | Select-Object -ExpandProperty Content`
Expected: JSON containing `briefing`, `briefingGeneratedAt`, `briefingStatus`, and `briefingRefreshing`

- [ ] **Step 6: Commit final integration adjustments**

```bash
git add backend frontend
git commit -m "feat: persist council briefing generations"
```

## Self-Review

- Spec coverage: The plan covers DB persistence, generated timestamp, latest-success reads, refresh state separation, admin metadata rendering, shared investment behavior, and verification. It intentionally excludes history browsing and rollback because the spec excluded them.
- Placeholder scan: No `TBD`, `TODO`, or implicit “write tests later” steps remain. Each task includes concrete files, commands, and code snippets.
- Type consistency: The plan uses one table name `council_briefing_history`, one helper module `backend/councilBriefingHistory.js`, one timestamp field `briefingGeneratedAt`, one refresh flag `briefingRefreshing`, and route metadata names that match the frontend state mapping.
