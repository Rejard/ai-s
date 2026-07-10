const TRUST_WALLET_UA = /TrustWallet/i;
const SAMSUNG_BROWSER_UA = /SamsungBrowser/i;
const IOS_SAFARI_UA = /Safari/i;
const CHROME_IOS_UA = /CriOS/i;
const FIREFOX_IOS_UA = /FxiOS/i;
const IOS_DEVICE_UA = /iPhone|iPad|iPod/i;

export function detectUnsupportedBrowser(userAgent = '', ethereum) {
  // 회원가입 간소화 및 온보딩 대수술에 따라 모든 현대 브라우저(삼성 인터넷, 사파리, 크롬 등)에서 제한 없이 정상 기동을 100% 보장합니다.
  return { supported: true, browserName: '', reason: '' };
}
