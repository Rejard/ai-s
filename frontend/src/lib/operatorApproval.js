const OPERATOR_ADDRESS = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';
const SUT_CONTRACT_ADDRESS = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
const POLYGON_RPC = 'https://polygon-bor-rpc.publicnode.com';
const POLYGON_CHAIN_ID = '0x89';

export async function checkOperatorAllowance({ walletAddress, ethersLib }) {
  const provider = new ethersLib.JsonRpcProvider(POLYGON_RPC, 137);
  const sutRead = new ethersLib.Contract(
    SUT_CONTRACT_ADDRESS,
    ['function allowance(address owner, address spender) view returns (uint256)'],
    provider
  );
  const checksumWallet = ethersLib.getAddress(walletAddress.toLowerCase());
  const allowance = await sutRead.allowance(checksumWallet, OPERATOR_ADDRESS);
  return allowance > 0n;
}

export async function approveOperator({ ethersLib }) {
  if (!window.ethereum) {
    throw new Error('Trust Wallet 브라우저 확장이 필요합니다.');
  }
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== POLYGON_CHAIN_ID) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: POLYGON_CHAIN_ID }] });
    } catch (switchErr) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: POLYGON_CHAIN_ID,
          chainName: 'Polygon Mainnet',
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          rpcUrls: [POLYGON_RPC],
          blockExplorerUrls: ['https://polygonscan.com']
        }]
      });
    }
  }
  let signer;
  try {
    const browserProvider = new ethersLib.BrowserProvider(window.ethereum);
    signer = await browserProvider.getSigner();
    await signer.provider.getBlockNumber();
  } catch (rpcErr) {
    const fallbackProvider = new ethersLib.JsonRpcProvider(POLYGON_RPC, 137);
    const browserProvider = new ethersLib.BrowserProvider(window.ethereum);
    const walletSigner = await browserProvider.getSigner();
    signer = walletSigner.connect(fallbackProvider);
  }
  const sutContract = new ethersLib.Contract(
    SUT_CONTRACT_ADDRESS,
    ['function approve(address spender, uint256 value) public returns (bool)'],
    signer
  );
  const tx = await sutContract.approve(OPERATOR_ADDRESS, ethersLib.parseUnits('1000000', 18));
  await tx.wait(1);
  return tx;
}
