const axios = require('axios');
const { queries } = require('./database');
const { createGateIoOrder, getGateIoBalances, getGateIoOpenOrders, cancelGateIoOrder } = require('./gateioHelper');
const { decryptText } = require('./secureCredentials');
const { runDailyEvolution } = require('./evolution');
const { buildTradePlan } = require('./autoTradeMath');
const { applyManagerAutoRangeSettings } = require('./managerAutoRange');
const {
  LABEL_VERSION,
  addMinutesToSqliteTimestamp,
  labelDueTrainingRows,
  toKstSqliteTimestamp,
} = require('./aisEvaluation');
const { exec } = require('child_process');
const os = require('os');

const pythonCmd = os.platform() === 'win32' ? 'py' : 'python';

if (!global.priceHistory) {
  global.priceHistory = [];
}

function calculateSMA(prices, period) {
  if (!prices || prices.length === 0) return 0;
  const targetPrices = prices.slice(-period);
  const sum = targetPrices.reduce((a, b) => a + b, 0);
  return sum / targetPrices.length;
}

function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < 2) return 50.0;
  
  let gains = 0;
  let losses = 0;
  
  const limit = Math.min(prices.length, period + 1);
  for (let i = prices.length - limit + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }
  
  const activeTicks = limit - 1;
  if (activeTicks === 0) return 50.0;
  
  const avgGain = gains / activeTicks;
  const avgLoss = losses / activeTicks;
  
  if (avgLoss === 0) return avgGain > 0 ? 100.0 : 50.0;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return parseFloat(rsi.toFixed(2));
}

async function getAiSTradingDecision(currentPrice, rsi, sma5, sma20, priceChangeRatio = 0.0) {
  try {
    const members = await queries.all(`
      SELECT member_id, name, weights_json, voting_power 
      FROM ais_council_members 
      WHERE status = 'ACTIVE'
    `);
    
    const membersB64 = Buffer.from(JSON.stringify(members || [])).toString('base64');
    
    return new Promise((resolve) => {
      const path = require('path');
      const scriptPath = path.join(__dirname, 'ais_inference.py');
      const cmd = `${pythonCmd} "${scriptPath}" ${currentPrice} ${rsi} ${sma5} ${sma20} ${priceChangeRatio} ${membersB64}`;
      
      exec(cmd, async (error, stdout, stderr) => {
        if (error) {
          console.error("[AiS Council Bridge Error]:", error.message);
          return resolve({
            success: false,
            error: error.message
          });
        }
        try {
          const result = JSON.parse(stdout.trim());
          if (!result.success || !result.votes) {
            return resolve({ success: false, error: "Inference response format invalid" });
          }
          
          const votes = result.votes;
          let buyVotes = 0;
          let sellVotes = 0;
          let holdVotes = 0;
          let totalPower = 0;
          
          const powerMap = {};
          (members || []).forEach(m => {
            powerMap[m.member_id] = m.voting_power || 1.0;
          });
          
          votes.forEach(v => {
            const power = powerMap[v.member_id] || 1.0;
            totalPower += power;
            if (v.decision === 'BUY') buyVotes += power;
            else if (v.decision === 'SELL') sellVotes += power;
            else holdVotes += power;
          });
          
          let finalDecision = 'HOLD';
          let winningVotes = holdVotes;
          
          if (buyVotes > winningVotes) {
            finalDecision = 'BUY';
            winningVotes = buyVotes;
          }
          if (sellVotes > winningVotes) {
            finalDecision = 'SELL';
            winningVotes = sellVotes;
          }
          
          const kstDate = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
          const timestampKst = kstDate.toISOString().replace('T', ' ').substring(0, 19);
          
          let reasonHeader = `[AI 의회 최종 의결 - ${finalDecision} (${winningVotes.toFixed(1)}표 / ${totalPower.toFixed(1)}표)]\n`;
          let reasonBody = "의원별 투표 성향:\n";
          
          for (const v of votes) {
            const power = powerMap[v.member_id] || 1.0;
            reasonBody += `- ${v.name}: [${v.decision}] (${power.toFixed(1)}표)\n`;
            
            try {
              await queries.run(`
                INSERT INTO ais_council_voting_history (timestamp, member_id, decision_vote, weight_at_vote)
                VALUES (?, ?, ?, ?)
              `, [timestampKst, v.member_id, v.decision, power]);
            } catch (dbVoteErr) {
              // Bypassed logging
            }
          }
          
          const finalReason = reasonHeader + reasonBody;
          
          resolve({
            success: true,
            decision: finalDecision,
            reason: finalReason,
            price: currentPrice,
            amount_ratio: 0.1,
            proposed_lower: parseFloat((currentPrice * 0.90).toFixed(4)),
            proposed_upper: parseFloat((currentPrice * 1.15).toFixed(4))
          });
          
        } catch (parseErr) {
          console.error("[AiS Council JSON Parse Error]:", parseErr.message, "Output was:", stdout);
          resolve({
            success: false,
            error: parseErr.message
          });
        }
      });
    });
  } catch (err) {
    console.error("[-] Council Inference System Error:", err.message);
    return { success: false, error: err.message };
  }
}

