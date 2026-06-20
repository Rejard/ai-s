function safeParseJson(value, fallback) {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    return value || fallback;
  } catch {
    return fallback;
  }
}

function summarizeDnaStates(dnaInput) {
  const dna = safeParseJson(dnaInput, {});
  const summary = { active: 0, inactive: 0, deprecated: 0, lethal: 0 };
  const bump = (state) => {
    if (state === 'A') summary.active += 1;
    else if (state === 'I') summary.inactive += 1;
    else if (state === 'D') summary.deprecated += 1;
    else if (state === 'L') summary.lethal += 1;
  };

  const strategyGenes = dna && Array.isArray(dna.strategy_genes) ? dna.strategy_genes : [];
  for (const strategy of strategyGenes) {
    if (!strategy || typeof strategy !== 'object') continue;
    bump(strategy.state);
    const subgenes = Array.isArray(strategy.subgenes) ? strategy.subgenes : [];
    for (const subgene of subgenes) {
      if (subgene && typeof subgene === 'object') bump(subgene.state);
    }
  }
  return summary;
}

function extractPhenotype(phenotypeInput) {
  const fallback = {
    BUY: [0, 0, 0, 0, 0],
    SELL: [0, 0, 0, 0, 0],
    HOLD: [0, 0, 0, 0, 0],
  };
  const parsed = safeParseJson(phenotypeInput, fallback);
  return Object.fromEntries(
    Object.entries(fallback).map(([action, defaultVector]) => {
      const vector = parsed && Array.isArray(parsed[action]) ? parsed[action] : defaultVector;
      return [
        action,
        vector.length === defaultVector.length ? vector : defaultVector,
      ];
    })
  );
}

module.exports = {
  summarizeDnaStates,
  extractPhenotype,
};
