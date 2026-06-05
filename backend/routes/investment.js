const express = require('express');
const router = express.Router();
const axios = require('axios');
const { queries } = require('../database');

// SUT price memory cache (default market price for simulation)
let cachedPrices = {
  sut: { usd: 1.0, usd_24h_change: 0.0 }
};
let lastPriceFetchTime = 0;
let cachedHistory = [];
let lastHistoryFetchTime = 0;

async function getLivePrices() {
  const now = Date.now();
  // Maintain 10-second cache to prevent Gate.io API Rate Limit (compared to dashboard 5-second polling)
  if (now - lastPriceFetchTime < 10000) {
    return cachedPrices;
  }

  try {
    const response = await axios.get(
      'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SUT_USDT',
      { timeout: 3000 }
    );
    if (response.data && response.data.length > 0) {
      const ticker = response.data[0];
      cachedPrices.sut.usd = parseFloat(ticker.last);
      cachedPrices.sut.usd_24h_change = parseFloat(ticker.change_percentage);
      lastPriceFetchTime = now;
    }
  } catch (err) {
    console.error("Gate.io 진짜 SUT 시세 불러오기 실패 (캐시된 이전 시세 사용):", err.message);
  }

  return cachedPrices;
}

async function getSutHistory() {
  const now = Date.now();

  if (now - lastHistoryFetchTime < 30000 && cachedHistory.length > 0) {
    return cachedHistory;
  }
  try {
    const res = await axios.get(
      'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=SUT_USDT&interval=1m&limit=20',
      { timeout: 3000 }
    );
    if (res.data) {

      cachedHistory = res.data.map(k => parseFloat(k[2]));
      lastHistoryFetchTime = now;
    }
  } catch (err) {
    console.error("Gate.io SUT 차트 히스토리 불러오기 실패:", err.message);
  }
  return cachedHistory;
}

let cachedKrwRate = 1400;
let lastKrwFetchTime = 0;

async function getKrwRate() {
  const now = Date.now();
  if (now - lastKrwFetchTime < 3600000 && lastKrwFetchTime !== 0) {
    return cachedKrwRate;
  }
  try {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 3000 });
    if (res.data && res.data.rates && res.data.rates.KRW) {
      cachedKrwRate = res.data.rates.KRW;
      lastKrwFetchTime = now;
    }
  } catch (err) {
    console.error("실시간 환율 불러오기 실패 (캐시된 환율 사용):", err.message);
  }
  return cachedKrwRate;
}

