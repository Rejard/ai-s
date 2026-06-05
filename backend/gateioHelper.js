const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_KEY = process.env.GATEIO_API_KEY;
const API_SECRET = process.env.GATEIO_API_SECRET;
const HOST = 'https://api.gateio.ws';

/**
 * Gate.io V4 API Signature Generator
 */
function getSignature(method, urlPath, queryString, bodyStr, timestamp, secret) {
  // Body SHA512 Hash
  const bodyHash = crypto.createHash('sha512').update(bodyStr || '').digest('hex');
  
  // Assemble signature original string
  const signatureString = `${method}\n${urlPath}\n${queryString || ''}\n${bodyHash}\n${timestamp}`;
  
  // Generate HMAC-SHA512 signature value
  return crypto.createHmac('sha512', secret || API_SECRET)
    .update(signatureString)
    .digest('hex');
}

/**
 * Gate.io V4 API Call common helper
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
 * 1. Query SUT and USDT available balance of exchange spot account
 */
async function getGateIoBalances(apiKey = null, apiSecret = null) {
  const result = await callGateIoApi('GET', '/api/v4/spot/accounts', '', null, apiKey, apiSecret);
  if (!result.success) {
    return result;
  }

  // Parse SUT and USDT balances
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
 * 2. Send actual SUT buy/sell orders (Limit order applied by default)
 * @param {string} apiKey
 * @param {string} apiSecret
 * @param {string} side 'buy' or 'sell'
 * @param {number|string} amount Order quantity (Number of SUT)
 * @param {number|string} price Order price (USD/USDT unit price)
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
 * 3. Retrieve SUT_USDT Exchange Transaction History (Order History / Trades)
 * @param {string} apiKey
 * @param {string} apiSecret
 */
async function getGateIoMyTrades(apiKey = null, apiSecret = null) {
  // Retrieve recent transaction history for SUT_USDT pair
  const queryString = 'currency_pair=SUT_USDT';
  return await callGateIoApi('GET', '/api/v4/spot/my_trades', queryString, null, apiKey, apiSecret);
}

/**
 * 4. Retrieve SUT_USDT Open Orders
 */
async function getGateIoOpenOrders(apiKey = null, apiSecret = null) {
  const queryString = 'status=open&currency_pair=SUT_USDT';
  return await callGateIoApi('GET', '/api/v4/spot/orders', queryString, null, apiKey, apiSecret);
}

/**
 * 5. Cancel a specific SUT_USDT order (Cancel Order)
 */
async function cancelGateIoOrder(apiKey = null, apiSecret = null, orderId) {
  const queryString = 'currency_pair=SUT_USDT';
  return await callGateIoApi('DELETE', `/api/v4/spot/orders/${orderId}`, queryString, null, apiKey, apiSecret);
}

module.exports = {
  getGateIoBalances,
  createGateIoOrder,
  getGateIoMyTrades,
  getGateIoOpenOrders,
  cancelGateIoOrder
};


