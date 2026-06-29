const axios = require('axios');
const { queries } = require('./database');

const GATE_IO_BASE = 'https://api.gateio.ws/api/v4';
const MAX_CANDLES_PER_REQUEST = 1000;
const REQUEST_DELAY_MS = 300;

const SUPPORTED_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '8h', '1d'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function intervalToSeconds(interval) {
  const map = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '8h': 28800, '1d': 86400 };
  return map[interval] || 3600;
}

async function ensureCandleTable(store = queries) {
  await store.run(`
    CREATE TABLE IF NOT EXISTS historical_candles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair TEXT NOT NULL,
      interval TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      UNIQUE(pair, interval, timestamp)
    )
  `);
  await store.run(`
    CREATE INDEX IF NOT EXISTS IDX_CANDLES_PAIR_INTERVAL_TS
    ON historical_candles(pair, interval, timestamp)
  `);
}

async function fetchCandlesFromGateIo(pair, interval, from, to) {
  const params = {
    currency_pair: pair,
    interval,
    from: Math.floor(from),
    to: Math.floor(to),
  };

  const response = await axios.get(`${GATE_IO_BASE}/spot/candlesticks`, {
    params,
    timeout: 10000,
  });

  if (!Array.isArray(response.data)) return [];

  return response.data.map((c) => ({
    timestamp: Number(c[0]),
    volume: Number(c[1]),
    close: Number(c[2]),
    high: Number(c[3]),
    low: Number(c[4]),
    open: Number(c[5]),
  }));
}

async function saveCandlesToDb(store, pair, interval, candles) {
  let saved = 0;
  for (const c of candles) {
    try {
      await store.run(
        `INSERT OR REPLACE INTO historical_candles (pair, interval, timestamp, open, high, low, close, volume)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [pair, interval, c.timestamp, c.open, c.high, c.low, c.close, c.volume]
      );
      saved++;
    } catch (err) {
      console.error('[CANDLES] Failed to save candle:', err.message);
    }
  }
  return saved;
}

async function collectHistoricalCandles({
  pair = 'SUT_USDT',
  interval = '1h',
  days = 475,
  store = queries,
  onProgress = null,
} = {}) {
  if (!SUPPORTED_INTERVALS.includes(interval)) {
    throw new Error(`Unsupported interval: ${interval}. Use: ${SUPPORTED_INTERVALS.join(', ')}`);
  }

  await ensureCandleTable(store);

  const now = Math.floor(Date.now() / 1000);
  const startTime = now - (days * 86400);
  const intervalSec = intervalToSeconds(interval);
  const windowSize = (MAX_CANDLES_PER_REQUEST - 1) * intervalSec;

  let currentFrom = startTime;
  let totalSaved = 0;
  let requestCount = 0;

  while (currentFrom < now) {
    const currentTo = Math.min(currentFrom + windowSize, now);
    requestCount++;

    try {
      const candles = await fetchCandlesFromGateIo(pair, interval, currentFrom, currentTo);

      if (candles.length > 0) {
        const saved = await saveCandlesToDb(store, pair, interval, candles);
        totalSaved += saved;
      }

      if (onProgress) {
        const progress = Math.min(100, Math.round(((currentTo - startTime) / (now - startTime)) * 100));
        onProgress({ progress, totalSaved, requestCount, currentFrom, currentTo });
      }
    } catch (err) {
      console.error(`[CANDLES] Request ${requestCount} failed:`, err.message);
    }

    currentFrom = currentTo;

    if (currentFrom < now) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return { totalSaved, requestCount, pair, interval, days };
}

async function loadCandles({ pair = 'SUT_USDT', interval = '1h', store = queries } = {}) {
  await ensureCandleTable(store);
  return store.all(
    `SELECT timestamp, open, high, low, close, volume
     FROM historical_candles
     WHERE pair = ? AND interval = ?
     ORDER BY timestamp ASC`,
    [pair, interval]
  );
}

async function getCandleStats({ pair = 'SUT_USDT', interval = '1h', store = queries } = {}) {
  await ensureCandleTable(store);
  const row = await store.get(
    `SELECT COUNT(*) as count,
            MIN(timestamp) as earliest,
            MAX(timestamp) as latest
     FROM historical_candles
     WHERE pair = ? AND interval = ?`,
    [pair, interval]
  );
  return {
    count: row?.count || 0,
    earliest: row?.earliest ? new Date(row.earliest * 1000).toISOString() : null,
    latest: row?.latest ? new Date(row.latest * 1000).toISOString() : null,
  };
}

module.exports = {
  ensureCandleTable,
  collectHistoricalCandles,
  loadCandles,
  getCandleStats,
  SUPPORTED_INTERVALS,
};
