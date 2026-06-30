const FACTIONS = [
  'BLACK_SWAN_SENTINEL',
  'EXPRESSION_DOMINANT',
  'DECAY_RESISTANT',
  'MUTAGEN_ADAPTIVE',
];

const NON_BSW_FACTIONS = ['EXPRESSION_DOMINANT', 'DECAY_RESISTANT', 'MUTAGEN_ADAPTIVE'];

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function classifyFactionByDna(dna, memberId) {
  const reg = dna.regulatory_profile || {};
  const genes = Array.isArray(dna.strategy_genes) ? dna.strategy_genes : [];
  const mutationLog = Array.isArray(dna.mutation_log) ? dna.mutation_log : [];

  const blackSwanCount = genes.filter((g) =>
    g && g.state === 'A' && Array.isArray(g.context_mask) && g.context_mask.includes('BLACK_SWAN')
  ).length;

  if (blackSwanCount >= 1) return 'BLACK_SWAN_SENTINEL';

  const expressionBudget = Number(reg.expression_budget || 12);
  const dominanceBias = Number(reg.dominance_bias || 1);
  const decayResistance = Number(reg.decay_resistance || 0.3);
  const reactivationBias = Number(reg.reactivation_bias || 0.1);

  const eb = expressionBudget / 20;
  const db = Math.min(dominanceBias, 2) / 2;
  const dr = Math.min(decayResistance, 1);
  const rb = Math.min(reactivationBias, 1);
  const ml = Math.min(mutationLog.length, 10) / 10;
  const ac = genes.length > 0
    ? genes.filter((g) => g && g.state === 'A').length / genes.length
    : 0;

  const scores = [
    eb * 0.4 + db * 0.3 + ac * 0.3,
    dr * 0.5 + (1 - rb) * 0.3 + (1 - ml) * 0.2,
    ml * 0.4 + rb * 0.3 + (1 - dr) * 0.3,
  ];

  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const spread = max > 0 ? (max - min) / max : 0;

  if (spread > 0.7) {
    const sortedIdx = [0, 1, 2].sort((a, b) => scores[b] - scores[a]);
    return NON_BSW_FACTIONS[sortedIdx[0]];
  }

  const idSeed = memberId || dna.genome_id || '';
  const hash = hashString(idSeed);
  return NON_BSW_FACTIONS[hash % NON_BSW_FACTIONS.length];
}

module.exports = { classifyFactionByDna, FACTIONS };
