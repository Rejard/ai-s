const { parentPort, workerData } = require('worker_threads');
const { simulateTrades, splitTimeSeries, precomputeIndicators, FEATURE_COUNT, DEFAULT_WEIGHTS } = require('./simulationEngine');
const crypto = require('crypto');

function generateUUID() {
  return crypto.randomUUID();
}

function crossoverWeights(parentA, parentB) {
  const child = {};
  for (const action of ['BUY', 'SELL', 'HOLD']) {
    const a = parentA[action] || DEFAULT_WEIGHTS();
    const b = parentB[action] || DEFAULT_WEIGHTS();
    const crossPoint = Math.floor(Math.random() * a.length);
    child[action] = a.map((v, i) => i < crossPoint ? v : (b[i] || 0));
  }
  return child;
}

function crossoverProfile(profA, profB) {
  return {
    expression_budget: Math.round((Number(profA.expression_budget || 12) + Number(profB.expression_budget || 12)) / 2),
    dominance_bias: (Number(profA.dominance_bias || 1) + Number(profB.dominance_bias || 1)) / 2,
    decay_resistance: (Number(profA.decay_resistance || 0.3) + Number(profB.decay_resistance || 0.3)) / 2,
    reactivation_bias: (Number(profA.reactivation_bias || 0.1) + Number(profB.reactivation_bias || 0.1)) / 2,
  };
}

function mutateDna(dna, strength) {
  const mutated = JSON.parse(JSON.stringify(dna));

  if (Math.random() < 0.6) {
    for (const action of ['BUY', 'SELL', 'HOLD']) {
      if (!mutated.weights[action]) mutated.weights[action] = DEFAULT_WEIGHTS();
      const idx = Math.floor(Math.random() * FEATURE_COUNT);
      mutated.weights[action][idx] += (Math.random() * 2 - 1) * strength;
    }
    mutated.mutation_log.push({ event: 'weight_nudge', strength });
  }

  if (Math.random() < 0.3) {
    const profile = mutated.regulatory_profile;
    const keys = ['expression_budget', 'dominance_bias', 'decay_resistance', 'reactivation_bias'];
    const key = keys[Math.floor(Math.random() * keys.length)];
    if (key === 'expression_budget') {
      profile[key] = Math.max(1, Math.min(20, profile[key] + Math.round((Math.random() * 2 - 1) * strength * 4)));
    } else {
      profile[key] = Math.max(0, Math.min(2, profile[key] + (Math.random() * 2 - 1) * strength));
    }
    mutated.mutation_log.push({ event: 'profile_mutation', profile_key: key });
  }

  if (Math.random() < 0.2) {
    const genes = mutated.strategy_genes || [];
    if (genes.length > 0) {
      const gene = genes[Math.floor(Math.random() * genes.length)];
      const contexts = ['BLACK_SWAN', 'BULL_EXPANSION', 'BEAR_SQUEEZE', 'SIDEWAYS_DRIFT', 'LOW_VOLUME'];
      const ctx = contexts[Math.floor(Math.random() * contexts.length)];
      const mask = Array.isArray(gene.context_mask) ? gene.context_mask : [];
      if (mask.includes(ctx)) {
        gene.context_mask = mask.filter((m) => m !== ctx);
      } else {
        gene.context_mask = [...mask, ctx];
      }
    }
  }

  if (Math.random() < 0.15) {
    const genes = mutated.strategy_genes || [];
    if (genes.length > 0) {
      const gene = genes[Math.floor(Math.random() * genes.length)];
      gene.state = ['A', 'I'][Math.floor(Math.random() * 2)];
    }
  }

  mutated.generation = (mutated.generation || 1) + 1;
  mutated.genome_id = `AISG-G${mutated.generation}-${generateUUID().slice(0, 8)}`;
  return mutated;
}

