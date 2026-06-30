const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { parseDbTimestamp } = require('../timeUtil');

const SCHEDULER_DEFS = [
  {
    id: 'gridbot_main',
    name: 'AI Grid Bot 중앙 스케줄러',
    type: 'timer',
    intervalDesc: '5~60분 (동적)',
    lastRunKey: 'last_gridbot_tick',
    intervalKey: 'global_ai_interval',
    defaultIntervalMin: 5,
    successKey: 'scheduler_gridbot_success_count',
    failKey: 'scheduler_gridbot_fail_count',
    consecutiveFailKey: 'scheduler_gridbot_consecutive_fails',
    overdueMultiplier: 2.0,
  },
  {
    id: 'labeling',
    name: '학습 데이터 라벨링 (적중 판정)',
    type: 'timer',
    intervalDesc: 'GridBot 틱과 동기',
    lastRunKey: 'scheduler_labeling_last_run',
    intervalKey: 'global_ai_interval',
    defaultIntervalMin: 5,
    overdueMultiplier: 2.5,
    extraKeys: { lastCount: 'scheduler_labeling_last_count' },
  },
  {
    id: 'shadow_racing',
    name: 'Shadow Racing 데이터 적재',
    type: 'timer',
    intervalDesc: 'GridBot 틱과 동기',
    lastRunKey: 'scheduler_shadow_last_run',
    intervalKey: 'global_ai_interval',
    defaultIntervalMin: 5,
    overdueMultiplier: 2.5,
  },
  {
    id: 'safeguard',
    name: '엔진 안전장치 (Safeguard)',
    type: 'timer',
    intervalDesc: 'GridBot 틱과 동기',
    lastRunKey: 'scheduler_safeguard_last_run',
    intervalKey: 'global_ai_interval',
    defaultIntervalMin: 5,
    overdueMultiplier: 2.5,
    extraKeys: { lastTriggered: 'scheduler_safeguard_last_triggered' },
  },
  {
    id: 'evolution_12h',
    name: 'AI 유전자 진화 (12시간)',
    type: 'conditional',
    intervalDesc: '12시간 주기',
    lastRunKey: 'last_evolution_time',
    fixedIntervalMs: 12 * 60 * 60 * 1000,
    overdueMultiplier: 1.5,
  },
  {
    id: 'auto_training',
    name: 'AiS 자동 재학습',
    type: 'conditional',
    intervalDesc: '24시간 + 10건 조건',
    lastRunKey: 'ais_last_trained_at',
    fixedIntervalMs: 24 * 60 * 60 * 1000,
    overdueMultiplier: 1.5,
    extraKeys: {
      lastCheck: 'scheduler_autotrain_last_check',
      lastTriggered: 'scheduler_autotrain_last_triggered',
    },
  },
  {
    id: 'kyc_cleanup',
    name: 'KYC 자동 정리',
    type: 'timer',
    intervalDesc: '1시간',
    lastRunKey: 'scheduler_kyc_cleanup_last_run',
    fixedIntervalMs: 60 * 60 * 1000,
    overdueMultiplier: 2.0,
    extraKeys: { lastDeleted: 'scheduler_kyc_cleanup_last_deleted' },
  },
  {
    id: 'council_briefing',
    name: '의회 브리핑 캐시',
    type: 'event',
    intervalDesc: '12시간 캐시 + 진화 후 재생성',
    briefingTable: true,
    fixedIntervalMs: 12 * 60 * 60 * 1000,
    overdueMultiplier: 1.5,
  },
];

function parseEpoch(val) {
  if (!val) return null;
  return parseDbTimestamp(val) || null;
}

