import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Phone, Globe, Image, UserCheck, Key, ShieldAlert, Shield } from 'lucide-react';
import { API_BASE } from '../App';
import { buildTrustWalletOpenUrl } from '../lib/walletProvider';
import { approveSutWithdrawalPermission } from '../lib/sutApproval';

function PcRegisterPage({ walletAddress, googleEmail, googleName, onRegisterComplete }) {
  const navigate = useNavigate();

  // 🌟 Google-linked email and real name are automatically mapped as read-only
  const [email] = useState(googleEmail || '');
  const [name] = useState(googleName || '');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Korea');
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardName, setIdCardName] = useState('');
  
  // Assigned Manager State Variable
  const [managerAddress, setManagerAddress] = useState('');
  const [managerVerified, setManagerVerified] = useState(false);
  const [managerName, setManagerName] = useState('');

  // State Variable
  const [isApproved, setIsApproved] = useState(false); // SUT Approve status
  const [approving, setApproving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Assigned Manager Wallet Verification Logic
  const verifyManager = async () => {
    if (!managerAddress) {
      alert('담당 매니저의 폴리곤 지갑 주소를 입력해 주세요.');
      return;
    }
    const cleanAddr = managerAddress.toLowerCase().trim();
    if (cleanAddr === walletAddress.toLowerCase()) {
      alert('본인 지갑 주소는 매니저로 입력할 수 없습니다.');
      return;
    }

    try {
      const res = await axios.get(`${API_BASE}/auth/verify-manager/${cleanAddr}`);
      if (res.data.success) {
        setManagerVerified(true);
        setManagerName(res.data.name);
      } else {
        setManagerVerified(false);
        setManagerName('');
        alert(res.data.message);
      }
    } catch (err) {
      alert('매니저 검증 중 에러가 발생했습니다.');
    }
  };

  // ID Card Photo File Selection Handler
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIdCardFile(file);
      setIdCardName(file.name);
    }
  };

  // Polygon SUT Smart Contract Withdrawal Limit Approval (SUT Approve) On-chain Execution
  const handleSUTApprove = async () => {
    setApproving(true);
    try {
      alert('지갑 앱에서 SUT 자동 결제 승인(Approve) 서명을 요청합니다. 지갑 화면에서 승인해 주세요.');

      const tx = await approveSutWithdrawalPermission({
        ethereum: window.ethereum,
        userAgent: navigator.userAgent,
        walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      });

      alert('트랜잭션이 폴리곤 네트워크에 전송되었습니다. 블록체인 처리를 잠시 확인합니다.');

      await Promise.race([
        tx.wait(),
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);

      setIsApproved(true);
      alert('SUT 자동 결제 승인 서명이 등록되었습니다.');
    } catch (err) {
      console.error(err);
      if (err.message === 'MOBILE_CHROME_REQUIRES_WALLET_APP') {
        const openUrl = buildTrustWalletOpenUrl(window.location.href);
        if (confirm('모바일 Chrome에서는 직접 지갑 서명을 할 수 없습니다. Trust Wallet 앱에서 이 가입 페이지를 열어 승인하시겠습니까?')) {
          window.location.href = openUrl;
        }
        return;
      }
      if (err.message === 'NO_INJECTED_WALLET') {
        alert('감지된 Web3 지갑이 없습니다. PC에서는 Trust Wallet 확장 프로그램을 설치/잠금 해제하고, 모바일에서는 Trust Wallet 앱에서 열어 주세요.');
        return;
      }
      if (err.code === 'ACTION_REJECTED' || (err.message && err.message.includes('rejected'))) {
        alert('지갑에서 서명 승인이 취소되었습니다. 가입 진행을 위해 승인이 필요합니다.');
      } else {
        alert(`SUT 승인 오류: ${err.message || err}`);
      }
    } finally {
      setApproving(false);
    }
  };

  const isFormComplete = phone.trim() !== '' && idCardFile !== null && isApproved && managerVerified;

  // Submit Full Registration Form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phone || !phone.trim()) {
      alert('📱 [미기입 사항] 전화번호를 입력해 주십시오.');
      return;
    }

    if (!idCardFile) {
      alert('🪪 [누락 사항] 신원 확인 및 KYC 심사 통과를 위해 주민등록증 / 여권 사진을 첨부해 주십시오.');
      return;
    }

    if (!managerVerified) {
      alert('👑 [검증 필요] 담당 매니저 지갑 주소를 입력하고 [검증] 버튼을 눌러 승인받으셔야 가입이 가능합니다.');
      return;
    }

    if (!isApproved) {
      alert('🔑 [승인 필요] 가입비 자동 수납 및 시스템 활성화를 위해 [SUT 자동 인출 권한(Approve) 승인]을 완료해 주십시오.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('walletAddress', walletAddress);
    formData.append('email', email);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('country', country);
    formData.append('idCard', idCardFile);
    if (managerVerified) {
      formData.append('managerAddress', managerAddress);
    }

    try {
      const res = await axios.post(`${API_BASE}/auth/register`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data.success) {
        alert(res.data.message);
        onRegisterComplete();
        navigate('/waiting');
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : '가입 신청서 접수 중 오류가 발생했습니다.';
      alert(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '40px 60px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* 👑 Master Manager 'Return to Manager Mode' Shortcut Bar */}
      {false && ((walletAddress && walletAddress.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase()) ||
        (localStorage.getItem('google_email') && localStorage.getItem('google_email').toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase())) && (
        <div 
          className="glass-card glow-active" 
          onClick={() => navigate('/manager')}
          style={{ 
            padding: '16px', 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(20, 16, 45, 0.4) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginBottom: '10px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>👑</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#C084FC' }}>Master Manager Mode</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>메니져 페이지 바로 가기 (터치 시 복귀)</div>
            </div>
          </div>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px', width: 'auto' }}>
            메니져 모드 이동
          </button>
        </div>
      )}

      <div className="pc-layout-wrapper" style={{ padding: 0 }}>
      
      {/* Left Column: Security Header and SUT Delegation Status Information */}
      <div className="pc-side-intro" style={{ maxWidth: '460px' }}>
        <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '16px', background: 'rgba(139,92,246,0.1)', marginBottom: '24px', width: 'fit-content' }}>
          <Shield size={40} color="#8B5CF6" />
        </div>
        <h1>신규 회원 KYC 등록</h1>
        <p>
          지갑 주소와 구글 이메일 연동이 완료되었습니다. 이제 안전한 자동 투자 집행을 위한 스마트 결제 승인 서명 및 신원정보 작성을 완료해 주십시오.
        </p>

        {/* Wallet and Google Status Summary Information */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
          
          <div className="glass-card" style={{ padding: '18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              👤 로그인 정보 (구글 인증 고정)
            </span>
            <div style={{ fontSize: '14px', color: 'var(--success-color)', fontWeight: '700', wordBreak: 'break-all' }}>
              🟢 {email}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              이름: {name}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '18px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              🔑 내 폴리곤 지갑 주소
            </span>
            <div style={{ fontSize: '13px', color: '#FFF', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {walletAddress}
            </div>
          </div>

          {/* SUT Approve Authority Delegation Box */}
          <div className="glass-card" style={{ padding: '22px', border: '1px solid rgba(139,92,246,0.25)' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'flex-start' }}>
              <Key size={22} color="#8B5CF6" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ fontSize: '15px', color: '#FFF', fontWeight: '600' }}>SUT Automatic Withdrawal Authority (Approve) Approval</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.5' }}>
                  추후 정식 투자 및 원활한 자동 이체를 위해 지갑의 서명 승인이 필수로 진행되어야 합니다.
                </p>
              </div>
            </div>

            {!isApproved ? (
              <button 
                type="button" 
                className="btn-primary" 
                style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', boxShadow: 'none' }}
                onClick={handleSUTApprove}
                disabled={approving}
              >
                {approving ? '지갑 트랜잭션 승인 대기 중...' : '폴리곤 SUT 인출 승인 위임하기'}
              </button>
            ) : (
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '12px',
                borderRadius: '12px',
                textAlign: 'center',
                fontSize: '14px',
                color: 'var(--success-color)',
                fontWeight: '700'
              }}>
                ✔ 스마트 컨트랙트 위임 승인 완료
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Right Column: Registration Form Information Entry and File Attachment */}
      <div style={{ flex: 1, maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <h3 style={{ fontSize: '18px', color: '#FFF', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '10px' }}>
            서류 제출 및 추가 정보 기입
          </h3>

          {/* Country of Residence and Phone Number (1 Row 2 Column Layout) */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">🌐 거주 국가</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)', zIndex: 1 }}><Globe size={18} /></span>
                <select 
                  className="form-select" 
                  style={{ paddingLeft: '45px' }}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="Korea">대한민국 (Korea)</option>
                  <option value="Japan">일본 (Japan)</option>
                  <option value="USA">미국 (USA)</option>
                  <option value="Vietnam">베트남 (Vietnam)</option>
                  <option value="China">중국 (China)</option>
                  <option value="UK">영국 (UK)</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">📱 전화번호</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }}><Phone size={18} /></span>
                <input 
                  type="tel" 
                  className="form-input" 
                  style={{ paddingLeft: '45px' }}
                  placeholder="+82 10-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Assigned Manager Wallet Address */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              👑 담당 매니저 폴리곤 지갑 주소 (필수)
              {managerVerified && (
                <span style={{ marginLeft: '10px', color: 'var(--success-color)', fontSize: '12px', fontWeight: 'bold' }}>
                  ✓ {managerName} 매니저 확인됨
                </span>
              )}
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }}><UserCheck size={18} /></span>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ 
                    paddingLeft: '45px',
                    borderColor: managerVerified ? 'var(--success-color)' : 'rgba(255, 255, 255, 0.1)'
                  }}
                  placeholder="0x..."
                  value={managerAddress}
                  onChange={(e) => {
                    setManagerAddress(e.target.value);
                    setManagerVerified(false);
                  }}
                  disabled={managerVerified}
                />
              </div>
              {!managerVerified ? (
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ padding: '0 24px', whiteSpace: 'nowrap', width: 'auto' }}
                  onClick={verifyManager}
                >
                  검증
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ padding: '0 24px', whiteSpace: 'nowrap', width: 'auto', background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5' }}
                  onClick={() => {
                    setManagerVerified(false);
                    setManagerAddress('');
                    setManagerName('');
                  }}
                >
                  취소
                </button>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '5px', display: 'block', paddingLeft: '4px' }}>
              * 담당 매니저의 지갑 주소를 입력하고 반드시 검증을 완료해 주십시오. (소속 코드가 기록됩니다)
            </span>
          </div>

          {/* ID Card File Upload */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">🪪 KYC 제출용 공식 신분증 이미지 첨부</label>
            <div style={{
              border: '2px dashed var(--glass-border)',
              borderRadius: '16px',
              padding: '30px 20px',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.3)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            >
              <input 
                type="file" 
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <Image size={34} color={idCardFile ? 'var(--success-color)' : '#A78BFA'} />
                <span style={{ fontSize: '14px', color: idCardFile ? '#FFF' : 'var(--text-muted)', fontWeight: '600' }}>
                  {idCardFile ? idCardName : 'Find Resident Registration Card / Passport Image File'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>Only JPG, PNG, PDF file formats supported (Max 5MB)</span>
              </div>
            </div>
          </div>

          {/* Registration Guide Warning */}
          <div style={{ display: 'flex', gap: '10px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '14px', borderRadius: '12px' }}>
            <ShieldAlert size={20} color="var(--danger-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
              KYC 서류 접수 후 플랫폼 어드민 심사 완료 시까지 평균 1시간 내외가 소요됩니다. 허위 서류나 위조 신분증 제출 시 즉시 영구 정지 처분됩니다.
            </p>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={submitting}
            style={{ 
              padding: '18px', 
              marginTop: '10px',
              opacity: isFormComplete ? 1.0 : 0.45, 
              background: isFormComplete 
                ? 'var(--primary-gradient)' 
                : 'rgba(255, 255, 255, 0.08)', 
              border: isFormComplete 
                ? '1px solid rgba(139, 92, 246, 0.4)' 
                : '1px solid rgba(255, 255, 255, 0.05)',
              color: isFormComplete ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
              boxShadow: isFormComplete ? '0 0 25px rgba(139, 92, 246, 0.4)' : 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {submitting ? '신청 정보 전송 중...' : '회원 가입 및 KYC 서류 제출 완료'}
          </button>

        </form>
      </div>
      
    </div>
    </div>
  );
}

export default PcRegisterPage;
