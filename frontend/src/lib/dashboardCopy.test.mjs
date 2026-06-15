import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { DASHBOARD_COPY } from './dashboardCopy.js';

assert.deepEqual(DASHBOARD_COPY, {
  managerPage: '매니저 페이지',
  adminPage: '관리자 페이지',
  assetOverview: '내 자산 현황',
  totalAssets: '총 보유 자산',
  walletBalance: '지갑 보유 잔액',
  managedAssets: '운용 자산',
  depositAction: 'SUT 입금',
  withdrawAction: 'SUT 출금 신청',
  depositAmount: '입금 수량 (SUT)',
  withdrawAmount: '출금 신청 수량 (SUT)',
  depositSubmit: '입금하기',
  withdrawSubmit: '출금 신청',
  recentTransactions: '최근 거래 내역',
  allTransactions: '전체 거래 내역',
  depositCompleted: '입금 완료',
  withdrawalPending: '출금 대기',
  noTransactions: '거래 내역이 없습니다.',
  logout: '로그아웃',
});

for (const pageFile of ['../pages/user_mobile_dashboard.jsx', '../pages/user_pc_dashboard.jsx']) {
  const source = await readFile(new URL(pageFile, import.meta.url), 'utf8');

  assert.match(source, /DASHBOARD_COPY/);
  assert.doesNotMatch(source, /Withdraw Funds|거래 히스토리|인출/);
}

console.log('ok - mobile and PC dashboards share formal financial terminology');
