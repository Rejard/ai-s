import React from 'react';
import { Users, Receipt, ExternalLink } from 'lucide-react';
import { formatKoreanDateTime } from '../lib/dateTime';
import ManagerManagementSection from '../components/ManagerManagementSection';
import ManagerSelfDepositHistory from '../components/ManagerSelfDepositHistory';

function ManagerMembersTab({
  pendingUsers,
  withdrawals,
  stats,
  submittingId,
  allUsers,
  recentPayments,
  managerRecentPayments,
  syncing,
  handleApprove,
  handleReject,
  handleApproveWithdrawal,
  handleRejectWithdrawal,
  handleDownloadIdCard,
  hasDownloadedId,
  handleSyncTransactions,
  setSelectedIdCard,
  setEditingUserWallet,
  API_BASE
}) {
  const MASTER_WALLET = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ManagerManagementSection
        pendingUsers={pendingUsers}
        withdrawals={withdrawals}
        stats={stats}
        submittingId={submittingId}
        handleApprove={handleApprove}
        handleReject={handleReject}
        handleApproveWithdrawal={handleApproveWithdrawal}
        handleRejectWithdrawal={handleRejectWithdrawal}
        setSelectedIdCard={setSelectedIdCard}
        API_BASE={API_BASE}
        handleDownloadIdCard={handleDownloadIdCard}
        hasDownloadedId={hasDownloadedId}
      />

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', color: '#F3F4F6', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={18} color="#8B5CF6" />
            최근 자산 예치/정산 내역
          </h3>
          <button
            type="button"
            className="btn-primary"
            disabled={syncing}
            onClick={handleSyncTransactions}
            style={{
              width: 'auto',
              padding: '6px 12px',
              fontSize: '11px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '700',
              color: '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: 'none'
            }}
          >
            {syncing ? '🔄 동기화 중...' : '🔄 거래 동기화'}
          </button>
        </div>

        {recentPayments.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            현재까지 플랫폼을 통해 발생한 예치 및 정산 내역이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', scrollbarWidth: 'none' }}>
            {recentPayments.map((pay) => (
              <div
                key={pay.id}
                style={{
                  background: 'rgba(0,0,0,0.15)',
                  border: '1px solid rgba(255,255,255,0.02)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#F3F4F6' }}>
                    {pay.name} ({pay.type === 'WITHDRAW_REQUEST' ? '지급 요청 정상 처리' : (pay.type === 'DEPOSIT' ? '자산 예치' : '수익 정산 배분')})
                  </div>
                  {pay.tx_hash && pay.tx_hash.length === 66 && pay.tx_hash.startsWith('0x') ? (
                    <a
                      href={`https://polygonscan.com/tx/${pay.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '9px', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                    >
                      TX: {pay.tx_hash.substring(0, 10)}... <ExternalLink size={8} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                      내부 수동 처리 (TX: {pay.tx_hash ? pay.tx_hash.substring(0, 16) : 'N/A'}...)
                    </span>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: pay.type === 'WITHDRAW_REQUEST' ? 'var(--danger-color)' : 'var(--success-color)' }}>
                    {pay.type === 'WITHDRAW_REQUEST' ? `-${pay.amount}` : `+${pay.amount}`} SUT
                  </div>
                  <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>
                    {pay.type === 'WITHDRAW_REQUEST' ? '지급 완료' : (pay.type === 'DEPOSIT' ? '예치 완료' : '수익 배분 완료')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ManagerSelfDepositHistory
        payments={managerRecentPayments}
        totalDeposited={stats?.managerSelfDeposited || 0}
        isMobile
      />

      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
          <Users size={18} color="#10B981" />
          전체 회원 명부 ({allUsers.length}명)
        </h3>

        {allUsers.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            등록된 플랫폼 회원이 존재하지 않습니다.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', scrollbarWidth: 'thin' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '650px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '11px' }}>
                  <th style={{ padding: '10px 8px' }}>이름 (국가)</th>
                  <th style={{ padding: '10px 8px' }}>이메일 / 연락처</th>
                  <th style={{ padding: '10px 8px' }}>지갑 주소</th>
                  <th style={{ padding: '10px 8px' }}>회원 상태</th>
                  <th style={{ padding: '10px 8px' }}>가입일</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user) => {
                  const isMaster = user.wallet_address && user.wallet_address.toLowerCase() === MASTER_WALLET.toLowerCase();
                  return (
                    <tr
                      key={user.id}
                      onClick={() => setEditingUserWallet(user.email)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        fontSize: '11px',
                        color: '#E5E7EB',
                        background: isMaster ? 'rgba(139,92,246,0.06)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isMaster ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isMaster ? 'rgba(139,92,246,0.06)' : 'transparent'}
                    >
                      <td style={{ padding: '12px 8px', fontWeight: '600' }}>
                        <span style={{ color: isMaster ? '#C084FC' : '#FFF' }}>{user.name}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>({user.country})</span>
                        {isMaster && (
                          <span style={{ marginLeft: '6px', background: 'rgba(139,92,246,0.2)', color: '#C084FC', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: '800' }}>Master</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div>{user.email}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-dark)' }}>{user.phone}</div>
                      </td>
                      <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '10px', color: '#A7F3D0' }}>
                        {user.wallet_address ? (
                          `${user.wallet_address.substring(0, 10)}...${user.wallet_address.substring(user.wallet_address.length - 8)}`
                        ) : (
                          <span style={{ fontStyle: 'italic', color: 'var(--text-dark)' }}>지갑 없음</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '9px',
                          fontWeight: '700',
                          background: user.status === 'APPROVED' ? 'rgba(139,92,246,0.12)' : user.status === 'PENDING_KYC' ? 'rgba(59,130,246,0.12)' : 'rgba(156,163,175,0.12)',
                          color: user.status === 'APPROVED' ? '#C084FC' : user.status === 'PENDING_KYC' ? '#60A5FA' : '#9CA3AF'
                        }}>
                          {user.status === 'APPROVED' ? '정회원' : user.status === 'PENDING_KYC' ? '승인대기' : '반려됨'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-dark)', fontSize: '9px' }}>
                        {formatKoreanDateTime(user.joined_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManagerMembersTab;
