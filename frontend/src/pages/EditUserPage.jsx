import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ethers } from 'ethers';
import { ArrowLeft, Save, AlertTriangle, User, Globe, Phone, Mail, Wallet, ShieldAlert, BadgeInfo } from 'lucide-react';
import { API_BASE } from '../App';

function EditUserPage() {
  const { walletAddress: paramWalletAddress } = useParams();
  const navigate = useNavigate();

  const [targetWallet, setTargetWallet] = useState('');
  const [formData, setFormData] = useState({
    walletAddress: '',
    email: '',
    name: '',
    phone: '',
    country: '',
    status: '',
    tier: ''
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [currentInvested, setCurrentInvested] = useState(0);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isPayingOut, setIsPayingOut] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // API base URL and security header settings
        const headers = { headers: { 'x-manager-email': 'lemaiiisk@gmail.com' } };

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
              status: user.status,
              tier: user.tier
            });

            try {
              const portRes = await axios.get(`${API_BASE}/investment/portfolio/${user.wallet_address}`);
              if (portRes.data.success) {
                setCurrentInvested(portRes.data.portfolio.totalInvested);
              }
            } catch (err) {
              console.error('투자 원금 로드 실패:', err);
            }
          } else {
            alert('해당 지갑 주소의 회원을 데이터베이스에서 찾을 수 없습니다.');
            navigate('/manager');
          }
        }
      } catch (err) {
        console.error('회원 상세 정보 수신 실패:', err);
        alert('회원 데이터를 조회하는 중 오류가 발생했습니다.');
        navigate('/manager');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [paramWalletAddress, navigate]);

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
      const headers = { headers: { 'x-manager-email': 'lemaiiisk@gmail.com' } };
      const res = await axios.post(`${API_BASE}/manager/update-user`, {
        targetWalletAddress: targetWallet,
        walletAddress: formData.walletAddress,
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        country: formData.country,
        status: formData.status,
        tier: formData.tier
      }, headers);

      if (res.data.success) {
        alert('🎉 ' + res.data.message);
        navigate('/manager');
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

  const handleManualAdjustment = async () => {
    if (!adjustmentAmount || parseFloat(adjustmentAmount) <= 0) {
      alert("차감할 SUT 수량을 양수로 입력하세요. (예: 100)");
      return;
    }

    const amountToDeduct = parseFloat(adjustmentAmount);

    const finalAmount = amountToDeduct > 0 ? -amountToDeduct : amountToDeduct;

    if (!confirm(`정말로 이 회원의 장부 잔액을 [${amountToDeduct} SUT] 만큼 강제 차감하시겠습니까?\n이 작업은 즉시 반영되며 되돌릴 수 없습니다.`)) {
      return;
    }

    setIsAdjusting(true);
    try {
      const headers = { headers: { 'x-manager-email': 'lemaiiisk@gmail.com' } };
      const res = await axios.post(`${API_BASE}/manager/manual-adjustment`, {
        targetWallet: targetWallet,
        amount: finalAmount,
        description: '0xManualAdminPhonePayout'
      }, headers);

      if (res.data.success) {
        alert(res.data.message);
        setAdjustmentAmount('');

        const portRes = await axios.get(`${API_BASE}/investment/portfolio/${targetWallet}`);
        if (portRes.data.success) {
          setCurrentInvested(portRes.data.portfolio.totalInvested);
        }
      }
    } catch (err) {
      alert('장부 변동 오류: ' + err.message);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleOnchainPayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      alert("송금할 SUT 수량을 양수로 입력하세요. (예: 100)");
      return;
    }

    const amountToSend = parseFloat(payoutAmount);

    if (!confirm(`🚨 [온체인 실제 송금 경고]\n정말로 이 회원(${targetWallet})에게 [${amountToSend} SUT]를 실제 지갑에서 전송하시겠습니까?\n이 작업은 실제 블록체인 트랜잭션을 실행하므로 되돌릴 수 없습니다.\n(주의: 장부 잔액 차감은 동반되지 않으며, 아래의 장부 차감 패널에서 별도 처리해야 합니다.)`)) {
      return;
    }

    if (!window.ethereum) {
      alert('설치된 메타마스크 혹은 트러스트월렛 브라우저 지갑을 찾을 수 없습니다.');
      return;
    }

    setIsPayingOut(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
      const sutAbi = ["function transfer(address recipient, uint256 amount) external returns (bool)"];
      const sutContract = new ethers.Contract(sutContractAddress, sutAbi, signer);

      const parsedAmount = ethers.parseUnits(amountToSend.toString(), 18);

      const tx = await sutContract.transfer(targetWallet, parsedAmount);

      await tx.wait();

      alert(`🎉 성공적으로 ${amountToSend} SUT 실제 송금이 완료되었습니다!\nTxHash: ${tx.hash}`);
      setPayoutAmount('');
    } catch (err) {
      console.error('온체인 송금 오류:', err);
      alert('❌ 오류 발생: ' + (err.reason || err.message));
    } finally {
      setIsPayingOut(false);
    }
  };

  if (loading) {
    return (
      <div style={{ margin: 'auto', textAlign: 'center', padding: '40px' }}>
        <div className="shimmer-loading" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 15px' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>회원 상세 데이터를 보안 대조 중입니다...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 20px 50px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          className="btn-secondary"
          onClick={() => navigate('/manager')}
          style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContext: 'center' }}
        >
          <ArrowLeft size={18} style={{ margin: 'auto' }} />
        </button>
        <div>
          <h2 style={{ fontSize: '18px', color: '#F9FAFB', fontWeight: '700' }}>Force Member Information Modification</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>본사 매니저의 전지전능한 정보 덮어쓰기 시스템</span>
        </div>
      </div>

      <div className="glass-card" style={{ border: '1px solid rgba(245,158,11,0.25)', background: 'linear-gradient(135deg, rgba(20,16,45,0.6) 0%, rgba(245,158,11,0.03) 100%)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '11px', lineHeight: '1.5', color: '#FBBF24' }}>
            <strong>[운영 주의보]</strong> 지갑 주소를 수정할 시, 2단계 수납 구조(`payments`)도 연쇄적으로 변경됩니다. 정확한 42자리 Polygon 주소 규격(0x로 시작)을 준수해 주십시오.
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', color: '#8B5CF6', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} />
            기본 인적사항 수정
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
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>전화번호</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="예: +82-10-1234-5678"
              required
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>구글 연동 이메일</label>
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
            장부 잔액 수동 관리 (송금 및 지급 조작)
          </h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.05)', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>현재 회원의 투자 원금 잔액</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFF' }}>{currentInvested.toFixed(2)} SUT</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', color: '#8B5CF6', fontWeight: '700' }}>(Input field for actual transfer amount) Transfer SUT to Member</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="송금할 SUT 수량 (예: 100)"
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#FFF',
                  fontSize: '13px'
                }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleOnchainPayout}
                disabled={isPayingOut || isAdjusting}
                style={{ width: 'auto', padding: '12px 20px', borderRadius: '8px', background: 'var(--primary-gradient)', fontSize: '12px', fontWeight: 'bold' }}
              >
                {isPayingOut ? '송금 중...' : '⚡ 회원에게 SUT 실제 송금'}
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', color: '#EF4444', fontWeight: '700' }}>(Input field for amount to deduct from member's ledger) Deduct from Member's Ledger</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="number"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="차감할 SUT 수량 (예: 100)"
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#FFF',
                  fontSize: '13px'
                }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleManualAdjustment}
                disabled={isPayingOut || isAdjusting}
                style={{ width: 'auto', padding: '12px 20px', borderRadius: '8px', background: 'var(--danger-color)', fontSize: '12px', fontWeight: 'bold' }}
              >
                {isAdjusting ? '차감 중...' : '📝 회원의 장부에서 차감'}
              </button>
            </div>
          </div>

          <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '4px' }}>
            💡 <strong>회원에게 SUT 실제 송금:</strong> 매니저의 지갑에서 회원의 지갑({targetWallet})으로 실제 SUT 토큰을 전송합니다. (장부 차감은 되지 않음)<br/>
            💡 <strong>회원의 장부에서 차감:</strong> 실제 토큰 전송 없이, 회원의 시뮬레이션 장부 잔액만 강제로 삭감(양수 입력 시 자동으로 차감 처리)합니다.
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '13px', color: '#10B981', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={14} />
            온체인 연계 데이터 수정
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Polygon 지갑 주소 (42자리)</label>
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
            가입 자격 및 멤버십 관리
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>KYC 심사 상태</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              style={{ background: 'var(--card-background)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
            >
              <option value="PENDING_KYC" style={{ background: '#0F1224', color: '#FFF' }}>KYC Review Pending (PENDING_KYC)</option>
              <option value="APPROVED" style={{ background: '#0F1224', color: '#FFF' }}>Official Registration Approved (APPROVED)</option>
              <option value="REJECTED" style={{ background: '#0F1224', color: '#FFF' }}>Document Rejection (REJECTED)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>멤버십 등급</label>
            <select
              name="tier"
              value={formData.tier}
              onChange={handleChange}
              style={{ background: 'var(--card-background)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
            >
              <option value="ACTIVE" style={{ background: '#0F1224', color: '#FFF' }}>Subscription Active Member (ACTIVE)</option>
              <option value="EXPIRED" style={{ background: '#0F1224', color: '#FFF' }}>Membership Expired (EXPIRED)</option>
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
          {submitting ? '데이터베이스 변경 적용 중...' : '회원 정보 강제 수정 집행'}
        </button>

      </form>
    </div>
  );
}

export default EditUserPage;
