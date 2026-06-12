const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const axios = require('axios');
const { ethers } = require('ethers');
const {
  extractCompleteGeminiText,
  makeCouncilBriefingGenerationConfig
} = require('../councilBriefing');
const { requireAuthenticatedSession } = require('../authSession');
const { getAisTrainingStats } = require('../aisAdminStats');

const MASTER_MANAGER_WALLET = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
const sutAddress = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
const sutAbi = ["function balanceOf(address account) external view returns (uint256)"];
const sutContract = new ethers.Contract(sutAddress, sutAbi, provider);

const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const multicallAbi = [
  "function aggregate(tuple(address target, bytes callData)[] calls) external view returns (uint256 blockNumber, bytes[] returnData)"
];
const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, provider);
const sutInterface = new ethers.Interface([
  "function balanceOf(address account) external view returns (uint256)"
]);

const adminAuthMiddleware = (req, res, next) => {
  if (req.authEmail !== 'lemaiiisk@gmail.com') {
    return res.status(403).json({
      success: false,
      message: '보안 경보: 관리자 권한이 존재하지 않습니다. 어드민 이메일(lemaiiisk@gmail.com)로 연동해 주십시오.'
    });
  }
  next();
};

// Mount security middleware on all Admin-specific API routes
router.use(requireAuthenticatedSession);
router.use(adminAuthMiddleware);

