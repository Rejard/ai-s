import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, Wallet, Users, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Play, Sparkles, StopCircle, LogOut, Mail, Phone
} from 'lucide-react';
import { API_BASE } from '../App';
import { ethers } from 'ethers';
import {
  buildNextPriceHistory,
  loadUserDashboardData,
  loadUserTxHistory,
  submitUserInvestmentTransaction,
} from '../lib/userDashboard';
import { DASHBOARD_COPY } from '../lib/dashboardCopy';

function PcDashboard({ walletAddress, userData, onLogout }) {
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

  const [councilStats, setCouncilStats] = useState(null);
  const [loadingCouncilStats, setLoadingCouncilStats] = useState(true);

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

  const fetchCouncilStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/investment/council-stats`);
      if (res.data.success) {
        setCouncilStats({
          factionStats: res.data.factionStats,
          activeMembers: res.data.activeMembers,
          recentVotes: res.data.recentVotes
        });
      }
    } catch (err) {
      console.error('Failed to load council stats in User PC Dashboard:', err.message);
    } finally {
      setLoadingCouncilStats(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchTxHistory();
    fetchCouncilStats();
    const refreshTimer = setInterval(() => {
      fetchDashboardData();
      fetchCouncilStats();
    }, 5000);
    return () => clearInterval(refreshTimer);
  }, [walletAddress]);

  const handleTxSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!txAmount || parseFloat(txAmount) <= 0) {
      alert('올바른 SUT 수량을 입력해 주세요.');
      return;
    }

    setProcessingTx(true);
    try {
      const result = await submitUserInvestmentTransaction({
        apiBase: API_BASE,
        walletAddress,
        amount: txAmount,
        type: txType,
        portfolio,
        ethereum: window.ethereum,
        userAgent: navigator.userAgent,
        walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
        axiosClient: axios,
        ethersLib: ethers,
      });

      if (txType === 'DEPOSIT') {
        if (result.response.data.success) {
          alert(`${txAmount} SUT 입금이 완료되었습니다.\n거래 해시: ${result.txHash}`);
        }
      } else if (result.response.data.success) {
        alert(`${txAmount} SUT 출금 신청이 접수되었습니다.`);
      }

      setShowTxModal(false);
      setTxAmount('');
      fetchDashboardData();
      fetchTxHistory();
    } catch (err) {
      alert('거래 처리에 실패했습니다: ' + err.message);
    } finally {
      setProcessingTx(false);
    }
  };

  return (
    <div className="pc-layout-wrapper" style={{ alignItems: 'stretch', gap: '30px', padding: '40px 60px' }}>

      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>

        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-gradient)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontSize: '26px', fontWeight: '700', color: '#FFFFFF', margin: '0 auto 16px'
          }}>
            {(userData && userData.name ? userData.name.substring(0, 1).toUpperCase() : '👤')}
          </div>
          <h3 style={{ fontSize: '18px', color: '#F3F4F6', marginBottom: '6px', fontWeight: '700' }}>
            {userData ? userData.name : '테스트 회원'} 님
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '14px' }}>
            {userData ? userData.email : '이메일 정보 없음'}
          </span>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '11px',
            color: 'var(--success-color)',
            fontWeight: '700'
          }}>
            <ShieldCheck size={14} />
            KYC 인증회원
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            🔑 내 연동 지갑 주소
          </span>
          <div style={{
            fontSize: '12px',
            color: '#FFF',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            background: 'rgba(0,0,0,0.2)',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.03)'
          }}>
            {walletAddress}
          </div>
        </div>

        {((userData && userData.email && userData.email.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase()) ||
          (walletAddress && walletAddress.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase()) ||
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
              flexDirection: 'column',
              gap: '12px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>👑</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#C084FC' }}>{DASHBOARD_COPY.managerPage}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>회원 관리 화면으로 이동</div>
              </div>
            </div>
            <button className="btn-primary" style={{ padding: '8px', fontSize: '12px' }}>
              {DASHBOARD_COPY.managerPage}
            </button>
          </div>
        )}

        {((userData && userData.email && userData.email.toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase()) ||
          (localStorage.getItem('google_email') && localStorage.getItem('google_email').toLowerCase() === 'lemaiiisk@gmail.com'.toLowerCase())) && (
          <div
            className="glass-card glow-active"
            onClick={() => navigate('/admin')}
            style={{
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(20, 16, 45, 0.4) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '10px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔑</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#F87171' }}>{DASHBOARD_COPY.adminPage}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>시스템 관리 화면으로 이동</div>
              </div>
            </div>
            <button className="btn-primary" style={{ padding: '8px', fontSize: '12px', background: 'linear-gradient(90deg, #EF4444, #DC2626)', border: 'none', color: '#FFF' }}>
              {DASHBOARD_COPY.adminPage}
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn-secondary"
          style={{
            padding: '14px',
            fontSize: '13px',
            color: 'var(--danger-color)',
            borderColor: 'rgba(239, 68, 68, 0.15)',
            background: 'rgba(239, 68, 68, 0.02)',
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={onLogout}
        >
          <LogOut size={16} /> {DASHBOARD_COPY.logout}
        </button>

      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {portfolio ? (
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>📊 SUT 실시간 시세 (Gate.io)</span>
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)' }}>
                    ${sutPrice.toFixed(4)} <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-muted)' }}>USD</span>
                  </span>

                  <span style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: sutChange24h >= 0 ? 'var(--success-color)' : 'var(--danger-color)',
                    background: sutChange24h >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: sutChange24h >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}>
                    {sutChange24h >= 0 ? '▲' : '▼'} {sutChange24h >= 0 ? '+' : ''}{sutChange24h.toFixed(2)}%
                  </span>

                  <span style={{ fontSize: '14px', color: 'var(--success-color)', fontWeight: '600' }}>
                    (≈ {(sutPrice * (portfolio.krwRate || 1400)).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} KRW)
                  </span>
                </div>
              </div>
              <div>
                <span className="glow-active" style={{ fontSize: '11px', color: 'var(--success-color)', background: 'rgba(16, 185, 129, 0.1)', padding: '5px 12px', borderRadius: '12px', fontWeight: '700', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  ● 실시간
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: '180px', position: 'relative', display: 'block', padding: '10px 20px 20px 20px' }}>
              <svg width="100%" height="160" viewBox="0 0 500 160" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="pcProfitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="pcLineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>

                <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="4,4" />
                <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.15)" />
                <line x1="0" y1="130" x2="500" y2="130" stroke="rgba(255,255,255,0.08)" strokeDasharray="4,4" />

                {(() => {
                  const data = priceHistory.length > 0 ? priceHistory : [0.19];
                  const height = 160;
                  const minVal = Math.min(...data) * 0.999;
                  const maxVal = Math.max(...data) * 1.001;
                  const valRange = maxVal - minVal || 0.01;
                  const points = data.map((val, idx) => {
                    const x = data.length > 1 ? (idx / (data.length - 1)) * 500 : 250;
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
                    dArea = `${dPath} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`;
                  }
                  return (
                    <>
                      {dArea && <path d={dArea} fill="url(#pcProfitGrad)" style={{ transition: 'all 0.5s ease' }} />}
                      {dPath && <path d={dPath} fill="none" stroke="url(#pcLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />}
                      {points.length > 0 && (
                        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="5" fill="var(--success-color)" stroke="#FFF" strokeWidth="2" style={{ transition: 'all 0.5s ease' }} />
                      )}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        ) : (
          <div className="shimmer-loading" style={{ height: '230px', borderRadius: '20px' }}></div>
        )}

        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', color: '#F3F4F6', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
            <Wallet size={18} color="#8B5CF6" />
            {DASHBOARD_COPY.assetOverview}
          </h3>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{DASHBOARD_COPY.totalAssets}</span>
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#F3F4F6', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
                        {totalAssets.toFixed(2)} <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>SUT</span>
                      </div>
                    </div>
                    {portfolio && portfolio.pendingWithdrawalAmount > 0 && (
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        padding: '10px 16px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--warning-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <AlertTriangle size={16} />
                        출금 승인 대기중: {portfolio.pendingWithdrawalAmount.toFixed(2)} SUT
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{DASHBOARD_COPY.walletBalance}</span>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#8B5CF6', marginTop: '4px' }}>
                        {walletSutBalance.toFixed(2)} SUT <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>({walletPercent.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{DASHBOARD_COPY.managedAssets}</span>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--success-color)', marginTop: '4px' }}>
                        {portfolio ? portfolio.totalInvested.toFixed(2) : '0.00'} SUT <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>({depositedPercent.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: '16px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '10px', overflow: 'hidden', display: 'flex', marginBottom: '24px' }}>
                    <div style={{ width: `${walletPercent}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.5s ease' }}></div>
                    <div style={{ width: `${depositedPercent}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.5s ease' }}></div>
                  </div>
                </>
              );
            })()}

            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                className="btn-primary"
                style={{ flex: 1, padding: '15px', fontSize: '14px' }}
                onClick={() => { setTxType('DEPOSIT'); setShowTxModal(true); }}
              >
                📥 {DASHBOARD_COPY.depositAction}
              </button>
              <button
                className="btn-secondary"
                style={{
                  flex: 1,
                  padding: '15px',
                  fontSize: '14px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#FCA5A5',
                  borderColor: 'rgba(239, 68, 68, 0.2)'
                }}
                onClick={() => { setTxType('WITHDRAW'); setShowTxModal(true); }}
              >
                📤 {DASHBOARD_COPY.withdrawAction}
              </button>
            </div>
          </div>
        </div>

        {/* 🏛️ AI Council (의회) 현황 및 분파 의석 지분율 섹션 */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(20, 16, 45, 0.3) 100%)', border: '1px solid rgba(59, 130, 246, 0.25)', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: '20px' }}>🏛️</span>
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#F3F4F6', margin: 0, fontWeight: '800' }}>🏛️ AI Council (의회) 지분율 및 의정 현황</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>유전적 진화 풀 500인과 현역 의원 탑 11인의 분파 지분 현황입니다.</p>
            </div>
          </div>

          {loadingCouncilStats ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>의원 명부를 분석 중입니다...</span>
            </div>
          ) : !councilStats ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>의회 정보를 불러오지 못했습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              
              {/* 상단 2열 구조: 지분율 게이지 & 최근 투표 현황 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                {/* 1. 500인 전체 의회 분파 점유율 게이지 */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700' }}>
                    📊 500인 후보군 분파별 점유율 (의석)
                  </h4>
                  <div style={{ display: 'flex', height: '24px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
                    {councilStats.factionStats.map((f, idx) => {
                      let color = '#6B7280';
                      if (f.faction === 'TREND_FOLLOWER') color = '#EF4444';
                      if (f.faction === 'VALUE_SEEKER') color = '#3B82F6';
                      if (f.faction === 'CONSERVATIVE_WATCHER') color = '#10B981';
                      if (f.faction === 'MUTANT_ROOKIE') color = '#8B5CF6';

                      return (
                        <div
                          key={f.faction}
                          style={{
                            width: `${f.percentage}%`,
                            background: color,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: '#FFF',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            transition: 'width 0.5s ease'
                          }}
                          title={`${f.faction}: ${f.count}석 (${f.percentage}%)`}
                        >
                          {f.percentage >= 10 ? `${f.percentage}%` : ''}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 범례 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { key: 'TREND_FOLLOWER', label: '추세추종 (SMA)', color: '#EF4444' },
                      { key: 'VALUE_SEEKER', label: '기술반등 (RSI)', color: '#3B82F6' },
                      { key: 'CONSERVATIVE_WATCHER', label: '변동방어 (안정)', color: '#10B981' },
                      { key: 'MUTANT_ROOKIE', label: '돌연변이 (진화)', color: '#8B5CF6' }
                    ].map(item => {
                      const stat = councilStats.factionStats.find(s => s.faction === item.key) || { count: 0, percentage: 0 };
                      return (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}><b>{item.label}:</b> {stat.count}석 ({stat.percentage}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 최근 의결 투표 흐름 */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700' }}>
                    🔔 최근 AI 의원 투표 현황
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', maxHeight: '90px' }}>
                    {councilStats.recentVotes.map(v => {
                      let voteColor = '#6B7280';
                      let voteBg = 'rgba(255,255,255,0.05)';
                      if (v.decision_vote === 'BUY') {
                        voteColor = 'var(--success-color)';
                        voteBg = 'rgba(16, 185, 129, 0.1)';
                      } else if (v.decision_vote === 'SELL') {
                        voteColor = 'var(--danger-color)';
                        voteBg = 'rgba(239, 68, 68, 0.1)';
                      } else {
                        voteColor = 'var(--text-muted)';
                        voteBg = 'rgba(255,255,255,0.08)';
                      }

                      return (
                        <div key={v.id} style={{ flexShrink: 0, width: '120px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{v.timestamp.substring(11)}</span>
                          <span style={{ fontSize: '10px', color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>{v.name}</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>{v.faction === 'TREND_FOLLOWER' ? '추세' : v.faction === 'VALUE_SEEKER' ? '기술' : v.faction === 'CONSERVATIVE_WATCHER' ? '방어' : '변동'}</span>
                            <span style={{ fontSize: '9px', color: voteColor, background: voteBg, padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>{v.decision_vote}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 하단 2. 현재 당선된 11인의 ACTIVE 의원 명부 */}
              <div>
                <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700' }}>
                  🏛️ 현직 라이브 의원 탑 11 (ACTIVE)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', maxHeight: '380px', overflowY: 'auto', paddingRight: '6px' }}>
                  {councilStats.activeMembers.map((member, i) => {
                    let borderCol = 'rgba(255,255,255,0.06)';
                    let badgeBg = 'rgba(255,255,255,0.05)';
                    let factionColor = '#6B7280';
                    let factionName = '무소속';

                    if (member.faction === 'TREND_FOLLOWER') {
                      borderCol = 'rgba(239, 68, 68, 0.15)';
                      badgeBg = 'rgba(239, 68, 68, 0.03)';
                      factionColor = '#EF4444';
                      factionName = '추세추종';
                    } else if (member.faction === 'VALUE_SEEKER') {
                      borderCol = 'rgba(59, 130, 246, 0.15)';
                      badgeBg = 'rgba(59, 130, 246, 0.03)';
                      factionColor = '#3B82F6';
                      factionName = '기술반등';
                    } else if (member.faction === 'CONSERVATIVE_WATCHER') {
                      borderCol = 'rgba(16, 185, 129, 0.15)';
                      badgeBg = 'rgba(16, 185, 129, 0.03)';
                      factionColor = '#10B981';
                      factionName = '변동방어';
                    } else if (member.faction === 'MUTANT_ROOKIE') {
                      borderCol = 'rgba(139, 92, 246, 0.15)';
                      badgeBg = 'rgba(139, 92, 246, 0.03)';
                      factionColor = '#8B5CF6';
                      factionName = '돌연변이';
                    }

                    // 특별 직책 및 스타일링 계산
                    let titleLabel = '🏛️ 의원';
                    let titleColor = '#9CA3AF';
                    let cardBg = 'rgba(0,0,0,0.2)';
                    if (i === 0) {
                      titleLabel = '👑 의장';
                      titleColor = '#F59E0B'; // Gold
                      cardBg = 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 16, 45, 0.3) 100%)';
                      borderCol = 'rgba(245, 158, 11, 0.25)';
                    } else if (i === 1) {
                      titleLabel = '🥈 부의장';
                      titleColor = '#E5E7EB'; // Silver
                      cardBg = 'linear-gradient(135deg, rgba(229, 231, 235, 0.08) 0%, rgba(20, 16, 45, 0.3) 100%)';
                      borderCol = 'rgba(229, 231, 235, 0.25)';
                    } else if (i === 2) {
                      titleLabel = '🥉 상임위원장';
                      titleColor = '#B45309'; // Bronze
                      cardBg = 'linear-gradient(135deg, rgba(180, 83, 9, 0.08) 0%, rgba(20, 16, 45, 0.3) 100%)';
                      borderCol = 'rgba(180, 83, 9, 0.25)';
                    }

                    return (
                      <div key={member.member_id} style={{ border: `1px solid ${borderCol}`, background: cardBg, padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: i < 3 ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: titleColor, fontWeight: '900', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            {titleLabel}
                          </span>
                          <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.06)', color: '#A78BFA', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                            🧬 {member.generation || 1}세대
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <div style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                            <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 'bold' }}>{member.name}</span>
                          </div>
                          <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', color: factionColor, padding: '2px 5px', borderRadius: '4px', fontWeight: '800' }}>
                            {factionName}
                          </span>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                          <span>지분: <b style={{ color: '#FFF' }}>{member.voting_power.toFixed(2)}표</b></span>
                          <span>정확도: <b style={{ color: '#10B981' }}>{member.correct_count}%</b></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

      <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>

        <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
          <h3 style={{ fontSize: '16px', color: '#F3F4F6', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
            📜 {DASHBOARD_COPY.allTransactions}
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '500px', paddingRight: '4px' }}>
            {txHistory && txHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {txHistory.map(tx => {
                  const isDeposit = tx.type !== 'WITHDRAW_REQUEST';
                  return (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '12px'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#F3F4F6', marginBottom: '4px' }}>
                          {isDeposit ? `📥 ${DASHBOARD_COPY.depositCompleted}` : `📤 ${DASHBOARD_COPY.withdrawalPending}`}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(tx.createdAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: '800',
                          fontFamily: 'var(--font-title)',
                          color: isDeposit ? 'var(--success-color)' : 'var(--warning-color)'
                        }}>
                          {isDeposit ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} SUT
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                {DASHBOARD_COPY.noTransactions}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.25)' }}>
          <h4 style={{ fontSize: '13px', color: '#A78BFA', fontWeight: '700', marginBottom: '10px' }}>
            💬 실시간 매니저 고객센터
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '14px' }}>
            트레이딩 이체 지연, KYC 수동 서명 보류 등 모든 관리 문의는 배정된 텔레그램 담당 매니저에게 즉시 문의해 주십시오.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ color: 'var(--text-muted)' }}>✉ 매니저 이메일</span>
              <a href={`mailto:${userData?.managerEmail || 'lemaiiisk@gmail.com'}`} style={{ color: '#FFF', textDecoration: 'none', fontWeight: '600' }}>
                {userData?.managerEmail || 'lemaiiisk@gmail.com'}
              </a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>📞 매니저 연락처</span>
              <a href={`tel:${userData?.managerPhone || '등록된 번호 없음'}`} style={{ color: '#FFF', textDecoration: 'none', fontWeight: '600' }}>
                {userData?.managerPhone || '010-2020-6447'}
              </a>
            </div>
          </div>
        </div>

      </div>

      {showTxModal && (
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
          alignItems: 'center'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '420px', background: '#111827', padding: '30px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '14px', color: '#FFF', fontWeight: '700' }}>
              {txType === 'DEPOSIT' ? `💸 ${DASHBOARD_COPY.depositAction}` : `📤 ${DASHBOARD_COPY.withdrawAction}`}
            </h3>

            <form onSubmit={handleTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#A78BFA' }}>
                  {txType === 'DEPOSIT' ? DASHBOARD_COPY.depositAmount : DASHBOARD_COPY.withdrawAmount}
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="예: 500"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px' }}>
                {txType === 'DEPOSIT'
                  ? '💡 입금한 SUT는 운용 자산에 반영됩니다.'
                  : '💡 출금 요청 시 봇 거래 정산이 수동으로 진행되며, 본사 매니저 최종 승인 후 입력하신 가상 지갑 주소로 SUT가 전달됩니다.'}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowTxModal(false)} style={{ flex: 1 }}>
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, background: txType === 'DEPOSIT' ? 'var(--primary-gradient)' : 'var(--danger-color)' }}
                  disabled={processingTx}
                >
                  {processingTx ? '처리 중...' : txType === 'DEPOSIT' ? DASHBOARD_COPY.depositSubmit : DASHBOARD_COPY.withdrawSubmit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default PcDashboard;