function classifyFactionByDna(dna) {
  const reg = dna.regulatory_profile || {};
  const genes = Array.isArray(dna.strategy_genes) ? dna.strategy_genes : [];
  const mutationLog = Array.isArray(dna.mutation_log) ? dna.mutation_log : [];

  const blackSwanCount = genes.filter((g) =>
    g && g.state === 'A' && Array.isArray(g.context_mask) && g.context_mask.includes('BLACK_SWAN')
  ).length;

  const activeCount = genes.filter((g) => g && g.state === 'A').length;
  const expressionBudget = Number(reg.expression_budget || 12);
  const decayResistance = Number(reg.decay_resistance || 0.3);
  const reactivationBias = Number(reg.reactivation_bias || 0.1);

  if (blackSwanCount >= 2 || (blackSwanCount >= 1 && genes.length <= 2)) return 'BLACK_SWAN_SENTINEL';
  if (expressionBudget >= 14 && activeCount >= genes.length * 0.8) return 'EXPRESSION_DOMINANT';
  if (decayResistance >= 0.5 && reactivationBias < 0.15) return 'DECAY_RESISTANT';
  if (mutationLog.length >= 5 && reactivationBias >= 0.2) return 'MUTAGEN_ADAPTIVE';

  if (expressionBudget >= 13) return 'EXPRESSION_DOMINANT';
  if (decayResistance >= 0.4) return 'DECAY_RESISTANT';
  if (mutationLog.length >= 3) return 'MUTAGEN_ADAPTIVE';

  return 'EXPRESSION_DOMINANT';
}

const { population, candles, config } = workerData;

const trainRatio = config.trainRatio || 0.7;
const totalGenerations = config.totalGenerations;
const mutationRate = config.mutationRate || 0.15;
const mutationStrength = config.mutationStrength || 0.5;
const eliteRatio = config.eliteRatio || 0.15;
const cullRatio = config.cullRatio || 0.20;
const checkpointInterval = config.checkpointInterval || 1000;

const [trainCandles, testCandles] = splitTimeSeries(candles, trainRatio);
const trainIndicators = precomputeIndicators(trainCandles);
const testIndicators = precomputeIndicators(testCandles);

for (let gen = 1; gen <= totalGenerations; gen++) {
  for (const member of population) {
    const result = simulateTrades(member.dna, trainCandles, { _precomputedIndicators: trainIndicators });
    member.fitness = result.fitness;
  }

  population.sort((a, b) => b.fitness - a.fitness);

  const eliteCount = Math.floor(population.length * eliteRatio);
  const cullCount = Math.floor(population.length * cullRatio);
  const elite = population.slice(0, eliteCount);

  for (let c = 0; c < cullCount; c++) {
    const cullIdx = population.length - 1 - c;
    if (cullIdx <= eliteCount) break;

    const parentA = elite[Math.floor(Math.random() * elite.length)];
    const parentB = elite[Math.floor(Math.random() * elite.length)];

    let childDna = {
      ...JSON.parse(JSON.stringify(parentA.dna)),
      weights: crossoverWeights(parentA.dna.weights, parentB.dna.weights),
      regulatory_profile: crossoverProfile(
        parentA.dna.regulatory_profile || {},
        parentB.dna.regulatory_profile || {}
      ),
      lineage: { parent_ids: [parentA.memberId, parentB.memberId] },
      mutation_log: [],
    };

    if (Math.random() < mutationRate) {
      childDna = mutateDna(childDna, mutationStrength);
    }

    population[cullIdx].dna = childDna;
    population[cullIdx].fitness = 0;
    population[cullIdx].faction = classifyFactionByDna(childDna);
  }

  if (gen % checkpointInterval === 0 || gen === totalGenerations) {
    const fitnesses = population.map((m) => m.fitness);
    const bestFitness = Math.max(...fitnesses);
    const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;

    const clusters = {};
    for (const m of population) {
      clusters[m.faction] = (clusters[m.faction] || 0) + 1;
    }

    let validationFitness = undefined;
    if (gen % (checkpointInterval * 10) === 0 || gen === totalGenerations) {
      const topResult = simulateTrades(population[0].dna, testCandles, { _precomputedIndicators: testIndicators });
      validationFitness = topResult.fitness;
    }

    parentPort.postMessage({
      type: 'progress',
      generation: gen,
      totalGenerations,
      bestFitness,
      avgFitness,
      validationFitness,
      clusterStats: clusters,
      progress: 10 + Math.round((gen / totalGenerations) * 85),
    });
  }
}

for (const member of population) {
  member.faction = classifyFactionByDna(member.dna);
}

parentPort.postMessage({
  type: 'done',
  population: population.map((m) => ({
    memberId: m.memberId,
    name: m.name,
    faction: m.faction,
    dna: m.dna,
  })),
});
