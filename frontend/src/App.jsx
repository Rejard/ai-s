import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Wallet, Users, BarChart3, Settings, Sparkles, AlertTriangle, ArrowDownUp } from 'lucide-react';

// 페이지 컴포넌트 로드
import ConsentPage from './pages/ConsentPage';
import RegisterPage from './pages/RegisterPage';
import WaitingPage from './pages/WaitingPage';
import Dashboard from './pages/Dashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import EditUserPage from './pages/EditUserPage';
import HistoryPage from './pages/HistoryPage';
import AdminDashboard from './pages/AdminDashboard';

// 💻 PC 전용 프리미엄 페이지 컴포넌트 추가
import PcConsentPage from './pages/PcConsentPage';
import PcRegisterPage from './pages/PcRegisterPage';
import PcWaitingPage from './pages/PcWaitingPage';
import PcDashboard from './pages/PcDashboard';
import PcManagerDashboard from './pages/PcManagerDashboard';
import PcAdminDashboard from './pages/PcAdminDashboard';
import { buildTrustWalletOpenUrl } from './lib/walletProvider';

// 백엔드 API 기본 주소 설정
export const API_BASE = 'https://edenai.alonics.com/api';

// 🌟 Rejard님이 발급해주신 웹 애플리케이션 전용 진짜 구글 OAuth2 클라이언트 ID 적용 완료!
const GOOGLE_CLIENT_ID = '327843712323-1se9k7pkfftu0d4r19mdf355ptj5j75u.apps.googleusercontent.com';
const GOOGLE_OAUTH_SCOPE = 'openid email profile';

