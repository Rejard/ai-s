import {
  buildTrustWalletOpenUrl,
  resolveWalletTransactionProvider,
} from './walletProvider.js';
import {
  approveSutWithdrawalPermission,
  waitForSuccessfulApproval,
} from './sutApproval.js';

export const APPROVAL_RECOVERY_SEARCH_PARAM = 'recover_sut_approval';

function isMobileUserAgent(userAgent = '') {
  return /iPhone|iPad|iPod|Android/i.test(userAgent);
}

function normalizeAddress(address = '') {
  return String(address).trim().toLowerCase();
}

export function buildApprovalRecoveryResumeUrl(currentUrl) {
  const url = new URL(currentUrl);
  url.searchParams.set(APPROVAL_RECOVERY_SEARCH_PARAM, '1');
  return url.toString();
}

export function hasApprovalRecoveryResumeFlag(currentUrl) {
  const url = new URL(currentUrl);
  return url.searchParams.get(APPROVAL_RECOVERY_SEARCH_PARAM) === '1';
}

export async function executeSutApprovalFlow({
  ethereum,
  currentUrl,
  userAgent,
  expectedWalletAddress,
  alertFn = () => {},
  confirmFn = () => false,
  setLocationHref = () => {},
  approveFn = approveSutWithdrawalPermission,
  waitFn = waitForSuccessfulApproval,
  buildOpenUrlFn = buildTrustWalletOpenUrl,
  resolveProviderFn = resolveWalletTransactionProvider,
  allowRedirectOnMissingWallet = true,
  onApproved,
} = {}) {
  try {
    if (expectedWalletAddress) {
      const provider = await resolveProviderFn({ ethereum });
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const activeAddress = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : '';

      if (normalizeAddress(activeAddress) !== normalizeAddress(expectedWalletAddress)) {
        alertFn('현재 Trust Wallet 활성 지갑이 AiS 가입 지갑과 다릅니다. 가입에 사용한 지갑으로 전환한 뒤 다시 위임 복구를 진행해 주세요.');
        return {
          status: 'wallet_mismatch',
          activeAddress,
          expectedWalletAddress,
        };
      }
    }

    alertFn('Trust Wallet에서 Polygon SUT 인출 승인 서명을 진행해 주세요.');

    const tx = await approveFn({ ethereum });

    alertFn('승인 트랜잭션을 전송했습니다. Polygon 블록체인 확인을 기다립니다.');
    await waitFn(tx);

    if (typeof onApproved === 'function') {
      onApproved();
    }

    alertFn('Polygon SUT 인출 승인이 다시 등록되었습니다.');
    return { status: 'approved', tx };
  } catch (err) {
    if (err?.message === 'NO_TRUST_WALLET') {
      if (
        allowRedirectOnMissingWallet &&
        isMobileUserAgent(userAgent) &&
        confirmFn('Trust Wallet 앱에서 현재 페이지를 다시 열어 승인 위임을 진행할까요?')
      ) {
        const resumeUrl = buildApprovalRecoveryResumeUrl(currentUrl);
        setLocationHref(buildOpenUrlFn(resumeUrl));
        return { status: 'redirected', resumeUrl };
      }

      alertFn('Trust Wallet이 연결되지 않았습니다. Trust Wallet Dapp 브라우저에서 AiS를 다시 열어 주세요.');
      return { status: 'wallet_missing' };
    }

    if (err?.code === 'INSUFFICIENT_POL_FOR_GAS') {
      alertFn('Polygon 메인넷 승인 수수료용 POL이 부족합니다. 지갑에 POL을 충전한 뒤 다시 시도해 주세요.');
      return { status: 'insufficient_pol' };
    }

    if (err?.code === 'APPROVAL_TX_REVERTED') {
      alertFn('승인 트랜잭션이 체인에서 실패했습니다. Polygon 네트워크와 POL 잔액을 확인한 뒤 다시 시도해 주세요.');
      return { status: 'reverted' };
    }

    if (err?.code === 'ACTION_REJECTED' || err?.message?.includes('rejected')) {
      alertFn('지갑에서 승인 서명이 취소되었습니다.');
      return { status: 'rejected' };
    }

    alertFn(`SUT 승인 처리 중 오류가 발생했습니다: ${err?.message || err}`);
    return { status: 'error', error: err };
  }
}