async function getSutCurrentPrice() {
  try {
    const tickerRes = await axios.get('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SUT_USDT', { timeout: 3000 });
    if (tickerRes.data && tickerRes.data.length > 0) {
      return parseFloat(tickerRes.data[0].last);
    }
  } catch (err) {
    console.error("[AI Bot Price Fetch Error]:", err.message);
  }
  return 0.158; // Default fallback price on lookup failure
}

async function getAiTradingDecision(apiKey, modelName, marketData) {
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const promptText = `
You are a master AI crypto trading strategist analyzing the SUT/USDT market.
Based on the real-time SUT price trend, generate a global trading strategy for all managers.

[MARKET DATA]
- Recent SUT Price Trend (Last 10 updates, older to newer): ${JSON.stringify(marketData.priceHistory)} USDT
- Current SUT Price: ${marketData.currentPrice} USDT
- Current RSI (14 Ticks): ${marketData.rsi14}
- Simple Moving Average 5 (SMA_5): ${marketData.sma5} USDT
- Simple Moving Average 20 (SMA_20): ${marketData.sma20} USDT
- Real-time Price Change Ratio (t-1 to t): ${marketData.priceChangeRatio.toFixed(4)}%
- 24-Hour Price Stats:
  - 24h Lowest Price (Min): ${marketData.stats24h.minPrice} USDT
  - 24h Highest Price (Max): ${marketData.stats24h.maxPrice} USDT
  - 24h Average Price (Avg): ${marketData.stats24h.avgPrice} USDT

[DECISION RULE]
1. decision: "BUY", "SELL", or "HOLD".
   - Favor "HOLD" to prevent over-trading, but do NOT hesitate to suggest "BUY" or "SELL" when indicators clearly display extreme under/overvaluation.
   - **BUY rule (Downtrend/Dip)**: Under extremely low RSI (<35) or clear bottom support/consolidation near 24h Min, trigger "BUY" even during consecutive downtrends to capture value. Avoid buying only when there is high-velocity panic-selling without any support.
   - **SELL rule (Uptrend/Peak)**: Under extremely high RSI (>65) or resistance near 24h Max, trigger "SELL" to secure profits. Do not delay taking profit excessively if momentum shifts or resistance is met.
   - Trigger "BUY" when solid bottom support or oversold indicator (RSI < 35) is confirmed.
   - Trigger "SELL" when overbought state (RSI > 65) or peak resistance is confirmed.
2. reason: Detail your market analysis and reason in Korean. Explain clearly why you decided to BUY, SELL, or HOLD according to the rules above.
3. price: Target execution price in USDT. For BUY, recommend a price <= current price (capitalizing on dips). For SELL, recommend a price >= current price.
4. amount_ratio: A number between 0.1 and 0.5 representing the recommended proportion of assets to trade (e.g., 0.1 means 10%).
5. proposed_lower: Propose a reasonable lower grid limit in USDT based on the current price (e.g., usually 5% to 15% lower than current price, but adjust logically based on trend).
6. proposed_upper: Propose a reasonable upper grid limit in USDT based on the current price (e.g., usually 10% to 50% higher than current price, but adjust logically based on trend).

You must respond in structured JSON format ONLY. Do not output markdown code blocks.
Response JSON schema:
{
  "decision": "BUY" | "SELL" | "HOLD",
  "reason": "Detailed explanation for the decision in Korean reflecting the rules above",
  "price": number,
  "amount_ratio": number,
  "proposed_lower": number,
  "proposed_upper": number
}
`;

  try {
    const response = await axios.post(url, {
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    }, { timeout: 15000 });

    if (response.data && response.data.candidates && response.data.candidates[0].content) {
      const jsonText = response.data.candidates[0].content.parts[0].text;
      const decisionObj = JSON.parse(jsonText.trim());
      return { success: true, ...decisionObj };
    }
  } catch (err) {
    console.error("[Gemini API Trading Call Error]:", err.response ? err.response.data : err.message);
    return { success: false, error: err.message };
  }
  return { success: false, error: 'AI 응답 수신 실패' };
}

