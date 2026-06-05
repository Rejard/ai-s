const express = require('express');
const router = express.Router();
const axios = require('axios');
const { queries } = require('../database');

// SUT 가격 메모리 캐시 (시뮬레이션용 디폴트 시세)
let cachedPrices = {
  sut: { usd: 1.0, usd_24h_change: 0.0 }
};
let lastPriceFetchTime = 0;
let cachedHistory = [];
let lastHistoryFetchTime = 0;

/**
 * @desc Gate.io API를 통한 SUT(SuperTrust) 진짜 실시간 시세 연동
 */
async function getLivePrices() {
  const now = Date.now();
  // Gate.io API Rate Limit 방지를 위해 10초 캐시 유지 (대시보드 5초 폴링 대비)
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

/**
 * @desc SUT 과거 차트 히스토리 조회 (최대 20개)
 */
async function getSutHistory() {
  const now = Date.now();
  // 히스토리는 1분 간격이므로 30초 정도 캐시
  if (now - lastHistoryFetchTime < 30000 && cachedHistory.length > 0) {
    return cachedHistory;
  }
  try {
    const res = await axios.get(
      'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=SUT_USDT&interval=1m&limit=20',
      { timeout: 3000 }
    );
    if (res.data) {
      // res.data: [timestamp, volume, close, high, low, open, ...]
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

/**
 * @desc 실시간 USD/KRW 환율 조회 (1시간 캐시)
 */
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

/**
 * @route GET /api/investment/prices
 * @desc 실시간 코인 시세 정보 반환
 */
router.get('/prices', async (req, res) => {
  try {
    const prices = await getLivePrices();
    res.json({ success: true, prices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/investment/portfolio/:walletAddress
 * @desc 사용자의 가상 투자금 포트폴리오 및 수익률 연동 조회
 */
router.get('/portfolio/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase().trim();

  try {
    const user = await queries.get("SELECT selected_coins, status FROM users WHERE LOWER(wallet_address) = ?", [walletAddress]);
    if (!user) {
      return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
    }

    // 단일 SUT 풀
    const ratios = { SUT: 100 };

    // 1. 사용자의 순수 투자 원금(SUT) 계산
    const deposits = await queries.get(`
      SELECT SUM(amount) as total FROM payments 
      WHERE LOWER(wallet_address) = ? AND type = 'MONTHLY_SUBSCRIPTION' AND status = 'SUCCESS'
    `, [walletAddress]);
    
    const addedDeposits = deposits.total || 0;
    const totalInvested = addedDeposits; // SUT 기준

    // 🌟 AI 트레이딩 수익 (SUT 수량 자체 증가분)
    const aiProfits = await queries.get(`
      SELECT SUM(amount) as total FROM payments 
      WHERE LOWER(wallet_address) = ? AND type = 'AI_TRADING_PROFIT' AND status = 'SUCCESS'
    `, [walletAddress]);
    const aiTradingProfitSut = aiProfits.total || 0;

    // 2. 총 보유 SUT 및 가치 평가
    const sutQuantity = totalInvested + aiTradingProfitSut;

    const prices = await getLivePrices();
    const sutPrice = prices.sut.usd;

    // 실시간 시세를 적용한 현재 평가가치 (달러)
    const totalValuation = sutQuantity * sutPrice;

    // 원금의 달러 가치 (단가 0.20$ 기준)
    const baseSutPrice = 0.20;
    const originalUsdValue = totalInvested * baseSutPrice;

    const totalProfitUsd = totalValuation - originalUsdValue;
    const profitPercent = originalUsdValue > 0 ? (totalProfitUsd / originalUsdValue) * 100 : 0;

    // 차트 초기값을 위한 히스토리 배열 로드
    const sutHistory = await getSutHistory();

    // 실시간 환율
    const krwRate = await getKrwRate();

    res.json({
      success: true,
      portfolio: {
        totalInvested,          // 투자 원금 (SUT)
        aiTradingProfitSut,     // AI 매매 수익 (SUT)
        sutQuantity,            // 총 보유량 (SUT)
        totalValuation,         // 현재 평가금 ($)
        totalProfitUsd,         // 평가 손익 ($)
        profitPercent,          // 수익률 (%)
        ratios,                 // 설정 비율
        sutHistory,             // 실시간 SUT 최근 가격 히스토리 (20개)
        krwRate,                // 실시간 달러/원 환율
        sutChange24h: prices.sut.usd_24h_change, // 🌟 24시간 변동률 추가
        assets: {
          SUT: {
            ratio: 100,
            invested: totalInvested,
            quantity: sutQuantity,
            currentValue: totalValuation,
            price: sutPrice,
            change24h: prices.sut.usd_24h_change // 🌟 자산별 노드에도 추가
          }
        }
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/investment/update-ratio
 * @desc 투자 비율 변경 및 손실 책임 면책 약관 업데이트
 */
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
 * @desc 추가 자금 예치 (Deposit) 모의 거래 등록
 */
router.post('/deposit', async (req, res) => {
  const { walletAddress, amount, txHash } = req.body;
  if (!walletAddress || !amount) {
    return res.status(400).json({ success: false, message: '필수 매개변수가 누락되었습니다.' });
  }
  const cleanWallet = walletAddress.toLowerCase().trim();

  try {
    // 결제 성공 이력 인서트 (MONTHLY_SUBSCRIPTION의 누적값으로 투자풀 증가)
    await queries.run(`
      INSERT INTO payments (wallet_address, amount, type, status, tx_hash)
      VALUES (?, ?, 'MONTHLY_SUBSCRIPTION', 'SUCCESS', ?)
    `, [cleanWallet, amount, txHash || '0xSimulatedDepositTx']);

    res.json({ success: true, message: `가상 투자 풀에 ${amount} USDT가 추가 입금되었습니다.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/investment/withdraw
 * @desc 자금 출금 (Withdrawal) 거래 실행
 */
router.post('/withdraw', async (req, res) => {
  const { walletAddress, amount } = req.body;
  if (!walletAddress || !amount) {
    return res.status(400).json({ success: false, message: '필수 매개변수가 누락되었습니다.' });
  }
  const cleanWallet = walletAddress.toLowerCase().trim();

  try {
    // 출금은 즉시 잔고 삭감이 아니라 관리자 승인 대기 상태(PENDING_REQUEST)로 들어감
    await queries.run(`
      INSERT INTO payments (wallet_address, amount, type, status, tx_hash)
      VALUES (?, ?, 'WITHDRAW_REQUEST', 'PENDING', '0xPendingManualPayout')
    `, [cleanWallet, amount]);
    res.json({ success: true, message: `📤 ${amount} SUT 출금 신청이 접수되었습니다. 매니저 심사 후 지갑으로 자동 송금됩니다.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/investment/history/:walletAddress
 * @desc 회원의 과거 예치 및 인출 거래 내역 조회
 */
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
