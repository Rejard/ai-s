import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Phone, Globe, Image, ShieldAlert } from 'lucide-react';
import { API_BASE } from '../App';
import { translateError } from '../lib/errorHandler';

function UserRegister({ googleEmail, googleName, onRegisterComplete }) {
  const navigate = useNavigate();

  const [email] = useState(googleEmail || '');
  const [name] = useState(googleName || '');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Korea');
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardName, setIdCardName] = useState('');

  const [managerAddress, setManagerAddress] = useState('');
  const [managerVerifyState, setManagerVerifyState] = useState('none');
  const [managerVerifyMsg, setManagerVerifyMsg] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIdCardFile(file);
      setIdCardName(file.name);
    }
  };

  const handleVerifyManager = async () => {
    const cleanAddr = managerAddress.toLowerCase().trim();
    if (!cleanAddr || !cleanAddr.startsWith('0x') || ![34, 42].includes(cleanAddr.length)) {
      setManagerVerifyState('failed');
      setManagerVerifyMsg('올바른 이더리움 지갑 주소(0x...) 형식이 아닙니다.');
      return;
    }

    setManagerVerifyState('checking');
    setManagerVerifyMsg('우리 시스템 승인 여부 실시간 확인 중...');

    try {
      const res = await axios.get(`${API_BASE}/auth/verify-manager/${cleanAddr}`);
      if (res.data.success) {
        setManagerVerifyState('success');
        setManagerVerifyMsg(`확인 완료: [${res.data.name}] 담당 매니저 계정입니다.`);
      } else {
        setManagerVerifyState('failed');
        setManagerVerifyMsg(res.data.message || '승인된 매니저 지갑 주소가 아닙니다.');
      }
    } catch (err) {
      setManagerVerifyState('failed');
      setManagerVerifyMsg('서버 상태가 원활하지 않습니다. 다시 시도해 주세요.');
    }
  };

  const isFormComplete = phone.trim() !== '' && idCardFile !== null && managerVerifyState === 'success';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phone || !phone.trim()) {
      alert('📱 [미기입 사항] 전화번호를 입력해 주십시오.');
      const phoneInput = document.querySelector('input[type="tel"]');
      if (phoneInput) phoneInput.focus();
      return;
    }

    if (managerVerifyState !== 'success') {
      alert('👤 [미검증 오류] 담당 매니저 지갑 주소 검증을 완료해 주십시오.');
      return;
    }

    if (!idCardFile) {
      alert('🪪 [누락 사항] 신원 확인 및 KYC 심사 통과를 위해 주민등록증 / 여권 사진을 첨부해 주십시오.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('email', email);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('country', country);
    formData.append('managerAddress', managerAddress.toLowerCase().trim());
    formData.append('idCard', idCardFile);

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
      const errMsg = translateError(err);
      alert('가입 신청에 실패했습니다:\n\n' + errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <h2 style={{ fontSize: '20px', color: '#F3F4F6', fontFamily: 'var(--font-title)', fontWeight: '700' }}>New Member KYC Registration</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
          구글 소셜 인증이 완료되었습니다. 나머지 가입 및 KYC 심사 정보를 정확하게 입력해 주십시오.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

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

        {/* 담당 매니저 지갑 주소 */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">👤 담당 매니저 지갑 주소 (DB 실시간 검증 필수)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }}>🔑</span>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '45px' }}
                placeholder="0x..."
                value={managerAddress}
                onChange={(e) => {
                  setManagerAddress(e.target.value);
                  setManagerVerifyState('none');
                  setManagerVerifyMsg('');
                }}
                required
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{
                width: '100px',
                borderRadius: '12px',
                padding: '0 10px',
                fontSize: '11px',
                background: managerVerifyState === 'success' ? '#10B981' : 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                color: '#FFF',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              onClick={handleVerifyManager}
              disabled={managerVerifyState === 'checking'}
            >
              {managerVerifyState === 'checking' ? '확인 중...' : managerVerifyState === 'success' ? '✓ 인증완료' : '매니저 검증'}
            </button>
          </div>
          {managerVerifyState !== 'none' && (
            <div style={{
              fontSize: '11px',
              marginTop: '6px',
              paddingLeft: '4px',
              color: managerVerifyState === 'success' ? '#10B981' : managerVerifyState === 'failed' ? '#EF4444' : '#9CA3AF',
              fontWeight: '500'
            }}>
              {managerVerifyMsg}
            </div>
          )}
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

        <div style={{ display: 'flex', gap: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '12px', borderRadius: '10px' }}>
          <ShieldAlert size={18} color="var(--danger-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            가입 접수 완료 시 본사 배심단의 수동 심사 단계로 진입합니다. 심사 및 가입 최종 승인까지 평균 1~2시간이 소요됩니다.<br/>
            <strong style={{ color: 'var(--danger-color)' }}>※ 가입 신청 후 24시간 이내에 본사 승인이 완료되지 않을 경우, 신청 내역은 자동 취소되며 서버에 업로드된 신분증 사진은 영구 삭제됩니다.</strong>
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

export default UserRegister;
