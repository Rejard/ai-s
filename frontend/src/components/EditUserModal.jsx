import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  Check,
  Mail,
  Phone,
  Save,
  ShieldAlert,
  User,
  Wallet,
  X,
  Loader2,
  Copy,
} from 'lucide-react';
import { API_BASE } from '../App';
import { formatKoreanDateTime } from '../lib/dateTime';
import { buildAuthHeaders } from '../lib/authSession';

const EMPTY_FORM = {
  walletAddress: '',
  email: '',
  name: '',
  phone: '',
  country: '',
  status: '',
};

function EditUserModal({ 
  walletAddress, 
  managerEmail, 
  onClose, 
  onSuccess,
  isManagerEdit = false,
  onDeleteManager,
  submittingDelete = null,
  targetEmail = ''
}) {
  const [targetWallet, setTargetWallet] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [currentInvested, setCurrentInvested] = useState(0);
  const [userWithdrawals, setUserWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState(null);
  const [managerBalances, setManagerBalances] = useState({
    gateio: { SUT: 0.0, USDT: 0.0 },
    gateioConnected: false,
    gateioError: null,
    onchain: 0.0,
    vault: 0.0
  });

  const headers = {
    headers: {
      ...buildAuthHeaders(),
      'x-manager-email': managerEmail || 'lemaiiisk@gmail.com',
    },
  };

  const loadUser = async () => {
    if (isManagerEdit && (!targetEmail || targetEmail === 'null' || targetEmail === 'undefined')) {
      return;
    }
    setLoading(true);
    try {
      if (isManagerEdit) {
        const detailRes = await axios.get(`${API_BASE}/admin/manager-detail/${targetEmail}`, {
          headers: {
            ...buildAuthHeaders(),
            'x-admin-email': 'lemaiiisk@gmail.com'
          }
        });

        if (!detailRes.data.success || !detailRes.data.manager) {
          throw new Error('매니저 정보를 불러오는 데 실패했습니다.');
        }

        const manager = detailRes.data.manager;
        setTargetWallet(manager.wallet_address || '');
        setFormData({
          walletAddress: manager.wallet_address || '',
          email: manager.email || '',
          name: manager.name || '',
          phone: manager.phone || '',
          country: manager.country || '',
          status: 'APPROVED',
        });

        setManagerBalances(detailRes.data.balances);
        setCurrentInvested(detailRes.data.balances.vault || 0);
        setUserWithdrawals([]);
      } else {
        const usersResponse = await axios.get(`${API_BASE}/manager/users`, headers);
        const user = (usersResponse.data.users || []).find(
          (item) => 
            (item.email && item.email.toLowerCase() === walletAddress?.toLowerCase()) ||
            (item.wallet_address && item.wallet_address.toLowerCase() === walletAddress?.toLowerCase())
        );

        if (!user) {
          throw new Error('선택한 회원을 찾을 수 없습니다.');
        }

        setTargetWallet(user.wallet_address || '');
        setFormData({
          walletAddress: user.wallet_address || '',
          email: user.email || '',
          name: user.name || '',
          phone: user.phone || '',
          country: user.country || '',
          status: user.status || 'PENDING_KYC',
        });

        const hasWallet = user.wallet_address && user.wallet_address !== 'none';
        const [portfolioResult, withdrawalsResult] = await Promise.allSettled([
          hasWallet ? axios.get(`${API_BASE}/investment/portfolio/${user.wallet_address}`) : Promise.resolve({ data: { success: true, portfolio: {} } }),
          axios.get(`${API_BASE}/manager/withdrawals`, headers),
        ]);

        if (portfolioResult.status === 'fulfilled' && portfolioResult.value.data?.success) {
          setCurrentInvested(Number(portfolioResult.value.data.portfolio?.totalInvested) || 0);
        }

        if (withdrawalsResult.status === 'fulfilled' && withdrawalsResult.value.data?.success) {
          setUserWithdrawals(
            (withdrawalsResult.value.data.withdrawals || []).filter(
              (request) => 
                (request.wallet_address && user.wallet_address && request.wallet_address.toLowerCase() === user.wallet_address.toLowerCase()) ||
                (request.email && user.email && request.email.toLowerCase() === user.email.toLowerCase())
            )
          );
        }
      }

    } catch (error) {
      alert(`회원 정보를 불러오지 못했습니다: ${error.response?.data?.error || error.message}`);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, [walletAddress, managerEmail, targetEmail]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const confirmMessage = isManagerEdit 
      ? '입력한 내용으로 매니저 정보를 수정하시겠습니까?' 
      : '입력한 내용으로 회원 정보를 수정하시겠습니까?';
    if (!confirm(confirmMessage)) return;

    setSubmitting(true);
    try {
      let response;
      if (isManagerEdit) {
        response = await axios.post(`${API_BASE}/admin/update-manager`, {
          targetEmail: targetEmail,
          walletAddress: formData.walletAddress.trim(),
          email: formData.email.trim(),
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          country: formData.country.trim(),
        }, {
          headers: {
            ...buildAuthHeaders(),
            'x-admin-email': 'lemaiiisk@gmail.com'
          }
        });
      } else {
        response = await axios.post(`${API_BASE}/manager/update-user`, {
          targetEmail: walletAddress,
          targetWalletAddress: targetWallet,
          walletAddress: formData.walletAddress.trim(),
          email: formData.email.trim(),
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          country: formData.country.trim(),
          status: formData.status,
        }, headers);
      }

      if (!response.data.success) {
        throw new Error(response.data.error || response.data.message || '정보 수정에 실패했습니다.');
      }

      alert(response.data.message || '수정되었습니다.');
      await onSuccess?.();
      onClose();
    } catch (error) {
      alert(`수정 실패: ${error.response?.data?.error || error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawal = async (request, action) => {
    const isApproval = action === 'approve';
    let body = {};

    if (isApproval) {
      const amount = prompt('실제 지급한 SUT 수량을 입력해 주세요.', request.requested_amount);
      if (amount === null) return;
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        alert('올바른 지급 수량을 입력해 주세요.');
        return;
      }
      body = { actualPayoutAmount: Number(amount) };
    } else if (!confirm(`${request.requested_amount} SUT 지급 요청을 반려하시겠습니까?`)) {
      return;
    }

    setProcessingWithdrawalId(request.id);
    try {
      const response = await axios.post(
        `${API_BASE}/manager/withdrawals/${request.id}/${action}`,
        body,
        headers
      );
      if (!response.data.success) throw new Error(response.data.error || '처리에 실패했습니다.');
      alert(response.data.message || '지급 요청이 처리되었습니다.');
      await loadUser();
      await onSuccess?.();
    } catch (error) {
      alert(`지급 요청 처리 실패: ${error.response?.data?.error || error.message}`);
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="회원 정보 수정"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="app-frame"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '22px',
          background: 'var(--bg-app)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ margin: 0, color: '#F9FAFB', fontSize: '20px' }}>회원 정보 수정</h2>
            <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '11px' }}>
              회원 기본정보, 연결 지갑과 KYC 상태를 관리합니다.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ border: 0, background: 'transparent', color: '#9CA3AF', cursor: 'pointer', padding: '4px' }}>
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            회원 정보를 불러오는 중입니다.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            {isManagerEdit && (
              <div className="glass-card" style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', color: '#E5E7EB', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📊 매니저 실시간 자산 현황
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Gate.io 거래소 잔고</span>
                      <span style={{ 
                        fontSize: '9px', 
                        color: managerBalances.gateioConnected ? 'var(--success-color)' : 'var(--warning-color)',
                        display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700'
                      }}>
                        <span style={{ 
                          width: '6px', height: '6px', borderRadius: '50%', 
                          background: managerBalances.gateioConnected ? 'var(--success-color)' : 'var(--warning-color)',
                          display: 'inline-block' 
                        }} />
                        {managerBalances.gateioConnected ? 'API 연결됨' : '연동 대기/설정 없음'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 'bold' }}>{managerBalances.gateio.SUT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SUT</div>
                      <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{managerBalances.gateio.USDT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>개인 지갑 SUT (온체인)</div>
                    <div style={{ fontSize: '14px', color: 'var(--success-color)', fontWeight: 'bold', height: '100%', display: 'flex', alignItems: 'center' }}>
                      {managerBalances.onchain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SUT
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>회원 총 운용 자산 (볼트)</div>
                    <div style={{ fontSize: '14px', color: '#FFF', fontWeight: 'bold', height: '100%', display: 'flex', alignItems: 'center' }}>
                      {managerBalances.vault.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SUT
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="glass-card" style={{ padding: '14px', display: 'flex', gap: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
              <span style={{ color: '#FBBF24', fontSize: '11px', lineHeight: 1.5 }}>
                지갑 주소 변경 시 연결된 거래 원장에도 영향을 줍니다. 변경 전 주소를 다시 확인해 주세요.
              </span>
            </div>

            <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
              <Field icon={<User size={14} />} label="성명" name="name" value={formData.name} onChange={handleChange} />
              <Field icon={<Mail size={14} />} label="이메일" name="email" type="email" value={formData.email} onChange={handleChange} />
              <Field icon={<Phone size={14} />} label="연락처" name="phone" value={formData.phone} onChange={handleChange} />
              <Field label="국가" name="country" value={formData.country} onChange={handleChange} />
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <Wallet size={14} /> Polygon 지갑 주소
                  </span>
                  {formData.walletAddress && formData.walletAddress !== 'none' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(formData.walletAddress);
                          alert('지갑 주소가 클립보드에 복사되었습니다.');
                        } catch (err) {
                          alert('복사에 실패했습니다. 직접 복사해 주세요.');
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(139, 92, 246, 0.85)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        transition: 'background 0.2s',
                        fontWeight: '500',
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.1)'}
                      onMouseLeave={(e) => e.target.style.background = 'none'}
                    >
                      <Copy size={11} /> 복사하기
                    </button>
                  )}
                </span>
                <input
                  name="walletAddress"
                  value={formData.walletAddress}
                  onChange={handleChange}
                  required
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldAlert size={14} /> KYC 상태</span>
                <select name="status" value={formData.status} onChange={handleChange} style={inputStyle}>
                  <option value="PENDING_KYC">심사 대기 (PENDING_KYC)</option>
                  <option value="APPROVED">승인 (APPROVED)</option>
                  <option value="REJECTED">반려 (REJECTED)</option>
                </select>
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.07)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>현재 운용 잔액</span>
                <strong style={{ color: '#F3F4F6' }}>{currentInvested.toFixed(2)} SUT</strong>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ margin: 0, color: '#F59E0B', fontSize: '13px' }}>회원 지급 요청</h3>
              {userWithdrawals.length === 0 ? (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '11px' }}>
                  지급 요청이 없습니다.
                </div>
              ) : userWithdrawals.map((request) => (
                <div key={request.id} style={{ padding: '10px', borderRadius: '10px', background: 'rgba(0, 0, 0, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: '#F3F4F6', fontSize: '12px' }}>{request.requested_amount} SUT</strong>
                    <div style={{ color: 'var(--text-dark)', fontSize: '9px', marginTop: '3px' }}>{formatKoreanDateTime(request.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="btn-primary" disabled={processingWithdrawalId === request.id} onClick={() => handleWithdrawal(request, 'approve')} style={{ width: 'auto', padding: '6px 10px', fontSize: '10px', background: 'var(--success-color)' }}>
                      <Check size={12} /> 승인
                    </button>
                    <button type="button" className="btn-primary" disabled={processingWithdrawalId === request.id} onClick={() => handleWithdrawal(request, 'reject')} style={{ width: 'auto', padding: '6px 10px', fontSize: '10px', background: 'var(--danger-color)' }}>
                      <X size={12} /> 반려
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {isManagerEdit && targetWallet.toLowerCase() !== '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase() && (
              <div className="glass-card" style={{ padding: '16px', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.03)' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#FCA5A5', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🚨 위험 관리 영역 (Danger Zone)
                </h4>
                <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: '1.4' }}>
                  이 매니저의 계정을 시스템에서 영구히 삭제하고, 해당 산하 회원들을 최상위 마스터 매니저 관리 하로 안전하게 강제 이관 처리합니다. 이 작업은 되돌릴 수 없습니다.
                </p>
                <button
                  type="button"
                  disabled={submittingDelete === targetWallet}
                  onClick={async () => {
                    if (confirm(`정말로 매니저 ${formData.name}의 계정을 영구 삭제하고 소속 회원들을 마스터 매니저에게 이관하시겠습니까?`)) {
                      try {
                        await onDeleteManager?.(targetWallet, formData.name);
                        onClose();
                      } catch (err) {
                        alert(`매니저 이관 실패: ${err.message}`);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '12px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#FCA5A5',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {submittingDelete === targetWallet ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <>계정 영구 삭제 및 소속 회원 전체 이관</>
                  )}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ width: 'auto', padding: '10px 18px' }}>취소</button>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ width: 'auto', padding: '10px 18px' }}>
                <Save size={16} /> {submitting ? '저장 중...' : '변경사항 저장'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '9px',
  background: 'rgba(0, 0, 0, 0.25)',
  color: '#F3F4F6',
  outline: 'none',
  boxSizing: 'border-box',
};

function Field({ icon, label, monospace = false, type = 'text', ...inputProps }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{icon}{label}</span>
      <input
        {...inputProps}
        type={type}
        required
        style={{ ...inputStyle, fontFamily: monospace ? 'monospace' : 'inherit' }}
      />
    </label>
  );
}

export default EditUserModal;
