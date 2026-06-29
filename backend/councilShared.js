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
    return "AI council faction data is being aggregated. Please try again shortly.";
  }

  const sortedFactions = [...factionStats].sort((a, b) => b.count - a.count);
  const leadingFaction = sortedFactions[0];

  let factionName = 'faction';
  let opinionText = 'cautious market-watching stance is maintained.';

  if (leadingFaction.faction === 'EXPRESSION_DOMINANT') {
    factionName = 'Expression Dominant (Gene Activation)';
    opinionText = 'aggressive gene expression strategy dominates, maximizing active strategy gene utilization.';
  } else if (leadingFaction.faction === 'BLACK_SWAN_SENTINEL') {
    factionName = 'Black Swan Sentinel (Crisis Watch)';
    opinionText = 'crisis-defensive sentiment is strong, prioritizing black swan event preparedness.';
  } else if (leadingFaction.faction === 'DECAY_RESISTANT') {
    factionName = 'Decay Resistant (Persistence)';
    opinionText = 'stability-focused sentiment prevails, maintaining high decay resistance for consistent performance.';
  } else if (leadingFaction.faction === 'MUTAGEN_ADAPTIVE') {
    factionName = 'Mutagen Adaptive (Evolution)';
    opinionText = 'adaptive mutation strategy is active, evolving rapidly through high reactivation bias.';
  }

  const chairman = activeMembers[0];
  const chairmanText = chairman
    ? `led by chairman ${chairman.name}(gen ${chairman.generation}, ${chairman.faction})`
    : 'led by the council';
  const originSummary = Array.isArray(originStats) && originStats.length
    ? `Origin composition: ${originStats.map((item) => `${item.origin} ${item.percentage}%`).join(', ')}.`
    : '';

  return `Among 500 candidates, ${factionName} holds ${leadingFaction.percentage}% securing majority. ${chairmanText} ${opinionText} ${originSummary}`.trim();
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