async function collectSchedulerHealth() {
  const allKeys = new Set();
  for (const def of SCHEDULER_DEFS) {
    if (def.lastRunKey) allKeys.add(def.lastRunKey);
    if (def.intervalKey) allKeys.add(def.intervalKey);
    if (def.successKey) allKeys.add(def.successKey);
    if (def.failKey) allKeys.add(def.failKey);
    if (def.consecutiveFailKey) allKeys.add(def.consecutiveFailKey);
    if (def.extraKeys) {
      for (const k of Object.values(def.extraKeys)) allKeys.add(k);
    }
  }

  const placeholders = [...allKeys].map(() => '?').join(',');
  const rows = await queries.all(
    `SELECT key, value FROM platform_settings WHERE key IN (${placeholders})`,
    [...allKeys]
  );
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  let briefingLastRun = null;
  try {
    const briefingRow = await queries.get(
      "SELECT generated_at FROM council_briefing_history ORDER BY id DESC LIMIT 1"
    );
    if (briefingRow && briefingRow.generated_at) {
      briefingLastRun = parseDbTimestamp(briefingRow.generated_at);
    }
  } catch (_) {}

  const now = Date.now();
  const schedulers = [];

  for (const def of SCHEDULER_DEFS) {
    let lastRunAt = null;
    if (def.briefingTable) {
      lastRunAt = briefingLastRun;
    } else {
      lastRunAt = parseEpoch(settings[def.lastRunKey]);
    }

    let currentIntervalMs = def.fixedIntervalMs || null;
    if (def.intervalKey && settings[def.intervalKey]) {
      const minutes = parseInt(settings[def.intervalKey], 10);
      if (Number.isFinite(minutes) && minutes > 0) {
        currentIntervalMs = minutes * 60 * 1000;
      }
    }
    if (!currentIntervalMs && def.defaultIntervalMin) {
      currentIntervalMs = def.defaultIntervalMin * 60 * 1000;
    }

    let nextExpectedAt = null;
    if (lastRunAt && currentIntervalMs) {
      nextExpectedAt = lastRunAt + currentIntervalMs;
    }

    const successCount = def.successKey ? parseInt(settings[def.successKey], 10) || 0 : null;
    const failCount = def.failKey ? parseInt(settings[def.failKey], 10) || 0 : null;
    const consecutiveFails = def.consecutiveFailKey
      ? parseInt(settings[def.consecutiveFailKey], 10) || 0
      : 0;

    let status = 'NEVER_RUN';
    let isOverdue = false;
    let overdueMinutes = 0;

    if (lastRunAt) {
      const elapsed = now - lastRunAt;
      const overdueThreshold = currentIntervalMs
        ? currentIntervalMs * (def.overdueMultiplier || 2.0)
        : null;
      const warningThreshold = currentIntervalMs
        ? currentIntervalMs * 1.5
        : null;

      if (overdueThreshold && elapsed > overdueThreshold) {
        status = 'OVERDUE';
        isOverdue = true;
        overdueMinutes = Math.round((elapsed - currentIntervalMs) / 60000);
      } else if (warningThreshold && elapsed > warningThreshold) {
        status = 'WARNING';
      } else {
        status = 'ALIVE';
      }

      if (consecutiveFails >= 3) {
        status = 'OVERDUE';
      } else if (consecutiveFails >= 1 && status === 'ALIVE') {
        status = 'WARNING';
      }
    }

    if (def.type === 'event' && lastRunAt && status === 'ALIVE') {
      status = 'DORMANT';
    }

    let details = null;
    if (def.extraKeys) {
      const parts = [];
      for (const [label, key] of Object.entries(def.extraKeys)) {
        const val = settings[key];
        if (val) {
          if (label === 'lastCount' || label === 'lastDeleted') {
            parts.push(`${label}: ${val}`);
          } else {
            const ts = parseEpoch(val);
            if (ts) {
              const ago = Math.round((now - ts) / 60000);
              parts.push(`${label}: ${ago}분 전`);
            }
          }
        }
      }
      if (parts.length > 0) details = parts.join(' | ');
    }

    schedulers.push({
      id: def.id,
      name: def.name,
      type: def.type,
      intervalDesc: def.intervalDesc,
      currentIntervalMs,
      lastRunAt,
      nextExpectedAt,
      successCount,
      failCount,
      consecutiveFails,
      status,
      isOverdue,
      overdueMinutes,
      details,
    });
  }

  return { success: true, timestamp: new Date().toISOString(), schedulers };
}

router.get('/scheduler-health', async (req, res) => {
  try {
    const result = await collectSchedulerHealth();
    res.json(result);
  } catch (err) {
    console.error('Scheduler health check error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.collectSchedulerHealth = collectSchedulerHealth;
