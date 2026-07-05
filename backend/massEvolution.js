const { queries } = require('./database');
const { loadCandles, collectHistoricalCandles, getCandleStats } = require('./historicalCandles');
const { safeParseJson } = require('./councilShared');
const { classifyFactionByDna } = require('./factionClassifier');
const { DEFAULT_WEIGHTS, FEATURE_COUNT } = require('./simulationEngine');
const { Worker } = require('worker_threads');
const path = require('path');

const DEFAULT_AIDL_POLICY = {
  contextMutationRate: 0.20,
  stateMutationRate: 0.15,
  profileMutationRate: 0.25,
  copyNumberMutationRate: 0.05,
  weightNudgeRate: 0.60,
  weightNudgeSize: 0.15,
};

async function loadAidlPolicy(store = queries) {
  const policy = { ...DEFAULT_AIDL_POLICY };
  try {
    const rows = await store.all(
      `SELECT key, value FROM platform_settings WHERE key IN (
        'aidl_context_mutation_rate', 'aidl_state_mutation_rate',
        'aidl_profile_mutation_rate', 'aidl_copy_number_mutation_rate',
        'aidl_weight_nudge_size'
      )`
    );
    for (const row of rows) {
      const val = parseFloat(row.value);
      if (!Number.isFinite(val)) continue;
      const clamped = Math.max(0, Math.min(1, val));
      if (row.key === 'aidl_context_mutation_rate') policy.contextMutationRate = clamped;
      if (row.key === 'aidl_state_mutation_rate') policy.stateMutationRate = clamped;
      if (row.key === 'aidl_profile_mutation_rate') policy.profileMutationRate = clamped;
      if (row.key === 'aidl_copy_number_mutation_rate') policy.copyNumberMutationRate = clamped;
      if (row.key === 'aidl_weight_nudge_size') policy.weightNudgeSize = clamped;
    }
  } catch (_) {}
  return policy;
}

const SCALE_PRESETS = {
  small: { generations: 10000, label: 'Small (10K generations)' },
  medium: { generations: 100000, label: 'Medium (100K generations)' },
  large: { generations: 1000000, label: 'Large (1M generations)' },
};

const DEFAULT_CONFIG = {
  scale: 'small',
  pair: 'SUT_USDT',
  interval: '1h',
  trainRatio: 0.7,
  mutationRate: 0.15,
  mutationStrength: 0.5,
  eliteRatio: 0.15,
  cullRatio: 0.20,
  checkpointInterval: 1000,
};

let activeSimulation = null;

function padWeights(weights) {
  const padded = {};
  for (const action of ['BUY', 'SELL', 'HOLD']) {
    const arr = Array.isArray(weights[action]) ? weights[action] : DEFAULT_WEIGHTS();
    if (arr.length >= FEATURE_COUNT) {
      padded[action] = arr.slice(0, FEATURE_COUNT);
    } else {
      padded[action] = [...arr, ...new Array(FEATURE_COUNT - arr.length).fill(0)];
    }
  }
  return padded;
}

async function loadPopulation(store = queries) {
  const rows = await store.all(`
    SELECT member_id, name, faction, generation, dna_json, weights_json, status
    FROM ais_council_members
    ORDER BY member_id
  `);

  return rows.map((row) => {
    const dna = safeParseJson(row.dna_json, {});
    if (!dna.weights && row.weights_json) {
      dna.weights = safeParseJson(row.weights_json, { BUY: DEFAULT_WEIGHTS(), SELL: DEFAULT_WEIGHTS(), HOLD: DEFAULT_WEIGHTS() });
    }
    if (!dna.regulatory_profile) {
      dna.regulatory_profile = { expression_budget: 12, dominance_bias: 1, decay_resistance: 0.3, reactivation_bias: 0.1 };
    }
    if (!dna.strategy_genes) dna.strategy_genes = [];
    if (!dna.mutation_log) dna.mutation_log = [];
    if (!dna.weights) dna.weights = { BUY: DEFAULT_WEIGHTS(), SELL: DEFAULT_WEIGHTS(), HOLD: DEFAULT_WEIGHTS() };
    dna.weights = padWeights(dna.weights);

    return {
      memberId: row.member_id,
      name: row.name,
      faction: row.faction,
      generation: Number(row.generation || 1),
      status: row.status,
      dna,
      fitness: 0,
    };
  });
}

