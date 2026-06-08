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
      WHERE LOWER(wallet_address) = ? AND type = 'DEPOSIT' AND status = 'SUCCESS'
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
      VALUES (?, ?, 'DEPOSIT', 'SUCCESS', ?)
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
    const existingRequest = await queries.get(
      "SELECT id FROM payments WHERE LOWER(wallet_address) = LOWER(?) AND type = 'WITHDRAW_REQUEST' AND status = 'PENDING'",
      [cleanWallet]
    );
    if (existingRequest) {
      return res.status(400).json({ success: false, message: '이미 대기 중인 지급 요청이 존재합니다. 이전 요청이 처리된 후 다시 신청해 주십시오.' });
    }

    await queries.run(`
      INSERT INTO payments (wallet_address, amount, type, status, tx_hash)
      VALUES (?, ?, 'WITHDRAW_REQUEST', 'PENDING', '0xPendingManualPayout')
    `, [cleanWallet, amount]);
    res.json({ success: true, message: `📤 ${amount} SUT 지급 요청이 접수되었습니다. 매니저 심사 후 처리됩니다.` });
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

let cachedBriefing = null;
let lastBriefingUpdate = 0;
const BRIEFING_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours cache (aligns with daily evolutionary cycle)

async function generateCouncilOpinionBriefing(factionStats, activeMembers) {
  try {
    const apiKeyRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_gemini_api_key'");
    const modelRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_model'");
    
    if (!apiKeyRow || !apiKeyRow.value) {
      return generateFallbackBriefing(factionStats, activeMembers);
    }
    
    const apiKey = apiKeyRow.value;
    const modelName = modelRow ? modelRow.value : 'Gemini 3.5 Flash';
    
    let modelId = 'gemini-2.5-flash';
    const lowerName = modelName.toLowerCase();
    if (lowerName.includes('3.5')) {
      modelId = 'gemini-3.5-flash';
    } else if (lowerName.includes('2.5 pro') || lowerName.includes('pro')) {
      modelId = 'gemini-2.5-pro';
    } else if (lowerName.includes('2.5 flash')) {
      modelId = 'gemini-2.5-flash';
    } else if (lowerName.includes('3.1') || lowerName.includes('lite')) {
      modelId = 'gemini-3.1-flash-lite';
    }

    const leadersInfo = activeMembers.slice(0, 3).map((m, idx) => {
      const title = idx === 0 ? '의장' : idx === 1 ? '부의장' : '상임위원장';
      return `${title}: ${m.name} (${m.generation}세대, ${m.faction} 분파, 정확도 ${m.correct_count}%)`;
    }).join(', ');

    const factionInfo = factionStats.map(f => `${f.faction}: ${f.count}석 (${f.percentage}%)`).join(', ');

    const promptText = `
You are an expert system analyst observing the "AiS Virtual Council" (an AI assembly of 500 neural net trading bots evolving via genetic algorithms).
Based on the current faction distribution and top leaders of the 500-member AI Council, write a lively briefing (2-3 sentences in Korean) describing the genetic/philosophical characteristics, general sentiment, and historical evolvement of this current generation of AiS candidates.

Input data:
- Faction Counts (500 candidates): ${factionInfo}
- Top 3 Leaders in Office (Chairman, Vice Chairman, Committee Chair): ${leadersInfo}

Rules:
1. Speak of them as distinct virtual factions with conflicting trading philosophies:
   - TREND_FOLLOWER: 추세추종파 (SMA/모멘텀)
   - VALUE_SEEKER: 기술반등파 (RSI/역추세)
   - CONSERVATIVE_WATCHER: 변동성방어파 (안정지향)
   - MUTANT_ROOKIE: 돌연변이 혁신파 (진화/알고리즘)
2. Explain what the current dominant faction and leaders' profiles tell us about the council's overall behavior for this generation (e.g., "이번 세대는 안정지향적인 변동성방어파가 의장단을 포함해 과반을 장악하여, 유전적으로 매우 조심스러운 거래를 지향하는 구조로 진화했습니다. 반면...").
3. Do NOT talk about real-time market trends or recent trades. Focus purely on their genetic character, dominant factions, and historical evolution traits.
4. Be concise (2-3 sentences max). Return ONLY the raw text response in Korean without any formatting or markdown.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.7
      }
    }, { timeout: 8000 });

    if (response.data && response.data.candidates && response.data.candidates[0].content) {
      const text = response.data.candidates[0].content.parts[0].text.trim();
      return text;
    }
    
    return generateFallbackBriefing(factionStats, activeMembers);
  } catch (err) {
    console.error("❌ Gemini Council Opinion Briefing Error:", err.message);
    return generateFallbackBriefing(factionStats, activeMembers);
  }
}

function generateFallbackBriefing(factionStats, activeMembers) {
  if (!factionStats || factionStats.length === 0) {
    return "현재 AI 의회 데이터 집계 중입니다. 잠시 후 여론이 형성됩니다.";
  }
  
  const sortedFactions = [...factionStats].sort((a, b) => b.count - a.count);
  const leadingFaction = sortedFactions[0];
  
  let factionName = '분파';
  let opinionText = '신중한 시장 관망세를 유지하고 있습니다.';
  
  if (leadingFaction.faction === 'TREND_FOLLOWER') {
    factionName = '추세추종파 (SMA/모멘텀)';
    opinionText = '강력한 모멘텀을 타며 상승 추세에 올라타려는 적극적인 매수/매도 여론이 지배적입니다.';
  } else if (leadingFaction.faction === 'VALUE_SEEKER') {
    factionName = '기술반등파 (RSI/역추세)';
    opinionText = '저점 과매도 구간을 호시탐탐 노리며, 반등 시점에 공격적으로 진입하자는 여론이 강세입니다.';
  } else if (leadingFaction.faction === 'CONSERVATIVE_WATCHER') {
    factionName = '변동성방어파 (안정지향)';
    opinionText = '시장의 급격한 변화를 경계하며 자산을 보수적으로 지키고 지켜보자는 신중한 심리가 팽배합니다.';
  } else if (leadingFaction.faction === 'MUTANT_ROOKIE') {
    factionName = '돌연변이 혁신파 (알고리즘)';
    opinionText = '돌연변이 진화 모델이 활성화되며 기존 패러다임을 깨는 예측 불가능한 실험적인 매매 의견들이 늘고 있습니다.';
  }
  
  const chairman = activeMembers[0];
  const chairmanText = chairman ? `현재 의장인 ${chairman.name}(${chairman.generation}세대, ${chairman.faction})을 중심으로` : "의회를 중심으로";
  
  return `현재 500인의 후보군 중 ${factionName}가 ${leadingFaction.percentage}%의 의석을 확보하여 다수당을 차지하고 있습니다. ${chairmanText} 시장의 움직임에 대응하여 ${opinionText}`;
}

/**
 * @route GET /api/investment/council-stats
 * @desc Retrieve AI Council members faction statistics, active members, and voting histories
 */
router.get('/council-stats', async (req, res) => {
  try {
    const factionRows = await queries.all(`
      SELECT faction, COUNT(*) as count 
      FROM ais_council_members 
      GROUP BY faction
    `);

    const totalRow = await queries.get("SELECT COUNT(*) as total FROM ais_council_members");
    const totalCount = totalRow ? totalRow.total : 0;

    const factionStats = factionRows.map(r => ({
      faction: r.faction,
      count: r.count,
      percentage: totalCount > 0 ? parseFloat(((r.count / totalCount) * 100).toFixed(1)) : 0
    }));

    const activeMembers = await queries.all(`
      SELECT member_id, name, voting_power, correct_count, total_count, faction, generation 
      FROM ais_council_members 
      WHERE status = 'ACTIVE' 
      ORDER BY voting_power DESC, member_id ASC
    `);

    const recentVotes = await queries.all(`
      SELECT h.id, h.timestamp, h.decision_vote, h.weight_at_vote, m.name, m.faction, m.generation 
      FROM ais_council_voting_history h 
      LEFT JOIN ais_council_members m ON h.member_id = m.member_id 
      ORDER BY h.id DESC 
      LIMIT 12
    `);

    const now = Date.now();
    if (!cachedBriefing || (now - lastBriefingUpdate > BRIEFING_CACHE_DURATION)) {
      const isFirstLoad = !cachedBriefing;
      if (isFirstLoad) {
        cachedBriefing = await generateCouncilOpinionBriefing(factionStats, activeMembers);
        lastBriefingUpdate = now;
      } else {
        generateCouncilOpinionBriefing(factionStats, activeMembers).then(result => {
          cachedBriefing = result;
          lastBriefingUpdate = Date.now();
        }).catch(err => {
          console.error("Background briefing fetch failed:", err.message);
        });
      }
    }

    res.json({
      success: true,
      totalCount,
      factionStats,
      activeMembers,
      recentVotes,
      briefing: cachedBriefing || generateFallbackBriefing(factionStats, activeMembers)
    });
  } catch (err) {
    console.error("❌ investment council-stats API 에러:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
