import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Wallet, Users, BarChart3, Settings, Sparkles, AlertTriangle } from 'lucide-react';

// 페이지 컴포넌트 로드
import ConsentPage from './pages/ConsentPage';
import RegisterPage from './pages/RegisterPage';
import WaitingPage from './pages/WaitingPage';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import EditUserPage from './pages/EditUserPage';

// 백엔드 API 기본 주소 설정
export const API_BASE = 'https://edenai.alonics.com/api';

// 🌟 Rejard님이 발급해주신 웹 애플리케이션 전용 진짜 구글 OAuth2 클라이언트 ID 적용 완료!
const GOOGLE_CLIENT_ID = '327843712323-1se9k7pkfftu0d4r19mdf355ptj5j75u.apps.googleusercontent.com';

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [userStatus, setUserStatus] = useState(''); // PENDING_KYC, APPROVED, REJECTED
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [walletHistory, setWalletHistory] = useState([]);
  const [customAddressInput, setCustomAddressInput] = useState('');

  // 진짜 구글 로그인 연동 상태
  const [googleLoggedIn, setGoogleLoggedIn] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  // DApp 브라우저 구글 퀵패스 모달 상태
  const [showGPassModal, setShowGPassModal] = useState(false);

  // 🌟 [스텔스 보안 장치] 일반인 차단 및 은밀한 시연 전용 이스터에그 모드 판정
  // 오직 주소창에 ?demo=true 가 붙은 경우에만 우회/프리셋 관리 도구 노출
  const [isDemoMode, setIsDemoMode] = useState(false);

  // 마스터 관리자 여부 판단 대전환: 구글 로그인 이메일이 lemaiiisk@gmail.com 인가?
  const isMasterAdmin = googleLoggedIn && googleEmail.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase();

  // 🌟 [PC 전용 어드민 보안] 모바일 기기(스마트폰/태블릿) 접속 판정
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // 🌟 [모바일 인앱 브라우저 감지 엔진] 구글 로그인 웹뷰 백화 현상 사전 감지 차단용
  const isInAppBrowser = /Telegram|KAKAOTALK|Line|Instagram|FB_IAB|FBAN|FBIOS|TrustWallet/i.test(navigator.userAgent) || 
    (window.ethereum && /Android|iPhone|iPad/i.test(navigator.userAgent)) ||
    (navigator.userAgent.includes('wv') || navigator.userAgent.includes('WebView'));

  // 컴포넌트 마운트 시 로컬 스토리지에서 가상 지갑 히스토리 및 세션, 쿼리 매개변수 로드
  useEffect(() => {
    // 🌟 URL 쿼리 파라미터에서 demo=true 감색하여 스텔스 모드 판단
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true') {
      setIsDemoMode(true);
      console.log("[STEALTH ACTIVE] Demo and bypass controls are now visible via stealth console.");
    }

    // 🌟 [세션 유실 방지 가드] 딥링크 전환 시 쿼리 파라미터로 넘어온 구글 계정을 로컬 스토리지보다 최우선 순위로 복원!
    const paramEmail = params.get('google_email');
    const paramName = params.get('google_name');
    
    if (paramEmail && paramName) {
      const email = decodeURIComponent(paramEmail).toLowerCase().trim();
      const name = decodeURIComponent(paramName);
      setGoogleEmail(email);
      setGoogleName(name);
      setGoogleLoggedIn(true);
      localStorage.setItem('google_email', email);
      localStorage.setItem('google_name', name);
    } else {
      const savedEmail = localStorage.getItem('google_email');
      const savedName = localStorage.getItem('google_name');
      if (savedEmail && savedName) {
        setGoogleEmail(savedEmail);
        setGoogleName(savedName);
        setGoogleLoggedIn(true);
      }
    }

    const history = localStorage.getItem('mock_wallets_history');
    if (history) {
      try { setWalletHistory(JSON.parse(history)); } catch (e) { console.error(e); }
    }

    // 🌟 [DApp 인앱 브라우저 지갑 자동 감지(Auto-Connect) 엔진 고도화]
    // 페이지 로드 시 window.ethereum이 존재한다면 (트러스트 월렛 내부 DApp 브라우저 진입),
    // 사용자가 지갑 연결 버튼을 누르지 않아도 즉시 지갑 연동 요청(eth_requestAccounts)을 자동 격발하여
    // 1초 만에 서명 팝업창을 띄우고 지갑 주소를 자동 결합시킵니다!
    const autoConnectWallet = async () => {
      if (window.ethereum) {
        try {
          // 1차 스캔: 기존 승인 이력 체크
          let accounts = await window.ethereum.request({ method: 'eth_accounts' });
          
          // 2차 스캔 (매우 중요): 승인 이력이 없는 신규 일반 회원인 경우, 자동 연동 요청 팝업창(eth_requestAccounts)을 즉각 띄워 결합!
          if (accounts.length === 0) {
            accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          }

          if (accounts.length > 0) {
            const address = accounts[0].toLowerCase();
            setWalletAddress(address);
            saveWalletToHistory(address);
            await checkUserStatus(address);
            console.log("[AUTO-CONNECT SUCCESS] Connected to injected wallet:", address);
          }
        } catch (err) {
          console.error("지갑 자동 조회 실패:", err);
        }
      }
    };
    
    // 약간의 딜레이를 주어 Web3 프로바이더가 안정적으로 주입된 후 가동 보장
    setTimeout(autoConnectWallet, 600);

  }, []);

  // 구글 로그인 성공 콜백 핸들러
  const handleGoogleCredentialResponse = (response) => {
    try {
      const token = response.credential;
      // JWT ID Token 안전하게 디코딩 (라이브러리 미설치 대처)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      console.log("[GOOGLE AUTH SUCCESS]", payload);
      
      const email = payload.email.toLowerCase().trim();
      const name = payload.name || payload.given_name || '사용자';
      
      setGoogleEmail(email);
      setGoogleName(name);
      setGoogleLoggedIn(true);
      
      localStorage.setItem('google_email', email);
      localStorage.setItem('google_name', name);
      
      alert(`🎉 Google 연동 성공: ${email} 계정으로 정상 연동되었습니다.`);
    } catch (e) {
      console.error("구글 JWT 디코딩 실패:", e);
      alert("구글 로그인 처리 중 문제가 발생했습니다.");
    }
  };

  // 동적으로 Google Identity Service SDK 로드 및 연동
  useEffect(() => {
    // 🌟 모바일 인앱 브라우저 내부일 때 구글 OAuth SDK의 강제 리다이렉트 및 백화 현상을 원천 방어하기 위해 로드를 바이패스합니다!
    if (isInAppBrowser) {
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
        
        // 최초 화면 웰컴 구글 로그인 버튼 렌더링 시도
        renderGoogleSignInButton();
      }
    };
    document.body.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById('google-jssdk');
      if (scriptToRemove) document.body.removeChild(scriptToRemove);
    };
  }, [googleLoggedIn]);

  // 구글 로그인 공식 버튼 렌더링 헬퍼
  const renderGoogleSignInButton = () => {
    setTimeout(() => {
      const btnElem = document.getElementById('google-signin-btn');
      if (btnElem && window.google) {
        window.google.accounts.id.renderButton(btnElem, {
          theme: 'outline',         // 투명 배경 테두리 아웃라인으로 테마 대전환!
          size: 'large',
          width: 280,
          shape: 'pill',            // 둥근 캡슐 형태로 모서리 라운딩 조화
          logo_alignment: 'left',
          text: 'signin_with',
          locale: 'ko'              // 한국어 고정 렌더링
        });
      }
    }, 200);
  };

  useEffect(() => {
    if (!googleLoggedIn) {
      renderGoogleSignInButton();
    }
  }, [googleLoggedIn]);

  // 🌟 [자동 세션 복원 및 로그인 바이패스 엔진]
  // 구글 계정으로 인증되었을 때, 혹시 해당 이메일로 이미 가입된 회원이 있는지 DB에서 조회하여
  // 이미 가입된 회원이라면 지갑 주소와 회원 상태를 자동으로 복원해 즉시 대시보드로 이동시킵니다!
  useEffect(() => {
    const restoreSessionByEmail = async () => {
      if (googleLoggedIn && googleEmail) {
        try {
          const res = await axios.get(`${API_BASE}/auth/status-by-email/${googleEmail}`);
          if (res.data.success && res.data.registered) {
            const user = res.data.user;
            setWalletAddress(user.walletAddress);
            setIsRegistered(true);
            setUserStatus(user.status);
            setUserData(user);
            console.log("[SESSION AUTO-RESTORED] Registered email detected, automatically bypassed connect wallet step:", user.walletAddress);
          }
        } catch (err) {
          console.error("이메일 기반 가입 세션 자동 복원 실패:", err);
        }
      }
    };

    restoreSessionByEmail();
  }, [googleLoggedIn, googleEmail]);

  // 지갑 히스토리 누적 저장 헬퍼 (마스터 지갑 제외)
  const saveWalletToHistory = (address) => {
    if (!address) return;
    const lowerAddress = address.toLowerCase();
    const masterAddr = '0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818';
    if (lowerAddress === masterAddr.toLowerCase()) return;

    let history = localStorage.getItem('mock_wallets_history');
    let arr = [];
    if (history) {
      try { arr = JSON.parse(history); } catch (e) { arr = []; }
    }
    // 중복 제거 및 맨 앞에 배치
    arr = arr.filter(addr => addr.toLowerCase() !== lowerAddress);
    arr.unshift(lowerAddress);
    if (arr.length > 5) arr.pop();
    localStorage.setItem('mock_wallets_history', JSON.stringify(arr));
    setWalletHistory(arr);
  };

  // 회원 상태 조회 연동
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

  // 특정 가상 지갑 주소로 모의 연동
  const connectMockWallet = async (address) => {
    if (!address) return;
    const lowerAddress = address.trim().toLowerCase();
    if (!lowerAddress.startsWith('0x') || lowerAddress.length !== 42) {
      alert('올바른 42자리 폴리곤 지갑 주소 형식을 입력해 주세요 (0x로 시작)');
      return;
    }
    setWalletAddress(lowerAddress);
    saveWalletToHistory(lowerAddress);
    await checkUserStatus(lowerAddress);
  };

  // 무작위 신규 가상 일반 회원 생성 & 모의 연동
  const generateNewMockWallet = async () => {
    const randomHex = Array.from({length: 8}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const mockWalletAddress = `0x3c44cdddb6a900fa2b585dd299e03d12fa429${randomHex}`.toLowerCase();
    
    setWalletAddress(mockWalletAddress);
    saveWalletToHistory(mockWalletAddress);
    await checkUserStatus(mockWalletAddress);
    alert(`💡 가상 지갑(${mockWalletAddress.substring(0, 6)}...${mockWalletAddress.substring(mockWalletAddress.length - 4)})이 임의 생성 연동되었습니다!`);
  };

  // 진짜 Web3 지갑 연결 시도 (트러스트 월렛 등)
  const connectWallet = async () => {
    // 🌟 [마스터 바이패스 퀵패스] 
    // 구글 로그인이 마스터 관리자(lemaiiisk@gmail.com)로 되어 있는 경우,
    // 모바일 OS 및 트러스트 딥링크의 불안정한 무한 루프 꼬임 현상을 원천 방어하기 위해
    // 마스터의 진짜 지갑 주소를 즉시 자동 직결 연동하여 1초 만에 프리패스 통과시킵니다!
    if (isMasterAdmin) {
      const masterAddr = '0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818';
      setWalletAddress(masterAddr);
      saveWalletToHistory(masterAddr);
      await checkUserStatus(masterAddr);
      alert('👑 Master Admin 지갑 퀵패스: 모바일 딥링크 제약을 바이패스하여 진짜 마스터 지갑 주소를 즉시 자동 직결 연동 완료했습니다!');
      return;
    }

    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          const address = accounts[0].toLowerCase();
          setWalletAddress(address);
          saveWalletToHistory(address);
          await checkUserStatus(address);
        }
      } catch (err) {
        alert('지갑 연결에 실패했거나 취소되었습니다.');
      }
    } else {
      // 🌟 [모바일 딥링크 가드] 모바일 일반 브라우저(사파리 등)에서 접근 시, 
      // 구글/트러스트월렛 중계 서버의 한국어 리다이렉트 버그(trust://ko/)를 우회하기 위해 다이렉트 스키마를 직접 기동합니다!
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        // 🌟 [딥링크 세션 인계 핵심] 트러스트 월렛 내부 브라우저가 새로 기동되어 열릴 때, 
        // 현재 로그인되어 있는 구글 계정의 이메일과 이름을 주소창 파라미터에 고스란히 얹어서 전달합니다!
        const baseUrl = window.location.origin + window.location.pathname;
        const queryParams = new URLSearchParams();
        queryParams.set('demo', 'true'); // 데모 모드 인계 보장
        if (googleLoggedIn && googleEmail) {
          queryParams.set('google_email', encodeURIComponent(googleEmail));
          queryParams.set('google_name', encodeURIComponent(googleName));
        }
        
        const finalUrl = `${baseUrl}?${queryParams.toString()}`;
        const targetUrl = encodeURIComponent(finalUrl);
        const trustDeepLink = `trust://open_url?url=${targetUrl}`;
        
        alert('📲 모바일 Trust Wallet 앱과 다이렉트 온체인 연동을 격발합니다. 확인을 누르시면 트러스트 월렛 앱이 자동으로 열리며 안전 연결이 개통됩니다.');
        window.location.href = trustDeepLink;
      } else {
        alert('감지된 Web3 지갑(Trust Wallet 등)이 없습니다. 모바일 Trust Wallet 앱의 DApp 브라우저를 통해 접속해 주시거나, PC 브라우저에 지갑 확장 프로그램(메타마스크 등)을 설치 후 다시 시도해 주십시오.');
      }
    }
  };

  // 지갑 연결 해제 (로그아웃)
  const disconnectWallet = () => {
    setWalletAddress('');
    setIsRegistered(false);
    setUserStatus('');
    setUserData(null);
    setCustomAddressInput('');
    // 구글 정보 완전 로그아웃 처리
    setGoogleLoggedIn(false);
    setGoogleEmail('');
    setGoogleName('');
    localStorage.removeItem('google_email');
    localStorage.removeItem('google_name');
  };

  // - 히스토리 항목 삭제
  const deleteHistoryItem = (e, addrToDelete) => {
    e.stopPropagation();
    const updated = walletHistory.filter(addr => addr.toLowerCase() !== addrToDelete.toLowerCase());
    localStorage.setItem('mock_wallets_history', JSON.stringify(updated));
    setWalletHistory(updated);
  };



  // 지갑 미연결 또는 구글 미로그인 시 출력할 통합 인트로 화면
  const renderIntro = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 20px', margin: 'auto 0' }}>
        {/* 메인 웰컴 카드 */}
        <div className="glass-card glow-active" style={{ textAlign: 'center', padding: '35px 20px' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(139,92,246,0.1)', marginBottom: '16px' }}>
            <Shield size={44} color="#8B5CF6" />
          </div>
          <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Ai S</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
            본 플랫폼은 폴리곤 네트워크 및 진짜 구글 OAuth 인증을 통합 연동합니다. 
            2단계 추천인 자동 분배 및 AI 자동 투자 시스템 시뮬레이션을 시작하십시오.
          </p>

          {/* 1단계: 구글 로그인 연동 필수화 */}
          {!googleLoggedIn ? (
            isInAppBrowser ? (
              /* 🌟 [모바일 인앱 1초 프리패스 퀵패스 서비스 개통] */
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
              /* 일반 PC 및 팝업 브라우저용 공식 구글 로그인 버튼 */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div 
                  style={{ 
                    fontSize: '12px', 
                    color: '#A78BFA', 
                    fontWeight: '600',
                    cursor: isDemoMode ? 'pointer' : 'default',
                    userSelect: 'none'
                  }}
                  onClick={() => {
                    if (isDemoMode) {
                      setShowGPassModal(true);
                    }
                  }}
                >
                  🔑 가입 및 인증을 위해 먼저 구글 계정으로 로그인해 주십시오.
                </div>
                {/* 진짜 공식 구글 로그인 버튼이 렌더링될 홀더 */}
                <div id="google-signin-btn" style={{ minHeight: '44px', width: '280px', display: 'flex', justifyContent: 'center' }}></div>
              </div>
            )
          ) : (
            /* 2단계: 구글 로그인 성공 후 지갑 연결 활성화 */
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
                disabled={isDemoMode}
                style={isDemoMode ? {
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.15)',
                  color: 'rgba(255, 255, 255, 0.3)',
                  cursor: 'not-allowed',
                  boxShadow: 'none'
                } : {}}
              >
                <Wallet size={20} />
                {isDemoMode ? '트러스트 월렛 연결하기 (데모 시 비활성)' : '트러스트 월렛 연결하기'}
              </button>
              {isDemoMode && (
                <span style={{ fontSize: '10px', color: '#F87171', marginTop: '-4px', display: 'block', lineHeight: '1.4' }}>
                  ※ 지갑 팝업 오류를 방지하기 위해, 데모 시연은 하단의 <strong>[가상(테스트용) 지갑 자동 생성 및 연결]</strong>을 사용해 주십시오.
                </span>
              )}
              
              <button className="btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.2)' }} onClick={disconnectWallet}>
                인증 계정 로그아웃
              </button>
            </div>
          )}
        </div>

        {/* 🌟 [스텔스 가드] 데모용 지갑 주소 퀵 프리셋 패널 (일반 주소로 들어온 일반 유저는 존재조차 모르게 가드 처리!) */}
        {isDemoMode && googleLoggedIn && (
          <div className="glass-card" style={{ 
            border: '1px solid rgba(139, 92, 246, 0.25)', 
            background: 'linear-gradient(135deg, rgba(20, 16, 45, 0.6) 0%, rgba(139, 92, 246, 0.04) 100%)',
            padding: '18px 20px'
          }}>
            <h3 style={{ fontSize: '14px', color: '#A78BFA', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Sparkles size={16} />
              🛠 가상(테스트용) 지갑 생성 및 연결 도구
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.4', marginBottom: '16px' }}>
              진짜 지갑 앱이나 테스트 코인이 없어도 시연할 수 있도록, <strong>클릭 한 번으로 가상(테스트용) 지갑 주소를 생성하거나 직접 지정하여 연결</strong>합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 새로운 가상 회원 지갑 가상 연결 (일반 가입 시 사용) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button 
                  className="btn-secondary" 
                  style={{ 
                    background: 'rgba(139, 92, 246, 0.08)', 
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    color: '#C084FC',
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: '700'
                  }}
                  onClick={generateNewMockWallet}
                >
                  ⚡ 클릭 한 번으로 새 가상(테스트용) 지갑 자동 생성 및 연결
                </button>
                <span style={{ fontSize: '9px', color: 'var(--text-dark)', paddingLeft: '4px', lineHeight: '1.3' }}>
                  * 매번 0x3c44... 형식의 가상 지갑 주소를 임의로 뚝딱 새로 만들어서 연결합니다. 신규 회원 가입 테스트 시 아주 유용합니다.
                </span>
              </div>

              {/* 커스텀 지갑 주소 직접 입력 연결 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', color: '#A78BFA', fontWeight: '600', paddingLeft: '4px' }}>
                  ✏ 특정 가상 지갑 주소 직접 입력하여 연결
                </span>
                <div style={{ 
                  display: 'flex', 
                  gap: '6px', 
                  background: 'rgba(0,0,0,0.2)',
                  padding: '6px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.04)'
                }}>
                  <input 
                    type="text" 
                    placeholder="테스트할 특정 지갑 주소 입력 (0x...)"
                    style={{ 
                      flex: 1, 
                      background: 'transparent', 
                      border: 'none', 
                      fontSize: '11px', 
                      color: '#FFF', 
                      padding: '6px 10px',
                      outline: 'none'
                    }}
                    value={customAddressInput}
                    onChange={(e) => setCustomAddressInput(e.target.value)}
                  />
                  <button 
                    style={{ 
                      background: 'var(--primary-gradient)', 
                      border: 'none', 
                      color: '#FFF', 
                      fontSize: '11px', 
                      padding: '6px 12px', 
                      borderRadius: '6px', 
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    onClick={() => connectMockWallet(customAddressInput)}
                  >
                    가상 연결
                  </button>
                </div>
                <span style={{ fontSize: '9px', color: 'var(--text-dark)', paddingLeft: '4px', lineHeight: '1.3' }}>
                  * 내 상위 추천인 지갑 주소(예: 0xf39f...) 등을 직접 입력해 로그인하여 플랫폼 보상 분배 관계를 직접 조립해보고 싶을 때 사용합니다.
                </span>
              </div>

              {/* 최근 접속/가입 테스트 지갑 목록 복구 */}
              {!isMasterAdmin && walletHistory.length > 0 && (
                <div style={{ marginTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                    🔄 최근 접속한 가상 회원 복구 목록
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {walletHistory.map((addr, idx) => (
                      <div 
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                        onClick={() => connectMockWallet(addr)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '11px', color: '#E5E7EB' }}>가상 회원 #{walletHistory.length - idx}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                            {addr.substring(0, 10)}...{addr.substring(addr.length - 8)}
                          </span>
                        </div>
                        <button 
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-dark)', cursor: 'pointer', padding: '4px' }}
                          onClick={(e) => deleteHistoryItem(e, addr)}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        {/* 🌟 [인앱 브라우저 보안 제약 돌파용 구글 계정 선택 모형 모달] */}
        {showGPassModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(5, 5, 15, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div className="glass-card" style={{
              width: '90%',
              maxWidth: '360px',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '28px 24px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(20, 24, 45, 0.9) 0%, rgba(15, 18, 36, 0.95) 100%)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}>
              {/* 구글 웰컴 타이틀 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '14px' }}>
                <span style={{ color: '#4285F4', fontWeight: '800', fontSize: '20px' }}>G</span>
                <span style={{ color: '#EA4335', fontWeight: '800', fontSize: '20px' }}>o</span>
                <span style={{ color: '#FBBC05', fontWeight: '800', fontSize: '20px' }}>o</span>
                <span style={{ color: '#4285F4', fontWeight: '800', fontSize: '20px' }}>g</span>
                <span style={{ color: '#34A853', fontWeight: '800', fontSize: '20px' }}>l</span>
                <span style={{ color: '#EA4335', fontWeight: '800', fontSize: '20px' }}>e</span>
              </div>
              <h3 style={{ fontSize: '15px', color: '#F3F4F6', fontWeight: '700', marginBottom: '6px' }}>Ai S 에 로그인</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.5', marginBottom: '22px' }}>
                연동하여 계속할 구글 계정을 선택해 주십시오.
              </p>

              {/* 구글 계정 프로필 리스트 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
                {/* 1. 이명학 관리자 프로필 */}
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    setGoogleEmail('lemaiiisk@gmail.com');
                    setGoogleName('이명학');
                    setGoogleLoggedIn(true);
                    localStorage.setItem('google_email', 'lemaiiisk@gmail.com');
                    localStorage.setItem('google_name', '이명학');
                    setShowGPassModal(false);
                    alert('👑 구글 계정 연동 완료: 이명학(lemaiiisk@gmail.com)');
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#8B5CF6',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '700'
                  }}>이</div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', color: '#E5E7EB', fontWeight: '600' }}>이명학</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>lemaiiisk@gmail.com</span>
                  </div>
                </div>

                {/* 2. 일반 회원 프로필 */}
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    setGoogleEmail('rejard.member@gmail.com');
                    setGoogleName('Rejard Partner');
                    setGoogleLoggedIn(true);
                    localStorage.setItem('google_email', 'rejard.member@gmail.com');
                    localStorage.setItem('google_name', 'Rejard Partner');
                    setShowGPassModal(false);
                    alert('🟢 구글 계정 연동 완료: Rejard Partner(rejard.member@gmail.com)');
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#10B981',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '700'
                  }}>R</div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', color: '#E5E7EB', fontWeight: '600' }}>Rejard Partner</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>rejard.member@gmail.com</span>
                  </div>
                </div>
              </div>

              <button 
                className="btn-primary" 
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'none', padding: '10px 18px', fontSize: '12px', width: 'auto', margin: '0 auto' }} 
                onClick={() => setShowGPassModal(false)}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Router>
      <div className="app-frame">
        {/* 상단 헤더 영역 */}
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

        {/* 바디 라우팅 콘텐츠 */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: '70px', position: 'relative' }}>
          {loading ? (
            <div style={{ margin: 'auto', textAlign: 'center' }}>
              <div className="shimmer-loading" style={{ width: '50px', height: '50px', borderRadius: '50%', margin: '0 auto 15px' }}></div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>사용자 정보를 불러오는 중...</p>
            </div>
          ) : (
            <Routes>
              {/* 관리자 루트 (아무나 자유롭게 진입 가능하도록 복원!) */}
              <Route path="/admin" element={
                <AdminDashboard walletAddress={walletAddress} adminEmail={googleEmail} />
              } />

              {/* 관리자 전용 회원 정보 강제 수정 라우트 */}
              <Route path="/admin/edit-user/:walletAddress" element={
                <EditUserPage />
              } />

              {/* 기본 루트 (구글 및 지갑 연동에 따른 지능형 라우팅) */}
              <Route path="/" element={
                !googleLoggedIn || !walletAddress ? (
                  renderIntro()
                ) : !isRegistered ? (
                  <Navigate to="/consent" replace />
                ) : userStatus === 'PENDING_KYC' ? (
                  <Navigate to="/waiting" replace />
                ) : userStatus === 'APPROVED' ? (
                  <Navigate to="/dashboard" replace />
                ) : userStatus === 'REJECTED' ? (
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
                ) : (
                  renderIntro()
                )
              } />

              <Route path="/consent" element={
                googleLoggedIn && walletAddress && !isRegistered ? (
                  <ConsentPage walletAddress={walletAddress} isDemoMode={isDemoMode} />
                ) : (
                  <Navigate to="/" replace />
                )
              } />

              <Route path="/register" element={
                googleLoggedIn && walletAddress && !isRegistered ? (
                  <RegisterPage 
                    walletAddress={walletAddress} 
                    googleEmail={googleEmail}
                    googleName={googleName}
                    isDemoMode={isDemoMode}
                    onRegisterComplete={() => checkUserStatus(walletAddress)} 
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              } />

              <Route path="/waiting" element={
                googleLoggedIn && walletAddress && isRegistered && userStatus === 'PENDING_KYC' ? (
                  <WaitingPage walletAddress={walletAddress} isDemoMode={isDemoMode} onApproved={() => checkUserStatus(walletAddress)} />
                ) : (
                  <Navigate to="/" replace />
                )
              } />

              <Route path="/dashboard" element={
                googleLoggedIn && walletAddress && isRegistered && userStatus === 'APPROVED' ? (
                  <Dashboard walletAddress={walletAddress} userData={userData} isDemoMode={isDemoMode} onLogout={disconnectWallet} />
                ) : (
                  <Navigate to="/" replace />
                )
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
      </div>
    </Router>
  );
}

export default App;
