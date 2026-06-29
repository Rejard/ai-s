const express = require('express');
const router = express.Router();
const axios = require('axios');
const { queries } = require('../database');
const {
  extractCompleteGeminiText,
  makeCouncilBriefingGenerationConfig
} = require('../councilBriefing');
const {
  createRefreshCoordinator,
  getLatestSuccessfulBriefing,
  shouldRefreshBriefing,
  startBriefingRefresh,
  finishBriefingRefreshSuccess,
  finishBriefingRefreshFailure
} = require('../councilBriefingHistory');
const { requireAuthenticatedSession } = require('../authSession');
const {
  parseCandidateDna,
  determineCandidateOrigin,
  summarizeOriginStats,
  generateFallbackBriefing,
  resolveGeminiModelId,
} = require('../councilShared');

const verifyWalletOwnership = async (req, res, next) => {
  const targetWallet = (req.params.walletAddress || req.body.walletAddress || '').toLowerCase().trim();
  if (!targetWallet) {
    return res.status(400).json({ success: false, message: '지갑 주소가 누락되었습니다.' });
  }

  try {
    if (req.authEmail === (process.env.ADMIN_EMAIL || 'lemaiiisk@gmail.com')) {
      return next();
    }

    const sessionUser = await queries.get(
      "SELECT wallet_address, is_manager FROM users WHERE LOWER(email) = LOWER(?)",
      [req.authEmail]
    );

    if (!sessionUser) {
      return res.status(403).json({ success: false, message: '가입 승인된 사용자 정보가 존재하지 않습니다.' });
    }

    if (sessionUser.wallet_address.toLowerCase() === targetWallet) {
      return next();
    }

    if (sessionUser.is_manager === 1) {
      const managedUser = await queries.get(
        "SELECT id FROM users WHERE LOWER(wallet_address) = LOWER(?) AND LOWER(manager_address) = LOWER(?)",
        [targetWallet, sessionUser.wallet_address]
      );
      if (managedUser) {
        return next();
      }
    }

    return res.status(403).json({ success: false, message: '권한 경보: 해당 지갑 주소의 데이터에 접근할 권한이 없습니다.' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const requireAdminCouncilAccess = (req, res, next) => {
  if (req.authEmail !== (process.env.ADMIN_EMAIL || 'lemaiiisk@gmail.com')) {
    return res.status(403).json({
      success: false,
      message: 'Council stats are restricted to the admin console.'
    });
  }

  next();
};



let cachedPrices = {
  sut: { usd: 1.0, usd_24h_change: 0.0, usd_24h_high: 1.0, usd_24h_low: 1.0 }
};
let lastPriceFetchTime = 0;
let cachedHistory = [];
let lastHistoryFetchTime = 0;

async function getLivePrices() {
  const now = Date.now();
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
      cachedPrices.sut.usd_24h_high = parseFloat(ticker.high_24h || ticker.last);
      cachedPrices.sut.usd_24h_low = parseFloat(ticker.low_24h || ticker.last);
      lastPriceFetchTime = now;
    }
  } catch (err) {
    console.error("Gate.io 진짜 SUT 시세 불러오기 실패 (캐시된 이전 시세 사용):", err.message);
  }

  return cachedPrices;
}

async function getSutHistory() {
  const now = Date.now();

  if (now - lastHistoryFetchTime < 60000 && cachedHistory.length > 0) {
    return cachedHistory;
  }
  try {
    const res = await axios.get(
      'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=SUT_USDT&interval=30m&limit=48',
      { timeout: 3000 }
    );
    if (res.data && res.data.length > 0) {
      cachedHistory = res.data.map(k => parseFloat(k[2]));
      lastHistoryFetchTime = now;
    }
  } catch (err) {
    console.error("Gate.io SUT 차트 히스토리 불러오기 실패:", err.message);
  }

  if (cachedHistory.length === 0) {
    const fallback = [];
    let base = 0.185;
    for (let i = 0; i < 48; i++) {
      base += (Math.random() - 0.48) * 0.002;
      fallback.push(parseFloat(base.toFixed(4)));
    }
    cachedHistory = fallback;
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

router.get('/portfolio/:walletAddress', requireAuthenticatedSession, verifyWalletOwnership, async (req, res) => {
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
    const aiTradingProfitSut = aiProfits?.total || 0;

    const sutQuantity = totalInvested + aiTradingProfitSut;

    const prices = await getLivePrices();
    const sutPrice = prices.sut.usd;

    const totalValuation = sutQuantity * sutPrice;

    const baseSutPriceRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'base_sut_price'");
    const baseSutPrice = baseSutPriceRow ? parseFloat(baseSutPriceRow.value) : 0.20;
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
        sutHigh24h: prices.sut.usd_24h_high,
        sutLow24h: prices.sut.usd_24h_low,
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

router.post('/update-ratio', requireAuthenticatedSession, verifyWalletOwnership, async (req, res) => {
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

router.post('/deposit', requireAuthenticatedSession, verifyWalletOwnership, async (req, res) => {
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

router.post('/withdraw', requireAuthenticatedSession, verifyWalletOwnership, async (req, res) => {
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

router.get('/history/:walletAddress', requireAuthenticatedSession, verifyWalletOwnership, async (req, res) => {
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
    console.error('[INVESTMENT] History query error:', err.message);
    res.status(500).json({ success: false, error: err.message });
}
});

const investmentBriefingRefreshCoordinator = createRefreshCoordinator();
const INVESTMENT_BRIEFING_SCOPE = 'INVESTMENT';
const BRIEFING_CACHE_DURATION = 12 * 60 * 60 * 1000;

async function generateCouncilOpinionBriefing(factionStats, activeMembers, generationStats, originStats = []) {
  try {
    const apiKeyRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_gemini_api_key'");
    const modelRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_model'");
    
    if (!apiKeyRow || !apiKeyRow.value) {
      return generateFallbackBriefing(factionStats, activeMembers, generationStats, originStats);
    }
    
    const apiKey = apiKeyRow.value;
    const modelName = modelRow ? modelRow.value : 'Gemini 3.5 Flash';
    
    const modelId = resolveGeminiModelId(modelName);

    const leadersInfo = activeMembers.slice(0, 3).map((m, idx) => {
      const title = idx === 0 ? '의장' : idx === 1 ? '부의장' : '상임위원장';
      return `${title}: ${m.name} (${m.generation}세대, ${m.faction} 분파, 정확도 ${m.correct_count}%)`;
    }).join(', ');

    const factionInfo = factionStats.map(f => `${f.faction}: ${f.count}석 (${f.percentage}%)`).join(', ');

    const generationInfo = generationStats ? generationStats.map(g => `${g.generation}세대: ${g.count}명 (${g.percentage}%)`).join(', ') : '1세대: 500명 (100%)';

    const promptText = `
You are an expert system analyst observing the "AiS Virtual Council" (an AI assembly of 500 neural net trading bots evolving via genetic algorithms).
Based on the current faction distribution, generation composition, and top leaders of the 500-member AI candidate pool, analyze the overall genetic and philosophical characteristics of these 500 AI candidates. Write a concise executive briefing in Korean within 600 Korean characters. (Output example: "이번 세대 교체를 통해 2세대 AI가 N명으로 새롭게 등장했으며... 특히 기술반등파가 다수를 차지하게 된 배경에는... 반면 추세추종파가 소수로 전락한 이유는...")

Input data:
- Faction Counts (500 candidates): ${factionInfo}
- Origin Counts (500 candidates): ${originStats.map(o => `${o.origin}: ${o.count}? (${o.percentage}%)`).join(', ')}
- Generation Distribution: ${generationInfo}
- Top 3 Leaders in Office (Chairman, Vice Chairman, Committee Chair): ${leadersInfo}

Rules:
1. Speak of them as distinct virtual factions with conflicting trading philosophies:
   - TREND_FOLLOWER: 추세추종파 (SMA/모멘텀)
   - VALUE_SEEKER: 기술반등파 (RSI/역추세)
   - CONSERVATIVE_WATCHER: 변동성방어파 (안정지향)
2. MUST explicitly mention the current generation landscape based on Generation Distribution (e.g. "현재 1세대가 500명을 100% 점유하고 있으며..." or "이번 진화를 통해 새로운 2세대가 O명으로 주류를 이루었고 살아남은 1세대는 O명뿐입니다...").
3. Deeply analyze the REASONS behind the current distribution. Why are the dominant factions succeeding and multiplying in this generation? Why did the minority factions fail to secure seats or dwindle? Create a logical evolutionary narrative explaining these market-survival dynamics in detail.
4. MUST explain the "birth background (탄생 배경)" of each major faction in the context of the AI's evolutionary history (e.g., what kind of market crash or bull run birthed the Value Seekers or Mutant Rookies).
5. Do NOT talk about real-time market trends or recent trades. Focus purely on their genetic character, dominant factions, and historical evolution traits.
6. Keep the report within 600 Korean characters. Return ONLY the raw text response in Korean without any formatting or markdown.
7. You MUST explicitly analyze the non-active candidates (non-elected candidates) who haven't entered the active top 11 but represent higher generations (e.g. 5th or 6th gen). Explain what their existence represents and how their trading philosophies are waiting in the candidate pool for the next evolutionary shift.
8. Include one concise sentence explaining the current origin distribution of the 500 candidates, separating crossover offspring, seeded random diversity, and mutation-derived lineage.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    
    let retries = 3;
    while (retries > 0) {
      try {
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: makeCouncilBriefingGenerationConfig()
        }, { timeout: 300000 });

        return extractCompleteGeminiText(response.data);
      } catch (err) {
        retries--;
        console.error(`[BRIEFING] Gemini council briefing error. Retries left: ${retries}`, err.message);
        if (retries === 0) {
          return generateFallbackBriefing(factionStats, activeMembers, generationStats, originStats);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    return generateFallbackBriefing(factionStats, activeMembers, generationStats, originStats);
  } catch (err) {
    console.error('[BRIEFING] Gemini council briefing error:', err.message);
    return generateFallbackBriefing(factionStats, activeMembers, generationStats, originStats);
  }
}



router.get('/council-stats' , requireAuthenticatedSession, requireAdminCouncilAccess, async (req, res) => {
  try {
    const factionRows = await queries.all(`
      SELECT COALESCE(faction, 'UNCLASSIFIED') as faction, COUNT(*) as count 
      FROM ais_council_members 
      GROUP BY COALESCE(faction, 'UNCLASSIFIED')
    `);

    const totalRow = await queries.get("SELECT COUNT(*) as total FROM ais_council_members");
    const totalCount = totalRow ? totalRow.total : 0;

    const factionStats = factionRows.map(r => ({
      faction: r.faction,
      count: r.count,
      percentage: totalCount > 0 ? parseFloat(((r.count / totalCount) * 100).toFixed(1)) : 0
    }));

    const originRows = await queries.all(`
      SELECT member_id, dna_json, generation, status
      FROM ais_council_members
    `);
    const originStats = summarizeOriginStats(originRows, totalCount);

    const activeMembers = await queries.all(`
      SELECT member_id, name, voting_power, correct_count, total_count, faction, generation, dna_json, phenotype_json
      FROM ais_council_members 
      WHERE status = 'ACTIVE' 
      ORDER BY voting_power DESC, member_id ASC
    `);
    const activeOriginStats = summarizeOriginStats(originRows.filter((row) => row.status === 'ACTIVE'), activeMembers.length);

    const recentVotes = await queries.all(`
      SELECT h.id, h.timestamp, h.decision_vote, h.weight_at_vote, m.name, m.faction, m.generation 
      FROM ais_council_voting_history h 
      LEFT JOIN ais_council_members m ON h.member_id = m.member_id 
      ORDER BY h.id DESC 
      LIMIT 11
    `);

    const generationRows = await queries.all(`
      SELECT generation, COUNT(*) as count 
      FROM ais_council_members 
      GROUP BY generation
      ORDER BY generation DESC
    `);
    const generationStats = generationRows.map(r => ({
      generation: r.generation,
      count: r.count,
      percentage: totalCount > 0 ? parseFloat(((r.count / totalCount) * 100).toFixed(1)) : 0
    }));
    const now = Date.now();
    let lastEvoTime = 0;
    const modelRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_model'");
    try {
      const evoRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'last_evolution_time'");
      if (evoRow && evoRow.value) lastEvoTime = parseInt(evoRow.value, 10);
    } catch(e) { console.error('[COUNCIL] Evolution time query failed:', e.message); }

    const latestBriefing = await getLatestSuccessfulBriefing(queries, INVESTMENT_BRIEFING_SCOPE);
    const lastBriefingUpdate = latestBriefing && latestBriefing.generatedAt
      ? new Date(latestBriefing.generatedAt).getTime()
      : 0;
    const refreshNeeded = shouldRefreshBriefing({
      latestSuccess: latestBriefing,
      now,
      lastEvolutionTime: lastEvoTime,
      cacheDurationMs: BRIEFING_CACHE_DURATION
    });

    const visibleBriefing = latestBriefing
      ? latestBriefing.briefingText
      : generateFallbackBriefing(factionStats, activeMembers, generationStats, originStats);

    if (!latestBriefing || (now - lastBriefingUpdate > BRIEFING_CACHE_DURATION) || (lastBriefingUpdate < lastEvoTime)) {
      if (investmentBriefingRefreshCoordinator.start(INVESTMENT_BRIEFING_SCOPE)) {
        const refreshRow = await startBriefingRefresh(queries, {
          scope: INVESTMENT_BRIEFING_SCOPE,
          triggeredBy: latestBriefing ? 'CACHE_REFRESH' : 'INITIAL',
          evolutionTime: lastEvoTime ? String(lastEvoTime) : null,
          modelName: modelRow && modelRow.value ? modelRow.value : null
        });

        generateCouncilOpinionBriefing(factionStats, activeMembers, generationStats, originStats).then(async (result) => {
          await finishBriefingRefreshSuccess(queries, refreshRow.id, {
            briefingText: result,
            generatedAt: new Date().toISOString()
          });
        }).catch(async (err) => {
          console.error('[BRIEFING] Background investment briefing fetch failed:', err.message);
          try {
            await finishBriefingRefreshFailure(queries, refreshRow.id, err.message);
          } catch (saveErr) {
            console.error('[BRIEFING] Failed to record briefing failure:', saveErr.message);
          }
        }).finally(() => {
          investmentBriefingRefreshCoordinator.finish(INVESTMENT_BRIEFING_SCOPE);
        });
      }
    }

    res.json({
      success: true,
      totalCount,
      factionStats,
      originStats,
      activeOriginStats,
      activeMembers,
      recentVotes,
      briefing: visibleBriefing,
      briefingGeneratedAt: latestBriefing ? latestBriefing.generatedAt : null,
      briefingStatus: latestBriefing ? latestBriefing.status : 'FALLBACK',
      briefingRefreshing: refreshNeeded || investmentBriefingRefreshCoordinator.isRefreshing(INVESTMENT_BRIEFING_SCOPE)
    });
  } catch (err) {
    console.error('[COUNCIL] Investment council-stats error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
