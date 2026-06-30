function safeParseJson(value, fallback = null) {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    return value || fallback;
  } catch {
    return fallback;
  }
}

function parseCandidateDna(dnaJson) {
  return safeParseJson(dnaJson, null);
}

function determineCandidateOrigin(row) {
  const memberId = String(row?.member_id || '');
  const dna = parseCandidateDna(row?.dna_json);
  const lineage = dna && typeof dna.lineage === 'object' ? dna.lineage : {};
  const parentIds = Array.isArray(lineage.parent_ids) ? lineage.parent_ids : [];
  const mutationLog = Array.isArray(dna?.mutation_log) ? dna.mutation_log : [];
  const generation = Number(row?.generation || dna?.generation || 1);

  if (mutationLog.length > 0) return 'mutated_lineage';
  if (memberId.startsWith('offspring_') || parentIds.length >= 2) return 'crossover_offspring';
  if (parentIds.length === 1 || generation > 1) return 'mutated_lineage';
  return 'seeded_random';
}

function summarizeOriginStats(rows, totalCount = null) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const counts = {
    seeded_random: 0,
    crossover_offspring: 0,
    mutated_lineage: 0,
  };
  sourceRows.forEach((row) => {
    counts[determineCandidateOrigin(row)] += 1;
  });
  const resolvedTotal = Number.isFinite(totalCount) && totalCount !== null ? totalCount : sourceRows.length;
  return Object.entries(counts)
    .map(([origin, count]) => ({
      origin,
      count,
      percentage: resolvedTotal > 0 ? Number(((count / resolvedTotal) * 100).toFixed(1)) : 0,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

function generateFallbackBriefing(factionStats, activeMembers, generationStats, originStats = []) {
  if (!factionStats || factionStats.length === 0) {
    return "\uc758\ud68c \ubd84\ud30c \ub370\uc774\ud130\ub97c \uc9d1\uacc4 \uc911\uc785\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.";
  }

  const sortedFactions = [...factionStats].sort((a, b) => b.count - a.count);
  const leadingFaction = sortedFactions[0];

  let factionName = '\ubd84\ud30c';
  let opinionText = '\uc2e0\uc911\ud55c \uc2dc\uc7a5 \uad00\ub9dd \uae30\uc870\uac00 \uc720\uc9c0\ub418\uace0 \uc788\uc2b5\ub2c8\ub2e4.';

  if (leadingFaction.faction === 'EXPRESSION_DOMINANT') {
    factionName = '\uc720\uc804\uc790\ubc1c\ud604\ud30c';
    opinionText = '\uc801\uadf9\uc801\uc778 \uc720\uc804\uc790 \ubc1c\ud604 \uc804\ub7b5\uc774 \uc9c0\ubc30\uc801\uc774\uba70, \ud65c\uc131 \uc804\ub7b5 \uc720\uc804\uc790 \ud65c\uc6a9\uc744 \uadf9\ub300\ud654\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.';
  } else if (leadingFaction.faction === 'BLACK_SWAN_SENTINEL') {
    factionName = '\uc704\uae30\uac10\uc2dc\ud30c';
    opinionText = '\uc704\uae30 \ubc29\uc5b4\uc801 \uc131\ud5a5\uc774 \uac15\ud558\uba70, \ube14\ub799\uc2a4\uc640 \uc774\ubca4\ud2b8 \ub300\ube44\ub97c \ucd5c\uc6b0\uc120\uc2dc\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.';
  } else if (leadingFaction.faction === 'DECAY_RESISTANT') {
    factionName = '\uc794\uc874\ub0b4\uc131\ud30c';
    opinionText = '\uc548\uc815\uc131 \uc911\uc2ec\uc758 \uae30\uc870\uac00 \uc9c0\ubc30\uc801\uc774\uba70, \ub192\uc740 \uac10\uc1e0 \ub0b4\uc131\uc744 \ud1b5\ud574 \uc77c\uad00\ub41c \uc131\uacfc\ub97c \uc720\uc9c0\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.';
  } else if (leadingFaction.faction === 'MUTAGEN_ADAPTIVE') {
    factionName = '\ubcc0\uc774\uc801\uc751\ud30c';
    opinionText = '\uc801\uc751\uc801 \ubcc0\uc774 \uc804\ub7b5\uc774 \ud65c\ubc1c\ud558\uba70, \ub192\uc740 \uc7ac\ud65c\uc131\ud654 \ud3b8\ud5a5\uc744 \ud1b5\ud574 \ube60\ub974\uac8c \uc9c4\ud654\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.';
  }

  const chairman = activeMembers[0];
  const chairmanText = chairman
    ? `\uc758\uc7a5 ${chairman.name}(${chairman.generation}\uc138\ub300, ${chairman.faction}\ud30c) \uc8fc\ub3c4 \ud558\uc5d0`
    : '\uc758\ud68c \uc8fc\ub3c4 \ud558\uc5d0';
  const originSummary = Array.isArray(originStats) && originStats.length
    ? `\ud0c4\uc0dd \uacbd\ub85c \uad6c\uc131: ${originStats.map((item) => `${item.origin} ${item.percentage}%`).join(', ')}.`
    : '';

  return `500\uc778 \ud6c4\ubcf4\uad70 \uc911 ${factionName}\uac00 ${leadingFaction.percentage}%\ub85c \ub2e4\uc218\ub97c \ud655\ubcf4\ud588\uc2b5\ub2c8\ub2e4. ${chairmanText} ${opinionText} ${originSummary}`.trim();
}

function resolveGeminiModelId(modelName) {
  if (!modelName) return 'gemini-2.5-flash';
  const lowerName = modelName.toLowerCase();
  if (lowerName.includes('3.5')) return 'gemini-3.5-flash';
  if (lowerName.includes('2.5 pro') || lowerName.includes('pro')) return 'gemini-2.5-pro';
  if (lowerName.includes('2.5 flash')) return 'gemini-2.5-flash';
  if (lowerName.includes('3.1') || lowerName.includes('lite')) return 'gemini-3.1-flash-lite';
  return 'gemini-2.5-flash';
}

module.exports = {
  safeParseJson,
  parseCandidateDna,
  determineCandidateOrigin,
  summarizeOriginStats,
  generateFallbackBriefing,
  resolveGeminiModelId,
};