function AppContent() {
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [userStatus, setUserStatus] = useState(''); // PENDING_KYC, APPROVED, REJECTED
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // 진짜 구글 로그인 연동 상태
  const [googleLoggedIn, setGoogleLoggedIn] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  // DApp 브라우저 구글 퀵패스 모달 상태
  const [showGPassModal, setShowGPassModal] = useState(false);

  // 사용자 요청: 웹 시작 시 화면 너비 동적 파악 알고리즘
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🌟 [PC 전용 메니져 보안] 모바일 기기(스마트폰/태블릿) 접속 판정
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const shouldUseGoogleRedirectLogin = isMobileDevice;

  // 🌟 [모바일 인앱 브라우저 감지 엔진] 구글 로그인 웹뷰 백화 현상 사전 감지 차단용
  const isInAppBrowser = /Telegram|KAKAOTALK|Line|Instagram|FB_IAB|FBAN|FBIOS|TrustWallet/i.test(navigator.userAgent) || 
    (window.ethereum && /Android|iPhone|iPad/i.test(navigator.userAgent)) ||
    (navigator.userAgent.includes('wv') || navigator.userAgent.includes('WebView'));

  const location = useLocation();
  const isManagerRoute = location.pathname.startsWith('/manager');
  const isPcView = !isMobileDevice && screenWidth > 768;

  const buildGoogleOAuthRedirectUrl = () => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${window.location.origin}/`,
      response_type: 'token',
      scope: GOOGLE_OAUTH_SCOPE,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const startGoogleRedirectLogin = () => {
    window.location.href = buildGoogleOAuthRedirectUrl();
  };

  const restoreSessionByEmail = async (email) => {
    try {
      const res = await axios.get(`${API_BASE}/auth/status-by-email/${email}`);
      if (res.data.success && res.data.registered) {
        const user = res.data.user;
        setWalletAddress(user.walletAddress);
        setIsRegistered(true);
        setUserStatus(user.status);
        setUserData(user);
        console.log("[SESSION AUTO-RESTORED] Registered email detected:", user.walletAddress);
        return user.walletAddress;
      }
    } catch (err) {
      console.error("이메일 세션 자동 복원 실패:", err);
    }
    return null;
  };

  const applyGoogleProfile = async (profile) => {
    const email = profile.email?.toLowerCase().trim();
    if (!email) throw new Error('Google profile did not include an email address.');

    const name = profile.name || profile.given_name || email;
    
    setLoading(true);
    await restoreSessionByEmail(email);
    setLoading(false);

    setGoogleEmail(email);
    setGoogleName(name);
    setGoogleLoggedIn(true);
    localStorage.setItem('google_email', email);
    localStorage.setItem('google_name', name);
  };

  const restoreGoogleOAuthRedirect = async () => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    if (!hash) return false;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) return false;

    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google userinfo failed with ${res.status}`);

    await applyGoogleProfile(await res.json());
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  };

  // 컴포넌트 마운트 시 통합 세션 복원 및 초기화 로직 수행
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await restoreGoogleOAuthRedirect();
      } catch (err) {
        console.error('Google OAuth redirect restore failed:', err);
        alert('Google 로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
      }

      const params = new URLSearchParams(window.location.search);
      const paramEmail = params.get('google_email');
      const paramName = params.get('google_name');
      
      let currentEmail = '';
      let currentName = '';

      if (paramEmail && paramName) {
        currentEmail = decodeURIComponent(paramEmail).toLowerCase().trim();
        currentName = decodeURIComponent(paramName);
      } else {
        const savedEmail = localStorage.getItem('google_email');
        const savedName = localStorage.getItem('google_name');
        if (savedEmail && savedName) {
          currentEmail = savedEmail;
          currentName = savedName;
        }
      }

      let _googleLoggedIn = false;
      if (currentEmail && currentName) {
        setGoogleEmail(currentEmail);
        setGoogleName(currentName);
        setGoogleLoggedIn(true);
        _googleLoggedIn = true;
        localStorage.setItem('google_email', currentEmail);
        localStorage.setItem('google_name', currentName);
      }

      const promises = [];
      let emailWalletAddress = null;

      // 1. 이메일 기반 가입 정보 조회 및 세션 복원
      if (_googleLoggedIn && currentEmail) {
        promises.push(
          restoreSessionByEmail(currentEmail).then(addr => {
            if (addr) emailWalletAddress = addr;
          })
        );
      }

      // 2. Web3 지갑 연동 확인 (딜레이 부여)
      promises.push(
        new Promise(resolve => setTimeout(async () => {
          if (window.ethereum) {
            try {
              let accounts = await window.ethereum.request({ method: 'eth_accounts' });
              if (accounts.length === 0) {
                try {
                  accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                } catch(e) {}
              }
              if (accounts.length > 0) {
                const address = accounts[0];
                if (emailWalletAddress) {
                  console.log("[AUTO-CONNECT] Email session already established. Skipping injected wallet overwrite.");
                } else {
                  setWalletAddress(address);
                  await checkUserStatus(address);
                }
              }
            } catch (err) {
              console.error("지갑 자동 조회 실패:", err);
            }
          }
          resolve();
        }, 600))
      );

      await Promise.all(promises);
      setIsAppReady(true);
    };

    initializeApp();
  }, []);

  // 구글 로그인 성공 콜백 핸들러
  const handleGoogleCredentialResponse = async (response) => {
    try {
      const token = response.credential;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      
      const email = payload.email.toLowerCase().trim();
      const name = payload.name || payload.given_name || '사용자';
      
      localStorage.setItem('google_email', email);
      localStorage.setItem('google_name', name);

      setLoading(true);
      await restoreSessionByEmail(email);
      setLoading(false);
      
      setGoogleEmail(email);
      setGoogleName(name);
      setGoogleLoggedIn(true);
      
      alert(`🎉 Google 연동 성공: ${email} 계정으로 정상 연동되었습니다.`);
    } catch (e) {
      console.error("구글 JWT 디코딩 실패:", e);
      alert("구글 로그인 처리 중 문제가 발생했습니다.");
    }
  };

  useEffect(() => {
    if (isInAppBrowser || shouldUseGoogleRedirectLogin) {
      console.log("[STEALTH CONTROL] Bypassed Google Identity SDK dynamic load for mobile In-App browser.");
      return;
    }

    const existingScript = document.getElementById('google-jssdk');
    if (existingScript) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'google-jssdk';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse
        });
        
        renderGoogleSignInButton();
      }
    };
    document.body.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById('google-jssdk');
      if (scriptToRemove) document.body.removeChild(scriptToRemove);
    };
  }, [googleLoggedIn]);

  const renderGoogleSignInButton = () => {
    setTimeout(() => {
      const btnElem = document.getElementById('google-signin-btn');
      if (btnElem && window.google) {
        if (btnElem.hasChildNodes()) return;
        
        window.google.accounts.id.renderButton(btnElem, {
          theme: 'outline',
          size: 'large',
          width: 280,
          shape: 'pill',
          logo_alignment: 'left',
          text: 'signin_with',
          locale: 'ko'
        });
      }
    }, 200);
  };

  useEffect(() => {
    if (!googleLoggedIn) {
      if (shouldUseGoogleRedirectLogin) return;
      renderGoogleSignInButton();
    }
  }, [googleLoggedIn]);

  const checkUserStatus = async (address) => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/auth/status/${address}`);
      if (res.data.success) {
        if (res.data.registered) {
          setIsRegistered(true);
          setUserStatus(res.data.user.status);
          setUserData(res.data.user);
        } else {
          setIsRegistered(false);
          setUserStatus('');
          setUserData(null);
        }
      }
    } catch (err) {
      console.error('회원 상태 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          const address = accounts[0];
          setWalletAddress(address);
          await checkUserStatus(address);
        }
      } catch (err) {
        alert('지갑 연결에 실패했거나 취소되었습니다.');
      }
    } else {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const baseUrl = window.location.origin + window.location.pathname;
        const queryParams = new URLSearchParams();
        if (googleLoggedIn && googleEmail) {
          queryParams.set('google_email', encodeURIComponent(googleEmail));
          queryParams.set('google_name', encodeURIComponent(googleName));
        }
        
        const finalUrl = `${baseUrl}?${queryParams.toString()}`;
        const trustDeepLink = buildTrustWalletOpenUrl(finalUrl);
        
        alert('📲 모바일 Trust Wallet 앱과 다이렉트 온체인 연동을 격발합니다. 확인을 누르시면 트러스트 월렛 앱이 자동으로 열리며 안전 연결이 개통됩니다.');
        window.location.href = trustDeepLink;
      } else {
        alert('감지된 Web3 지갑(Trust Wallet 등)이 없습니다. 모바일 Trust Wallet 앱의 DApp 브라우저를 통해 접속해 주시거나, PC 브라우저에 지갑 확장 프로그램(메타마스크 등)을 설치 후 다시 시도해 주십시오.');
      }
    }
  };

  const disconnectWallet = () => {
    localStorage.removeItem('google_email');
    localStorage.removeItem('google_name');
    alert('계정이 안전하게 초기화되었습니다.');
    window.location.reload();
  };

  const GoogleSignInBtn = () => {
    useEffect(() => {
      if (shouldUseGoogleRedirectLogin) return;
      renderGoogleSignInButton();
    }, []);
    if (shouldUseGoogleRedirectLogin) {
      return (
        <button
          className="btn-primary"
          onClick={startGoogleRedirectLogin}
          style={{
            width: '280px',
            minHeight: '44px',
            borderRadius: '22px',
            background: '#ffffff',
            color: '#1f2937',
            border: '1px solid #dadce0',
            fontWeight: 700,
            justifyContent: 'center',
          }}
        >
          Google 계정으로 로그인
        </button>
      );
    }

    return <div id="google-signin-btn" style={{ minHeight: '44px', width: '280px', display: 'flex', justifyContent: 'center' }}></div>;
  };

  const renderIntro = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 20px', margin: 'auto 0' }}>
        <div className="glass-card glow-active" style={{ textAlign: 'center', padding: '35px 20px' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(139,92,246,0.1)', marginBottom: '16px' }}>
            <Shield size={44} color="#8B5CF6" />
          </div>
          <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Ai S</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
            본 플랫폼은 폴리곤 네트워크 및 진짜 구글 OAuth 인증을 통합 연동합니다. 
            2단계 추천인 자동 분배 및 AI 자동 투자 시스템 시뮬레이션을 시작하십시오.
          </p>

          {!googleLoggedIn ? (
            isInAppBrowser ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                <button 
                  className="btn-primary glow-active"
                  style={{
                    background: 'var(--primary-gradient)',
                    boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)',
                    fontSize: '14px',
                    fontWeight: '800',
                    padding: '14px 20px',
                    width: '280px',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#FFF',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onClick={() => setShowGPassModal(true)}
                >
                  ⚡ 1초 구글 계정 간편 연동 (DApp 퀵패스)
                </button>
                <div style={{ fontSize: '10px', color: '#A78BFA', lineHeight: '1.4', padding: '0 10px' }}>
                  💡 모바일 DApp 브라우저 환경입니다.<br />
                  구글 OAuth 백화 오류 방지를 위해 <strong>1초 퀵패스</strong>가 자동으로 개통되었습니다.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div 
                  style={{ 
                    fontSize: '12px', 
                    color: '#A78BFA', 
                    fontWeight: '600',
                    userSelect: 'none'
                  }}
                >
                  🔑 가입 및 인증을 위해 먼저 구글 계정으로 로그인해 주십시오.
                </div>
                <GoogleSignInBtn />
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '13px'
              }}>
                🟢 <span style={{ color: 'var(--success-color)', fontWeight: '700' }}>Google 계정 연동됨:</span> {googleEmail}
              </div>

              <button 
                className="btn-primary" 
                onClick={connectWallet}
              >
                <Wallet size={20} />
                {'트러스트 월렛 연결하기'}
              </button>
              
              <button className="btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.2)' }} onClick={disconnectWallet}>
                인증 계정 로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPcIntro = () => {
    return (
      <div className="pc-layout-wrapper">
        <div className="pc-side-intro" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'inline-flex', padding: '14px', borderRadius: '16px', background: 'rgba(139,92,246,0.1)', marginBottom: '24px', width: 'fit-content' }}>
            <Sparkles size={36} color="#8B5CF6" />
          </div>
          <h1>Ai S Trading</h1>
          <p>
            폴리곤 네트워크 및 안전한 구글 로그인 연동을 지원하는 AI 기반 다자간 시뮬레이션 트레이딩 플랫폼입니다.
            실시간 온체인 게이지 분석 및 다이렉트 슬립 연산 위임(Approve)을 즉시 시작해 보십시오.
          </p>

          <div className="pc-intro-cards">
            <div className="pc-intro-card">
              <div className="icon-wrapper">
                <Shield size={22} />
              </div>
              <div>
                <h4>안전한 구글 로그인 & DApp 연동</h4>
                <p>2단계 구글 퀵패스 및 폴리곤 Web3 다이렉트 연계를 결합하여 빈틈없는 신원 증명을 제공합니다.</p>
              </div>
            </div>

            <div className="pc-intro-card">
              <div className="icon-wrapper">
                <ArrowDownUp size={22} />
              </div>
              <div>
                <h4>자동 이체 및 자산 인출 위임</h4>
                <p>스마트 컨트랙트 승인(Approve)을 통해 가입비 및 이율을 투명하고 안전하게 정산 시뮬레이션합니다.</p>
              </div>
            </div>

            <div className="pc-intro-card">
              <div className="icon-wrapper">
                <BarChart3 size={22} />
              </div>
              <div>
                <h4>실시간 시세 피드백 차트</h4>
                <p>Gate.io 및 주요 거래소 SUT 토큰 시세를 LIVE로 추적하여 실시간 지갑 가치 변화를 투영합니다.</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: '420px', flexShrink: 0 }}>
          <div className="glass-card glow-active" style={{ padding: '40px 30px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(139,92,246,0.08)', marginBottom: '20px' }}>
              <Wallet size={48} color="#8B5CF6" />
            </div>
            <h2 style={{ fontSize: '24px', marginBottom: '12px', fontWeight: '700' }}>플랫폼 연동</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '30px' }}>
              안전한 보안 통신 규격을 기반으로 서비스를 실행합니다. 아래 연동 과정을 차례대로 밟아주십시오.
            </p>

            {!googleLoggedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '13px', color: '#A78BFA', fontWeight: '600' }}>
                  🔑 1단계: 구글 공식 계정 연동
                </div>
                <GoogleSignInBtn />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  padding: '14px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  color: '#E5E7EB'
                }}>
                  🟢 <span style={{ color: 'var(--success-color)', fontWeight: '700' }}>Google 인증됨:</span> {googleEmail}
                </div>

                <div style={{ fontSize: '13px', color: '#A78BFA', fontWeight: '600' }}>
                  📲 2단계: 폴리곤 지갑 연결
                </div>

                <button 
                  className="btn-primary" 
                  onClick={connectWallet}
                  style={{ padding: '16px', fontSize: '15px' }}
                >
                  <Wallet size={20} />
                  트러스트 월렛 연결하기
                </button>
                
                <button 
                  className="btn-secondary" 
                  style={{ color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.2)', padding: '12px' }} 
                  onClick={disconnectWallet}
                >
                  구글 연동 해제
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      style={
        isPcView 
        ? {
            width: '100%',
            minHeight: '100vh',
            backgroundColor: 'var(--bg-color)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }
        : {
            width: `${screenWidth}px`,
            maxWidth: '100vw',
            minHeight: '100vh',
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflowX: 'hidden',
            margin: '0 auto'
          }
      }
    >
      {!isPcView && (
        <header style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 18, 36, 0.4)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 8px #10B981' }}></div>
            <span style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '0.05em', color: '#F3F4F6', fontFamily: 'var(--font-title)' }}>
              Ai S
            </span>
          </div>
          {googleLoggedIn && (
            <div style={{ fontSize: '10px', color: '#8B5CF6', background: 'rgba(139,92,246,0.08)', padding: '5px 10px', borderRadius: '15px', border: '1px solid rgba(139,92,246,0.2)' }}>
              👤 {googleEmail.length > 18 ? googleEmail.substring(0, 15) + '...' : googleEmail}
            </div>
          )}
        </header>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: isPcView ? '0' : '70px', position: 'relative' }}>
        {(!isAppReady || loading) ? (
          <div style={{ margin: 'auto', textAlign: 'center' }}>
            <div className="shimmer-loading" style={{ width: '50px', height: '50px', borderRadius: '50%', margin: '0 auto 15px' }}></div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>보안 세션을 확인하는 중입니다...</p>
          </div>
        ) : (
          <Routes>
            <Route path="/manager" element={
              googleLoggedIn && googleEmail.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase() ? (
                isPcView ? (
                  <PcManagerDashboard walletAddress={walletAddress} managerEmail={googleEmail} />
                ) : (
                  <ManagerDashboard walletAddress={walletAddress} managerEmail={googleEmail} />
                )
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/admin" element={
              googleLoggedIn && googleEmail.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase() ? (
                isPcView ? (
                  <PcAdminDashboard walletAddress={walletAddress} managerEmail={googleEmail} />
                ) : (
                  <AdminDashboard walletAddress={walletAddress} managerEmail={googleEmail} />
                )
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/manager/edit-user/:walletAddress" element={
              googleLoggedIn && googleEmail.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase() ? (
                <EditUserPage />
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/" element={
              !googleLoggedIn || !walletAddress ? (
                isPcView ? renderPcIntro() : renderIntro()
              ) : !isRegistered ? (
                <Navigate to="/consent" replace />
              ) : userStatus === 'PENDING_KYC' ? (
                <Navigate to="/waiting" replace />
              ) : userStatus === 'APPROVED' ? (
                <Navigate to="/dashboard" replace />
              ) : userStatus === 'REJECTED' ? (
                isPcView ? (
                  <div className="pc-layout-wrapper" style={{ justifyContent: 'center' }}>
                    <div className="glass-card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '40px' }}>
                      <ShieldCheck size={48} color="#EF4444" style={{ marginBottom: '20px', margin: '0 auto' }} />
                      <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>KYC 승인이 반려되었습니다</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '25px' }}>
                        신분증 심사가 반려되었습니다. 재도전하시려면 아래 버튼을 눌러주십시오.
                      </p>
                      <button className="btn-primary" onClick={() => setIsRegistered(false)}>
                        가입 신청 다시 접수하기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card" style={{ margin: 'auto 20px', textAlign: 'center' }}>
                    <Shield size={40} color="#EF4444" style={{ marginBottom: '15px' }} />
                    <h3 style={{ marginBottom: '10px' }}>KYC 승인이 반려되었습니다</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
                      신분증 심사가 반려되었습니다. 재도전하시려면 아래 버튼을 눌러주십시오.
                    </p>
                    <button className="btn-primary" onClick={() => setIsRegistered(false)}>
                      가입 재신청하기
                    </button>
                  </div>
                )
              ) : (
                isPcView ? renderPcIntro() : renderIntro()
              )
            } />

            <Route path="/consent" element={
              googleLoggedIn && walletAddress && !isRegistered ? (
                isPcView ? (
                  <PcConsentPage walletAddress={walletAddress} onLogout={disconnectWallet} />
                ) : (
                  <ConsentPage walletAddress={walletAddress} onLogout={disconnectWallet} />
                )
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/register" element={
              googleLoggedIn && walletAddress && !isRegistered ? (
                isPcView ? (
                  <PcRegisterPage 
                    walletAddress={walletAddress} 
                    googleEmail={googleEmail}
                    googleName={googleName}
                    onRegisterComplete={() => checkUserStatus(walletAddress)} 
                  />
                ) : (
                  <RegisterPage 
                    walletAddress={walletAddress} 
                    googleEmail={googleEmail}
                    googleName={googleName}
                    onRegisterComplete={() => checkUserStatus(walletAddress)} 
                  />
                )
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/waiting" element={
              googleLoggedIn && walletAddress && isRegistered && userStatus === 'PENDING_KYC' ? (
                isPcView ? (
                  <PcWaitingPage walletAddress={walletAddress} onApproved={() => checkUserStatus(walletAddress)} />
                ) : (
                  <WaitingPage walletAddress={walletAddress} onApproved={() => checkUserStatus(walletAddress)} />
                )
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/dashboard" element={
              googleLoggedIn && walletAddress && isRegistered && userStatus === 'APPROVED' ? (
                isPcView ? (
                  <PcDashboard walletAddress={walletAddress} userData={userData} onLogout={disconnectWallet} />
                ) : (
                  <Dashboard walletAddress={walletAddress} userData={userData} onLogout={disconnectWallet} />
                )
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/history" element={
              googleLoggedIn && walletAddress && isRegistered && userStatus === 'APPROVED' ? (
                isPcView ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <HistoryPage walletAddress={walletAddress} />
                )
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>

      {/* DApp 브라우저용 구글 간편 연동 (퀵패스) 모달 */}
      {showGPassModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '30px', background: '#111827' }}>
            <h3 style={{ fontSize: '18px', color: '#FFF', marginBottom: '10px' }}>⚡ DApp 퀵패스 간편 연동</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
              현재 보안을 위해 인앱 브라우저로 접속하셨습니다.<br/>
              구글 팝업 오류 방지를 위해, 사용하실 <strong>구글 이메일 주소</strong>와 성함을 직접 입력하시면 즉시 연동됩니다.
            </p>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label className="form-label" style={{ color: '#A78BFA' }}>구글 이메일 주소</label>
              <input 
                type="email" 
                className="form-input" 
                id="gpass-email"
                placeholder="예: email@gmail.com"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '25px' }}>
              <label className="form-label" style={{ color: '#A78BFA' }}>성함 (본명)</label>
              <input 
                type="text" 
                className="form-input" 
                id="gpass-name"
                placeholder="예: 홍길동"
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, padding: '12px' }}
                onClick={() => setShowGPassModal(false)}
              >
                취소
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, padding: '12px', background: 'var(--primary-gradient)' }}
                onClick={() => {
                  const email = document.getElementById('gpass-email').value.trim();
                  const name = document.getElementById('gpass-name').value.trim();
                  if (!email || !email.includes('@')) {
                    alert('유효한 구글 이메일 주소를 입력해주세요.');
                    return;
                  }
                  if (!name) {
                    alert('성함을 입력해주세요.');
                    return;
                  }
                  setGoogleEmail(email.toLowerCase());
                  setGoogleName(name);
                  setGoogleLoggedIn(true);
                  localStorage.setItem('google_email', email.toLowerCase());
                  localStorage.setItem('google_name', name);
                  setShowGPassModal(false);
                }}
              >
                연동 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
