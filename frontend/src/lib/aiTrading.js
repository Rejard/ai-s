const SQLITE_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function parseAiLogCreatedAt(createdAt) {
  if (!createdAt) return NaN;

  if (SQLITE_TIMESTAMP_PATTERN.test(createdAt)) {
    return Date.parse(`${createdAt.replace(' ', 'T')}Z`);
  }

  return Date.parse(createdAt);
}

export function isFreshAiStrategy(createdAt, nowMs = Date.now(), maxAgeMs = 15 * 60 * 1000) {
  const createdAtMs = parseAiLogCreatedAt(createdAt);
  if (!Number.isFinite(createdAtMs)) return false;

  return nowMs - createdAtMs <= maxAgeMs;
}
