const TRUST_WALLET_UA = /TrustWallet/i;
const SAMSUNG_BROWSER_UA = /SamsungBrowser/i;
const IOS_SAFARI_UA = /Safari/i;
const CHROME_IOS_UA = /CriOS/i;
const FIREFOX_IOS_UA = /FxiOS/i;
const IOS_DEVICE_UA = /iPhone|iPad|iPod/i;

export function detectUnsupportedBrowser(userAgent = '', ethereum) {
  const ua = String(userAgent || '');

  if (TRUST_WALLET_UA.test(ua) || ethereum) {
    return { supported: true, browserName: '', reason: '' };
  }

  if (SAMSUNG_BROWSER_UA.test(ua)) {
    return {
      supported: false,
      browserName: '삼성 인터넷',
      reason: '삼성 인터넷 브라우저는 블록체인 지갑 연동을 지원하지 않습니다.',
    };
  }

  if (
    IOS_DEVICE_UA.test(ua) &&
    IOS_SAFARI_UA.test(ua) &&
    !CHROME_IOS_UA.test(ua) &&
    !FIREFOX_IOS_UA.test(ua)
  ) {
    return {
      supported: false,
      browserName: 'Safari',
      reason: 'iOS Safari 브라우저는 블록체인 지갑 연동을 지원하지 않습니다.',
    };
  }

  return { supported: true, browserName: '', reason: '' };
}