async function savePopulationToDb(population, store = queries) {
  for (const member of population) {
    const dna = member.dna;
    const weightsJson = JSON.stringify(dna.weights || {});
    const reclassifiedFaction = classifyFactionByDna(dna, member.memberId);
    member.faction = reclassifiedFaction;
    dna.faction_hint = reclassifiedFaction;
    const dnaJson = JSON.stringify(dna);

    await store.run(
      `UPDATE ais_council_members
       SET dna_json = ?, weights_json = ?, generation = ?, faction = ?
       WHERE member_id = ?`,
      [dnaJson, weightsJson, dna.generation || 1, reclassifiedFaction, member.memberId]
    );
  }
}

async function runMassEvolution(userConfig = {}, store = queries) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const scalePreset = SCALE_PRESETS[config.scale] || SCALE_PRESETS.small;
  const totalGenerations = config.generations || scalePreset.generations;

  activeSimulation = {
    status: 'COLLECTING_DATA',
    progress: 0,
    generation: 0,
    totalGenerations,
    bestFitness: 0,
    avgFitness: 0,
    startedAt: new Date().toISOString(),
    scale: config.scale,
    clusterStats: {},
    error: null,
  };

  try {
    const candleStats = await getCandleStats({ pair: config.pair, interval: config.interval, store });
    if (candleStats.count < 500) {
      await collectHistoricalCandles({
        pair: config.pair,
        interval: config.interval,
        days: 475,
        store,
        onProgress: (p) => { activeSimulation.progress = Math.round(p.progress * 0.1); },
      });
    }

    const candles = await loadCandles({ pair: config.pair, interval: config.interval, store });
    if (candles.length < 100) {
      throw new Error(`Insufficient candle data: ${candles.length} candles. Need at least 100.`);
    }

    activeSimulation.status = 'LOADING_POPULATION';
    const population = await loadPopulation(store);
    if (population.length === 0) {
      throw new Error('No council members found in database.');
    }

    activeSimulation.status = 'EVOLVING';
    const aidlPolicy = await loadAidlPolicy(store);
    console.log(`[EVOLUTION] Worker thread starting: ${totalGenerations} generations, ${population.length} members, ${candles.length} candles`);
    console.log(`[EVOLUTION] AIDL policy:`, JSON.stringify(aidlPolicy));

    const workerResult = await new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'evolutionWorker.js'), {
        workerData: {
          population,
          candles,
          config: {
            totalGenerations,
            trainRatio: config.trainRatio,
            mutationRate: config.mutationRate,
            mutationStrength: config.mutationStrength,
            eliteRatio: config.eliteRatio,
            cullRatio: config.cullRatio,
            checkpointInterval: config.checkpointInterval,
            aidlPolicy,
          },
        },
      });

      worker.on('message', (msg) => {
        if (msg.type === 'progress') {
          activeSimulation.generation = msg.generation;
          activeSimulation.progress = msg.progress;
          activeSimulation.bestFitness = msg.bestFitness;
          activeSimulation.avgFitness = msg.avgFitness;
          activeSimulation.clusterStats = msg.clusterStats;
          if (msg.validationFitness !== undefined) {
            activeSimulation.validationFitness = msg.validationFitness;
          }
        } else if (msg.type === 'done') {
          resolve(msg.population);
        }
      });

      worker.on('error', (err) => {
        console.error('[EVOLUTION] Worker error:', err.message);
        reject(err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });

      activeSimulation._worker = worker;
    });

    activeSimulation.status = 'SAVING';
    activeSimulation.progress = 95;
    console.log('[EVOLUTION] Saving evolved population to DB...');

    await savePopulationToDb(workerResult, store);

    activeSimulation.status = 'COMPLETED';
    activeSimulation.progress = 100;
    activeSimulation.completedAt = new Date().toISOString();
    delete activeSimulation._worker;

    const finalClusters = {};
    for (const m of workerResult) {
      finalClusters[m.faction] = (finalClusters[m.faction] || 0) + 1;
    }
    activeSimulation.clusterStats = finalClusters;

    console.log('[EVOLUTION] Mass evolution completed:', JSON.stringify(finalClusters));
    return activeSimulation;
  } catch (err) {
    activeSimulation.status = 'ERROR';
    activeSimulation.error = err.message;
    delete activeSimulation._worker;
    console.error('[EVOLUTION] Mass evolution failed:', err.message);
    throw err;
  }
}

function getSimulationStatus() {
  if (!activeSimulation) {
    return { status: 'IDLE', progress: 0 };
  }
  const { _worker, ...safe } = activeSimulation;
  return safe;
}

function cancelSimulation() {
  if (activeSimulation && activeSimulation._worker) {
    activeSimulation._worker.terminate();
    activeSimulation.status = 'CANCELLED';
    delete activeSimulation._worker;
    return true;
  }
  return false;
}

module.exports = {
  runMassEvolution,
  getSimulationStatus,
  cancelSimulation,
  SCALE_PRESETS,
  DEFAULT_CONFIG,
};
