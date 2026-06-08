import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import axios from 'axios';
import { ethers } from 'ethers';
import { ArrowLeft, Save, AlertTriangle, User, Globe, Phone, Mail, Wallet, ShieldAlert, BadgeInfo } from 'lucide-react';
import { API_BASE } from '../App';
import { getPreferredInjectedProvider } from '../lib/walletProvider';

function EditUserModal({ walletAddress: paramWalletAddress, managerEmail, onClose, onSuccess }) {
  
  

  const [targetWallet, setTargetWallet] = useState('');
  const [formData, setFormData] = useState({
    walletAddress: '',
    email: '',
    name: '',
    phone: '',
    country: '',
    status: ''
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [currentInvested, setCurrentInvested] = useState(0);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [userWithdrawals, setUserWithdrawals] = useState([]);
  const [isPayingOut, setIsPayingOut] = useState(false);

  const fetchUserData = async () => {
    try {
      const headers = { headers: { 'x-manager-email': managerEmail || 'lemaiiisk@gmail.com' } };

      const res = await axios.get(`${API_BASE}/manager/users`, headers);
      if (res.data.success) {
        const user = res.data.users.find(
          (u) => u.wallet_address.toLowerCase() === paramWalletAddress.toLowerCase()
        );

        if (user) {
          setTargetWallet(user.wallet_address);

          setFormData({
            walletAddress: user.wallet_address,
            email: user.email,
            name: user.name,
            phone: user.phone,
            country: user.country,
            status: user.status
          });

          try {
            const portRes = await axios.get(`${API_BASE}/investment/portfolio/${user.wallet_address}`);
            if (portRes.data.success) {
              setCurrentInvested(portRes.data.portfolio.totalInvested);
            }
          } catch (err) {
            console.error('투자 원장 로드 실패:', err);
          }

          // 해당 회원의 대기 중 지급 요청 내역 로드
          try {
            const withdrawRes = await axios.get(`${API_BASE}/manager/withdrawals`, headers);
            if (withdrawRes.data.success) {
              const filtered = withdrawRes.data.withdrawals.filter(
                (w) => w.wallet_address.toLowerCase() === user.wallet_address.toLowerCase()
              );
              setUserWithdrawals(filtered);
            }
          } catch (err) {
            console.error('해당 회원의 지급 요청 내역 로드 실패:', err);
          }
        } else {
          alert('해당 지갑 주소의 회원을 데이터베이스에서 찾을 수 없습니다.');
          onClose();
        }
      }
    } catch (err) {
      console.error('회원 상세 정보 수신 실패:', err);
      alert('회원 데이터를 조회하는 중 오류가 발생했습니다.');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [paramWalletAddress]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirm('입력하신 회원 정보로 데이터베이스 및 온체인 구조를 강제 수정하시겠습니까?')) {
      return;
    }

    setSubmitting(true);
    try {
      const headers = { headers: { 'x-manager-email': managerEmail || 'lemaiiisk@gmail.com' } };
      const res = await axios.post(`${API_BASE}/manager/update-user`, {
        targetWalletAddress: targetWallet,
        walletAddress: formData.walletAddress,
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        country: formData.country,
        status: formData.status
      }, headers);

      if (res.data.success) {
        alert('🎉 ' + res.data.message);
        if(onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert('❌ 수정 실패: ' + errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveWithdrawal = async (id, requestedAmount, name) => {
    const actualPayoutStr = prompt(`[수동 지급 확정]\n\n${name} 회원님이 신청한 출금 신청 금액은 [${requestedAmount} SUT] 입니다.\n\n매니저님께서 출금 승인 처리하여 지급하신 금액을 메모용으로 입력해 주세요.\n(참고: 회원의 자산 장부에서는 출금 신청 원금인 ${requestedAmount} SUT가 차감 정산됩니다.)`, requestedAmount);

    if (actualPayoutStr === null) return;

    try {
      const headers = { headers: { 'x-manager-email': managerEmail || 'lemaiiisk@gmail.com' } };
      const res = await axios.post(`${API_BASE}/manager/withdrawals/${id}/approve`, {
        actualPayoutAmount: parseFloat(actualPayoutStr)
      }, headers);

      if (res.data.success) {
        alert(res.data.message);
        await fetchUserData();
      }
    } catch (err) {
      alert('지급 승인 처리 중 오류 발생: ' + err.message);
    }
  };

  const handleRejectWithdrawal = async (id, requestedAmount, name) => {
    if (!confirm(`[지급 요청 반려]\n\n정말로 ${name} 회원님의 지급 요청 [${requestedAmount} SUT]을 반려 처리하시겠습니까?\n이 작업은 즉시 반영되며 장부 원장 차감은 발생하지 않습니다.`)) {
      return;
    }

    try {
      const headers = { headers: { 'x-manager-email': managerEmail || 'lemaiiisk@gmail.com' } };
      const res = await axios.post(`${API_BASE}/manager/withdrawals/${id}/reject`, {}, headers);
      if (res.data.success) {
        alert(res.data.message);
        await fetchUserData();
      }
    } catch (err) {
      alert('지급 반려 처리 중 오류 발생: ' + err.message);
    }
  };

  const handleOnchainPayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      alert("지급할 SUT 수량을 양수로 입력해 주십시오. (예: 100)");
      return;
    }

    const amountToSend = parseFloat(payoutAmount);

    if (!confirm(`🚨 [온체인 전송 집행 경고]\n정말로 이 회원(${targetWallet})에게 [${amountToSend} SUT]를 지갑에서 전송하시겠습니까?\\n이 작업은 블록체인 트랜잭션을 실행하므로 되돌릴 수 없습니다.\\n(주의: 투자 원장 잔고는 자동으로 차감되지 않으며, 원장 차감이 필요할 경우 별도로 처리해야 합니다.)`)) {
      return;
    }

    const trustProvider = getPreferredInjectedProvider(window.ethereum);
    if (!trustProvider) {
      alert('설치된 트러스트 월렛(Trust Wallet) 브라우저 지갑을 찾을 수 없거나 잠겨 있습니다. 확장 프로그램을 설치/활성화하고 다시 시도해 주십시오.');
      return;
    }

    setIsPayingOut(true);
    try {
      const provider = new ethers.BrowserProvider(trustProvider);
      const signer = await provider.getSigner();

      const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
      const sutAbi = ["function transfer(address recipient, uint256 amount) external returns (bool)"];
      const sutContract = new ethers.Contract(sutContractAddress, sutAbi, signer);

      const parsedAmount = ethers.parseUnits(amountToSend.toString(), 18);
      const tx = await sutContract.transfer(targetWallet, parsedAmount);
      await tx.wait();

      alert(`🎉 성공적으로 ${amountToSend} SUT 온체인 실지급이 완료되었습니다!\n거래 해시(TxHash): ${tx.hash}`);
      setPayoutAmount('');
      if(onSuccess) onSuccess();
    } catch (err) {
      console.error('온체인 송금 오류:', err);
      alert('❌ 오류 발생: ' + (err.reason || err.message));
    } finally {
      setIsPayingOut(false);
    }
  };

  if (loading) {
    return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div className="app-frame" style={{ 
        width: '100%', 
        maxWidth: '600px', 
        maxHeight: '90vh', 
        overflowY: 'auto', 
        background: 'var(--bg-app)', 
        borderRadius: '20px', 
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 0 30px rgba(139, 92, 246, 0.2)',
        position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10 }}>
          <X size={24} />
        </button>
        <div style={{ padding: '20px 20px 50px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          className="btn-secondary"
          onClick={() => onClose()}
          style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={18} style={{ margin: 'auto' }} />
        </button>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '18px', color: '#F9FAFB', marginTop: '10px', fontWeight: '700', margin: 0 }}>회원 원장 정보 강제 변경</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>본사 관리자용 회원 정보 및 투자 원장 제어 시스템</span>
        </div>
      </div>

      <div className="glass-card" style={{ border: '1px solid rgba(245,158,11,0.25)', background: 'linear-gradient(135deg, rgba(20,16,45,0.6) 0%, rgba(245,158,11,0.03) 100%)', padding: '14px 16px', textAlign: 'left' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '11px', lineHeight: '1.5', color: '#FBBF24' }}>
            <strong>[운영 주의보]</strong> 지갑 주소를 수정할 시, 연계된 자산 거래 내역(`payments`) 원장 정보도 연쇄적으로 갱신됩니다. 정확한 42자리 폴리곤(Polygon) 주소 규격(0x로 시작)을 확인한 뒤 적용해 주십시오.
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', color: '#8B5CF6', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} />
            기본 인적사항 변경
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>성명</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="회원 이름"
              required
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>국가</label>
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder="예: Korea, USA"
              required
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>연락처 (전화번호)</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="예: 010-1234-5678"
              required
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>이메일 주소 (구글 연동)</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="구글 계정 이메일"
              required
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
            />
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h3 style={{ fontSize: '13px', color: '#EF4444', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={14} />
            위탁 자산 원장 수동 조정 (온체인 전송 및 장부 조정)
          </h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.05)', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>현재 회원의 예치 원금(SUT) 잔액</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFF' }}>{currentInvested.toFixed(2)} SUT</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', color: '#8B5CF6', fontWeight: '700' }}>회원 대상 온체인 전송 (SUT 송금)</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="지급할 SUT 수량 (예: 100)"
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#FFF',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleOnchainPayout}
                disabled={isPayingOut}
                style={{ width: 'auto', padding: '12px 20px', borderRadius: '8px', background: 'var(--primary-gradient)', fontSize: '12px', fontWeight: 'bold' }}
              >
                {isPayingOut ? '송금 진행 중...' : '⚡ 회원 지갑으로 SUT 전송'}
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '12px', color: '#F59E0B', fontWeight: '700' }}>회원 지급 요청</label>
            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />

            {userWithdrawals.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '12px' }}>
                대기 중인 지급 요청 건이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {userWithdrawals.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#FFF', textAlign: 'left' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>{req.requested_amount} SUT</span> 지급 요청 
                      <span style={{ fontSize: '10px', color: 'var(--text-dark)', marginLeft: '8px' }}>
                        ({new Date(req.created_at).toLocaleString()})
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: '10px', background: 'var(--success-color)', borderRadius: '6px', boxShadow: 'none', width: 'auto' }}
                        onClick={() => handleApproveWithdrawal(req.id, req.requested_amount, formData.name)}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: '10px', background: 'var(--danger-color)', borderRadius: '6px', boxShadow: 'none', width: 'auto' }}
                        onClick={() => handleRejectWithdrawal(req.id, req.requested_amount, formData.name)}
                      >
                        거절
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '8px' }}>
            💡 <strong>회원 대상 온체인 전송:</strong> 매니저의 지갑에서 회원의 블록체인 지갑({targetWallet})으로 SUT 토큰을 전송합니다. (장부의 투자 원금은 자동으로 차감되지 않습니다.)<br />
            💡 <strong>회원 지급 요청 심사:</strong> 회원이 신청한 지급 요청을 승인 또는 거절 처리합니다. 승인 시 회원의 예치 원금 장고가 신청 금액만큼 차감 정산됩니다.
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', color: '#10B981', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={14} />
            온체인 연동 주소 변경
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>폴리곤(Polygon) 블록체인 지갑 주소 (42자리)</label>
            <input
              type="text"
              name="walletAddress"
              value={formData.walletAddress}
              onChange={handleChange}
              placeholder="0x..."
              required
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '11px', fontFamily: 'monospace', color: '#FFF', outline: 'none' }}
            />
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', color: '#F59E0B', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} />
            가입 자격 및 심사 상태 관리
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>KYC 신원 심사 상태</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              style={{ background: 'var(--card-background)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
            >
              <option value="PENDING_KYC" style={{ background: '#0F1224', color: '#FFF' }}>KYC 심사 대기 (PENDING_KYC)</option>
              <option value="APPROVED" style={{ background: '#0F1224', color: '#FFF' }}>정회원 가입 승인 (APPROVED)</option>
              <option value="REJECTED" style={{ background: '#0F1224', color: '#FFF' }}>가입 신청 반려 (REJECTED)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={submitting}
          style={{ background: 'var(--primary-gradient)', fontSize: '14px', fontWeight: '700', padding: '14px', borderRadius: '12px', boxShadow: '0 0 15px rgba(139,92,246,0.3)', marginTop: '8px', gap: '6px' }}
        >
          <Save size={18} />
          {submitting ? '원장 및 정보 변경 적용 중...' : '원장 및 회원 정보 강제 변경 적용'}
        </button>

      </form></div></div></div>);
}

}
export default EditUserModal;
