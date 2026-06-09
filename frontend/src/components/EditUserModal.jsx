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
} from 'lucide-react';
import { API_BASE } from '../App';
import { formatKoreanDateTime } from '../lib/dateTime';

const EMPTY_FORM = {
  walletAddress: '',
  email: '',
  name: '',
  phone: '',
  country: '',
  status: '',
};

function EditUserModal({ walletAddress, managerEmail, onClose, onSuccess }) {
  const [targetWallet, setTargetWallet] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [currentInvested, setCurrentInvested] = useState(0);
  const [userWithdrawals, setUserWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState(null);

  const headers = {
    headers: {
      'x-manager-email': managerEmail || 'lemaiiisk@gmail.com',
    },
  };

  const loadUser = async () => {
    setLoading(true);
    try {
      const usersResponse = await axios.get(`${API_BASE}/manager/users`, headers);
      const user = (usersResponse.data.users || []).find(
        (item) => item.wallet_address?.toLowerCase() === walletAddress?.toLowerCase()
      );

      if (!user) {
        throw new Error('선택한 회원을 찾을 수 없습니다.');
      }

      setTargetWallet(user.wallet_address);
      setFormData({
        walletAddress: user.wallet_address || '',
        email: user.email || '',
        name: user.name || '',
        phone: user.phone || '',
        country: user.country || '',
        status: user.status || 'PENDING_KYC',
      });

      const [portfolioResult, withdrawalsResult] = await Promise.allSettled([
        axios.get(`${API_BASE}/investment/portfolio/${user.wallet_address}`),
        axios.get(`${API_BASE}/manager/withdrawals`, headers),
      ]);

      if (portfolioResult.status === 'fulfilled' && portfolioResult.value.data.success) {
        setCurrentInvested(Number(portfolioResult.value.data.portfolio?.totalInvested) || 0);
      }

      if (withdrawalsResult.status === 'fulfilled' && withdrawalsResult.value.data.success) {
        setUserWithdrawals(
          (withdrawalsResult.value.data.withdrawals || []).filter(
            (request) => request.wallet_address?.toLowerCase() === user.wallet_address.toLowerCase()
          )
        );
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
  }, [walletAddress, managerEmail]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!confirm('입력한 내용으로 회원 정보를 수정하시겠습니까?')) return;

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/manager/update-user`, {
        targetWalletAddress: targetWallet,
        walletAddress: formData.walletAddress.trim(),
        email: formData.email.trim(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        country: formData.country.trim(),
        status: formData.status,
      }, headers);

      if (!response.data.success) {
        throw new Error(response.data.error || '회원 정보 수정에 실패했습니다.');
      }

      alert(response.data.message || '회원 정보가 수정되었습니다.');
      await onSuccess?.();
      onClose();
    } catch (error) {
      alert(`회원 정보 수정 실패: ${error.response?.data?.error || error.message}`);
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
              <Field icon={<Wallet size={14} />} label="Polygon 지갑 주소" name="walletAddress" value={formData.walletAddress} onChange={handleChange} monospace />
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