async function recordManagerTradeExecution({ managerEmail, aiLogId, side, amount, price, status, gateioOrderId = '', message = '' }) {
  try {
    await queries.run(`
      INSERT OR IGNORE INTO manager_trade_executions
        (manager_email, ai_log_id, side, amount, price, status, gateio_order_id, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [managerEmail, aiLogId, side, amount, price, status, gateioOrderId, message]);
  } catch (err) {
    console.error("[AI GRID BOT] trade execution log save failed:", err.message);
  }
}

async function executeServerAutoTrades(aiLogId, aiResult, currentSutPrice = 0) {
  const decision = String(aiResult.decision || '').toUpperCase();
  const proposedPrice = parseFloat(aiResult.price) || 0;
  const amountRatio = parseFloat(aiResult.amount_ratio) || 0.1;

  if (!aiLogId || !proposedPrice || !['BUY', 'SELL'].includes(decision)) {
    return;
  }

  const managers = await queries.all(`
    SELECT
      s.manager_email,
      s.ai_grid_lower,
      s.ai_grid_upper,
      s.ai_grid_count,
      c.encrypted_api_key,
      c.encrypted_api_secret
    FROM manager_ai_settings s
    JOIN manager_gateio_credentials c
      ON LOWER(c.manager_email) = LOWER(s.manager_email)
    WHERE s.ai_grid_status = 'ON'
  `);

  for (const manager of managers) {
    const managerEmail = manager.manager_email;
    const alreadyRun = await queries.get(
      "SELECT id FROM manager_trade_executions WHERE LOWER(manager_email) = LOWER(?) AND ai_log_id = ?",
      [managerEmail, aiLogId]
    );
    if (alreadyRun) continue;

    let side = '';
    let amount = 0;

    try {
      const apiKey = decryptText(manager.encrypted_api_key);
      const apiSecret = decryptText(manager.encrypted_api_secret);
      const balanceRes = await getGateIoBalances(apiKey, apiSecret);
      if (!balanceRes.success) {
        await recordManagerTradeExecution({ managerEmail, aiLogId, side: decision.toLowerCase(), amount: 0, price: proposedPrice, status: 'FAILED', message: balanceRes.message || 'Gate.io balance check failed.' });
        continue;
      }

      // ⏳ [AI GRID BOT] 기존 미체결 주문 자동 취소 (Clean-up) 로직 수행
      try {
        const openOrdersRes = await getGateIoOpenOrders(apiKey, apiSecret);
        if (openOrdersRes.success && Array.isArray(openOrdersRes.data)) {
          const now = Date.now();
          for (const order of openOrdersRes.data) {
            const createTimeMs = parseFloat(order.create_time_ms || (order.create_time * 1000));
            const elapsedMinutes = (now - createTimeMs) / (60 * 1000);
            
            const orderPrice = parseFloat(order.price);
            const refPrice = currentSutPrice || proposedPrice;
            const priceDiffPercent = Math.abs((refPrice - orderPrice) / orderPrice) * 100;
            
            // 조건 1: 15분 경과 OR 조건 2: 가격 괴리율 2% 이상
            if (elapsedMinutes >= 15 || priceDiffPercent >= 2.0) {
              console.log(`[🤖 AI GRID BOT] 미체결 대기 주문 자동 취소 진행 - 매니저: ${managerEmail}, 주문ID: ${order.id}, 경과시간: ${elapsedMinutes.toFixed(1)}분, 괴리율: ${priceDiffPercent.toFixed(2)}%`);
              await cancelGateIoOrder(apiKey, apiSecret, order.id);
            }
          }
        }
      } catch (cancelErr) {
        console.error(`[-] [AI GRID BOT] 매니저 ${managerEmail} 기존 주문 자동 취소 중 예외 발생:`, cancelErr.message);
      }

      const oneTimeOverride = await queries.get(`
        SELECT id, side, spend_usdt, dry_run
        FROM manager_one_time_trade_tests
        WHERE LOWER(manager_email) = LOWER(?)
          AND status = 'PENDING'
          AND UPPER(side) = ?
        ORDER BY id ASC
        LIMIT 1
      `, [managerEmail, decision]);

      const tradePlan = buildTradePlan({
        decision,
        proposedPrice,
        amountRatio,
        balances: balanceRes.balances,
        lower: manager.ai_grid_lower,
        upper: manager.ai_grid_upper,
        count: manager.ai_grid_count,
        oneTimeOverride
      });
      side = tradePlan.side;
      amount = tradePlan.amount;

      if (!tradePlan.executable) {
        await recordManagerTradeExecution({
          managerEmail,
          aiLogId,
          side: side || decision.toLowerCase(),
          amount: tradePlan.amount || 0,
          price: proposedPrice,
          status: 'SKIPPED',
          message: tradePlan.message
        });
        continue;
      }

      if (tradePlan.dryRun) {
        await recordManagerTradeExecution({
          managerEmail,
          aiLogId,
          side,
          amount,
          price: proposedPrice,
          status: 'SKIPPED',
          message: `${tradePlan.message} Would submit ${side} ${amount} SUT @ ${proposedPrice} USDT.`
        });
        if (oneTimeOverride) {
          await queries.run(`
            UPDATE manager_one_time_trade_tests
            SET status = 'USED', used_ai_log_id = ?, used_at = datetime('now')
            WHERE id = ?
          `, [aiLogId, oneTimeOverride.id]);
        }
        continue;
      }

      const orderRes = await createGateIoOrder(apiKey, apiSecret, side, amount, proposedPrice);
      if (orderRes.success) {
        await recordManagerTradeExecution({
          managerEmail,
          aiLogId,
          side,
          amount,
          price: proposedPrice,
          status: 'SUCCESS',
          gateioOrderId: orderRes.data && orderRes.data.id ? String(orderRes.data.id) : '',
          message: 'Server auto trade order submitted.'
        });
      } else {
        await recordManagerTradeExecution({
          managerEmail,
          aiLogId,
          side,
          amount,
          price: proposedPrice,
          status: 'FAILED',
          message: orderRes.message || 'Gate.io order failed.'
        });
      }
    } catch (err) {
      await recordManagerTradeExecution({
        managerEmail,
        aiLogId,
        side: side || decision.toLowerCase(),
        amount,
        price: proposedPrice,
        status: 'FAILED',
        message: err.message
      });
    }
  }
}

async function runAiGridBot() {
  console.log(`[🤖 AI GRID BOT] =======================================`);
  console.log(`[🤖 AI GRID BOT] 글로벌 시황 분석 스케줄러 실행 중... (시간: ${new Date().toLocaleString()})`);

  try {
    const dbSettings = await queries.all("SELECT key, value FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key', 'global_ai_interval', 'ai_grid_status', 'global_ai_engine', 'global_ai_interval_auto')");
    let globalModel = 'Gemini 1.5 Pro';
    let globalApiKey = '';
    let globalAiInterval = 5;
    let aiStatus = 'OFF';
    let aiEngineMode = 'GEMINI_ONLY';
    let intervalAuto = 'OFF';

    dbSettings.forEach(s => {
      if (s.key === 'global_ai_model') globalModel = s.value;
      if (s.key === 'global_gemini_api_key') globalApiKey = s.value;
      if (s.key === 'global_ai_interval') {
        globalAiInterval = Math.max(1, Math.min(60, parseInt(s.value, 10) || 5));
      }
      if (s.key === 'ai_grid_status') aiStatus = s.value;
      if (s.key === 'global_ai_engine') aiEngineMode = s.value;
      if (s.key === 'global_ai_interval_auto') intervalAuto = s.value;
    });

    const activeManagerRow = await queries.get("SELECT COUNT(*) AS total FROM manager_ai_settings WHERE ai_grid_status = 'ON'");
    const hasActiveManager = activeManagerRow && activeManagerRow.total > 0;

    if (aiStatus !== 'ON' && !hasActiveManager) {
      console.log(`[🤖 AI GRID BOT] 활성화된 매니저 AI 봇이 없습니다. 분석을 일시 중단합니다.`);
      return;
    }

    if (!globalApiKey && aiEngineMode !== 'AIS_ONLY') {
      console.warn(`[🤖 AI GRID BOT] 경고: 어드민 페이지에 글로벌 Gemini API Key가 등록되지 않았습니다.`);
      return;
    }

    // 2. 보조지표 계산을 위한 가격 히스토리 데이터 채우기 및 계산
    if (global.priceHistory.length < 20) {
      const pastLogs = await queries.all("SELECT proposed_price FROM manager_ai_logs ORDER BY created_at DESC LIMIT 30");
      if (pastLogs && pastLogs.length > 0) {
        const prices = pastLogs.map(l => l.proposed_price).reverse();
        global.priceHistory = [...prices, ...global.priceHistory].slice(-30);
      }
    }

    const currentSutPrice = await getSutCurrentPrice();
    const observedAtKst = toKstSqliteTimestamp();
    try {
      const labelResult = await labelDueTrainingRows(
        queries,
        observedAtKst,
        currentSutPrice
      );
      if (labelResult.labeled > 0) {
        console.log(`[AI GRID BOT] Labeled ${labelResult.labeled} due AiS observations.`);
      }
    } catch (labelError) {
      console.error('[AI GRID BOT] Failed to label due AiS observations:', labelError.message);
    }

    global.priceHistory.push(currentSutPrice);
    if (global.priceHistory.length > 30) {
      global.priceHistory.shift();
    }

    // 변동성 기반 동적 주기 연산
    if (intervalAuto === 'ON' && global.priceHistory.length >= 5) {
      const recentPrices = global.priceHistory.slice(-10); // 최근 최대 10개
      const maxPrice = Math.max(...recentPrices);
      const minPrice = Math.min(...recentPrices);
      if (minPrice > 0) {
        const volRatio = (maxPrice - minPrice) / minPrice;
        let newInterval = 15;
        if (volRatio >= 0.03) {
          newInterval = 5;
        } else if (volRatio >= 0.01) {
          newInterval = 15;
        } else {
          newInterval = 30;
        }

        if (newInterval !== globalAiInterval) {
          console.log(`[🤖 AI GRID BOT] 변동성 감지 동적 주기 변경: ${globalAiInterval}분 -> ${newInterval}분 (변동률: ${(volRatio * 100).toFixed(2)}%)`);
          globalAiInterval = newInterval;
          await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_interval', ?)", [newInterval.toString()]);
        }
      }
    }

    const rsi14 = calculateRSI(global.priceHistory, 14);
    const sma5 = calculateSMA(global.priceHistory, 5);
    const sma20 = calculateSMA(global.priceHistory, 20);
    const priceChangeRatio = global.priceHistory.length >= 2 
      ? ((currentSutPrice - global.priceHistory[global.priceHistory.length - 2]) / global.priceHistory[global.priceHistory.length - 2]) * 100 
      : 0.0;

    let yieldPercent = ((currentSutPrice - 0.15) / 0.15) * 100;
    try {
      const tickerRes = await axios.get('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SUT_USDT', { timeout: 3000 });
      if (tickerRes.data && tickerRes.data.length > 0 && tickerRes.data[0].change_percentage !== undefined) {
        yieldPercent = parseFloat(tickerRes.data[0].change_percentage);
      }

      await queries.run(`
        INSERT INTO manager_yield_history (yield_percent)
        VALUES (?)
      `, [parseFloat(yieldPercent.toFixed(2))]);

      await queries.run(`
        DELETE FROM manager_yield_history
        WHERE id NOT IN (
          SELECT id FROM manager_yield_history
          ORDER BY recorded_at DESC
          LIMIT 200
        )
      `);
    } catch (yieldErr) {
      // Bypassed yield error logging
    }

    let stats24h = { minPrice: currentSutPrice, maxPrice: currentSutPrice, avgPrice: currentSutPrice };
    try {
      const past24hData = await queries.all(`
        SELECT current_price FROM ais_training_data 
        WHERE timestamp >= datetime('now', '-24 hours') 
        ORDER BY timestamp ASC
      `);
      if (past24hData && past24hData.length > 0) {
        const prices = past24hData.map(d => d.current_price);
        stats24h.minPrice = Math.min(...prices);
        stats24h.maxPrice = Math.max(...prices);
        stats24h.avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      }
    } catch (dbErr) {
      console.error("[-] 24h stats query error in gridBot:", dbErr.message);
    }

    const marketData = {
      priceHistory: global.priceHistory,
      currentPrice: currentSutPrice,
      rsi14,
      sma5,
      sma20,
      priceChangeRatio,
      stats24h
    };

    let aiResult;
    if (aiEngineMode === 'AIS_ONLY') {
      console.log(`[🤖 AI GRID BOT] AiS 독자 로컬 모델 시황 분석 요청 중...`);
      aiResult = await getAiSTradingDecision(currentSutPrice, rsi14, sma5, sma20, priceChangeRatio);
      if (!aiResult.success) {
        console.warn(`[🤖 AI GRID BOT] AiS 추론 실패로 Gemini 모델로 임시 우회합니다. Error: ${aiResult.error}`);
        aiResult = await getAiTradingDecision(globalApiKey, globalModel, marketData);
      }
    } else if (aiEngineMode === 'HYBRID_COOP') {
      console.log(`[🤖 AI GRID BOT] Gemini + AiS 공동 합의 매매 분석 진행 중...`);
      try {
        const [geminiRes, aisRes] = await Promise.all([
          getAiTradingDecision(globalApiKey, globalModel, marketData),
          getAiSTradingDecision(currentSutPrice, rsi14, sma5, sma20, priceChangeRatio)
        ]);

        if (geminiRes.success && aisRes.success) {
          if (geminiRes.decision === aisRes.decision) {
            aiResult = {
              success: true,
              decision: geminiRes.decision,
              reason: `[Gemini+AiS 공동 합의 일치 - ${geminiRes.decision}] 양 모델의 의사결정이 일치하여 거래를 속행합니다.\n- Gemini 근거: ${geminiRes.reason}\n- AiS 근거: ${aisRes.reason}`,
              price: geminiRes.price,
              amount_ratio: geminiRes.amount_ratio,
              proposed_lower: geminiRes.proposed_lower,
              proposed_upper: geminiRes.proposed_upper
            };
          } else {
            aiResult = {
              success: true,
              decision: 'HOLD',
              reason: `[Gemini+AiS 공동 합의] 양 모델의 의견이 달라 자산 보호를 위해 관망(HOLD) 조치되었습니다.\n- Gemini: [${geminiRes.decision}] ${geminiRes.reason}\n- AiS: [${aisRes.decision}] ${aisRes.reason}`,
              price: currentSutPrice,
              amount_ratio: 0.1,
              proposed_lower: proposedLower,
              proposed_upper: proposedUpper
            };
          }
        } else {
          console.warn(`[-] 공동 매매 중 하나가 실패하였습니다. Gemini 결과를 우선으로 적용합니다. (Gemini: ${geminiRes.success}, AiS: ${aisRes.success})`);
          aiResult = geminiRes.success ? geminiRes : { success: false, error: '공동 분석 실패' };
        }
      } catch (coopErr) {
        console.error("[-] 공동 합의 분석 중 심각한 오류 발생:", coopErr.message);
        aiResult = { success: false, error: coopErr.message };
      }
    } else {
      console.log(`[🤖 AI GRID BOT] Gemini (${globalModel}) 글로벌 시황 분석 요청 중...`);
      aiResult = await getAiTradingDecision(globalApiKey, globalModel, marketData);
    }

    if (!aiResult.success) {
      console.error(`[🤖 AI GRID BOT] AI 의사결정 호출 실패:`, aiResult.error);
      return;
    }

    const proposedLower = parseFloat(aiResult.proposed_lower) || 0.15;
    const proposedUpper = parseFloat(aiResult.proposed_upper) || 0.30;

    console.log(`[🤖 AI GRID BOT] 전략:`, aiResult.decision);
    console.log(`[🤖 AI GRID BOT] 근거: ${aiResult.reason}`);
    console.log(`[🤖 AI GRID BOT] 타겟 가격: ${aiResult.price} USDT / 추천 비중: ${aiResult.amount_ratio}`);
    console.log(`[🤖 AI GRID BOT] 추천 하한가/상한가: ${proposedLower} ~ ${proposedUpper} USDT`);

    try {
      const logInsert = await queries.run(`
        INSERT INTO manager_ai_logs (decision, reason, proposed_price, proposed_amount, proposed_lower, proposed_upper)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        aiResult.decision,
        aiResult.reason || '판단 근거 없음',
        parseFloat(aiResult.price) || 0,
        parseFloat(aiResult.amount_ratio) || 0.1,
        proposedLower,
        proposedUpper
      ]);

      await queries.run(`
        DELETE FROM manager_ai_logs
        WHERE id NOT IN (
          SELECT id FROM manager_ai_logs
          ORDER BY created_at DESC
          LIMIT 50
        )
      `);
      console.log(`[🤖 AI GRID BOT] 글로벌 전략 DB 저장 완료.`);

      // 1. Shadow 학습 혹은 AiS 전담 상태일 때 SQLite ais_training_data 테이블에 무제한 적재
      const autoRangeUpdated = await applyManagerAutoRangeSettings({
        queries,
        proposedLower,
        proposedUpper,
      });
      if (autoRangeUpdated > 0) {
        console.log(`[AI GRID BOT] Applied auto upper/lower range to ${autoRangeUpdated} manager setting(s).`);
      }

      if (aiEngineMode === 'GEMINI_AIS_SHADOW' || aiEngineMode === 'AIS_ONLY') {
        try {
          const evaluationDueAt = addMinutesToSqliteTimestamp(
            observedAtKst,
            globalAiInterval
          );
          
          await queries.run(`
            INSERT INTO ais_training_data (
              timestamp, current_price, price_change_ratio, rsi_14, sma_5, sma_20,
              gemini_decision, gemini_proposed_price, gemini_amount_ratio, gemini_reason,
              evaluation_due_at, evaluation_status, label_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
          `, [
            observedAtKst,
            currentSutPrice,
            parseFloat(priceChangeRatio.toFixed(4)),
            rsi14,
            parseFloat(sma5.toFixed(4)),
            parseFloat(sma20.toFixed(4)),
            aiResult.decision,
            parseFloat(aiResult.price) || 0,
            parseFloat(aiResult.amount_ratio) || 0.1,
            aiResult.reason || '판단 근거 없음',
            evaluationDueAt,
            LABEL_VERSION
          ]);
          console.log(`[🤖 AI GRID BOT] AiS 학습용 데이터셋 무제한 SQLite 적재 완료.`);
        } catch (dbTrainErr) {
          console.error("[🤖 AI GRID BOT] SQLite 학습 데이터셋 적재 오류:", dbTrainErr.message);
        }
      }

      // 💾 CSV 파일에 학습 데이터 저장 로직 추가 (호환성 보존)
      try {
        const fs = require('fs');
        const path = require('path');
        const dataDir = path.resolve(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        const csvPath = path.join(dataDir, 'ai_decisions.csv');
        const fileExists = fs.existsSync(csvPath);
        
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const escapedReason = (aiResult.reason || '판단 근거 없음')
          .replace(/"/g, '""')
          .replace(/\r?\n|\r/g, ' ');
        
        const csvLine = `"${timestamp}",${currentSutPrice},"${aiResult.decision}",${parseFloat(aiResult.price) || 0},${parseFloat(aiResult.amount_ratio) || 0.1},${proposedLower},${proposedUpper},"${escapedReason}"\n`;
        
        if (!fileExists) {
          const header = 'timestamp,current_price,decision,proposed_price,amount_ratio,proposed_lower,proposed_upper,reason\n';
          fs.writeFileSync(csvPath, header + csvLine, 'utf8');
        } else {
          fs.appendFileSync(csvPath, csvLine, 'utf8');
        }
        console.log(`[🤖 AI GRID BOT] AI 학습 데이터 CSV 저장 완료. (${csvPath})`);
      } catch (csvErr) {
        console.error("[🤖 AI GRID BOT] CSV 학습 데이터 저장 실패:", csvErr.message);
      }

      await executeServerAutoTrades(logInsert.lastID, aiResult, currentSutPrice);
    } catch (dbLogErr) {
      console.error("[🤖 AI GRID BOT] 전략 로그 저장 실패:", dbLogErr.message);
    }

    // 3. AiS 모델 백그라운드 자동 학습 트리거 검사
    try {
      const statsRow = await queries.get(
        "SELECT COUNT(*) as total FROM ais_training_data WHERE evaluation_status = 'LABELED' AND label_version = ?",
        [LABEL_VERSION]
      );
      const totalUnfilled = statsRow ? statsRow.total : 0;
      
      const lastTrainedRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'ais_last_trained_at'");
      const lastTrainedStr = lastTrainedRow ? lastTrainedRow.value : '';
      
      let shouldTrain = false;
      if (totalUnfilled >= 10) {
        if (!lastTrainedStr) {
          shouldTrain = true;
        } else {
          const lastTrainedDate = new Date(lastTrainedStr);
          const diffHours = (new Date() - lastTrainedDate) / (1000 * 60 * 60);
          if (diffHours >= 24) {
            shouldTrain = true;
          }
        }
      }

      if (shouldTrain) {
        console.log(`[🤖 AI GRID BOT] 자동 재학습 조건 만족 (데이터: ${totalUnfilled}건). 백그라운드 학습 스크립트 실행 중...`);
        const path = require('path');
        const trainScriptPath = path.join(__dirname, 'train_ais.py');
        exec(`${pythonCmd} "${trainScriptPath}"`, (trainErr, stdout, stderr) => {
          if (trainErr) {
            console.error("[-] AiS Auto-Training failed:", trainErr.message);
          } else {
            console.log("[+] AiS Auto-Training finished:", stdout.trim());
          }
        });
      }
    } catch (trainTriggerErr) {
      console.error("[-] Failed to check AiS auto-training trigger:", trainTriggerErr.message);
    }

  } catch (err) {
    console.error(`❌ [🤖 AI GRID BOT] 실행 중 심각한 예외 발생:`, err.message);
  }
}

