import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, ShieldCheck, Wallet, Users, BarChart3, Settings, Sparkles, AlertTriangle, ArrowDownUp } from 'lucide-react';
import { ethers } from 'ethers';

import ConsentPage from './pages/ConsentPage';
import RegisterPage from './pages/RegisterPage';
import WaitingPage from './pages/WaitingPage';
import Dashboard from './pages/Dashboard';
import CouncilPage from './pages/CouncilPage';
import ManagerDashboard from './pages/ManagerDashboard';

import HistoryPage from './pages/HistoryPage';
import AdminDashboard from './pages/AdminDashboard';

import PcConsentPage from './pages/PcConsentPage';
import PcRegisterPage from './pages/PcRegisterPage';
import PcWaitingPage from './pages/PcWaitingPage';
import PcDashboard from './pages/PcDashboard';
import PcManagerDashboard from './pages/PcManagerDashboard';
import PcAdminDashboard from './pages/PcAdminDashboard';
import { isAdminGoogleAccount, isManagerAccount, isWalletOwnedByGoogleAccount } from './lib/accountIdentity';
import { hasApprovalRecoveryResumeFlag } from './lib/sutApprovalFlow';
import { buildTrustWalletOpenUrl, getPreferredInjectedProvider } from './lib/walletProvider';
import { clearAuthSession, getAuthToken, saveAuthSession } from './lib/authSession';

export const API_BASE = import.meta.env.VITE_API_BASE || 'https://edenai.alonics.com/api';

const GOOGLE_CLIENT_ID = '327843712323-1se9k7pkfftu0d4r19mdf355ptj5j75u.apps.googleusercontent.com';
const GOOGLE_OAUTH_SCOPE = 'openid email profile';

const sanitizeAndValidateAddress = (address) => {
  if (!address || typeof address !== 'string') return null;
  const cleaned = address.replace(/\s+/g, '').replace(/^Ox/i, '0x');
  return ethers.isAddress(cleaned) ? cleaned : null;
};

