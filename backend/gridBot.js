const axios = require('axios');
const { queries } = require('./database');
const { 
  getGateIoBalances, 
  createGateIoOrder, 
  getGateIoOpenOrders, 
  cancelGateIoOrder 
} = require('./gateioHelper');

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
 * Gemini API를 사용하여 실시간 트레이딩 판단(의사결정) 요청
 * @param {string} apiKey Gemini API Key
 * @param {string} modelName Gemini Model Name
 * @param {object} marketData 시황 데이터 및 가이드라인
 */
async function getAiTradingDecision(apiKey, modelName, marketData) {
  let modelId = 'gemini-1.5-flash';
  const lowerName = modelName.toLowerCase();
  if (lowerName.includes('pro')) {
    modelId = 'gemini-1.5-pro';
  } else if (lowerName.includes('2.0')) {
    modelId = 'gemini-2.0-flash';
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const promptText = `
You are an advanced AI crypto trading bot managing spot assets of SUT/USDT pair.
Based on the following real-time market data and guidelines, make a smart trading decision.

[MARKET DATA & WALLET BALANCES]
- Recent SUT Price Trend (Last 10 updates, older to newer): ${JSON.stringify(marketData.priceHistory)} USDT
- Current SUT Price: ${marketData.currentPrice} USDT
- Manager's Available SUT Balance: ${marketData.sutBalance} SUT
- Manager's Available USDT Balance: ${marketData.usdtBalance} USDT

[MANAGER'S SAFETY BOUNDARY (GARDRAIL)]
- Lower Price Boundary: ${marketData.lowerLimit} USDT (Do not buy SUT if price is below this or too close to it without safety, and never buy SUT above this range. Basically, this is the floor price range where you should consider buying SUT safely.)
- Upper Price Boundary: ${marketData.upperLimit} USDT (Do not sell SUT below this range. Consider this the target ceiling price range where you should sell SUT for profit realization.)

[DECISION RULE]
1. If you decide to BUY SUT:
   - "decision" must be "BUY".
   - The proposed buy "price" must be within the safety boundary and close to the lower limit, or capitalizing on a dip. It must be <= ${marketData.lowerLimit} USDT (or near it).
   - "amount" (SUT count) must be affordable with the current USDT balance: (price * amount) <= ${marketData.usdtBalance} USDT.
2. If you decide to SELL SUT:
   - "decision" must be "SELL".
   - The proposed sell "price" must be >= the current SUT price, and ideally near or above ${marketData.upperLimit} USDT.
   - "amount" (SUT count) to sell must be <= ${marketData.sutBalance} SUT.
3. If market is uncertain or there is insufficient balance, choose "HOLD".
   - "decision" must be "HOLD".
   - "price" must be 0, "amount" must be 0.

You must respond in structured JSON format ONLY. Do not output markdown code blocks.
Response JSON schema:
{
  "decision": "BUY" | "SELL" | "HOLD",
  "reason": "Detail explanation for the decision in Korean",
  "price": number,
  "amount": number
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
 * AI 그리드 봇 코어 실행 루프 함수
 */
async function runAiGridBot() {
  console.log(`[🤖 AI GRID BOT] =======================================`);
  console.log(`[🤖 AI GRID BOT] 스케줄러 감시 루프 실행 중... (시간: ${new Date().toLocaleString()})`);

  try {
    // 1. 글로벌 어드민 AI 설정 로드 (Gemini API Key)
    const dbSettings = await queries.all("SELECT key, value FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key')");
    let globalModel = 'Gemini 1.5 Pro';
    let globalApiKey = '';

    dbSettings.forEach(s => {
      if (s.key === 'global_ai_model') globalModel = s.value;
      if (s.key === 'global_gemini_api_key') globalApiKey = s.value;
    });

    if (!globalApiKey) {
      console.warn(`[🤖 AI GRID BOT] 경고: 어드민 페이지에 글로벌 Gemini API Key가 등록되지 않았습니다. 가동을 스킵합니다.`);
      return;
    }

    // 2. 실시간 SUT 현재가 조회 및 히스토리 업데이트
    const currentSutPrice = await getSutCurrentPrice();
    global.priceHistory.push(currentSutPrice);
    if (global.priceHistory.length > 10) {
      global.priceHistory.shift(); // 최대 최근 10개만 유지
    }

    // 3. AI 그리드 오토 봇이 활성화(ON)된 매니저 데이터 로드
    // 플랫폼 세팅에서 ai_grid_status가 'ON'인 설정 파악
    const activeBotRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'ai_grid_status'");
    if (!activeBotRow || activeBotRow.value !== 'ON') {
      console.log(`[🤖 AI GRID BOT] 봇 작동 상태가 OFF입니다. 감시를 일시 중단합니다.`);
      return;
    }

    // 매니저들의 SUT 가이드라인 및 로컬 저장된 API 설정 로드
    const managerSettings = await queries.all("SELECT key, value FROM platform_settings WHERE key LIKE 'ai_grid_%' OR key LIKE 'gateio_%'");
    const botConfig = {
      lower: 0.12,
      upper: 0.35,
      apiKey: '',
      apiSecret: ''
    };

    managerSettings.forEach(s => {
      if (s.key === 'ai_grid_lower') botConfig.lower = parseFloat(s.value);
      if (s.key === 'ai_grid_upper') botConfig.upper = parseFloat(s.value);
      if (s.key === 'gateio_api_key') botConfig.apiKey = s.value;
      if (s.key === 'gateio_api_secret') botConfig.apiSecret = s.value;
    });

    if (!botConfig.apiKey || !botConfig.apiSecret) {
      console.warn(`[🤖 AI GRID BOT] 경고: 매니저 대시보드에 Gate.io API 키 및 주소가 서버 DB에 등록되어 있지 않습니다. 오토 봇 매매를 생략합니다.`);
      return;
    }

    // 4. 매니저의 Gate.io 실시간 잔고 조회
    const balanceRes = await getGateIoBalances(botConfig.apiKey, botConfig.apiSecret);
    if (!balanceRes.success) {
      console.error(`[🤖 AI GRID BOT] Gate.io 잔고 조회 실패:`, balanceRes.message);
      return;
    }
    const { SUT: sutBalance, USDT: usdtBalance } = balanceRes.balances;
    console.log(`[🤖 AI GRID BOT] 가용 자산 상태 -> SUT: ${sutBalance.toFixed(2)} SUT / USDT: ${usdtBalance.toFixed(2)} USDT`);

    // 5. Gemini 의사결정 호출
    const marketData = {
      priceHistory: global.priceHistory,
      currentPrice: currentSutPrice,
      sutBalance,
      usdtBalance,
      lowerLimit: botConfig.lower,
      upperLimit: botConfig.upper
    };

    console.log(`[🤖 AI GRID BOT] Gemini (${globalModel}) 의사결정 요청 중...`);
    const aiResult = await getAiTradingDecision(globalApiKey, globalModel, marketData);
    
    if (!aiResult.success) {
      console.error(`[🤖 AI GRID BOT] AI 의사결정 호출 실패:`, aiResult.error);
      return;
    }

    console.log(`[🤖 AI GRID BOT] AI 판단 결과:`, aiResult.decision);
    console.log(`[🤖 AI GRID BOT] AI 판단 근거: ${aiResult.reason}`);
    console.log(`[🤖 AI GRID BOT] AI 추천 주문 -> 가격: ${aiResult.price} USDT / 수량: ${aiResult.amount} SUT`);

    if (aiResult.decision === 'HOLD') {
      console.log(`[🤖 AI GRID BOT] AI가 관망(HOLD)을 추천하여 추가 주문을 생성하지 않습니다.`);
      return;
    }

    // 6. 가드레일 유효성 검증
    const proposedPrice = parseFloat(aiResult.price);
    const proposedAmount = parseFloat(aiResult.amount);

    if (isNaN(proposedPrice) || proposedPrice <= 0 || isNaN(proposedAmount) || proposedAmount <= 0) {
      console.warn(`[🤖 AI GRID BOT] AI의 제안 가격/수량이 비정상적입니다. 취소합니다.`);
      return;
    }

    // 6-1. 하한선/상한선 가드레일 필터 검증
    if (aiResult.decision === 'BUY' && proposedPrice > botConfig.upper) {
      console.warn(`[🤖 AI GRID BOT] 위험 감지: AI가 설정된 상한선(${botConfig.upper})보다 높은 가격에 매수를 요청했습니다. 안전 가드레일에 의해 차단되었습니다.`);
      return;
    }
    if (aiResult.decision === 'SELL' && proposedPrice < botConfig.lower) {
      console.warn(`[🤖 AI GRID BOT] 위험 감지: AI가 설정된 하한선(${botConfig.lower})보다 낮은 가격에 매도를 요청했습니다. 안전 가드레일에 의해 차단되었습니다.`);
      return;
    }

    // 6-2. 잔고 안전 필터 검증
    if (aiResult.decision === 'BUY' && (proposedPrice * proposedAmount) > usdtBalance) {
      console.warn(`[🤖 AI GRID BOT] 한도 초과: AI 매수 요청액(${(proposedPrice * proposedAmount).toFixed(2)} USDT)이 보유한 USDT 잔고(${usdtBalance.toFixed(2)} USDT)를 초과합니다.`);
      return;
    }
    if (aiResult.decision === 'SELL' && proposedAmount > sutBalance) {
      console.warn(`[🤖 AI GRID BOT] 수량 부족: AI 매도 요청량(${proposedAmount} SUT)이 보유한 SUT 잔고(${sutBalance.toFixed(2)} SUT)를 초과합니다.`);
      return;
    }

    // 7. 기존 미체결 주문 일괄 취소 (Re-balancing 모델 적용)
    console.log(`[🤖 AI GRID BOT] 기존 SUT_USDT 미체결 주문 조회를 수행합니다.`);
    const openOrdersRes = await getGateIoOpenOrders(botConfig.apiKey, botConfig.apiSecret);
    if (openOrdersRes.success && Array.isArray(openOrdersRes.data)) {
      console.log(`[🤖 AI GRID BOT] 미체결 주문 ${openOrdersRes.data.length}건 감지. 일괄 취소를 시작합니다.`);
      for (const order of openOrdersRes.data) {
        const cancelRes = await cancelGateIoOrder(botConfig.apiKey, botConfig.apiSecret, order.id);
        if (cancelRes.success) {
          console.log(`✔ [🤖 AI GRID BOT] 미체결 주문 ID: ${order.id} 취소 완료.`);
        } else {
          console.error(`❌ [🤖 AI GRID BOT] 주문 ID: ${order.id} 취소 실패:`, cancelRes.message);
        }
      }
    }

    // 8. 신규 AI 실거래 주문 전송
    console.log(`[🤖 AI GRID BOT] 신규 AI 지정가 주문 전송 격발 ➡️ 방향: ${aiResult.decision} / 가격: ${proposedPrice} / 수량: ${proposedAmount}`);
    const orderRes = await createGateIoOrder(
      botConfig.apiKey, 
      botConfig.apiSecret, 
      aiResult.decision.toLowerCase(), 
      proposedAmount, 
      proposedPrice
    );

    if (orderRes.success) {
      console.log(`🎉 [🤖 AI GRID BOT] AI 오토 봇 지정가 주문이 Gate.io 거래소에 정상 체결/대기 등록 완료되었습니다.`);
      console.log(`🎉 [🤖 AI GRID BOT] 주문 세부 정보 -> ID: ${orderRes.data.id} / 가격: ${orderRes.data.price} / 수량: ${orderRes.data.amount}`);
      
      // 거래소 주문 성공 이력을 플랫폼 payments에 기록 (시뮬레이션 통계용)
      try {
        await queries.run(`
          INSERT INTO payments (wallet_address, amount, type, status, tx_hash, distributed_amount)
          VALUES ('0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987', ?, ?, 'SUCCESS', ?, 0)
        `, [
          proposedPrice * proposedAmount, 
          `AI_${aiResult.decision}_BOT`, 
          `GATEIO_ORDER_${orderRes.data.id}`
        ]);
      } catch (dbErr) {
        console.error("[🤖 AI GRID BOT] DB 로그 기록 실패:", dbErr.message);
      }
    } else {
      console.error(`❌ [🤖 AI GRID BOT] 신규 주문 전송 실패:`, orderRes.message);
    }

  } catch (err) {
    console.error(`❌ [🤖 AI GRID BOT] 오토 봇 실행 중 심각한 예외 발생:`, err.message);
  }
}

/**
 * 봇 스케줄러 타이머 마운트 모듈
 */
function initGridBotScheduler() {
  // 5분 간격 = 5 * 60 * 1000 = 300000ms
  // 테스트 및 디버깅 편의를 위해 일단 기동 시 즉시 1회 기동하고, 이후 5분 주기로 감시 가동
  setTimeout(runAiGridBot, 5000); // 서버 부트스트랩 완료 5초 후에 첫 가동
  
  const botInterval = setInterval(runAiGridBot, 300000);
  console.log(`[🤖 AI GRID BOT] AI 트레이딩 백그라운드 엔진 스케줄러 마운트 완료 (주기: 5분)`);
}

module.exports = {
  runAiGridBot,
  initGridBotScheduler
};
