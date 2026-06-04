import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, AlertTriangle, User, Globe, Phone, Mail, Wallet, ShieldAlert, BadgeInfo } from 'lucide-react';
import { API_BASE } from '../App';

function EditUserPage() {
  const { walletAddress: paramWalletAddress } = useParams();
  const navigate = useNavigate();

  // 수정 대상 회원 기존 데이터 및 입력 폼 상태
  const [targetWallet, setTargetWallet] = useState('');
  const [formData, setFormData] = useState({
    walletAddress: '',
    email: '',
    name: '',
    phone: '',
    country: '',
    status: '',
    tier: '',
    referrerAddress: '',
    trialEndsAt: ''
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 날짜 입력을 "YYYY-MM-DDTHH:MM" 규격으로 포맷팅해주는 헬퍼
  const formatDateTimeLocal = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const pad = (num) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // API 기본 주소 및 보안 헤더 세팅
        const headers = { headers: { 'x-admin-email': 'lemaiiisk@gmail.com' } };
        
        // 전체 회원 목록을 가져온 후 대상 회원 탐색 (또는 백엔드 세부조회 대체)
        const res = await axios.get(`${API_BASE}/admin/users`, headers);
        if (res.data.success) {
          const user = res.data.users.find(
            (u) => u.wallet_address.toLowerCase() === paramWalletAddress.toLowerCase()
          );

          if (user) {
            setTargetWallet(user.wallet_address);
            
            // 추천인 주소 조회를 위해 referrals 테이블 정보 간접 로드
            let referrer = 'none';
            try {
              const statusRes = await axios.get(`${API_BASE}/auth/status/${user.wallet_address}`);
              if (statusRes.data.success && statusRes.data.registered) {
                // 가입 시에 추천 구조 조회
                const referrerRes = await axios.get(`${API_BASE}/admin/pending-users`, headers);
                // 초대인 주소 맵핑 (기본 세팅에서 root 또는 가입 정보 주입)
                // 만약 referrals 테이블이 있으므로, referrer_address가 users 테이블에 이미 SELECT에 들어있지 않다면,
                // users 스키마 상의 referrer_address(database.js에 정의된 컬럼)를 추출
              }
            } catch (e) {
              console.error(e);
            }

            // users 테이블에 존재하는 컬럼으로 세팅
            setFormData({
              walletAddress: user.wallet_address,
              email: user.email,
              name: user.name,
              phone: user.phone,
              country: user.country,
              status: user.status,
              tier: user.tier,
              // database.js 시딩 단계에 저장된 referrer_address 활용 (혹은 관계 조회)
              referrerAddress: user.referrer_address || '0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818',
              trialEndsAt: formatDateTimeLocal(user.trial_ends_at)
            });
          } else {
            alert('해당 지갑 주소의 회원을 데이터베이스에서 찾을 수 없습니다.');
            navigate('/admin');
          }
        }
      } catch (err) {
        console.error('회원 상세 정보 수신 실패:', err);
        alert('회원 데이터를 조회하는 중 오류가 발생했습니다.');
        navigate('/admin');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [paramWalletAddress, navigate]);

  // 입력 필드 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // 수정 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirm('입력하신 회원 정보로 데이터베이스 및 온체인 구조를 강제 수정하시겠습니까?')) {
      return;
    }

    setSubmitting(true);
    try {
      const headers = { headers: { 'x-admin-email': 'lemaiiisk@gmail.com' } };
      const res = await axios.post(`${API_BASE}/admin/update-user`, {
        targetWalletAddress: targetWallet,
        walletAddress: formData.walletAddress,
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        country: formData.country,
        status: formData.status,
        tier: formData.tier,
        referrerAddress: formData.referrerAddress,
        trialEndsAt: formData.trialEndsAt ? new Date(formData.trialEndsAt).toISOString() : null
      }, headers);

      if (res.data.success) {
        alert('🎉 ' + res.data.message);
        navigate('/admin');
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
      
      {/* 1. 상단 타이틀 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          className="btn-secondary" 
          onClick={() => navigate('/admin')}
          style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContext: 'center' }}
        >
          <ArrowLeft size={18} style={{ margin: 'auto' }} />
        </button>
        <div>
          <h2 style={{ fontSize: '18px', color: '#F9FAFB', fontWeight: '700' }}>회원 정보 강제 수정</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>본사 관리자의 전지전능한 정보 덮어쓰기 시스템</span>
        </div>
      </div>

      {/* 2. 경고 공지 배너 */}
      <div className="glass-card" style={{ border: '1px solid rgba(245,158,11,0.25)', background: 'linear-gradient(135deg, rgba(20,16,45,0.6) 0%, rgba(245,158,11,0.03) 100%)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '11px', lineHeight: '1.5', color: '#FBBF24' }}>
            <strong>[운영 주의보]</strong> 지갑 주소나 추천인 주소를 수정할 시, 2단계 추천인 온체인 분배 수납 구조(`referrals` 및 `payments`)도 연쇄적으로 변경됩니다. 정확한 42자리 Polygon 주소 규격(0x로 시작)을 준수해 주십시오.
          </div>
        </div>
      </div>

      {/* 3. 수정 입력 폼 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 회원 기본 신원 그룹 */}
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

        {/* 블록체인 지갑 및 관계 주소 그룹 */}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>추천인(초대인) 지갑 주소 (42자리)</label>
            <input 
              type="text" 
              name="referrerAddress"
              value={formData.referrerAddress}
              onChange={handleChange}
              placeholder="0x..."
              required
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '11px', fontFamily: 'monospace', color: '#FFF', outline: 'none' }}
            />
          </div>
        </div>

        {/* 회원 관리 등급 및 만료 기한 그룹 */}
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
              <option value="PENDING_KYC" style={{ background: '#0F1224', color: '#FFF' }}>KYC심사대기 (PENDING_KYC)</option>
              <option value="APPROVED" style={{ background: '#0F1224', color: '#FFF' }}>정식가입승인 (APPROVED)</option>
              <option value="REJECTED" style={{ background: '#0F1224', color: '#FFF' }}>서류반려탈락 (REJECTED)</option>
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
              <option value="TRIAL" style={{ background: '#0F1224', color: '#FFF' }}>무료체험회원 (TRIAL)</option>
              <option value="ACTIVE" style={{ background: '#0F1224', color: '#FFF' }}>정액제정회원 (ACTIVE)</option>
              <option value="EXPIRED" style={{ background: '#0F1224', color: '#FFF' }}>멤버십만료 (EXPIRED)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>무료 체험/멤버십 기한 설정 (분 단위 정밀 통제)</label>
            <input 
              type="datetime-local" 
              name="trialEndsAt"
              value={formData.trialEndsAt}
              onChange={handleChange}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#FFF', outline: 'none' }}
            />
          </div>
        </div>

        {/* 4. 수정 집행 제어부 */}
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