function AppContent() {
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [userStatus, setUserStatus] = useState('');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  const [googleLoggedIn, setGoogleLoggedIn] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const isAdminViewer = googleLoggedIn && isAdminGoogleAccount(googleEmail);
  const isManagerViewer = googleLoggedIn && isManagerAccount(userData, googleEmail, walletAddress);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!googleLoggedIn || !googleEmail || !isRegistered) return undefined;

    let cancelled = false;
    const refreshAccountRole = async () => {
      try {
        const response = await axios.get(`${API_BASE}/auth/status-by-email/${encodeURIComponent(googleEmail)}`);
        if (!cancelled && response.data.success && response.data.registered) {
          setUserData(response.data.user);
          setUserStatus(response.data.user.status);
        }
      } catch (error) {
        console.error('Failed to refresh account role:', error.message);
      }
    };

    refreshAccountRole();
    const interval = setInterval(refreshAccountRole, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [googleLoggedIn, googleEmail, isRegistered]);

  // 🌟 [PC Exclusive Manager Security] Mobile device (smartphone/tablet) connection judgment
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const shouldUseGoogleRedirectLogin = isMobileDevice;

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

  const applyGoogleProfile = async (profile, authToken) => {
    const email = profile.email?.toLowerCase().trim();
    if (!email) throw new Error('Google profile did not include an email address.');

    const name = profile.name || profile.given_name || email;
    saveAuthSession(authToken, { email, name });

    setLoading(true);
    const restoredWallet = await restoreSessionByEmail(email);
    if (!restoredWallet && walletAddress) {
      await checkUserStatus(walletAddress, email);
    }
    setLoading(false);

    setGoogleEmail(email);
    setGoogleName(name);
    setGoogleLoggedIn(true);
  };

  const createGoogleSession = async (proof) => {
    const response = await axios.post(`${API_BASE}/auth/google-session`, proof);
    if (!response.data.success || !response.data.token) {
      throw new Error('Google session creation failed.');
    }
    return response.data;
  };

  const restoreGoogleOAuthRedirect = async () => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    if (!hash) return false;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) return false;

    const session = await createGoogleSession({ accessToken });
    await applyGoogleProfile(session.profile, session.token);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await restoreGoogleOAuthRedirect();
      } catch (err) {
        console.error('Google OAuth redirect restore failed:', err);
        alert('Google 로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
      }

      let searchString = window.location.search;
      if (searchString.includes('&amp;')) {
        searchString = searchString.replace(/&amp;/g, '&');
      }
      const params = new URLSearchParams(searchString);
      const hashParams = new URLSearchParams(window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : '');
      const handoffToken = hashParams.get('auth_token');

      let currentEmail = '';
      let currentName = '';
      const authToken = handoffToken || getAuthToken();

      let _googleLoggedIn = false;
      if (authToken) {
        try {
          const sessionResponse = await axios.get(`${API_BASE}/auth/session`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          currentEmail = sessionResponse.data.profile.email;
          currentName = sessionResponse.data.profile.name;
          saveAuthSession(authToken, { email: currentEmail, name: currentName });
          setGoogleEmail(currentEmail);
          setGoogleName(currentName);
          setGoogleLoggedIn(true);
          _googleLoggedIn = true;
          if (handoffToken) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch {
          clearAuthSession();
        }
      }

      const promises = [];
      let emailWalletAddress = null;

      if (_googleLoggedIn && currentEmail) {
        promises.push(
          restoreSessionByEmail(currentEmail).then(addr => {
            if (addr) emailWalletAddress = addr;
          })
        );
      }

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
                if (emailWalletAddress && !hasApprovalRecoveryResumeFlag(window.location.href)) {
                  console.log("[AUTO-CONNECT] Email session already established. Skipping injected wallet overwrite.");
                } else {
                  await checkUserStatus(address, currentEmail);
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

  const handleGoogleCredentialResponse = async (response) => {
    try {
      const session = await createGoogleSession({ credential: response.credential });
      await applyGoogleProfile(session.profile, session.token);
      alert(`Google 계정 연동 완료: ${session.profile.email}`);
    } catch (e) {
      console.error('Google login verification failed:', e);
      alert('Google 로그인 인증에 실패했습니다. 다시 시도해주세요.');
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

  const checkUserStatus = async (address, authenticatedEmail = googleEmail) => {
    if (!address) return { registered: false, conflict: false };
    const cleanedAddress = sanitizeAndValidateAddress(address);
    if (!cleanedAddress) {
      alert('연결된 지갑 주소 형식이 올바르지 않습니다. 지갑 설정을 확인해 주세요.');
      setWalletAddress('');
      setIsRegistered(false);
      setUserStatus('');
      setUserData(null);
      return { registered: false, conflict: false };
    }
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/auth/status/${cleanedAddress}`);
      if (res.data.success) {
        if (res.data.registered) {
          if (authenticatedEmail && !isWalletOwnedByGoogleAccount(res.data.user, authenticatedEmail)) {
            setWalletAddress('');
            setIsRegistered(false);
            setUserStatus('');
            setUserData(null);
            alert('이미 다른 Google 계정으로 가입된 지갑입니다. 해당 지갑으로는 새 계정을 가입할 수 없습니다. 기존 가입 Google 계정으로 로그인하거나 다른 지갑을 연결해 주세요.');
            return { registered: true, conflict: true };
          }

          setWalletAddress(cleanedAddress);
          setIsRegistered(true);
          setUserStatus(res.data.user.status);
          setUserData(res.data.user);
          return { registered: true, conflict: false };
        } else {
          setWalletAddress(cleanedAddress);
          setIsRegistered(false);
          setUserStatus('');
          setUserData(null);
        }
      }
      return { registered: false, conflict: false };
    } catch (err) {
      console.error('회원 상태 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    const trustProvider = getPreferredInjectedProvider(window.ethereum);
    if (trustProvider) {
      try {
        const accounts = await trustProvider.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          const address = accounts[0];
          await checkUserStatus(address, googleEmail);
        }
      } catch (err) {
        alert('지갑 연결에 실패했거나 취소되었습니다.');
      }
    } else {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const baseUrl = window.location.origin + window.location.pathname;
        const authFragment = googleLoggedIn && getAuthToken()
          ? `#auth_token=${encodeURIComponent(getAuthToken())}`
          : '';
        const finalUrl = `${baseUrl}${authFragment}`;
        const trustDeepLink = buildTrustWalletOpenUrl(finalUrl);

        alert('Trust Wallet 앱으로 이동합니다. Trust Wallet에서 AiS를 열어 지갑을 연결해 주세요.');
        window.location.href = trustDeepLink;
      } else {
        alert('감지된 Trust Wallet 지갑이 없거나 잠겨 있습니다. PC 브라우저에 Trust Wallet 확장 프로그램을 설치/활성화하고 다시 시도해 주십시오.');
      }
    }
  };

  const disconnectWallet = () => {
    clearAuthSession();
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
            본 플랫폼은 폴리곤 네트워크 및 구글 OAuth 인증을 통합 연동합니다.
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
                  onClick={startGoogleRedirectLogin}
                >
                  Google 계정으로 안전하게 로그인
                </button>
                <div style={{ fontSize: '10px', color: '#A78BFA', lineHeight: '1.4', padding: '0 10px' }}>
                  Google 인증을 완료한 계정만 접근할 수 있습니다.
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
                <p>Google 공식 인증 및 폴리곤 Web3 다이렉트 연계를 결합하여 계정 권한을 안전하게 확인합니다.</p>
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
              isManagerViewer ? (
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
              isAdminViewer ? (
                isPcView ? (
                  <PcAdminDashboard walletAddress={walletAddress} managerEmail={googleEmail} />
                ) : (
                  <AdminDashboard walletAddress={walletAddress} managerEmail={googleEmail} />
                )
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

            <Route path="/login" element={
              !googleLoggedIn || isAdminViewer ? (
                isPcView ? renderPcIntro() : renderIntro()
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/consent" element={
              isAdminViewer || (googleLoggedIn && walletAddress && !isRegistered) ? (
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
              isAdminViewer || (googleLoggedIn && walletAddress && !isRegistered) ? (
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
              isAdminViewer || (googleLoggedIn && walletAddress && isRegistered && userStatus === 'PENDING_KYC') ? (
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

            <Route path="/council" element={
              googleLoggedIn && walletAddress && isRegistered && userStatus === 'APPROVED' ? (
                <CouncilPage />
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/history" element={
              isAdminViewer || (googleLoggedIn && walletAddress && isRegistered && userStatus === 'APPROVED') ? (
                isPcView && !isAdminViewer ? (
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
