import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  TrendingUp, TrendingDown, Wallet, Users, AlertTriangle, 
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Play, Sparkles, StopCircle
} from 'lucide-react';
import { API_BASE } from '../App';
import { ethers } from 'ethers';

function Dashboard({ walletAddress, userData, onLogout }) {
  const navigate = useNavigate();
  
  // 포트폴리오 상태
  const [portfolio, setPortfolio] = useState(null);
  const [walletSutBalance, setWalletSutBalance] = useState(0); // 지갑 내 SUT 잔고
  const [depositPercent, setDepositPercent] = useState(0); // 슬라이더 퍼센트


  // 실시간 SUT 가격 히스토리
  const [priceHistory, setPriceHistory] = useState([]);
  const [sutPrice, setSutPrice] = useState(0.19);
  const [sutChange24h, setSutChange24h] = useState(0); // 🌟 24시간 변동률 상태 추가

  // 입출금 다이얼로그 상태
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('DEPOSIT');
  const [txAmount, setTxAmount] = useState('');
  const [processingTx, setProcessingTx] = useState(false);

  // 거래 내역(History) 상태
  const [txHistory, setTxHistory] = useState([]);

  // 대시보드 데이터 및 지갑 잔고 로드
  const fetchDashboardData = async () => {
    try {
      // 포트폴리오 조회
      const portRes = await axios.get(`${API_BASE}/investment/portfolio/${walletAddress}`);
      if (portRes.data.success) {
        setPortfolio(portRes.data.portfolio);
        const curPrice = portRes.data.portfolio.assets.SUT.price;
        setSutPrice(curPrice);
        setSutChange24h(portRes.data.portfolio.sutChange24h || 0); // 🌟 24시간 변동률 설정
        
        // 백엔드에서 전달받은 히스토리가 있으면 차트 초기화 (처음 로드 시)
        setPriceHistory(prev => {
          let nextHistory = prev;
          if (prev.length === 0 && portRes.data.portfolio.sutHistory && portRes.data.portfolio.sutHistory.length > 0) {
             nextHistory = portRes.data.portfolio.sutHistory;
          } else if (prev.length === 0) {
             nextHistory = [curPrice];
          } else {
             // 기존 히스토리에 새 가격 추가
             nextHistory = [...prev, curPrice];
          }
          if (nextHistory.length > 30) {
            nextHistory.shift();
          }
          return nextHistory;
        });
      }

      // 지갑의 실제 SUT 잔고 조회 (public RPC 이용 - 네트워크 무관하게 항상 폴리곤 잔고 읽어옴)
      try {
        const rpcProvider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
        const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55".toLowerCase();
        const sutAbi = ["function balanceOf(address account) external view returns (uint256)"];
        const sutContract = new ethers.Contract(sutContractAddress, sutAbi, rpcProvider);
        const balanceWei = await sutContract.balanceOf(walletAddress);
        setWalletSutBalance(parseFloat(ethers.formatUnits(balanceWei, 18)));
      } catch (balErr) {
        console.error("지갑 잔고 조회 에러:", balErr);
      }

    } catch (err) {
      console.error('대시보드 데이터 조회 실패:', err);
    }
  };

  const fetchTxHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/investment/history/${walletAddress}`);
      if (res.data.success) {
        setTxHistory(res.data.history);
      }
    } catch (err) {
      console.error('거래 내역 조회 실패:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchTxHistory();
    // 5초 간격 리프레시
    const refreshTimer = setInterval(() => {
      fetchDashboardData();
    }, 5000);
    return () => clearInterval(refreshTimer);
  }, [walletAddress]);

  // 온체인 입금(Deposit) 및 출금(Withdrawal) 처리
  const handleTxSubmit = async (e, explicitAmount = null, explicitType = null) => {
    if (e && e.preventDefault) e.preventDefault();
    
    const finalAmount = explicitAmount !== null ? explicitAmount : txAmount;
    const finalType = explicitType !== null ? explicitType : txType;

    if (!finalAmount || parseFloat(finalAmount) <= 0) {
      alert('유효한 금액을 입력해 주세요.');
      return;
    }

    setProcessingTx(true);
    try {
      if (finalType === 'DEPOSIT') {
        if (!window.ethereum) {
          throw new Error('설치된 메타마스크 혹은 트러스트월렛 브라우저 지갑을 찾을 수 없습니다.');
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();

        if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          throw new Error(`지갑 주소 불일치: 현재 로그인된 계정 주소(${walletAddress})와 메타마스크에 활성화된 주소(${signerAddress})가 다릅니다. 지갑 계정을 확인해 주세요.`);
        }

        // SUT 토큰 정보
        const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
        const vaultAddress = "0x855c880D538892fD899eECb72D4b1Ac5B46089eA";
        const sutAbi = ["function transfer(address recipient, uint256 amount) external returns (bool)"];
        
        const sutContract = new ethers.Contract(sutContractAddress, sutAbi, signer);

        // 금액 파싱 (18 decimals)
        const parsedAmount = ethers.parseUnits(finalAmount.toString(), 18);

        // 실제 온체인 토큰 전송 실행
        const tx = await sutContract.transfer(vaultAddress, parsedAmount);
        
        // 블록 확정 대기
        await tx.wait();

        const res = await axios.post(`${API_BASE}/investment/deposit`, {
          walletAddress,
          amount: parseFloat(finalAmount),
          txHash: tx.hash
        });
        if (res.data.success) {
          alert(`🎉 성공적으로 ${finalAmount} SUT가 봇 자본금에 예치되어 장부에 기록되었습니다.\nTxHash: ${tx.hash}`);
        }
      } else {
        if (portfolio && parseFloat(finalAmount) > portfolio.sutQuantity) {
          alert('출금 요청 금액이 현재 총 보유 SUT 한도를 초과합니다.');
          setProcessingTx(false);
          return;
        }
        const res = await axios.post(`${API_BASE}/investment/withdraw`, {
          walletAddress,
          amount: parseFloat(finalAmount)
        });
        if (res.data.success) {
          alert(`📤 ${finalAmount} SUT 출금 신청이 성공적으로 접수되었습니다. 승인 후 지갑으로 SUT가 전송됩니다.`);
        }
      }
      setShowTxModal(false);
      setTxAmount('');
      fetchDashboardData();
      fetchTxHistory(); // 거래 후 히스토리 갱신
    } catch (err) {
      alert('거래 처리 실패: ' + err.message);
    } finally {
      setProcessingTx(false);
    }
  };

  return (
    <div style={{ padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* 🌟 마스터 매니저 전용 '메니져 모드 복귀' 단축 바 */}
      {((userData && userData.email && userData.email.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase()) ||
        (walletAddress && walletAddress.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase()) ||
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
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#C084FC' }}>마스터 메니져 모드</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>메니져 페이지 바로 가기</div>
            </div>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '11px', borderRadius: '8px', background: 'var(--primary-gradient)' }}>
            메니져 모드 이동
          </button>
        </div>
      )}

      {/* 👑 마스터 관리자 전용 '관리자 모드 진입' 단축 바 */}
      {((userData && userData.email && userData.email.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase()) ||
        (localStorage.getItem('google_email') && localStorage.getItem('google_email').toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase())) && (
        <div 
          className="glass-card glow-active" 
          onClick={() => navigate('/admin')}
          style={{ 
            padding: '12px 16px', 
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(20, 16, 45, 0.4) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            marginTop: '-10px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔑</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#F87171' }}>관리자 모드</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>관리자 페이지 바로 가기</div>
            </div>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '11px', borderRadius: '8px', background: 'linear-gradient(90deg, #EF4444, #DC2626)', border: 'none', color: '#FFF' }}>
            관리자 모드 이동
          </button>
        </div>
      )}

      {/* 가입 사용자 환영 배너 */}
      <div className="glass-card" style={{ 
        padding: '15px 18px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ 
          width: '42px', height: '42px', borderRadius: '50%', background: 'var(--primary-gradient)', 
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontSize: '18px', fontWeight: '700', color: '#FFFFFF'
        }}>
          {(userData && userData.name ? userData.name.substring(0, 1).toUpperCase() : '👤')}
        </div>
        <div>
          <h3 style={{ fontSize: '16px', color: '#F3F4F6' }}>{userData ? userData.name : '테스트 회원'} 님</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{userData ? userData.email : '이메일 정보 없음'}</span>
        </div>
      </div>

      {/* 1. 실시간 SUT 토큰 시세 차트 */}
      {portfolio ? (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>📊 1 SUT 실시간 시세 (Gate.io)</span>
              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '24px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)' }}>
                  ${sutPrice.toFixed(4)} <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>USD</span>
                </span>

                {/* 🌟 24h 변동률 배지 */}
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: sutChange24h >= 0 ? 'var(--success-color)' : 'var(--danger-color)',
                  background: sutChange24h >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '3px 6px',
                  borderRadius: '6px',
                  border: sutChange24h >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}>
                  {sutChange24h >= 0 ? '▲' : '▼'} {sutChange24h >= 0 ? '+' : ''}{sutChange24h.toFixed(2)}%
                </span>

                <span style={{ fontSize: '13px', color: 'var(--success-color)', fontWeight: '600' }}>
                  (≈ {(sutPrice * (portfolio.krwRate || 1400)).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원)
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: 'var(--success-color)', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '10px', fontWeight: '700' }}>
                ● LIVE
              </span>
            </div>
          </div>

          <div style={{ width: '100%', height: '120px', position: 'relative', display: 'block', padding: '0 10px 10px 10px' }}>
            <svg width="100%" height="110" viewBox="0 0 220 110" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="dbProfitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="dbLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
                <filter id="dbGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <line x1="0" y1="20" x2="220" y2="20" stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />
              <line x1="0" y1="55" x2="220" y2="55" stroke="rgba(255,255,255,0.25)" />
              <line x1="0" y1="90" x2="220" y2="90" stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />

              {(() => {
                const data = priceHistory.length > 0 ? priceHistory : [0.19];
                const height = 110;
                const minVal = Math.min(...data) * 0.999;
                const maxVal = Math.max(...data) * 1.001;
                const valRange = maxVal - minVal || 0.01;
                const points = data.map((val, idx) => {
                  const x = data.length > 1 ? (idx / (data.length - 1)) * 220 : 110; 
                  const y = height - 20 - ((val - minVal) / valRange) * (height - 40);
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
                  dArea = `${dPath} L ${points[points.length - 1].x} 110 L ${points[0].x} 110 Z`;
                }
                return (
                  <>
                    {dArea && <path d={dArea} fill="url(#dbProfitGrad)" style={{ transition: 'all 0.5s ease' }} />}
                    {dPath && <path d={dPath} fill="none" stroke="url(#dbLineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />}
                    {points.length > 0 && (
                      <circle cx={`${points[points.length - 1].x}%`} cy={points[points.length - 1].y} r="4" fill="var(--success-color)" stroke="#FFF" strokeWidth="1.5" style={{ transition: 'all 0.5s ease' }} filter="url(#dbGlow)" />
                    )}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      ) : (
        <div className="shimmer-loading" style={{ height: '160px', borderRadius: '12px' }}></div>
      )}

      {/* 2. 나의 총 자산 및 예치 현황 */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wallet size={18} color="#8B5CF6" />
          나의 자산 및 예치 현황
        </h3>
        
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {(() => {
            const totalAssets = walletSutBalance + (portfolio ? portfolio.totalInvested : 0);
            let walletPercent = 100;
            let depositedPercent = 0;
            if (totalAssets > 0) {
              walletPercent = (walletSutBalance / totalAssets) * 100;
              depositedPercent = 100 - walletPercent;
            }
            return (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>총 보유 가상자산 (원금)</span>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
                    {totalAssets.toFixed(2)} SUT
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>내 지갑 잔고 (미예치)</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#8B5CF6' }}>{walletSutBalance.toFixed(2)} SUT <span style={{fontSize:'10px', fontWeight:'normal'}}>({walletPercent.toFixed(1)}%)</span></span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>매니저 풀 예치금</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success-color)' }}>{portfolio ? portfolio.totalInvested.toFixed(2) : '0.00'} SUT <span style={{fontSize:'10px', fontWeight:'normal'}}>({depositedPercent.toFixed(1)}%)</span></span>
                  </div>
                </div>

                <div style={{ marginTop: '10px', marginBottom: '20px', width: '100%', height: '14px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                  {/* 지갑 잔고 비율 바 (보라색) */}
                  <div style={{ width: `${walletPercent}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.5s ease' }}></div>
                  {/* 예치금 비율 바 (초록색) */}
                  <div style={{ width: `${depositedPercent}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.5s ease' }}></div>
                </div>
              </>
            );
          })()}

          {/* 입출금 버튼 */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '13px' }} onClick={() => { setTxType('DEPOSIT'); setShowTxModal(true); }}>자금 예치하기</button>
            <button className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={() => { setTxType('WITHDRAW'); setShowTxModal(true); }}>자금 인출하기</button>
          </div>
        </div>
      </div>





      {/* 가상 입출금 모달 */}
      {showTxModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '380px', background: 'var(--bg-app)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px', color: '#F3F4F6' }}>
              {txType === 'DEPOSIT' ? '투자 봇 자본금 예치' : '투자 봇 자본금 인출'}
            </h3>
            <form onSubmit={handleTxSubmit}>
              <div className="form-group">
                <label className="form-label">{txType === 'DEPOSIT' ? '예치 요청 금액 (SUT 단위)' : '출금 요청 금액 (SUT 단위)'}</label>
                <input type="number" className="form-input" placeholder="예: 250" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} min="1" required />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                {txType === 'DEPOSIT' 
                  ? '추가 자금을 수동으로 예치합니다.' 
                  : '인출 시 포트폴리오에서 자산이 차감되어 본인 소유의 지갑 주소로 입금됩니다.'}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowTxModal(false)} style={{ flex: 1 }}>취소</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, background: txType === 'DEPOSIT' ? 'var(--primary-gradient)' : 'var(--danger-color)' }} disabled={processingTx}>{processingTx ? '처리 중...' : '확인'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 가상 입출금 모달 생략(위쪽에 있음) */}

      {/* 최근 3건 거래 내역 미리보기 */}
      <div className="glass-card" style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#F3F4F6' }}>
            <span style={{ color: 'var(--accent-color)' }}>📜</span> 최근 거래 내역
          </h3>
          <button 
            onClick={() => navigate('/history')}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--accent-color)', 
              fontSize: '12px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            전체 보기 &gt;
          </button>
        </div>

        {txHistory && txHistory.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {txHistory.slice(0, 3).map(tx => {
              const isDeposit = tx.type !== 'WITHDRAW_REQUEST';
              return (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#F3F4F6', marginBottom: '4px' }}>
                      {isDeposit ? '예치 (입금)' : '인출 (출금)'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(tx.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-title)', color: isDeposit ? 'var(--success-color)' : 'var(--danger-color)' }}>
                      {isDeposit ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} SUT
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            아직 거래 내역이 없습니다.
          </div>
        )}
      </div>

      {/* 안전하게 로그아웃 버튼 */}
      <button 
        type="button" 
        className="btn-secondary" 
        style={{ padding: '14px', fontSize: '14px', color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.02)', marginTop: '5px', display: 'flex', justifyContent: 'center', gap: '8px' }}
        onClick={onLogout}
      >
        🔌 안전하게 로그아웃 (지갑 연결 해제)
      </button>

      {/* 매니저 연락처 (고객 센터) */}
      <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <div>💬 담당 매니저 문의</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href={`mailto:${userData?.managerEmail || 'lemaiiisk@gmail.com'}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              ✉️ {userData?.managerEmail || 'lemaiiisk@gmail.com'}
            </a>
            <span style={{ color: 'var(--glass-border)' }}>|</span>
            <a href={`tel:${userData?.managerPhone || '등록된 번호 없음'}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              📞 {userData?.managerPhone || '등록된 번호 없음'}
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
