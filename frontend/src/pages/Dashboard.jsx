import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  TrendingUp, TrendingDown, Wallet, Users, AlertTriangle, 
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Play, Sparkles 
} from 'lucide-react';
import { API_BASE } from '../App';

function Dashboard({ walletAddress, userData, isDemoMode, onLogout }) {
  const navigate = useNavigate();
  // 포트폴리오 및 시세 상태
  const [portfolio, setPortfolio] = useState(null);
  const [prices, setPrices] = useState(null);
  
  // 카운트다운 타이머 상태
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [trialExpired, setTrialExpired] = useState(false);

  // 투자 비율 조절 상태
  const [ratioPol, setRatioPol] = useState(50);
  const [ratioUsdt, setRatioUsdt] = useState(50);
  const [riskConfirmed, setRiskConfirmed] = useState(false);
  const [savingRatio, setSavingRatio] = useState(false);

  // 🌟 AI 자동 투자 ON/OFF 스위칭 상태 (각 지갑 매핑 로컬 스토리지 및 세션 비동기 방어 연동)
  const [aiActive, setAiActive] = useState(true);

  useEffect(() => {
    if (walletAddress) {
      const saved = localStorage.getItem(`aiActive_${walletAddress}`);
      setAiActive(saved !== 'false');
    }
  }, [walletAddress]);

  const handleToggleAiActive = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const nextState = !aiActive;
    setAiActive(nextState);
    if (walletAddress) {
      localStorage.setItem(`aiActive_${walletAddress}`, String(nextState));
    }
  };

  // 🌟 실시간 수익률 곡선 그래프용 히스토리 축적 상태 (기초 웰컴 지지 히스토리 10포인트 선탑재)
  const [profitHistory, setProfitHistory] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // 🌟 [Rejard님 특급 승인] 비율 구동 수동 해지 및 잠금 강제 해제 상태
  const [manualUnlocked, setManualUnlocked] = useState(false);

  const handleUnlockRatio = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (confirm("🔓 현재 가동 중인 비율 구동 설정을 수동 해제하고 비중 재설정 모드로 전환하시겠습니까?")) {
      setManualUnlocked(true);
      setRiskConfirmed(false); // 동의 체크 해제
    }
  };

  // 자금 입출금 다이얼로그 상태
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('DEPOSIT'); // DEPOSIT or WITHDRAW
  const [txAmount, setTxAmount] = useState('');
  const [processingTx, setProcessingTx] = useState(false);

  // 추천 보상 및 결제 히스토리
  const [referralCount1, setReferralCount1] = useState(0);
  const [referralCount2, setReferralCount2] = useState(0);
  const [totalRewards, setTotalRewards] = useState(0);
  const [paymentHistory, setPaymentHistory] = useState([]);
  
  // 데모 가입비 격발 상태
  const [triggeringCharge, setTriggeringCharge] = useState(false);

  // 🌟 DB에 실제로 저장되어 가동 중인 실시간 AI 리밸런싱 비율 산출
  const activePolRatio = portfolio?.ratios?.POL !== undefined ? portfolio.ratios.POL : 50;
  const activeUsdtRatio = portfolio?.ratios?.USDT !== undefined ? portfolio.ratios.USDT : 50;
  const isRatioMatched = (activePolRatio === ratioPol && activeUsdtRatio === ratioUsdt) && !manualUnlocked;

  // 1. 핵심 데이터 로드
  const fetchDashboardData = async () => {
    try {
      // 포트폴리오 정보 로드
      const portRes = await axios.get(`${API_BASE}/investment/portfolio/${walletAddress}`);
      if (portRes.data.success) {
        setPortfolio(portRes.data.portfolio);
        
        // 🌟 [Rejard님 특급 버그 소멸 패치]
        // 사용자가 슬라이더를 만져서 비율을 조절하고 있거나 수동 해제하여 '저장 대기' 상태인 경우에는,
        // 5초 폴링 시 백엔드의 옛날 비율 값을 슬라이더에 강제 덮어쓰지 않고 사용자의 입력 상태를 그대로 보존합니다!
        const dbPol = portRes.data.portfolio.ratios.POL;
        const dbUsdt = portRes.data.portfolio.ratios.USDT;
        const isCurrentlyAdjusting = (ratioPol !== dbPol || ratioUsdt !== dbUsdt);

        if (!isCurrentlyAdjusting && !manualUnlocked) {
          setRatioPol(dbPol);
          setRatioUsdt(dbUsdt);
        }
        
        // 🌟 실시간 수익률 곡선 그래프용 히스토리 동적 큐잉 축적 (최대 15포인트 제한)
        const curProfit = portRes.data.portfolio.profitPercent;
        setProfitHistory(prev => {
          const nextHistory = [...prev, curProfit];
          if (nextHistory.length > 15) {
            nextHistory.shift();
          }
          return nextHistory;
        });
      }

      // 시세 정보 로드
      const priceRes = await axios.get(`${API_BASE}/investment/prices`);
      if (priceRes.data.success) {
        setPrices(priceRes.data.prices);
      }

      // 추천 통계 및 내역 로드 (보안 격리된 전용 퍼블릭 API 결합)
      const statsRes = await axios.get(`${API_BASE}/auth/payments/${walletAddress}`);
      if (statsRes.data.success) {
        setPaymentHistory(statsRes.data.payments);
      }

      // 나의 추천 보상 내역 및 카운트 실시간 로드 (대소문자 오차 0% 신설 API 결합)
      const refStatsRes = await axios.get(`${API_BASE}/auth/referral-stats/${walletAddress}`);
      if (refStatsRes.data.success) {
        setReferralCount1(refStatsRes.data.referralCount1);
        setReferralCount2(refStatsRes.data.referralCount2);
        setTotalRewards(refStatsRes.data.totalRewards);
      }

    } catch (err) {
      console.error('대시보드 데이터 조회 실패:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // 5초 간격 시황 및 포트폴리오 강제 리프레시 (생동감 극대화)
    const refreshTimer = setInterval(() => {
      const isCurrentActive = localStorage.getItem(`aiActive_${walletAddress}`) !== 'false';
      if (isCurrentActive) {
        fetchDashboardData();
      }
    }, 5000);
    return () => clearInterval(refreshTimer);
  }, [walletAddress, aiActive, ratioPol, ratioUsdt, manualUnlocked]);

  // 2. 무료 체험 카운트다운 타이머 구동
  useEffect(() => {
    if (!userData || !userData.trialEndsAt) return;

    const timer = setInterval(() => {
      const difference = +new Date(userData.trialEndsAt) - +new Date();
      
      if (difference <= 0) {
        clearInterval(timer);
        setTrialExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
        setTrialExpired(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [userData]);

  // 3. 투자 비율 변경 제출
  const handleRatioSave = async () => {
    if (!aiActive) {
      alert('⚠️ AI 자동 투자가 일시 정지된 상태입니다.\n먼저 우측 상단의 [AI 자동 투자] 버튼을 눌러 활성화(ON)해 주신 뒤에 리밸런싱을 집행해 주세요.');
      return;
    }
    if (!riskConfirmed) {
      alert('투자 손실 책임 면책 약관에 동의해 주셔야 설정이 완료됩니다.');
      return;
    }
    setSavingRatio(true);
    try {
      const res = await axios.post(`${API_BASE}/investment/update-ratio`, {
        walletAddress,
        ratioPol,
        ratioUsdt,
        confirmed: true
      });
      if (res.data.success) {
        alert(res.data.message);
        setRiskConfirmed(false);
        fetchDashboardData();
      }
    } catch (err) {
      alert('비율 설정 실패: ' + err.message);
    } finally {
      setSavingRatio(false);
    }
  };

  // 4. 모의 자금 입금/출금 처리 (돈을 뺏다 넣었다)
  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!txAmount || parseFloat(txAmount) <= 0) {
      alert('유효한 금액을 입력해 주세요.');
      return;
    }

    setProcessingTx(true);
    try {
      if (txType === 'DEPOSIT') {
        const res = await axios.post(`${API_BASE}/investment/deposit`, {
          walletAddress,
          amount: parseFloat(txAmount)
        });
        if (res.data.success) {
          alert(`🎉 성공적으로 ${txAmount} USDT 가상 자산이 투자 풀에 입금 예치되었습니다.`);
        }
      } else {
        // 출금 한도 체크
        if (portfolio && parseFloat(txAmount) > portfolio.totalValuation) {
          alert('출금 요청 금액이 현재 총 평가 가치 한도를 초과합니다.');
          setProcessingTx(false);
          return;
        }
        const res = await axios.post(`${API_BASE}/investment/withdraw`, {
          walletAddress,
          amount: parseFloat(txAmount)
        });
        if (res.data.success) {
          alert(`📤 성공적으로 ${txAmount} USDT 가상 자산이 출금되어 본인 지갑으로 환원되었습니다.`);
        }
      }
      setShowTxModal(false);
      setTxAmount('');
      fetchDashboardData();
    } catch (err) {
      alert('거래 처리 실패: ' + err.message);
    } finally {
      setProcessingTx(false);
    }
  };

  // 5. 데모용 즉시 가입비/월정액 강제 청구 및 분배 테스트
  const handleTriggerCharge = async () => {
    if (!confirm('10일을 기다리지 않고 즉시 100 USDT 가입비를 청구하여 스마트 컨트랙트 인출 및 2단계 추천인 분배(각 25 USDT)를 격발하시겠습니까?')) {
      return;
    }
    setTriggeringCharge(true);
    try {
      const res = await axios.post(`${API_BASE}/cron/trigger-charge-manually`, {
        walletAddress
      });
      if (res.data.success) {
        alert(`${res.data.message}\n\n🔗 온체인 트랜잭션 해시:\n${res.data.txHash}`);
        fetchDashboardData();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert('격발 실패: ' + errMsg);
    } finally {
      setTriggeringCharge(false);
    }
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* 🌟 마스터 관리자 전용 '본사 어드민 관제탑 복귀' 단축 바 */}
      {userData && userData.email && userData.email.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase() && (
        <div 
          className="glass-card glow-active" 
          onClick={() => navigate('/admin')}
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
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#C084FC' }}>마스터 어드민 연동 중</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>현재 사용자 뷰를 모니터링 중입니다. 터치 시 즉시 관제탑으로 복귀합니다.</div>
            </div>
          </div>
          <button 
            className="btn-primary" 
            style={{ width: 'auto', padding: '6px 14px', fontSize: '11px', borderRadius: '8px', background: 'var(--primary-gradient)', boxShadow: 'none' }}
          >
            관제탑 가기
          </button>
        </div>
      )}


      {/* 가입 사용자 이름 및 아바타 환영 배너 카드 */}
      <div className="glass-card" style={{ 
        padding: '15px 18px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ 
          width: '42px', 
          height: '42px', 
          borderRadius: '50%', 
          background: 'var(--primary-gradient)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          fontSize: '18px',
          fontWeight: '700',
          color: '#FFFFFF'
        }}>
          {(userData && userData.name ? userData.name.substring(0, 1).toUpperCase() : '👤')}
        </div>
        <div>
          <h3 style={{ fontSize: '16px', color: '#F3F4F6' }}>
            {userData ? userData.name : '테스트 회원'} 님
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {userData ? userData.email : '이메일 정보 없음'}
          </span>
        </div>
      </div>

      {/* 1. 카운트다운 타이머 글라스 카드 */}
      <div className="glass-card glow-active" style={{ 
        padding: '20px', 
        background: 'linear-gradient(135deg, rgba(23, 27, 44, 0.8) 0%, rgba(99, 102, 241, 0.08) 100%)',
        position: 'relative'
      }}>
        
        {userData && userData.tier === 'TRIAL' && !trialExpired ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: '700', letterSpacing: '0.05em' }}>
                🎁 10일 무료 체험 멤버십 혜택 중
              </span>
              <span className="badge badge-pending" style={{ fontSize: '10px' }}>TRIAL RUNNING</span>
            </div>
            
            {/* 타이머 레이아웃 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', margin: '10px 0' }}>
              {[
                { label: '일 (DAY)', val: timeLeft.days },
                { label: '시 (HOUR)', val: timeLeft.hours },
                { label: '분 (MIN)', val: timeLeft.minutes },
                { label: '초 (SEC)', val: timeLeft.seconds }
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    width: '55px',
                    height: '50px',
                    borderRadius: '10px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '22px',
                    fontWeight: '700',
                    fontFamily: 'var(--font-title)',
                    color: '#F3F4F6'
                  }}>
                    {String(item.val).padStart(2, '0')}
                  </div>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px' }}>{item.label}</span>
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', marginTop: '12px' }}>
              무료 체험 종료 시 자동으로 가입비 100 USDT 청구 및 정식 활성화로 전환됩니다.
            </p>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '700', marginBottom: '8px' }}>
              🟢 PLATFORM REGULAR ACTIVE MEMBER
            </div>
            <h3 style={{ fontSize: '20px', color: '#F3F4F6' }}>정식 연간 멤버십 회원</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
              스마트 컨트랙트 수납이 완료되었으며, 2단계 추천 배분 권한이 완전히 활성화되었습니다.
            </p>
          </div>
        )}

        {/* 데모용 즉시 격발 단축버튼 (오직 ?demo=true 모드에서만 스텔스 기동) */}
        {userData && userData.tier === 'TRIAL' && isDemoMode && (
          <button 
            className="btn-secondary" 
            style={{ 
              marginTop: '16px', 
              padding: '10px', 
              fontSize: '12px', 
              border: '1px dashed rgba(139,92,246,0.4)',
              background: 'rgba(139,92,246,0.03)',
              color: '#A78BFA'
            }}
            onClick={handleTriggerCharge}
            disabled={triggeringCharge}
          >
            <Play size={14} />
            {triggeringCharge ? '가입비 온체인 수납 격발 중...' : '[데모] 10일 후 가입비 즉시 청구 & 50% 분배 격발'}
          </button>
        )}
      </div>

      {/* 2. 실시간 시뮬레이션 포트폴리오 현황 카드 */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)' }}>🤖 실시간 인공지능 투자 가치</span>
          <span style={{
            fontSize: '11px',
            color: 'var(--text-dark)',
            background: 'rgba(255,255,255,0.02)',
            padding: '3px 8px',
            borderRadius: '10px'
          }}>5초마다 시세 갱신</span>
        </div>

        {portfolio ? (
          <div>
            <h2 style={{ fontSize: '28px', color: '#F3F4F6', fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              {portfolio.totalValuation.toFixed(2)} 
              <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>USDT</span>
            </h2>
            
            {/* 수익률 표시기 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              marginTop: '6px', 
              color: portfolio.totalProfitUsd >= 0 ? 'var(--success-color)' : 'var(--danger-color)',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              {portfolio.totalProfitUsd >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>
                {portfolio.totalProfitUsd >= 0 ? '+' : ''}{portfolio.totalProfitUsd.toFixed(2)} USDT 
                ({portfolio.totalProfitUsd >= 0 ? '+' : ''}{portfolio.profitPercent.toFixed(2)}%)
              </span>
              <span style={{ color: 'var(--text-dark)', fontSize: '11px', fontWeight: 'normal' }}>누적 대비</span>
            </div>

            {/* 🌟 [Rejard님 특급 실사용성 개선] 자산 2열 정보 바 (원금 vs 평가 자산 가치 시각화) */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginTop: '16px', 
              padding: '12px 14px', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '12px' 
            }}>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  💰 총 모의 투자 원금
                </span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)', marginTop: '4px', display: 'block' }}>
                  {portfolio.totalInvested.toFixed(2)} <span style={{ fontSize: '10px', color: 'var(--text-dark)', fontWeight: 'normal' }}>USDT</span>
                </span>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
              <div style={{ flex: 1, paddingLeft: '8px', textAlign: 'left' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📈 실시간 총 평가 자산
                </span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)', marginTop: '4px', display: 'block' }}>
                  {portfolio.totalValuation.toFixed(2)} <span style={{ fontSize: '10px', color: 'var(--text-dark)', fontWeight: 'normal' }}>USDT</span>
                </span>
              </div>
            </div>

            {/* 개별 자산 정보 */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              {/* POL 자산 */}
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>POL 보유 가치</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#F3F4F6', margin: '4px 0' }}>
                  {portfolio.assets.POL.currentValue.toFixed(2)} USDT
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dark)' }}>
                  {portfolio.assets.POL.quantity.toFixed(1)} POL (@${portfolio.assets.POL.price.toFixed(3)})
                </div>
              </div>
              
              {/* USDT 자산 */}
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>USDT 보유 가치</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#F3F4F6', margin: '4px 0' }}>
                  {portfolio.assets.USDT.currentValue.toFixed(2)} USDT
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dark)' }}>
                  {portfolio.assets.USDT.quantity.toFixed(1)} USDT (@$1.00)
                </div>
              </div>
            </div>

            {/* 📊 [Rejard님 특급 승인] 실시간 포트폴리오 & 수익률 시각화 차트 패널 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginTop: '20px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              padding: '16px',
              borderRadius: '16px'
            }}>
              {/* 상단 탭 제목 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#A78BFA', letterSpacing: '0.05em' }}>
                  📊 AI REAL-TIME VISUALIZATION
                </span>
                <span style={{ fontSize: '9px', color: aiActive ? 'var(--success-color)' : '#F59E0B', fontWeight: '700' }}>
                  {aiActive ? '● LIVE UPDATE' : '■ FREEZED'}
                </span>
              </div>

              {/* 차트 컨텐츠 (플렉스 가로 정렬: 도넛 차트 | 꺾은선 차트) */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                
                {/* 1) 자산 배분 도넛 차트 (Donut Chart) */}
                <div style={{
                  flex: '1 1 120px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.01)',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.02)',
                  position: 'relative'
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '10px' }}>자산 배분 비중</span>
                  
                  <div style={{ width: '90px', height: '90px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {/* SVG Donut */}
                    <svg width="90" height="90" viewBox="0 0 100 100">
                      <defs>
                        {/* 그림자 및 발광 필터 */}
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>
                      {/* USDT 배경 트랙 */}
                      <circle 
                        cx="50" cy="50" r="40" 
                        fill="none" 
                        stroke="rgba(16, 185, 129, 0.15)" 
                        strokeWidth="10" 
                      />
                      {/* POL 원호 (보라색) */}
                      <circle 
                        cx="50" cy="50" r="40" 
                        fill="none" 
                        stroke="#8B5CF6" 
                        strokeWidth="10" 
                        strokeDasharray="251.2" 
                        strokeDashoffset={251.2 * (1 - activePolRatio / 100)} 
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        filter="url(#glow)"
                      />
                      {/* USDT 원호 (녹색) - POL이 차지한 나머지 영역 */}
                      <circle 
                        cx="50" cy="50" r="40" 
                        fill="none" 
                        stroke="var(--success-color)" 
                        strokeWidth="10" 
                        strokeDasharray="251.2" 
                        strokeDashoffset={251.2 * (1 - activeUsdtRatio / 100)} 
                        strokeLinecap="round"
                        transform={`rotate(${360 * (activePolRatio / 100) - 90} 50 50)`}
                        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        filter="url(#glow)"
                      />
                    </svg>
                    {/* 도넛 정중앙 텍스트 */}
                    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#FFF' }}>{activePolRatio}%</span>
                      <span style={{ fontSize: '7px', color: 'var(--text-dark)', fontWeight: '700' }}>POL 비중</span>
                    </div>
                  </div>

                  {/* 범례 */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', fontSize: '9px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#8B5CF6' }}>● POL {activePolRatio}%</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--success-color)' }}>● USDT {activeUsdtRatio}%</span>
                  </div>
                </div>

                {/* 2) 실시간 수익률 꺾은선 곡선 그래프 (Line Bezier Chart) */}
                <div style={{
                  flex: '2 1 200px',
                  width: '100%',
                  minWidth: '220px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'rgba(255,255,255,0.01)',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>실시간 수익률 추이</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: portfolio.profitPercent >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                      {portfolio.profitPercent >= 0 ? '+' : ''}{portfolio.profitPercent.toFixed(2)}%
                    </span>
                  </div>

                  {/* 곡선 SVG 그리기 */}
                  <div style={{ width: '100%', height: '90px', position: 'relative', display: 'block' }}>
                    <svg width="100%" height="90" viewBox="0 0 220 90" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs>
                        {/* 중복 방지 대시보드 전용 그라데이션 광채 마스크 */}
                        <linearGradient id="dbProfitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="dbLineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#10B981" />
                        </linearGradient>
                        {/* 꺾은선 차트 전용 로컬 발광 필터 정의 보증 */}
                        <filter id="dbGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      {/* 가로 그리드 지지선 - 투명도를 선명하게 대폭 상향하여 확실한 시인성 확보! */}
                      <line x1="0" y1="15" x2="220" y2="15" stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />
                      <line x1="0" y1="45" x2="220" y2="45" stroke="rgba(255,255,255,0.25)" />
                      <line x1="0" y1="75" x2="220" y2="75" stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />

                      {/* 동적 곡선 및 그라데이션 렌더링 */}
                      {(() => {
                        const data = profitHistory.length > 0 ? profitHistory : [0];
                        const height = 90;
                        const minVal = Math.min(...data, -1);
                        const maxVal = Math.max(...data, 1);
                        const valRange = maxVal - minVal || 2;

                        const points = data.map((val, idx) => {
                          const x = data.length > 1 ? (idx / (data.length - 1)) * 220 : 110; 
                          const y = height - 15 - ((val - minVal) / valRange) * (height - 30);
                          return { x, y, val };
                        });

                        let dPath = '';
                        let dArea = '';

                         if (points.length > 0) {
                           dPath = `M ${points[0].x} ${points[0].y}`;
                           
                           for (let i = 0; i < points.length - 1; i++) {
                             const p0 = points[i];
                             const p1 = points[i + 1];
                             const cpX1 = p0.x + (p1.x - p0.x) / 2;
                             const cpY1 = p0.y;
                             const cpX2 = p0.x + (p1.x - p0.x) / 2;
                             const cpY2 = p1.y;

                             dPath += ` C ${cpX1} ${cpY1} ${cpX2} ${cpY2} ${p1.x} ${p1.y}`;
                           }

                           dArea = `${dPath} L ${points[points.length - 1].x} 90 L ${points[0].x} 90 Z`;
                         }

                        return (
                          <>
                            {dArea && (
                              <path 
                                d={dArea} 
                                fill="url(#dbProfitGrad)" 
                                style={{ transition: 'all 0.5s ease' }} 
                              />
                            )}

                            {dPath && (
                              <path 
                                d={dPath} 
                                fill="none" 
                                stroke="url(#lineGrad)" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                style={{ transition: 'all 0.5s ease' }} 
                              />
                            )}

                            {points.length > 0 && (
                              <circle 
                                cx={`${points[points.length - 1].x}%`} 
                                cy={points[points.length - 1].y} 
                                r="4" 
                                fill="var(--success-color)" 
                                stroke="#FFF" 
                                strokeWidth="1.5"
                                style={{ transition: 'all 0.5s ease' }}
                                filter="url(#glow)"
                              />
                            )}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>

              </div>
            </div>

            {/* 입금 및 출금 버튼 (돈을 뺏다 넣었다) */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, padding: '11px', fontSize: '13px' }}
                onClick={() => {
                  setTxType('DEPOSIT');
                  setShowTxModal(true);
                }}
              >
                <ArrowUpRight size={16} color="var(--success-color)" />
                자금 예치하기
              </button>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, padding: '11px', fontSize: '13px' }}
                onClick={() => {
                  setTxType('WITHDRAW');
                  setShowTxModal(true);
                }}
              >
                <ArrowDownLeft size={16} color="var(--danger-color)" />
                자금 인출하기
              </button>
            </div>

          </div>
        ) : (
          <div className="shimmer-loading" style={{ height: '100px', borderRadius: '12px' }}></div>
        )}
      </div>

      {/* 3. 자동 투자 비율 설정 조절 카드 */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#8B5CF6" />
          시스템 자동 투자 비중 조절
        </h3>

        {/* 🌟 실시간 자동 투자 적용 현황판 (피드백 완전 소멸 및 시각화 고도화) */}
        <div style={{
          background: 'rgba(139, 92, 246, 0.05)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          padding: '12px 14px',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>현재 가동 중인 포트폴리오 비중</span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#FFF', marginTop: '2px', display: 'block' }}>
              🟣 POL {activePolRatio}% : 🟢 USDT {activeUsdtRatio}%
            </span>
          </div>
          <button 
            type="button"
            onClick={handleToggleAiActive}
            style={{
              fontSize: '9px',
              background: aiActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: aiActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              color: aiActive ? 'var(--success-color)' : 'var(--danger-color)',
              padding: '4px 10px',
              borderRadius: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              outline: 'none',
              position: 'relative',
              zIndex: 99,
              boxShadow: aiActive ? '0 0 8px rgba(16, 185, 129, 0.1)' : '0 0 8px rgba(239, 68, 68, 0.1)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {aiActive ? '▶ AI 자동 투자 구동 중' : '⏸ AI 자동 투자 일시 정지됨'}
          </button>
        </div>

        {/* 💡 초간편 AI 리밸런싱 이용 가이드 (Rejard님 특급 실사용성 개선 패치) */}
        <div style={{
          background: 'rgba(139, 92, 246, 0.03)',
          border: '1px dashed rgba(139, 92, 246, 0.2)',
          padding: '12px 14px',
          borderRadius: '10px',
          fontSize: '11px',
          lineHeight: '1.6',
          color: 'var(--text-muted)',
          marginBottom: '16px',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#A78BFA', fontWeight: '700' }}>
            <span style={{ fontSize: '13px' }}>💡</span>
            <span>초간편 AI 리밸런싱 이용 가이드</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong style={{ color: '#F3F4F6' }}>1단계:</strong> 아래의 🟣 POL / 🟢 USDT <strong>슬라이더</strong>를 밀어 원하시는 비율로 조절합니다.</div>
            <div><strong style={{ color: '#F3F4F6' }}>2단계:</strong> 하단의 <strong>[필수 손실 면책 약관]</strong> 체크박스에 동의합니다.</div>
            <div><strong style={{ color: '#F3F4F6' }}>3단계:</strong> 활성화되는 하단의 <strong>보라색 [리밸런싱 집행] 버튼</strong>을 누르면 즉시 완료!</div>
          </div>
        </div>

        {/* 슬라이더 영역 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '15px 0' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>🟣 POL (Polygon Native) 비중</span>
              <span style={{ fontWeight: '700', color: '#F3F4F6' }}>{ratioPol}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="10"
              value={ratioPol} 
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setRatioPol(val);
                setRatioUsdt(100 - val);
                // 🌟 슬라이더 비중 조작을 시작하면 면책 동의를 해제하여 새로 동의를 유도
                setRiskConfirmed(false);
                setManualUnlocked(false); // 수동 해제 상태 리셋
              }}
              style={{ width: '100%', accentColor: '#8B5CF6', cursor: 'pointer' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>🟢 USDT (Tether Stable) 비중</span>
              <span style={{ fontWeight: '700', color: '#F3F4F6' }}>{ratioUsdt}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="10"
              value={ratioUsdt} 
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setRatioUsdt(val);
                setRatioPol(100 - val);
                // 🌟 슬라이더 비중 조작을 시작하면 면책 동의를 해제하여 새로 동의를 유도
                setRiskConfirmed(false);
                setManualUnlocked(false); // 수동 해제 상태 리셋
              }}
              style={{ width: '100%', accentColor: 'var(--success-color)', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* 자필 수준 면책 동의 약관 */}
        <div style={{ 
          background: 'rgba(239,68,68,0.04)', 
          border: '1px solid rgba(239,68,68,0.12)', 
          padding: '12px', 
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <input 
              type="checkbox" 
              id="riskConfirmed"
              // 🌟 [Rejard님 특급 동의 락인 UX]
              // 현재 구동 비율과 슬라이더 비율이 완벽히 일치할 때는 자동으로 체크 고정(Checked)!
              // 비율을 조절하기 시작했을 때만 체크를 풀어 신규 면책 동의를 강제합니다.
              checked={isRatioMatched ? true : riskConfirmed}
              onChange={() => {
                if (!isRatioMatched) {
                  setRiskConfirmed(!riskConfirmed);
                }
              }}
              disabled={isRatioMatched} // 현재 비율과 일치 시 조작 불필요하므로 비활성 가이드
              style={{ 
                width: '16px', 
                height: '16px', 
                accentColor: isRatioMatched ? 'var(--success-color)' : 'var(--danger-color)', 
                cursor: isRatioMatched ? 'default' : 'pointer', 
                marginTop: '2px' 
              }}
            />
            <label htmlFor="riskConfirmed" style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', cursor: isRatioMatched ? 'default' : 'pointer' }}>
              <strong>[필수 손실 면책 확인]</strong> 본인이 직접 설정한 투자 비중에 따라 실시간 모의 거래가 집행되며, 이로 인한 가치 하락 및 투자 손실의 전적인 책임은 본인에게 있음에 동의합니다.
            </label>
          </div>
        </div>

        <button 
          className="btn-primary" 
          onClick={isRatioMatched ? handleUnlockRatio : handleRatioSave}
          disabled={savingRatio || (!riskConfirmed && !isRatioMatched)}
          style={{ 
            marginTop: '14px', 
            padding: '12px', 
            fontSize: '14px',
            background: isRatioMatched 
              ? 'rgba(16, 185, 129, 0.1)' 
              : 'var(--primary-gradient)',
            border: isRatioMatched
              ? '1px solid rgba(16, 185, 129, 0.25)'
              : 'none',
            color: isRatioMatched ? 'var(--success-color)' : '#FFFFFF',
            boxShadow: isRatioMatched ? 'none' : '0 0 15px rgba(139,92,246,0.3)',
            cursor: 'pointer'
          }}
        >
          {savingRatio ? (
            'AI 트레이딩 봇 비중 재분배 적용 중...'
          ) : isRatioMatched ? (
            <>✔ 현재 이 비율로 구동 중 (재분배 완료)</>
          ) : (
            <>
              <ShieldCheck size={16} />
              새로운 투자 비율 저장 및 리밸런싱 집행
            </>
          )}
        </button>
      </div>

      {/* 4. 추천인 파이프라인 대시보드 카드 */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="#8B5CF6" />
          나의 추천인 파이프라인
        </h3>

        {/* 추천 라인 통계 정보 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>1차 추천 회원</span>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#F3F4F6', margin: '4px 0' }}>{referralCount1} 명</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>2차 추천 회원</span>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#F3F4F6', margin: '4px 0' }}>{referralCount2} 명</div>
          </div>
        </div>

        {/* 누적 보상 */}
        <div style={{ 
          marginTop: '12px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          padding: '14px',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>실시간 누적 추천 분배 보상</span>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--success-color)', marginTop: '2px' }}>
              {totalRewards} USDT
            </div>
          </div>
          <span className="badge badge-approved" style={{ fontSize: '9px' }}>50% EQUAL REWARD</span>
        </div>

        <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '8px', lineHeight: '1.4', paddingLeft: '4px' }}>
          * 추천 가입비 및 월정액 발생 시 1차 직접 추천인에게 25 USDT, 2차 상위 추천인에게 25 USDT가 폴리곤 스마트 컨트랙트로 실시간 균등 전송 분배됩니다.
        </div>
      </div>

      {/* 5. 가상 입출금 거래 다이얼로그 모달 */}
      {showTxModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(5px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div className="glass-card" style={{
            width: '90%',
            maxWidth: '380px',
            background: 'var(--bg-app)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px', color: '#F3F4F6' }}>
              {txType === 'DEPOSIT' ? '투자 풀 자금 예치 (Deposit)' : '투자 풀 자금 인출 (Withdraw)'}
            </h3>
            
            <form onSubmit={handleTxSubmit}>
              <div className="form-group">
                <label className="form-label">거래 금액 (USDT 단위)</label>
                <input 
                  type="number" 
                  className="form-input"
                  placeholder="예: 250"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                {txType === 'DEPOSIT' ? (
                  <>추가 자금을 예치하면 설정된 비율({ratioPol}% POL / {ratioUsdt}% USDT)에 따라 모의 매수가 자동으로 집행되어 원금이 확장됩니다.</>
                ) : (
                  <>인출 시 가상 포트폴리오에서 자산이 비율대로 차감되어 본인 소유의 지갑 주소로 가상 테더가 입금됩니다.</>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setShowTxModal(false)}
                  style={{ flex: 1 }}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 1 }}
                  disabled={processingTx}
                >
                  {processingTx ? '처리 중...' : '확인'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. 안전하게 로그아웃 (지갑 연결 해제) 버튼 */}
      <button 
        type="button" 
        className="btn-secondary" 
        style={{ 
          padding: '14px', 
          fontSize: '14px', 
          color: 'var(--danger-color)', 
          borderColor: 'rgba(239,68,68,0.15)',
          background: 'rgba(239,68,68,0.02)',
          marginTop: '5px',
          gap: '8px'
        }}
        onClick={onLogout}
      >
        🔌 안전하게 로그아웃 (지갑 연결 해제)
      </button>

    </div>
  );
}

export default Dashboard;
