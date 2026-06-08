const TRUST_RDNS = ['com.trustwallet.app', 'com.trustwallet.browser-extension'];
const POLYGON_COIN_ID = 966;

const eip6963Providers = [];

// Bypass window listener setup when window is undefined in node.js test environment
if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (event) => {
    if (!eip6963Providers.some((p) => p.info.uuid === event.detail.info.uuid)) {
      eip6963Providers.push(event.detail);
    }
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

export function getInjectedProviders(ethereum) {
  const eipProviders = eip6963Providers.map((p) => p.provider);
  let legacyProviders = [];
  if (ethereum) {
    if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
      legacyProviders = ethereum.providers;
    } else {
      legacyProviders = [ethereum];
    }
  }
  return Array.from(new Set([...eipProviders, ...legacyProviders]));
}

export function findTrustWalletProvider(providers) {
  const foundEip = eip6963Providers.find((p) => {
    const rdns = p.info?.rdns?.toLowerCase();
    return TRUST_RDNS.includes(rdns);
  });
  if (foundEip) return foundEip.provider;

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
  return findTrustWalletProvider(providers);
}

export async function resolveWalletTransactionProvider({
  ethereum,
}) {
  const provider = getPreferredInjectedProvider(ethereum);
  if (provider) return provider;

  throw new Error('NO_TRUST_WALLET');
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

export function buildTrustWalletOpenUrl(targetUrl) {
  return `trust://open_url?coin_id=${POLYGON_COIN_ID}&url=${encodeURIComponent(targetUrl)}`;
}
