const TRUST_RDNS = ['com.trustwallet.app', 'com.trustwallet.browser-extension'];
const POLYGON_COIN_ID = 966;

export function getInjectedProviders(ethereum) {
  if (!ethereum) return [];
  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    return ethereum.providers;
  }
  return [ethereum];
}

export function findTrustWalletProvider(providers) {
  return providers.find((provider) => {
    const rdns = provider?.info?.rdns?.toLowerCase();
    return Boolean(
      provider?.isTrust ||
      provider?.isTrustWallet ||
      provider?.isTrustWalletProvider ||
      provider?.isTrustWalletExtension ||
      (rdns && TRUST_RDNS.includes(rdns))
    );
  }) || null;
}

export function getPreferredInjectedProvider(ethereum) {
  const providers = getInjectedProviders(ethereum);
  return findTrustWalletProvider(providers) || providers[0] || null;
}

export function normalizeChainId(chainId) {
  if (chainId === null || chainId === undefined || chainId === '') return '';
  if (typeof chainId === 'number') return `0x${chainId.toString(16)}`;

  const value = String(chainId).trim().toLowerCase();
  if (!value) return '';

  let parsed;
  if (value.startsWith('0x')) {
    parsed = parseInt(value, 16);
  } else {
    parsed = parseInt(value, 10);
  }
  return Number.isNaN(parsed) ? '' : `0x${parsed.toString(16)}`;
}

export function isMobileChromeWithoutInjectedWallet(userAgent, ethereum) {
  const ua = userAgent || '';
  const isMobile = /android|iphone|ipad|ipod/i.test(ua);
  const isChrome = /crios|chrome/i.test(ua) && !/edg|opr|samsungbrowser/i.test(ua);
  return isMobile && isChrome && !ethereum;
}

export function buildTrustWalletOpenUrl(targetUrl) {
  return `https://link.trustwallet.com/open_url?coin_id=${POLYGON_COIN_ID}&url=${encodeURIComponent(targetUrl)}`;
}
