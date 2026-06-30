const { loadCandles } = require('./historicalCandles');
const { precomputeIndicators, calculateIndicators, splitTimeSeries, FEATURE_COUNT, DEFAULT_WEIGHTS } = require('./simulationEngine');
const { queries } = require('./database');
const { safeParseJson } = require('./councilShared');

const INDICATOR_NAMES = [
  'priceChange', 'RSI', 'sma20Deviation', 'volumeRatio', 'volatility',
  'macdHistogram', 'bollingerPctB', 'atrRatio', 'emaCrossover', 'obvChange'
];

async function deepVerify() {
  console.log('=== DEEP INDICATOR VERIFICATION ===\n');
  console.log(`[1] FEATURE_COUNT = ${FEATURE_COUNT}`);
  console.log(`[1] DEFAULT_WEIGHTS() length = ${DEFAULT_WEIGHTS().length}`);
  console.log(`[1] Indicator names: ${INDICATOR_NAMES.length}\n`);

  const candles = await loadCandles({ pair: 'SUT_USDT', interval: '1h' });
  console.log(`[2] Loaded ${candles.length} candles\n`);

  const [trainCandles] = splitTimeSeries(candles, 0.7);
  const indicators = precomputeIndicators(trainCandles);

  const validIndicators = indicators.filter(v => v !== null);
  console.log(`[3] precomputeIndicators: ${validIndicators.length} valid out of ${indicators.length}\n`);

  console.log('--- Per-indicator statistics (precomputed) ---');
  const stats = INDICATOR_NAMES.map(() => ({ min: Infinity, max: -Infinity, sum: 0, nonZero: 0, count: 0 }));

  for (const vec of validIndicators) {
    for (let i = 0; i < FEATURE_COUNT; i++) {
      const v = vec[i];
      stats[i].min = Math.min(stats[i].min, v);
      stats[i].max = Math.max(stats[i].max, v);
      stats[i].sum += v;
      stats[i].count++;
      if (Math.abs(v) > 1e-9) stats[i].nonZero++;
    }
  }

  let allActive = true;
  for (let i = 0; i < FEATURE_COUNT; i++) {
    const s = stats[i];
    const avg = s.sum / s.count;
    const pctNonZero = ((s.nonZero / s.count) * 100).toFixed(1);
    const status = s.nonZero > 0 ? '✅' : '❌ DEAD';
    if (s.nonZero === 0) allActive = false;
    console.log(`  [${i}] ${INDICATOR_NAMES[i].padEnd(18)} min=${s.min.toFixed(4)} max=${s.max.toFixed(4)} avg=${avg.toFixed(4)} nonZero=${pctNonZero}% ${status}`);
  }
  console.log('');

  console.log('--- Sample vectors (first 3 valid) ---');
  let shown = 0;
  for (let i = 0; i < indicators.length && shown < 3; i++) {
    if (indicators[i]) {
      console.log(`  candle[${i}]: [${indicators[i].map(v => v.toFixed(4)).join(', ')}]`);
      shown++;
    }
  }
  console.log('');

  console.log('--- calculateIndicators (real-time single candle) ---');
  const midIdx = Math.floor(trainCandles.length * 0.7);
  const realtimeSlice = trainCandles.slice(0, midIdx + 1);
  const rtResult = calculateIndicators(realtimeSlice, midIdx);
  if (rtResult) {
    console.log(`  Length: ${rtResult.length}`);
    for (let i = 0; i < rtResult.length; i++) {
      const status = Math.abs(rtResult[i]) > 1e-9 ? '✅' : '⚠️ zero';
      console.log(`  [${i}] ${INDICATOR_NAMES[i].padEnd(18)} = ${rtResult[i].toFixed(6)} ${status}`);
    }
  } else {
    console.log('  ❌ calculateIndicators returned null');
  }
  console.log('');

  console.log('--- Evolved weights analysis (DB members) ---');
  const rows = await queries.all(`
    SELECT member_id, weights_json FROM ais_council_members ORDER BY member_id LIMIT 20
  `);

  const weightStats = INDICATOR_NAMES.map(() => ({ min: Infinity, max: -Infinity, sum: 0, count: 0, allZero: true }));

  for (const row of rows) {
    const w = safeParseJson(row.weights_json, null);
    if (!w) continue;
    for (const action of ['BUY', 'SELL', 'HOLD']) {
      if (!Array.isArray(w[action])) continue;
      for (let i = 0; i < Math.min(w[action].length, FEATURE_COUNT); i++) {
        const v = w[action][i];
        weightStats[i].min = Math.min(weightStats[i].min, v);
        weightStats[i].max = Math.max(weightStats[i].max, v);
        weightStats[i].sum += v;
        weightStats[i].count++;
        if (Math.abs(v) > 1e-9) weightStats[i].allZero = false;
      }
    }
  }

  let newIndicatorsUsed = true;
  for (let i = 0; i < FEATURE_COUNT; i++) {
    const s = weightStats[i];
    const avg = (s.sum / s.count).toFixed(4);
    const range = (s.max - s.min).toFixed(4);
    const evolved = s.allZero ? '❌ NOT EVOLVED (all zero)' : '✅ evolved';
    if (i >= 5 && s.allZero) newIndicatorsUsed = false;
    console.log(`  [${i}] ${INDICATOR_NAMES[i].padEnd(18)} range=${range} avg=${avg} ${evolved}`);
  }
  console.log('');

  const totalMembers = await queries.get('SELECT COUNT(*) as cnt FROM ais_council_members');
  const sample10 = await queries.all('SELECT weights_json FROM ais_council_members ORDER BY RANDOM() LIMIT 10');
  let wrongLength = 0;
  for (const r of sample10) {
    const w = safeParseJson(r.weights_json, null);
    if (w) {
      for (const action of ['BUY', 'SELL', 'HOLD']) {
        if (w[action]?.length !== FEATURE_COUNT) wrongLength++;
      }
    }
  }
  console.log(`[4] Total members: ${totalMembers.cnt}, sampled 10, wrong-length vectors: ${wrongLength}\n`);

  console.log('=== VERDICT ===');
  if (allActive && newIndicatorsUsed && wrongLength === 0) {
    console.log('✅ ALL 10 INDICATORS ARE ACTIVE AND EVOLVED');
  } else {
    if (!allActive) console.log('❌ Some indicators produce zero values');
    if (!newIndicatorsUsed) console.log('❌ New indicators (idx 5-9) have not been evolved');
    if (wrongLength > 0) console.log('❌ Some weight vectors have wrong length');
  }

  process.exit(0);
}

deepVerify().catch((err) => {
  console.error('[VERIFY] Fatal:', err);
  process.exit(1);
});
