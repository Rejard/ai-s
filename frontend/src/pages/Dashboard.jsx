import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, Wallet, Users, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Play, Sparkles, StopCircle
} from 'lucide-react';
import { API_BASE } from '../App';
import { ethers } from 'ethers';
import {
  buildNextPriceHistory,
  loadUserDashboardData,
  loadUserTxHistory,
  submitUserInvestmentTransaction,
} from '../lib/userDashboard';

function Dashboard({ walletAddress, userData, onLogout }) {
  const navigate = useNavigate();

  const [portfolio, setPortfolio] = useState(null);
  const [walletSutBalance, setWalletSutBalance] = useState(0);
  const [depositPercent, setDepositPercent] = useState(0);

  const [priceHistory, setPriceHistory] = useState([]);
  const [sutPrice, setSutPrice] = useState(0.19);
  const [sutChange24h, setSutChange24h] = useState(0);

  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('DEPOSIT');
  const [txAmount, setTxAmount] = useState('');
  const [processingTx, setProcessingTx] = useState(false);

  const [txHistory, setTxHistory] = useState([]);

  const fetchDashboardData = async () => {
    try {
      const data = await loadUserDashboardData({
        apiBase: API_BASE,
        walletAddress,
        axiosClient: axios,
        ethersLib: ethers,
      });
      if (data.portfolio !== undefined) setPortfolio(data.portfolio);
      if (data.sutPrice !== undefined) setSutPrice(data.sutPrice);
      if (data.sutChange24h !== undefined) setSutChange24h(data.sutChange24h);
      if (data.sutPrice !== undefined) {
        setPriceHistory((prev) => buildNextPriceHistory(prev, data.sutPrice, data.portfolio?.sutHistory || []));
      }
      if (data.walletSutBalance !== undefined) setWalletSutBalance(data.walletSutBalance);
    } catch (err) {
      console.error('Dashboard data load failed:', err);
    }
  };

  const fetchTxHistory = async () => {
    try {
      const history = await loadUserTxHistory({ apiBase: API_BASE, walletAddress, axiosClient: axios });
      setTxHistory(history);
    } catch (err) {
      console.error('Transaction history load failed:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchTxHistory();
    const refreshTimer = setInterval(() => {
      fetchDashboardData();
    }, 5000);
    return () => clearInterval(refreshTimer);
  }, [walletAddress]);

  const handleTxSubmit = async (e, explicitAmount = null, explicitType = null) => {
    if (e && e.preventDefault) e.preventDefault();

    const finalAmount = explicitAmount !== null ? explicitAmount : txAmount;
    const finalType = explicitType !== null ? explicitType : txType;

    if (!finalAmount || parseFloat(finalAmount) <= 0) {
      alert('Enter a valid amount.');
      return;
    }

    setProcessingTx(true);
    try {
      const result = await submitUserInvestmentTransaction({
        apiBase: API_BASE,
        walletAddress,
        amount: finalAmount,
        type: finalType,
        portfolio,
        ethereum: window.ethereum,
        axiosClient: axios,
        ethersLib: ethers,
      });

      if (finalType === 'DEPOSIT') {
        if (result.response.data.success) {
          alert(`Deposit recorded after confirmation: ${finalAmount} SUT\nTxHash: ${result.txHash}`);
        }
      } else if (result.response.data.success) {
        alert(`${finalAmount} SUT withdrawal request submitted.`);
      }

      setShowTxModal(false);
      setTxAmount('');
      fetchDashboardData();
      fetchTxHistory();
    } catch (err) {
      alert('Transaction failed: ' + err.message);
    } finally {
      setProcessingTx(false);
    }
  };

  return (
    <div style={{ padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>

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
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#C084FC' }}>Master Manager Mode</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>메니져 페이지 바로 가기</div>
            </div>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '11px', borderRadius: '8px', background: 'var(--primary-gradient)' }}>
            메니져 모드 이동
          </button>
        </div>
      )}

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
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#F87171' }}>Admin Mode</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>관리자 페이지 바로 가기</div>
            </div>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: '11px', borderRadius: '8px', background: 'linear-gradient(90deg, #EF4444, #DC2626)', border: 'none', color: '#FFF' }}>
            관리자 모드 이동
          </button>
        </div>
      )}

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
          <h3 style={{ fontSize: '16px', color: '#F3F4F6' }}>{userData ? userData.name : 'Test Member'}</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{userData ? userData.email : '이메일 정보 없음'}</span>
        </div>
      </div>

      {portfolio ? (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>📊 1 SUT 실시간 시세 (Gate.io)</span>
              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '24px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)' }}>
                  ${sutPrice.toFixed(4)} <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>USD</span>
                </span>

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

                  <div style={{ width: `${walletPercent}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.5s ease' }}></div>

                  <div style={{ width: `${depositedPercent}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.5s ease' }}></div>
                </div>
              </>
            );
          })()}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '13px' }} onClick={() => { setTxType('DEPOSIT'); setShowTxModal(true); }}>자금 예치하기</button>
            <button className="btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={() => { setTxType('WITHDRAW'); setShowTxModal(true); }}>Withdraw Funds</button>
          </div>
        </div>
      </div>

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

      <button
        type="button"
        className="btn-secondary"
        style={{ padding: '14px', fontSize: '14px', color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.02)', marginTop: '5px', display: 'flex', justifyContent: 'center', gap: '8px' }}
        onClick={onLogout}
      >
        🔌 안전하게 로그아웃 (지갑 연결 해제)
      </button>

      <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <div>💬 담당 매니저 문의</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href={`mailto:${userData?.managerEmail || 'lemaiiisk@gmail.com'}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              ✉️ {userData?.managerEmail || 'lemaiiisk@gmail.com'}
            </a>
            <span style={{ color: 'var(--glass-border)' }}>|</span>
            <a href={`tel:${userData?.managerPhone || '010-2020-6447'}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              📞 {userData?.managerPhone || '010-2020-6447'}
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