function initGridBotScheduler() {
  console.log(`[🤖 AI GRID BOT] AI 엔진 중앙 스케줄러 마운트 완료 (동적 주기 적용)`);

  const scheduleNext = async () => {
    if (global.gridBotTimeout) {
      clearTimeout(global.gridBotTimeout);
      global.gridBotTimeout = null;
    }

    try {
      await runAiGridBot();

      // --- Daily Evolution Check ---
      try {
        const lastEvolutionRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'last_evolution_time'");
        let lastEvo = 0;
        if (lastEvolutionRow && lastEvolutionRow.value) {
          lastEvo = parseInt(lastEvolutionRow.value, 10);
        }
        const now = Date.now();
        // 24 hours
        if (now - lastEvo > 24 * 60 * 60 * 1000) {
          await runDailyEvolution();
          await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('last_evolution_time', ?)", [now.toString()]);
        }
      } catch (err) {
        console.error("[🧬 AI EVOLUTION ERROR]", err.message);
      }
      // -----------------------------
    } catch (e) {
      console.error("[🤖 AI GRID BOT] 실행 중 에러:", e);
    }

    let intervalMinutes = 5;
    try {
      const setting = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_interval'");
      if (setting && !isNaN(parseInt(setting.value))) {
        intervalMinutes = parseInt(setting.value);
      }
    } catch (dbErr) {
      console.error("[🤖 AI GRID BOT] 인터벌 설정 읽기 실패:", dbErr.message);
    }

    intervalMinutes = Math.max(1, Math.min(60, intervalMinutes));
    const nextTickMs = intervalMinutes * 60 * 1000;

    if (global.gridBotTimeout) {
      clearTimeout(global.gridBotTimeout);
    }
    global.gridBotTimeout = setTimeout(scheduleNext, nextTickMs);
  };

  if (global.gridBotTimeout) {
    clearTimeout(global.gridBotTimeout);
  }
  global.gridBotTimeout = setTimeout(scheduleNext, 5000);
}

module.exports = {
  runAiGridBot,
  initGridBotScheduler,
  executeServerAutoTrades
};