router.get('/prices', async (req, res) => {
  try {
    const prices = await getLivePrices();
    res.json({ success: true, prices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/portfolio/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase().trim();

  try {
    const user = await queries.get("SELECT selected_coins, status FROM users WHERE LOWER(wallet_address) = ?", [walletAddress]);
    if (!user) {
      return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
    }

    const ratios = { SUT: 100 };

    const deposits = await queries.get(`
      SELECT SUM(amount) as total FROM payments
      WHERE LOWER(wallet_address) = ? AND type = 'MONTHLY_SUBSCRIPTION' AND status = 'SUCCESS'
    `, [walletAddress]);

    const addedDeposits = deposits.total || 0;
    const totalInvested = addedDeposits;

    const aiProfits = await queries.get(`
      SELECT SUM(amount) as total FROM payments
      WHERE LOWER(wallet_address) = ? AND type = 'AI_TRADING_PROFIT' AND status = 'SUCCESS'
    `, [walletAddress]);
    const aiTradingProfitSut = aiProfits.total || 0;

    const sutQuantity = totalInvested + aiTradingProfitSut;

    const prices = await getLivePrices();
    const sutPrice = prices.sut.usd;

    const totalValuation = sutQuantity * sutPrice;

    const baseSutPrice = 0.20;
    const originalUsdValue = totalInvested * baseSutPrice;

    const totalProfitUsd = totalValuation - originalUsdValue;
    const profitPercent = originalUsdValue > 0 ? (totalProfitUsd / originalUsdValue) * 100 : 0;

    const sutHistory = await getSutHistory();

    const krwRate = await getKrwRate();

    res.json({
      success: true,
      portfolio: {
        totalInvested,
        aiTradingProfitSut,
        sutQuantity,
        totalValuation,
        totalProfitUsd,
        profitPercent,
        ratios,
        sutHistory,
        krwRate,
        sutChange24h: prices.sut.usd_24h_change,
        assets: {
          SUT: {
            ratio: 100,
            invested: totalInvested,
            quantity: sutQuantity,
            currentValue: totalValuation,
            price: sutPrice,
            change24h: prices.sut.usd_24h_change
          }
        }
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/update-ratio', async (req, res) => {
  const { walletAddress, ratioPol, ratioUsdt, confirmed } = req.body;

  if (!walletAddress || ratioPol === undefined || ratioUsdt === undefined) {
    return res.status(400).json({ success: false, message: '지갑 주소 및 비율이 누락되었습니다.' });
  }

  if (ratioPol + ratioUsdt !== 100) {
    return res.status(400).json({ success: false, message: '투자 비중의 합은 반드시 100%여야 합니다.' });
  }

  if (!confirmed) {
    return res.status(400).json({ success: false, message: '투자 책임 면책 조항에 동의하셔야 비율 설정이 완료됩니다.' });
  }

  const cleanWallet = walletAddress.toLowerCase().trim();
  const selectedCoins = JSON.stringify({ POL: ratioPol, USDT: ratioUsdt });

  try {
    const user = await queries.get("SELECT id FROM users WHERE wallet_address = ?", [cleanWallet]);
    if (!user) {
      return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
    }

    await queries.run("UPDATE users SET selected_coins = ? WHERE wallet_address = ?", [selectedCoins, cleanWallet]);
    res.json({ success: true, message: '투자 비중이 성공적으로 저장되었으며, 실시간 자동 시스템 매매가 갱신되었습니다.' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/investment/deposit
 * @desc Register additional fund Deposit mock transaction
 */
router.post('/deposit', async (req, res) => {
  const { walletAddress, amount, txHash } = req.body;
  if (!walletAddress || !amount) {
    return res.status(400).json({ success: false, message: '필수 매개변수가 누락되었습니다.' });
  }
  const cleanWallet = walletAddress.toLowerCase().trim();

  try {

    await queries.run(`
      INSERT INTO payments (wallet_address, amount, type, status, tx_hash)
      VALUES (?, ?, 'MONTHLY_SUBSCRIPTION', 'SUCCESS', ?)
    `, [cleanWallet, amount, txHash || '0xSimulatedDepositTx']);

    res.json({ success: true, message: `가상 투자 풀에 ${amount} USDT가 추가 입금되었습니다.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/withdraw', async (req, res) => {
  const { walletAddress, amount } = req.body;
  if (!walletAddress || !amount) {
    return res.status(400).json({ success: false, message: '필수 매개변수가 누락되었습니다.' });
  }
  const cleanWallet = walletAddress.toLowerCase().trim();

  try {

    await queries.run(`
      INSERT INTO payments (wallet_address, amount, type, status, tx_hash)
      VALUES (?, ?, 'WITHDRAW_REQUEST', 'PENDING', '0xPendingManualPayout')
    `, [cleanWallet, amount]);
    res.json({ success: true, message: `📤 ${amount} SUT 출금 신청이 접수되었습니다. 매니저 심사 후 지갑으로 자동 송금됩니다.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/history/:walletAddress', async (req, res) => {
  const cleanWallet = req.params.walletAddress.toLowerCase().trim();
  try {
    const history = await queries.all(
      `SELECT id, amount, type, status, created_at as createdAt
       FROM payments
       WHERE wallet_address = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [cleanWallet]
    );
    res.json({ success: true, history });
  } catch (err) {
    console.error("히스토리 조회 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
