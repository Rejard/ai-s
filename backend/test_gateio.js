const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SUT_USDT');
    console.log(res.data);
  } catch (e) {
    console.error(e.message);
  }
}
test();
