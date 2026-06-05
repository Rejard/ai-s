const axios = require('axios');
const { queries } = require('./database');
const { createGateIoOrder, getGateIoBalances } = require('./gateioHelper');
const { decryptText } = require('./secureCredentials');
const { buildTradePlan } = require('./autoTradeMath');

// Real-time SUT price history memory storage (Holds last 10 prices)
if (!global.priceHistory) {
  global.priceHistory = [];
}

/**
 * Retrieve SUT real-time price using Gate.io Public API
 */
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

/**
 * Request global market strategy judgment using Gemini API
 */
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

[DECISION RULE]
1. decision: "BUY", "SELL", or "HOLD".
2. reason: Detail your market analysis and reason in Korean.
3. price: Target execution price in USDT. For BUY, recommend a price <= current price (capitalizing on dips). For SELL, recommend a price >= current price.
4. amount_ratio: A number between 0.1 and 0.5 representing the recommended proportion of assets to trade (e.g., 0.1 means 10%).

You must respond in structured JSON format ONLY. Do not output markdown code blocks.
Response JSON schema:
{
  "decision": "BUY" | "SELL" | "HOLD",
  "reason": "Detail explanation for the decision in Korean",
  "price": number,
  "amount_ratio": number
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

async function executeServerAutoTrades(aiLogId, aiResult) {
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

/**
 * AI Grid Bot core execution loop function (Centralized analysis engine)
 */
async function runAiGridBot() {
  console.log(`[🤖 AI GRID BOT] =======================================`);
  console.log(`[🤖 AI GRID BOT] 글로벌 시황 분석 스케줄러 실행 중... (시간: ${new Date().toLocaleString()})`);

  try {
    // 1. Load global Admin AI settings
    const dbSettings = await queries.all("SELECT key, value FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key', 'ai_grid_status')");
    let globalModel = 'Gemini 1.5 Pro';
    let globalApiKey = '';
    let aiStatus = 'OFF';

    dbSettings.forEach(s => {
      if (s.key === 'global_ai_model') globalModel = s.value;
      if (s.key === 'global_gemini_api_key') globalApiKey = s.value;
      if (s.key === 'ai_grid_status') aiStatus = s.value;
    });

    const activeManagerRow = await queries.get("SELECT COUNT(*) AS total FROM manager_ai_settings WHERE ai_grid_status = 'ON'");
    const hasActiveManager = activeManagerRow && activeManagerRow.total > 0;

    if (aiStatus !== 'ON' && !hasActiveManager) {
      console.log(`[🤖 AI GRID BOT] 활성화된 매니저 AI 봇이 없습니다. 분석을 일시 중단합니다.`);
      return;
    }

    if (!globalApiKey) {
      console.warn(`[🤖 AI GRID BOT] 경고: 어드민 페이지에 글로벌 Gemini API Key가 등록되지 않았습니다.`);
      return;
    }

    // 2. Retrieve real-time SUT current price and update history
    const currentSutPrice = await getSutCurrentPrice();
    global.priceHistory.push(currentSutPrice);
    if (global.priceHistory.length > 10) {
      global.priceHistory.shift();
    }

    // 3. Calculate global profitability (Reference standard profitability)
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
      // ignore
    }

    // 4. Call Gemini decision-making
    const marketData = {
      priceHistory: global.priceHistory,
      currentPrice: currentSutPrice
    };

    console.log(`[🤖 AI GRID BOT] Gemini (${globalModel}) 글로벌 시황 분석 요청 중...`);
    const aiResult = await getAiTradingDecision(globalApiKey, globalModel, marketData);
    
    if (!aiResult.success) {
      console.error(`[🤖 AI GRID BOT] AI 의사결정 호출 실패:`, aiResult.error);
      return;
    }

    console.log(`[🤖 AI GRID BOT] 전략:`, aiResult.decision);
    console.log(`[🤖 AI GRID BOT] 근거: ${aiResult.reason}`);
    console.log(`[🤖 AI GRID BOT] 타겟 가격: ${aiResult.price} USDT / 추천 비중: ${aiResult.amount_ratio}`);

    // 5. Save AI judgment log to DB (Manager locally retrieves and executes this data individually)
    try {
      const logInsert = await queries.run(`
        INSERT INTO manager_ai_logs (decision, reason, proposed_price, proposed_amount)
        VALUES (?, ?, ?, ?)
      `, [
        aiResult.decision,
        aiResult.reason || '판단 근거 없음',
        parseFloat(aiResult.price) || 0,
        parseFloat(aiResult.amount_ratio) || 0.1  // Save amount_ratio to proposed_amount column
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
      await executeServerAutoTrades(logInsert.lastID, aiResult);
    } catch (dbLogErr) {
      console.error("[🤖 AI GRID BOT] 전략 로그 저장 실패:", dbLogErr.message);
    }

  } catch (err) {
    console.error(`❌ [🤖 AI GRID BOT] 실행 중 심각한 예외 발생:`, err.message);
  }
}

/**
 * Bot scheduler timer mount module (Dynamic interval applied)
 */
function initGridBotScheduler() {
  console.log(`[🤖 AI GRID BOT] AI 엔진 중앙 스케줄러 마운트 완료 (동적 주기 적용)`);
  
  // After initial execution, a recursive function that schedules its next execution time
  const scheduleNext = async () => {
    try {
      await runAiGridBot();
    } catch (e) {
      console.error("[🤖 AI GRID BOT] 실행 중 에러:", e);
    }

    // After execution completion, read the configured interval (minutes) from DB
    let intervalMinutes = 5; // Default value 5 minutes
    try {
      const setting = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_interval'");
      if (setting && !isNaN(parseInt(setting.value))) {
        intervalMinutes = parseInt(setting.value);
      }
    } catch (dbErr) {
      console.error("[🤖 AI GRID BOT] 인터벌 설정 읽기 실패:", dbErr.message);
    }

    // Limited to a minimum of 1 minute and a maximum of 60 minutes
    intervalMinutes = Math.max(1, Math.min(60, intervalMinutes));
    const nextTickMs = intervalMinutes * 60 * 1000;
    
    // console.log(`[🤖 AI Grid Bot] The next analysis will be executed ${intervalMinutes} minutes later.`);
    setTimeout(scheduleNext, nextTickMs);
  };

  // Start first execution 5 seconds after server boot
  setTimeout(scheduleNext, 5000);
}

module.exports = {
  runAiGridBot,
  initGridBotScheduler,
  executeServerAutoTrades
};