router.get('/managers', async (req, res) => {
  try {

    const managers = await queries.all(`
      SELECT id, wallet_address, email, name, phone, country, joined_at
      FROM users
      WHERE is_manager = 1
      ORDER BY joined_at ASC
    `);

    const enrichedManagers = await Promise.all(managers.map(async (m) => {

      const subUsersRow = await queries.get(`
        SELECT COUNT(*) as count
        FROM users
        WHERE LOWER(manager_address) = LOWER(?) AND status = 'APPROVED'
      `, [m.wallet_address]);
      const userCount = subUsersRow ? subUsersRow.count : 0;

      const subUsers = await queries.all(`
        SELECT wallet_address
        FROM users
        WHERE LOWER(manager_address) = LOWER(?) AND status = 'APPROVED'
      `, [m.wallet_address]);

      let performance = 0;
      if (subUsers && subUsers.length > 0) {
        try {

          const calls = subUsers.map(u => ({
            target: sutAddress,
            callData: sutInterface.encodeFunctionData("balanceOf", [u.wallet_address])
          }));

          const [blockNumber, returnData] = await multicallContract.aggregate(calls);

          const balances = returnData.map(data => {
            try {
              const [balance] = sutInterface.decodeFunctionResult("balanceOf", data);
              return parseFloat(ethers.formatUnits(balance, 18));
            } catch (decErr) {
              return 0;
            }
          });

          performance = balances.reduce((sum, val) => sum + val, 0);
          performance = parseFloat(performance.toFixed(2));
        } catch (err) {
          console.error(`[Admin Multicall3 Query Error] Manager: ${m.wallet_address}`, err.message);
          performance = 0;
        }
      }

      let onchainBalance = "0.00";
      try {
        const balanceWei = await sutContract.balanceOf(m.wallet_address);
        onchainBalance = parseFloat(ethers.formatUnits(balanceWei, 18)).toFixed(2);
      } catch (err) {
        console.error(`[Admin CEX Onchain SUT Query Error] ${m.wallet_address}:`, err.message);
      }

      return {
        ...m,
        userCount,
        performance,
        onchainBalance
      };
    }));

    res.json({ success: true, managers: enrichedManagers });
  } catch (err) {
    console.error("❌ 어드민 매니저 목록 로드 에러:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/promote-manager', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '지갑 주소가 누락되었습니다.' });
  }

  const cleanWallet = walletAddress.trim();

  try {

    const user = await queries.get(
      "SELECT id, status, is_manager FROM users WHERE LOWER(wallet_address) = LOWER(?)",
      [cleanWallet]
    );
    if (!user) {
      return res.status(444).json({ success: false, message: '등록되지 않은 회원 지갑 주소입니다. 가입을 먼저 완료해 주십시오.' });
    }
    if (user.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: '가입 승인(APPROVED)이 완료되지 않은 회원입니다. KYC 승인을 먼저 완료해 주십시오.' });
    }
    if (user.is_manager === 1) {
      return res.status(400).json({ success: false, message: '이미 매니저 등급인 회원입니다.' });
    }

    await queries.run(`
      UPDATE users
      SET is_manager = 1,
          manager_address = 'none',
          referrer_address = 'none'
      WHERE LOWER(wallet_address) = LOWER(?)
    `, [cleanWallet]);

    res.json({
      success: true,
      message: '회원이 매니저로 성공적으로 승격되었습니다. 이제 독립적인 500명 정원 할당이 가능합니다.'
    });

  } catch (err) {
    console.error("❌ 매니저 승격 에러:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/delete-manager', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '삭제할 매니저의 지갑 주소가 누락되었습니다.' });
  }

  const cleanWallet = walletAddress.trim();

  if (cleanWallet.toLowerCase() === MASTER_MANAGER_WALLET.toLowerCase()) {
    return res.status(400).json({ success: false, message: '경고: 최초 마스터 매니저 지갑 계정은 관리 목적상 삭제가 불가능합니다.' });
  }

  try {

    const user = await queries.get("SELECT id, is_manager FROM users WHERE wallet_address = ?", [cleanWallet]);
    if (!user || user.is_manager !== 1) {
      return res.status(404).json({ success: false, message: '해당 매니저 계정을 찾을 수 없거나 이미 강등/삭제되었습니다.' });
    }

    const migrateRes = await queries.run(`
      UPDATE users
      SET manager_address = ?
      WHERE manager_address = ?
    `, [MASTER_MANAGER_WALLET, cleanWallet]);

    console.log(`[Admin Account Cleanup] Migrated ${migrateRes.changes} users under ${cleanWallet} to Master Manager ${MASTER_MANAGER_WALLET}.`);

    // 3. The Manager's ledger payment (payments) history is also deleted for data integrity
    await queries.run("DELETE FROM payments WHERE wallet_address = ?", [cleanWallet]);

    await queries.run("DELETE FROM users WHERE wallet_address = ?", [cleanWallet]);

    res.json({
      success: true,
      message: `성공적으로 매니저 계정이 삭제되었습니다. 소속되어 있던 회원들은 마스터 매니저 밑으로 정상 이관 완료되었습니다.`
    });

  } catch (err) {
    console.error("❌ 매니저 삭제 및 이관 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/save-ai-config', async (req, res) => {
  const { model, apiKey, interval, intervalAuto } = req.body;
  try {
    if (model) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_model', ?)`, [model.trim()]);
    if (apiKey) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_gemini_api_key', ?)`, [apiKey.trim()]);
    if (interval) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_interval', ?)`, [interval.toString()]);
    if (intervalAuto) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_interval_auto', ?)`, [intervalAuto.toString()]);

    res.json({ success: true, message: '글로벌 AI 두뇌 및 API Key 설정이 서버 DB에 안전하게 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ai-config', async (req, res) => {
  try {
    const settings = await queries.all("SELECT key, value FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key', 'global_ai_interval', 'global_ai_interval_auto')");
    const config = {
      model: 'Gemini 3.5 Flash',
      hasApiKey: false,
      apiKey: '',
      interval: '5',
      intervalAuto: 'OFF'
    };

    settings.forEach(s => {
      if (s.key === 'global_ai_model') config.model = s.value;
      if (s.key === 'global_gemini_api_key' && s.value) {
        config.hasApiKey = true;
        config.apiKey = s.value;
      }
      if (s.key === 'global_ai_interval') config.interval = s.value;
      if (s.key === 'global_ai_interval_auto') config.intervalAuto = s.value;
    });

    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/admin/ai-engine
 * @desc Get global AI engine switching mode
 */
router.get('/ai-engine', async (req, res) => {
  try {
    const row = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
    const engineMode = row ? row.value : 'GEMINI_ONLY';
    res.json({ success: true, engineMode });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/admin/save-ai-engine
 * @desc Save global AI engine switching mode
 */
router.post('/save-ai-engine', async (req, res) => {
  const { engineMode } = req.body;
  const validModes = ['GEMINI_ONLY', 'GEMINI_AIS_SHADOW', 'AIS_ONLY', 'HYBRID_COOP'];
  if (!engineMode || !validModes.includes(engineMode)) {
    return res.status(400).json({ success: false, message: '올바르지 않은 AI 구동 모드 선택입니다.' });
  }
  try {
    await queries.run(`
      INSERT INTO platform_settings (key, value)
      VALUES ('global_ai_engine', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [engineMode]);
    res.json({ success: true, message: `🎉 글로벌 AI 작동 엔진이 성공적으로 [${engineMode}] 모드로 저장되었습니다.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/admin/training-stats
 * @desc Retrieve total count of records in ais_training_data
 */
router.get('/training-stats', async (req, res) => {
  try {
    const trainingStats = await getAisTrainingStats(queries);

    const settings = await queries.all(`
      SELECT key, value FROM platform_settings 
      WHERE key IN ('ais_last_trained_at', 'ais_model_accuracy')
    `);

    let lastTrainedAt = '';
    let modelAccuracy = '0.00';

    settings.forEach(s => {
      if (s.key === 'ais_last_trained_at') lastTrainedAt = s.value;
      if (s.key === 'ais_model_accuracy') modelAccuracy = s.value;
    });

    res.json({ 
      success: true, 
      count: trainingStats.total,
      lastTrainedAt,
      modelAccuracy: trainingStats.latestRun
        ? trainingStats.latestRun.holdoutScore.toFixed(2)
        : modelAccuracy,
      ...trainingStats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/admin/export-training-csv
 * @desc Export SQLite ais_training_data to fully compliant RFC 4180 CSV file
 */
router.get('/export-training-csv', async (req, res) => {
  try {
    const rows = await queries.all(`
      SELECT timestamp, current_price, price_change_ratio, rsi_14, sma_5, sma_20,
             gemini_decision, gemini_proposed_price, gemini_amount_ratio, gemini_reason,
             next_price_5m, realized_price_change, is_correct_decision,
             evaluation_due_at, evaluation_status, label_version
      FROM ais_training_data
      ORDER BY id ASC
    `);

    // Build CSV compliant header and body rows
    const header = 'timestamp,current_price,price_change_ratio,rsi_14,sma_5,sma_20,gemini_decision,gemini_proposed_price,gemini_amount_ratio,gemini_reason,next_price_5m,realized_price_change,is_correct_decision,evaluation_due_at,evaluation_status,label_version\n';
    
    let csvContent = header;
    rows.forEach(r => {
      // Escape reasons containing quotes or newlines to prevent parsing crashes in ML packages
      const escapedReason = String(r.gemini_reason || '')
        .replace(/"/g, '""')
        .replace(/\r?\n|\r/g, ' ');
      
      const line = `"${r.timestamp}",${r.current_price},${r.price_change_ratio},${r.rsi_14},${r.sma_5},${r.sma_20},"${r.gemini_decision}",${r.gemini_proposed_price},${r.gemini_amount_ratio},"${escapedReason}",${r.next_price_5m},${r.realized_price_change},${r.is_correct_decision},"${r.evaluation_due_at || ''}","${r.evaluation_status || ''}",${r.label_version || ''}\n`;
      csvContent += line;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ais_training_dataset.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    console.error("❌ CSV 다운로드 내보내기 에러:", err);
    res.status(500).send(`CSV 내보내기 실패: ${err.message}`);
  }
});

let cachedBriefing = null;
let lastBriefingUpdate = 0;
const BRIEFING_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours cache (aligns with daily evolutionary cycle)

async function generateCouncilOpinionBriefing(factionStats, activeMembers, generationStats) {
  try {
    const apiKeyRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_gemini_api_key'");
    const modelRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_model'");
    
    if (!apiKeyRow || !apiKeyRow.value) {
      return generateFallbackBriefing(factionStats, activeMembers, generationStats);
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

    const generationInfo = generationStats ? generationStats.map(g => `${g.generation}세대: ${g.count}명 (${g.percentage}%)`).join(', ') : '1세대: 500명 (100%)';

    const promptText = `
You are an expert system analyst observing the "AiS Virtual Council" (an AI assembly of 500 neural net trading bots evolving via genetic algorithms).
Based on the current faction distribution, generation composition, and top leaders of the 500-member AI candidate pool, analyze the overall genetic and philosophical characteristics of these 500 AI candidates. Write a concise executive briefing in Korean within 600 Korean characters. (Output example: "이번 세대 교체를 통해 2세대 AI가 N명으로 새롭게 등장했으며... 특히 기술반등파가 다수를 차지하게 된 배경에는... 반면 추세추종파가 소수로 전락한 이유는...")

Input data:
- Faction Counts (500 candidates): ${factionInfo}
- Generation Distribution: ${generationInfo}
- Top 3 Leaders in Office (Chairman, Vice Chairman, Committee Chair): ${leadersInfo}

Rules:
1. Speak of them as distinct virtual factions with conflicting trading philosophies:
   - TREND_FOLLOWER: 추세추종파 (SMA/모멘텀)
   - VALUE_SEEKER: 기술반등파 (RSI/역추세)
   - CONSERVATIVE_WATCHER: 변동성방어파 (안정지향)
   - MUTANT_ROOKIE: 돌연변이 혁신파 (진화/알고리즘)
2. MUST explicitly mention the current generation landscape based on Generation Distribution (e.g. "현재 1세대가 500명을 100% 점유하고 있으며..." or "이번 진화를 통해 새로운 2세대가 O명으로 주류를 이루었고 살아남은 1세대는 O명뿐입니다...").
3. Deeply analyze the REASONS behind the current distribution. Why are the dominant factions succeeding and multiplying in this generation? Why did the minority factions fail to secure seats or dwindle? Create a logical evolutionary narrative explaining these market-survival dynamics in detail.
4. MUST explain the "birth background (탄생 배경)" of each major faction in the context of the AI's evolutionary history (e.g., what kind of market crash or bull run birthed the Value Seekers or Mutant Rookies).
5. Do NOT talk about real-time market trends or recent trades. Focus purely on their genetic character, dominant factions, and historical evolution traits.
6. Keep the report within 600 Korean characters. Return ONLY the raw text response in Korean without any formatting or markdown.
7. You MUST explicitly analyze the non-active candidates (non-elected candidates) who haven't entered the active top 11 but represent higher generations (e.g. 5th or 6th gen). Explain what their existence represents and how their trading philosophies are waiting in the candidate pool for the next evolutionary shift.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    
    let retries = 3;
    while (retries > 0) {
      try {
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: makeCouncilBriefingGenerationConfig()
        }, { timeout: 300000 }); // 5 minutes

        return extractCompleteGeminiText(response.data);
      } catch (err) {
        retries--;
        console.error(`❌ Gemini Council Opinion Briefing Error. Retries left: ${retries}`, err.message);
        if (retries === 0) {
          return generateFallbackBriefing(factionStats, activeMembers, generationStats);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    return generateFallbackBriefing(factionStats, activeMembers, generationStats);
  } catch (err) {
    console.error("❌ Gemini Council Opinion Briefing Error:", err.message);
    return generateFallbackBriefing(factionStats, activeMembers, generationStats);
  }
}

function generateFallbackBriefing(factionStats, activeMembers, generationStats) {
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
 * @route GET /api/admin/council-stats
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
    try {
      const evoRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'last_evolution_time'");
      if (evoRow && evoRow.value) lastEvoTime = parseInt(evoRow.value, 10);
    } catch(e) {}
    
    if (!cachedBriefing || (now - lastBriefingUpdate > BRIEFING_CACHE_DURATION) || (lastBriefingUpdate < lastEvoTime)) {
      if (!cachedBriefing) {
        cachedBriefing = "현재 500명 AI 의원들의 세대 진화 및 파벌 탄생 배경에 대한 심층 분석을 백그라운드에서 진행 중입니다. 분석이 완료되기까지 약 5분이 소요될 수 있으니 잠시 후 새로고침해 주십시오...";
      }
      
      lastBriefingUpdate = now; // 중복 호출 방지를 위해 미리 갱신
      
      generateCouncilOpinionBriefing(factionStats, activeMembers, generationStats).then(result => {
        cachedBriefing = result;
        lastBriefingUpdate = Date.now();
      }).catch(err => {
        console.error("Background briefing fetch failed:", err.message);
        // 실패 시 다시 시도할 수 있도록 초기화
        if (cachedBriefing.includes("진행 중")) cachedBriefing = null; 
      });
    }

    res.json({
      success: true,
      totalCount,
      factionStats,
      activeMembers,
      recentVotes,
      briefing: cachedBriefing || generateFallbackBriefing(factionStats, activeMembers, generationStats)
    });
  } catch (err) {
    console.error("Admin /council-stats Error:", err);
    res.status(500).json({ error: "Failed to fetch council stats" });
  }
});

// [BACKDOOR] Force GA Evolution
router.post('/force-evolution', async (req, res) => {
  try {
    const { runDailyEvolution } = require('../evolution.js');
    const stats = await runDailyEvolution();
    
    // Update platform_settings to trigger briefing cache flush
    await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('last_evolution_time', ?)", [Date.now().toString()]);
    
    res.json({ success: true, stats, message: "강제 세대 진화 알고리즘이 완료되었습니다." });
  } catch(err) {
    console.error("Force Evolution Error:", err);
    res.status(500).json({ error: "진화 알고리즘 실행 실패" });
  }
});

module.exports = router;
