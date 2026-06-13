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
      scope,
      briefing_text,
      status,
      triggered_by,
      evolution_time,
      model_name
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

  const generatedAtMs = latestSuccess.generatedAt
    ? new Date(latestSuccess.generatedAt).getTime()
    : 0;

  if (!generatedAtMs) return true;
  if ((now - generatedAtMs) > cacheDurationMs) return true;

  return generatedAtMs < lastEvolutionTime;
}

module.exports = {
  ensureCouncilBriefingHistorySchema,
  getLatestSuccessfulBriefing,
  startBriefingRefresh,
  finishBriefingRefreshSuccess,
  finishBriefingRefreshFailure,
  createRefreshCoordinator,
  shouldRefreshBriefing
};
