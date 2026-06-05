const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_KEY = process.env.GATEIO_API_KEY;
const API_SECRET = process.env.GATEIO_API_SECRET;
const HOST = 'https://api.gateio.ws';

/**
 * Gate.io V4 API Signature 생성기
 */
function getSignature(method, urlPath, queryString, bodyStr, timestamp, secret) {
  // Body SHA512 Hash
  const bodyHash = crypto.createHash('sha512').update(bodyStr || '').digest('hex');
  
  // 서명 원본 스트링 조립
  const signatureString = `${method}\n${urlPath}\n${queryString || ''}\n${bodyHash}\n${timestamp}`;
  
  // HMAC-SHA512 서명값 생성
  return crypto.createHmac('sha512', secret || API_SECRET)
    .update(signatureString)
    .digest('hex');
}

/**
 * Gate.io V4 API 호출 공통 헬퍼
 */
async function callGateIoApi(method, urlPath, queryString = '', body = null, apiKey = null, apiSecret = null) {
  const effectiveKey = apiKey || API_KEY;
  const effectiveSecret = apiSecret || API_SECRET;

  if (!effectiveKey || !effectiveSecret) {
    return { success: false, code: 'KEY_NOT_CONFIGURED', message: 'Gate.io API 키가 설정되어 있지 않습니다.' };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = getSignature(method, urlPath, queryString, bodyStr, timestamp, effectiveSecret);

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'KEY': effectiveKey,
    'SIGN': signature,
    'Timestamp': timestamp
  };

  const url = `${HOST}${urlPath}${queryString ? '?' + queryString : ''}`;

  try {
    const config = { method, url, headers };
    if (body) config.data = body;

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (err) {
    console.error(`[Gate.io API ERROR] ${method} ${urlPath}:`, err.response ? err.response.data : err.message);
    return { 
      success: false, 
      code: 'API_ERROR', 
      message: err.response && err.response.data && err.response.data.label ? err.response.data.message : err.message 
    };
  }
}

/**
 * 1. 거래소 현물 계정의 SUT 및 USDT 가용 잔고 조회
 */
async function getGateIoBalances(apiKey = null, apiSecret = null) {
  const result = await callGateIoApi('GET', '/api/v4/spot/accounts', '', null, apiKey, apiSecret);
  if (!result.success) {
    return result;
  }

  // SUT 및 USDT 잔고 파싱
  const balances = { SUT: 0.0, USDT: 0.0 };
  if (Array.isArray(result.data)) {
    result.data.forEach(acc => {
      if (acc.currency === 'SUT') {
        balances.SUT = parseFloat(acc.available) + parseFloat(acc.locked);
      } else if (acc.currency === 'USDT') {
        balances.USDT = parseFloat(acc.available) + parseFloat(acc.locked);
      }
    });
  }

  return { success: true, balances };
}

/**
 * 2. 실제 SUT 매수/매도 주문 전송 (지정가 제한 주문 기본 적용)
 * @param {string} apiKey
 * @param {string} apiSecret
 * @param {string} side 'buy' 또는 'sell'
 * @param {number|string} amount 주문 수량 (SUT 개수)
 * @param {number|string} price 주문 가격 (USD/USDT 단가)
 */
async function createGateIoOrder(apiKey = null, apiSecret = null, side = 'sell', amount = '0.1', price = '0.19') {
  const orderBody = {
    currency_pair: 'SUT_USDT',
    type: 'limit',
    side: side.toLowerCase(),
    amount: amount.toString(),
    price: price.toString(),
    time_in_force: 'gtc'
  };

  return await callGateIoApi('POST', '/api/v4/spot/orders', '', orderBody, apiKey, apiSecret);
}

/**
 * 3. SUT_USDT 거래소 체결 내역(Order History / Trades) 조회
 * @param {string} apiKey
 * @param {string} apiSecret
 */
async function getGateIoMyTrades(apiKey = null, apiSecret = null) {
  // SUT_USDT 페어의 최근 체결 이력 조회
  const queryString = 'currency_pair=SUT_USDT';
  return await callGateIoApi('GET', '/api/v4/spot/my_trades', queryString, null, apiKey, apiSecret);
}

module.exports = {
  getGateIoBalances,
  createGateIoOrder,
  getGateIoMyTrades
};


