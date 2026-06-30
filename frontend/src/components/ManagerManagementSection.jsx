import React from 'react';
import { ShieldAlert, Receipt, Eye, Check, X, Users } from 'lucide-react';
import { formatKoreanDateTime } from '../lib/dateTime';

function ManagerManagementSection({
  pendingUsers,
  withdrawals,
  stats,
  submittingId,
  handleApprove,
  handleReject,
  handleApproveWithdrawal,
  handleRejectWithdrawal,
  setSelectedIdCard,
  API_BASE,
  handleDownloadIdCard,
  hasDownloadedId
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(139,92,246,0.08)', marginBottom: '6px' }}>
              <Users size={16} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>승인 회원 현황</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F3F4F6', marginTop: '4px' }}>
              {stats.totalApproved} <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>/ {stats.limit}</span>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(245,158,11,0.08)', marginBottom: '6px' }}>
              <ShieldAlert size={16} color="#F59E0B" />
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>가입 심사 대기</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F59E0B', marginTop: '4px' }}>
              {stats.totalPending} 명
            </div>
          </div>
        </div>
      )}

      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
          <ShieldAlert size={18} color="#F59E0B" />
          신규 가입 심사 ({pendingUsers.length}건)
        </h3>

        {pendingUsers.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            현재 새로 접수된 가입 신청이나 신원 서류 심사 대기자가 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', color: '#F3F4F6', margin: 0 }}>{user.name} ({user.country})</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>구글인증: {user.email}</span>
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>
                    {formatKoreanDateTime(user.joined_at)}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                  <div style={{ wordBreak: 'break-all' }}>지갑: <b>{user.wallet_address}</b></div>
                  <div>전화번호: {user.phone}</div>
                  {(() => {
                    const diffHours = 24 - (Date.now() - new Date(user.joined_at + 'Z').getTime()) / (1000 * 60 * 60);
                    const remainingHours = Math.max(0, Math.floor(diffHours));
                    const remainingMins = Math.max(0, Math.floor((diffHours - remainingHours) * 60));
                    const isExpired = diffHours <= 0;
                    return (
                      <div style={{ color: isExpired ? 'var(--danger-color)' : '#FCD34D', fontSize: '11px', fontWeight: 'bold', marginTop: '4px' }}>
                        {isExpired ? '⏳ 기한 만료 (자동 취소 대상)' : `⏳ 승인 기한: ${remainingHours}시간 ${remainingMins}분 남음`}
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px', gap: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#93C5FD', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    onClick={() => handleDownloadIdCard(user.id, user.name)}
                  >
                    <Eye size={12} />
                    신분증 확인
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px', gap: '4px', background: 'var(--success-color)', boxShadow: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: hasDownloadedId[user.id] ? 1 : 0.4 }}
                    onClick={() => handleApprove(user.wallet_address)}
                    disabled={submittingId === user.wallet_address || !hasDownloadedId[user.id]}
                  >
                    <Check size={12} />
                    승인
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: '40px', padding: '8px', fontSize: '11px', borderRadius: '8px', background: 'var(--danger-color)', boxShadow: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    onClick={() => handleReject(user.wallet_address)}
                    disabled={submittingId === user.wallet_address}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ border: '1px solid rgba(245, 158, 11, 0.3)' }}>
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
          <Receipt size={18} color="#F59E0B" />
          지급 요청 심사 (대기: {withdrawals.length}건)
        </h3>

        {withdrawals.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            현재 접수된 회원 지급 요청이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {withdrawals.map((req) => (
              <div key={req.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#F3F4F6' }}>{req.name} 회원의 지급 요청</div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>{formatKoreanDateTime(req.created_at)}</span>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1, background: 'rgba(16,185,129,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.1)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--success-color)' }}>지급 요청 금액</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFF' }}>{req.requested_amount} SUT</div>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', marginBottom: '15px', wordBreak: 'break-all' }}>
                  <strong>지급 지갑 주소:</strong><br />
                  <span style={{ color: '#A78BFA' }}>{req.wallet_address}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'var(--success-color)', fontSize: '12px', padding: '10px 8px', boxShadow: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    onClick={() => handleApproveWithdrawal(req.id, req.requested_amount, req.name)}
                  >
                    <Check size={14} style={{ marginRight: '4px' }} /> 지급 승인 완료
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#FCA5A5', fontSize: '12px', padding: '10px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    onClick={() => handleRejectWithdrawal(req.id, req.requested_amount, req.name)}
                  >
                    <X size={14} style={{ marginRight: '4px' }} /> 지급 요청 반려
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default ManagerManagementSection;
