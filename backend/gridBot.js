const axios = require('axios');
const { queries } = require('./database');

// 실시간 SUT 가격 히스토리 메모리 저장소 (최근 10개 가격 보유)
if (!global.priceHistory) {
  global.priceHistory = [];
}

/**
 * Gate.io Public API를 사용해 SUT 실시간 가격 조회
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
  return 0.158; // 조회 실패 시 기본 폴백 가격
}

/**
 * Gemini API를 사용하여 글로벌 시황 전략 판단 요청
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

/**
 * AI 그리드 봇 코어 실행 루프 함수 (중앙화 분석 엔진)
 */
async function runAiGridBot() {
  console.log(`[🤖 AI GRID BOT] =======================================`);
  console.log(`[🤖 AI GRID BOT] 글로벌 시황 분석 스케줄러 실행 중... (시간: ${new Date().toLocaleString()})`);

  try {
    // 1. 글로벌 어드민 AI 설정 로드
    const dbSettings = await queries.all("SELECT key, value FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key', 'ai_grid_status')");
    let globalModel = 'Gemini 1.5 Pro';
    let globalApiKey = '';
    let aiStatus = 'OFF';

    dbSettings.forEach(s => {
      if (s.key === 'global_ai_model') globalModel = s.value;
      if (s.key === 'global_gemini_api_key') globalApiKey = s.value;
      if (s.key === 'ai_grid_status') aiStatus = s.value;
    });

    if (aiStatus !== 'ON') {
      console.log(`[🤖 AI GRID BOT] 플랫폼 전체 AI 봇 상태가 OFF입니다. 분석을 일시 중단합니다.`);
      return;
    }

    if (!globalApiKey) {
      console.warn(`[🤖 AI GRID BOT] 경고: 어드민 페이지에 글로벌 Gemini API Key가 등록되지 않았습니다.`);
      return;
    }

    // 2. 실시간 SUT 현재가 조회 및 히스토리 업데이트
    const currentSutPrice = await getSutCurrentPrice();
    global.priceHistory.push(currentSutPrice);
    if (global.priceHistory.length > 10) {
      global.priceHistory.shift();
    }

    // 3. 글로벌 수익률 계산 (참고용 기준 수익률)
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

    // 4. Gemini 의사결정 호출
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

    // 5. AI 판단 로그 DB 저장 (매니저 로컬에서 이 데이터를 가져가서 개별 실행)
    try {
      await queries.run(`
        INSERT INTO manager_ai_logs (decision, reason, proposed_price, proposed_amount)
        VALUES (?, ?, ?, ?)
      `, [
        aiResult.decision,
        aiResult.reason || '판단 근거 없음',
        parseFloat(aiResult.price) || 0,
        parseFloat(aiResult.amount_ratio) || 0.1  // amount_ratio를 proposed_amount 컬럼에 저장
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
    } catch (dbLogErr) {
      console.error("[🤖 AI GRID BOT] 전략 로그 저장 실패:", dbLogErr.message);
    }

  } catch (err) {
    console.error(`❌ [🤖 AI GRID BOT] 실행 중 심각한 예외 발생:`, err.message);
  }
}

/**
 * 봇 스케줄러 타이머 마운트 모듈 (동적 간격 적용)
 */
function initGridBotScheduler() {
  console.log(`[🤖 AI GRID BOT] AI 엔진 중앙 스케줄러 마운트 완료 (동적 주기 적용)`);
  
  // 최초 1회 실행 후, 스스로 다음 실행 시간을 예약하는 재귀 함수
  const scheduleNext = async () => {
    try {
      await runAiGridBot();
    } catch (e) {
      console.error("[🤖 AI GRID BOT] 실행 중 에러:", e);
    }

    // 실행 완료 후 DB에서 설정된 인터벌(분) 읽어오기
    let intervalMinutes = 5; // 기본값 5분
    try {
      const setting = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_interval'");
      if (setting && !isNaN(parseInt(setting.value))) {
        intervalMinutes = parseInt(setting.value);
      }
    } catch (dbErr) {
      console.error("[🤖 AI GRID BOT] 인터벌 설정 읽기 실패:", dbErr.message);
    }

    // 최소 1분, 최대 60분으로 제한
    intervalMinutes = Math.max(1, Math.min(60, intervalMinutes));
    const nextTickMs = intervalMinutes * 60 * 1000;
    
    // console.log(`[🤖 AI GRID BOT] 다음 분석은 ${intervalMinutes}분 뒤에 실행됩니다.`);
    setTimeout(scheduleNext, nextTickMs);
  };

  // 서버 부트 후 5초 뒤에 첫 실행 시작
  setTimeout(scheduleNext, 5000);
}

module.exports = {
  runAiGridBot,
  initGridBotScheduler
};
