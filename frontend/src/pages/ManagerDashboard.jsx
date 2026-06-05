import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Users, DollarSign, Award, ArrowLeft, Check, X,
  Eye, ShieldAlert, BarChart3, Receipt, ExternalLink, ShieldCheck, Wallet, Settings,
  ArrowUpDown
} from 'lucide-react';
import { API_BASE } from '../App';
import { ethers } from 'ethers';
import {
  approveManagerUser,
  approveManagerWithdrawal,
  buildManagerHeaders,
  clearManagerGateIoCredentials,
  loadManagerDashboardData,
  rejectManagerUser,
  saveManagerAiSettings,
  saveManagerGateIoCredentials,
  sendSutToGateIoDepositAddress,
  submitManagerGateIoOrder,
} from '../lib/managerDashboard';

function ManagerDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [withdrawals, setWithdrawals] = useState([]);

  const [gridSettings, setGridSettings] = useState({
    ai_grid_status: 'OFF',
    ai_grid_lower: '0.15',
    ai_grid_upper: '0.30',
    ai_grid_count: '10',
    ai_grid_frequency: '5'
  });

  const [portfolio, setPortfolio] = useState(null);
  const [walletSutBalance, setWalletSutBalance] = useState(0);
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('DEPOSIT');
  const [txAmount, setTxAmount] = useState('');
  const [processingTx, setProcessingTx] = useState(false);
  const [gateioBalance, setGateioBalance] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [yieldHistory, setYieldHistory] = useState([]);
  const [aiLogs, setAiLogs] = useState([]);

  // New: Strategy ID reference for preventing duplicate execution
  const lastExecutedStrategyIdRef = useRef(null);

  const [selectedIdCard, setSelectedIdCard] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);

  const [orderAmount, setOrderAmount] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const [localApiKey, setLocalApiKey] = useState(localStorage.getItem('gateio_api_key') || '');
  const [localApiSecret, setLocalApiSecret] = useState(localStorage.getItem('gateio_api_secret') || '');
  const [localDepositAddress, setLocalDepositAddress] = useState(localStorage.getItem('gateio_deposit_address') || '');

  const [showSendSutModal, setShowSendSutModal] = useState(false);
  const [sendSutAmount, setSendSutAmount] = useState('');
  const [sendingSut, setSendingSut] = useState(false);

  // Manager password protection status for demonstration convenience and thorough prevention of unauthorized external access
  const [managerAuth, setManagerAuth] = useState(false);
  const [managerPassword, setManagerPassword] = useState('');

  const getManagerHeaders = () => {
    return buildManagerHeaders({
      managerEmail,
      getStorageItem: (key) => localStorage.getItem(key),
    });
  };

  const handleGateIoOrder = async (side) => {
    if (!orderAmount || parseFloat(orderAmount) <= 0) {
      alert("주문 수량을 입력하세요.");
      return;
    }
    if (!orderPrice || parseFloat(orderPrice) <= 0) {
      alert("주문 가격을 입력하세요.");
      return;
    }

    if (!confirm(`Gate.io 거래소에 SUT를 [${orderAmount}개]를 [${orderPrice} USDT] 단가로 실제 ${side === 'buy' ? '매수(BUY)' : '매도(SELL)'} 주문하시겠습니까?\n이 작업은 거래소에 실시간 반영되는 실제 주문입니다.`)) {
      return;
    }

    setSubmittingOrder(true);
    try {
      const res = await submitManagerGateIoOrder({
        apiBase: API_BASE,
        managerEmail,
        side,
        amount: orderAmount,
        price: orderPrice,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });

      if (res.data.success) {
        alert(`🎉 ${res.data.message}\n주문 ID: ${res.data.order.id}`);
        setOrderAmount('');
        setOrderPrice('');
        fetchManagerData();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 주문 오류: ${errMsg}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleSaveApiKeys = async () => {
    if (!localApiKey.trim() || !localApiSecret.trim() || !localDepositAddress.trim()) {
      alert('⚠️ 모든 API 키 및 입금 주소를 정확하게 입력해 주세요.');
      return;
    }

    try {
      await saveManagerGateIoCredentials({
        apiBase: API_BASE,
        managerEmail,
        apiKey: localApiKey,
        apiSecret: localApiSecret,
        depositAddress: localDepositAddress,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
        setStorageItem: (key, value) => localStorage.setItem(key, value),
      });
      alert('💾 Gate.io API 키 및 입금 주소가 기기 및 서버 DB에 안전하게 저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('경고: 로컬 저장은 성공했으나 서버 DB 저장에 실패했습니다: ' + (err.response?.data?.message || err.message));
    }
    fetchManagerData();
  };

  const handleClearApiKeys = async () => {
    setLocalApiKey('');
    setLocalApiSecret('');
    setLocalDepositAddress('');

    try {
      await clearManagerGateIoCredentials({
        apiBase: API_BASE,
        managerEmail,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
        removeStorageItem: (key) => localStorage.removeItem(key),
      });
      alert('🗑️ 저장된 API 키 및 입금 주소가 기기 및 서버에서 정상 삭제되었습니다.');
    } catch (err) {
      console.error(err);
      alert('경고: 로컬 삭제는 성공했으나 서버 DB 삭제에 실패했습니다: ' + (err.response?.data?.message || err.message));
    }
    fetchManagerData();
  };

  const handleSendSutToGateIo = async (e) => {
    if (e) e.preventDefault();

    const depositAddr = localStorage.getItem('gateio_deposit_address') || '';
    if (!depositAddr) {
      alert('Gate.io SUT 입금 주소를 로컬 설정에서 먼저 입력하고 저장해 주세요.');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(depositAddr.trim())) {
      alert('올바른 폴리곤 지갑 주소 형식(0x...로 시작하는 42자리)이 아닙니다. 로컬 설정을 확인해 주세요.');
      return;
    }

    if (!sendSutAmount || parseFloat(sendSutAmount) <= 0) {
      alert('유효한 수량을 입력해 주세요.');
      return;
    }

    if (!window.ethereum) {
      alert('설치된 메타마스크 혹은 트러스트월렛 브라우저 지갑을 찾을 수 없습니다.');
      return;
    }

    setSendingSut(true);
    try {
      const transferTx = await sendSutToGateIoDepositAddress({
        ethereum: window.ethereum,
        ethersLib: ethers,
        depositAddress: depositAddr,
        amount: sendSutAmount,
      });
      alert(`SUT transfer completed to Gate.io deposit address.\nTxHash: ${transferTx.hash}`);
      setShowSendSutModal(false);
      setSendSutAmount('');
    } catch (err) {
      console.error(err);
      alert(`❌ 전송 실패: ${err.message || err}`);
    } finally {
      setSendingSut(false);
    }
  };

  const fetchManagerData = async () => {
    try {
      const managerData = await loadManagerDashboardData({
        apiBase: API_BASE,
        managerEmail,
        walletAddress,
        axiosClient: axios,
        ethersLib: ethers,
        getStorageItem: (key) => localStorage.getItem(key),
        setStorageItem: (key, value) => localStorage.setItem(key, value),
        removeStorageItem: (key) => localStorage.removeItem(key),
        previousYieldHistory: yieldHistory,
      });

      if (managerData.pendingUsers !== undefined) setPendingUsers(managerData.pendingUsers);
      if (managerData.stats !== undefined) setStats(managerData.stats);
      if (managerData.recentPayments !== undefined) setRecentPayments(managerData.recentPayments);
      if (managerData.allUsers !== undefined) setAllUsers(managerData.allUsers);
      if (managerData.withdrawals !== undefined) setWithdrawals(managerData.withdrawals);
      if (managerData.gridSettings !== undefined) setGridSettings(managerData.gridSettings);
      if (managerData.portfolio !== undefined) setPortfolio(managerData.portfolio);
      if (managerData.walletSutBalance !== undefined) setWalletSutBalance(managerData.walletSutBalance);
      if (managerData.gateioBalance !== undefined) setGateioBalance(managerData.gateioBalance);
      if (managerData.performance !== undefined) setPerformance(managerData.performance);
      if (managerData.yieldHistory !== undefined) setYieldHistory(managerData.yieldHistory);
      if (managerData.aiLogs !== undefined) setAiLogs(managerData.aiLogs);

      if (managerData.credentialUpdates.clearApiKey) setLocalApiKey('');
      if (managerData.credentialUpdates.clearApiSecret) setLocalApiSecret('');
      if (managerData.credentialUpdates.depositAddress) setLocalDepositAddress(managerData.credentialUpdates.depositAddress);
    } catch (err) {
      console.error('Manager data load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerData();
    const interval = setInterval(fetchManagerData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gridSettings.ai_grid_status !== 'ON' || !aiLogs || aiLogs.length === 0) return;

    const latestStrategy = aiLogs[0];
    if (lastExecutedStrategyIdRef.current === latestStrategy.id) return;
    lastExecutedStrategyIdRef.current = latestStrategy.id;
  }, [aiLogs, gridSettings.ai_grid_status]);

  const handleApprove = async (walletAddressToApprove) => {
    if (!confirm('해당 회원의 신분증 및 구글 계정을 승인하고 10일 무료 체험(TRIAL) 등급으로 가입을 허가하시겠습니까?')) {
      return;
    }
    setSubmittingId(walletAddressToApprove);
    try {
      const res = await approveManagerUser({
        apiBase: API_BASE,
        managerEmail,
        walletAddress: walletAddressToApprove,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchManagerData();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert('승인 처리 중 오류 발생: ' + errMsg);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async (walletAddressToReject) => {
    if (!confirm('해당 회원의 신원 서류가 부적합하여 가입 신청을 반려하시겠습니까?')) {
      return;
    }
    setSubmittingId(walletAddressToReject);
    try {
      const res = await rejectManagerUser({
        apiBase: API_BASE,
        managerEmail,
        walletAddress: walletAddressToReject,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchManagerData();
      }
    } catch (err) {
      alert('반려 처리 중 오류 발생: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleApproveWithdrawal = async (id, requestedAmount, name) => {

    const actualPayoutStr = prompt(`[수동 지급 확정]\n\n${name} 회원님이 신청한 출금액은 [${requestedAmount} SUT] 입니다.\n\n매니저님께서 실제로 트러스트월렛을 통해 송금하신 실제 금액을 메모용으로 입력해주세요.\n(참고: 회원의 장부에서는 무조건 신청 원금인 ${requestedAmount} SUT가 소멸됩니다.)`, requestedAmount);

    if (actualPayoutStr === null) return;

    try {
      const res = await approveManagerWithdrawal({
        apiBase: API_BASE,
        managerEmail,
        withdrawalId: id,
        actualPayoutAmount: actualPayoutStr,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchManagerData();
      }
    } catch (err) {
      alert('출금 승인 처리 중 오류 발생: ' + err.message);
    }
  };

  const handleToggleAiStatus = async () => {
    const newStatus = gridSettings.ai_grid_status === 'ON' ? 'OFF' : 'ON';

    if (newStatus === 'ON') {
      const typed = prompt(`[⚠️ 법적 책임 면책 동의서 ⚠️]\n\n본 AI 자동 매매(Grid Trading) 기능의 가동으로 인해 발생하는 회원의 자산 손실 및 모든 민형사상 법적 책임은 해당 기능을 활성화한 '매니저 본인'에게 귀속됩니다. 플랫폼 개발팀은 어떠한 책임도 지지 않습니다.\n\n위 내용에 동의하시면 아래 입력창에 정확히 "동의합니다" 라고 입력해 주세요.`);

      if (typed !== "동의합니다") {
        alert("동의 문구가 일치하지 않아 AI 오토 트레이딩이 가동되지 않았습니다.");
        return;
      }
    }

    try {
      const res = await saveManagerAiSettings({
        apiBase: API_BASE,
        managerEmail,
        settings: { status: newStatus },
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });

      if (res.data.success) {
        setGridSettings(prev => ({ ...prev, ai_grid_status: newStatus }));
        alert(newStatus === 'ON' ? '🤖 완전 자동화 AI 트레이딩 봇이 가동되었습니다!' : 'AI 트레이딩 봇이 정지되었습니다.');
      }
    } catch (err) {
      alert('설정 변경 중 오류: ' + err.message);
    }
  };

  const handleSaveGridSettings = async () => {
    try {
      const res = await saveManagerAiSettings({
        apiBase: API_BASE,
        managerEmail,
        settings: {
          status: gridSettings.ai_grid_status,
          lower: gridSettings.ai_grid_lower,
          upper: gridSettings.ai_grid_upper,
          count: gridSettings.ai_grid_count,
          frequency: gridSettings.ai_grid_frequency,
        },
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });

      if (res.data.success) {
        alert('그리드 봇 파라미터가 안전하게 저장되었습니다.');
      }
    } catch (err) {
      alert('설정 저장 중 오류: ' + err.message);
    }
  };

  const handleTxSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!txAmount || parseFloat(txAmount) <= 0) {
      alert('유효한 금액을 입력해 주세요.');
      return;
    }

    setProcessingTx(true);
    try {
      if (txType === 'DEPOSIT') {
        if (!window.ethereum) {
          throw new Error('설치된 메타마스크 혹은 트러스트월렛 브라우저 지갑을 찾을 수 없습니다.');
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();

        if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          throw new Error(`지갑 주소 불일치: 현재 로그인된 계정 주소(${walletAddress})와 메타마스크에 활성화된 주소(${signerAddress})가 다릅니다. 지갑 계정을 확인해 주세요.`);
        }

        const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
        const vaultAddress = "0x855c880D538892fD899eECb72D4b1Ac5B46089eA";
        const sutAbi = ["function transfer(address recipient, uint256 amount) external returns (bool)"];

        const sutContract = new ethers.Contract(sutContractAddress, sutAbi, signer);

        const parsedAmount = ethers.parseUnits(txAmount.toString(), 18);

        const tx = await sutContract.transfer(vaultAddress, parsedAmount);

        await tx.wait();

        const res = await axios.post(`${API_BASE}/investment/deposit`, {
          walletAddress,
          amount: parseFloat(txAmount),
          txHash: tx.hash
        });
        if (res.data.success) {
          alert(`🎉 성공적으로 ${txAmount} SUT가 예치되어 시뮬레이션 장부에 즉시 기록되었습니다.\nTxHash: ${tx.hash}`);
        }
      } else {
        if (portfolio && parseFloat(txAmount) > portfolio.sutQuantity) {
          alert('출금 요청 금액이 현재 총 보유 SUT 한도를 초과합니다.');
          setProcessingTx(false);
          return;
        }
        const res = await axios.post(`${API_BASE}/investment/withdraw`, {
          walletAddress,
          amount: parseFloat(txAmount)
        });
        if (res.data.success) {
          alert(`📤 ${txAmount} SUT 출금 신청이 성공적으로 접수되었습니다. 승인 후 지갑으로 가상 전송됩니다.`);
        }
      }
      setShowTxModal(false);
      setTxAmount('');
      fetchManagerData();
    } catch (err) {
      alert('거래 처리 실패: ' + err.message);
    } finally {
      setProcessingTx(false);
    }
  };

  const handleTriggerAIProfit = async () => {
    const profitPercentage = prompt(`[AI 트레이딩 시뮬레이션 수익 분배]\n\n현재 가입된 정식(ACTIVE) 회원들에게 배분할 'SUT 수익률(%)'을 숫자로 입력해 주세요.\n(예: 0.5 입력 시, 회원의 SUT 총액 기준 0.5%의 SUT가 추가로 분배됩니다.)`, "0.5");

    if (profitPercentage === null || isNaN(parseFloat(profitPercentage))) return;

    if (!confirm(`전체 정회원을 대상으로 ${profitPercentage}%의 AI 수익률을 강제 배분하시겠습니까? (이 작업은 취소할 수 없으며 즉시 각 회원의 SUT 잔고가 증가합니다.)`)) {
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/manager/trigger-ai-profit`, {
        profitPercentage
      }, getManagerHeaders());

      if (res.data.success) {
        alert(res.data.message);
        fetchManagerData();
      }
    } catch (err) {
      alert('AI 수익 분배 중 오류 발생: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ margin: 'auto', textAlign: 'center', padding: '20px' }}>
        <div className="shimmer-loading" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 15px' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>본사 매니저 통계 모듈을 빌드 중입니다...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn-secondary"
          onClick={() => navigate('/dashboard')}
          style={{ width: 'auto', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', gap: '5px' }}
        >
          <ArrowLeft size={16} />
          사용자 모드로
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          🏢 <strong>본사 매니저 관제 시스템</strong>
        </span>
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden', position: 'relative', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <div style={{ padding: '16px 16px 10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>📈 Gate.io 실시간 투자 수익률 (원금 대비)</span>
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '20px',
                fontWeight: '800',
                color: performance ? (performance.yieldPercent >= 0 ? 'var(--success-color)' : 'var(--danger-color)') : '#FFF',
                fontFamily: 'var(--font-title)'
              }}>
                {performance ? `${performance.yieldPercent >= 0 ? '+' : ''}${performance.yieldPercent.toFixed(2)}%` : '0.00%'}
              </span>
              {performance && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  (원금: {performance.totalBuyUsdt.toFixed(2)} USDT / 보유 USDT: {gateioBalance ? parseFloat(gateioBalance.USDT).toFixed(2) : '0.00'} USDT)
                </span>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <span className="glow-active" style={{ fontSize: '9px', color: performance ? 'var(--success-color)' : 'var(--text-dark)', background: performance ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '8px', fontWeight: '700', whiteSpace: 'nowrap' }}>
              ● {performance ? '실거래 수익률' : '가상 데모'}
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: '100px', position: 'relative', display: 'block', padding: '10px 16px 12px 16px' }}>
          <svg width="100%" height="80" viewBox="0 0 500 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id="mobileManagerYieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="mobileManagerYieldLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>

            <line x1="0" y1="15" x2="500" y2="15" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
            <line x1="0" y1="40" x2="500" y2="40" stroke="rgba(255,255,255,0.08)" />
            <line x1="0" y1="65" x2="500" y2="65" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />

            {(() => {
              const data = (performance && yieldHistory.length > 0) ? yieldHistory : [0];
              const height = 80;
              const minVal = Math.min(...data) - 0.5;
              const maxVal = Math.max(...data) + 0.5;
              const valRange = maxVal - minVal || 1;
              const points = data.map((val, idx) => {
                const x = data.length > 1 ? (idx / (data.length - 1)) * 500 : 250;
                const y = height - 10 - ((val - minVal) / valRange) * (height - 20);
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
                dArea = `${dPath} L ${points[points.length - 1].x} 80 L ${points[0].x} 80 Z`;
              }
              return (
                <>
                  {dArea && performance && <path d={dArea} fill="url(#mobileManagerYieldGrad)" style={{ transition: 'all 0.5s ease' }} />}
                  {dPath && <path d={dPath} fill="none" stroke={performance ? "url(#mobileManagerYieldLineGrad)" : "rgba(255,255,255,0.15)"} strokeDasharray={performance ? "none" : "4,4"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />}
                  {points.length > 0 && performance && (
                    <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="var(--success-color)" stroke="#FFF" strokeWidth="1.5" style={{ transition: 'all 0.5s ease' }} />
                  )}
                </>
              );
            })()}
          </svg>
        </div>

        {/* Fallback guidance overlay when API key is not set or there is no transaction history */}
        {!performance && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(10, 8, 20, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <span style={{ color: '#F59E0B', fontWeight: '700', display: 'block', marginBottom: '4px', fontSize: '11px' }}>⚠️ 수익률 차트 비활성화됨</span>
              로컬 Gate.io API 키를 등록하고 거래소에서 SUT를 실제 매수하면 수익률 차트가 여기에 표기됩니다.
            </div>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)' }}>
              <BarChart3 size={20} color="var(--success-color)" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ fontSize: '14px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>🤖 자동화 AI 그리드 트레이딩 봇</h4>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>상/하한가 범위를 설정하면 매일 봇이 수익을 발생시킵니다.</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {gridSettings.ai_grid_status === 'ON' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--success-color)' }}>LIVE</span>
                <span style={{ fontSize: '9px', color: 'var(--success-color)', fontWeight: 'bold' }}>작동중</span>
              </div>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>정지됨</span>
            )}
            <button
              onClick={handleToggleAiStatus}
              style={{
                width: '46px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: gridSettings.ai_grid_status === 'ON' ? 'var(--success-color)' : 'rgba(255,255,255,0.2)',
                position: 'relative', transition: 'background 0.3s'
              }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', background: '#FFF', position: 'absolute', top: '2px',
                left: gridSettings.ai_grid_status === 'ON' ? '24px' : '2px', transition: 'left 0.3s'
              }}></div>
            </button>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(59, 130, 246, 0.02)', border: '1px solid rgba(59, 130, 246, 0.15)', margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>🤖</span>
              <h4 style={{ fontSize: '12px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>실시간 AI 엔진 의사결정 브리핑</h4>
            </div>
            <span className="pulse-indicator" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#3B82F6', fontWeight: '700' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6', display: 'inline-block', boxShadow: '0 0 6px #3B82F6' }}></span>
              실시간
            </span>
          </div>

          <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0, textAlign: 'left' }}>
            글로벌 AI 두뇌가 5분마다 실시간 가격 추이와 잔고를 분석하여 의사결정을 내린 결과 보고서입니다.
          </p>

          {aiLogs.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '11px' }}>
              📡 AI 엔진이 시장 데이터를 분석 중입니다. 최초 실행 완료까지 약 5분 정도 소요됩니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '2px' }}>
              {aiLogs.slice(0, 5).map((log, index) => {
                let badgeColor = 'var(--text-muted)';
                let badgeBg = 'rgba(255,255,255,0.05)';
                let borderCol = 'rgba(255,255,255,0.05)';

                if (log.decision === 'BUY') {
                  badgeColor = 'var(--success-color)';
                  badgeBg = 'rgba(16, 185, 129, 0.1)';
                  borderCol = 'rgba(16, 185, 129, 0.15)';
                } else if (log.decision === 'SELL') {
                  badgeColor = 'var(--danger-color)';
                  badgeBg = 'rgba(239, 68, 68, 0.1)';
                  borderCol = 'rgba(239, 68, 68, 0.15)';
                } else if (log.decision === 'HOLD') {
                  badgeColor = '#F59E0B';
                  badgeBg = 'rgba(245, 158, 11, 0.1)';
                  borderCol = 'rgba(245, 158, 11, 0.15)';
                }

                return (
                  <div
                    key={log.id || index}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: `1px solid ${borderCol}`,
                      borderRadius: '8px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: '950',
                          color: badgeColor,
                          background: badgeBg,
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          {log.decision === 'BUY' ? '매수' : log.decision === 'SELL' ? '매도' : '관망'}
                        </span>
                        {log.decision !== 'HOLD' && (
                          <span style={{ fontSize: '9px', color: '#E5E7EB', fontWeight: 'bold' }}>
                            {log.proposed_price} USDT / {log.proposed_amount} SUT
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '8px', color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                        {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ fontSize: '10px', color: '#D1D5DB', lineHeight: '1.4', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '6px' }}>
                      {log.reason}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>하한가 (최저)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>SUT</span>
              <input
                type="number"
                value={gridSettings.ai_grid_lower}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_lower: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>상한가 (최고)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>SUT</span>
              <input
                type="number"
                value={gridSettings.ai_grid_upper}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_upper: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>그리드 수</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <input
                type="number"
                value={gridSettings.ai_grid_count}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_count: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ color: 'var(--text-dark)', fontSize: '11px', marginLeft: '4px' }}>개</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>일일 빈도 (Frequency)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <input
                type="number"
                value={gridSettings.ai_grid_frequency}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_frequency: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ color: 'var(--text-dark)', fontSize: '11px', marginLeft: '4px' }}>회</span>
            </div>
          </div>
        </div>

        {/* 🛡️ Exchange API Safety Guide Warning */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          padding: '10px 12px',
          borderRadius: '8px',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start'
        }}>
          <ShieldAlert size={14} color="var(--danger-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ textAlign: 'left' }}>
            <strong style={{ fontSize: '11px', color: 'var(--danger-color)' }}>안전 가이드 (계정 정지 주의)</strong>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
              일일 매매 횟수(Frequency)를 너무 높게 설정하면 거래소(Binance, Gate.io 등)의 API 호출 제한(Rate Limit) 정책에 위반되어 <b>봇 연결 차단 및 계정 정지(Wash Trading 의심)</b> 위험이 있습니다. 안정적인 자산 운용을 위해 기본 설정값(하루 5~15회 내외)을 유지하는 것을 권장합니다.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn-secondary"
            onClick={handleTriggerAIProfit}
            style={{ fontSize: '11px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)' }}
          >
            (수동) 1회성 수익률 쏘기
          </button>

          <button
            className="btn-primary"
            onClick={handleSaveGridSettings}
            style={{ background: 'var(--primary-color)', padding: '8px 20px', fontSize: '12px', width: 'auto' }}
          >
            파라미터 저장
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: gateioBalance ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)', background: gateioBalance ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255, 255, 255, 0.02)' }}>
        <div>
          <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 10px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>📊</span> Gate.io API 실거래 연동 현황
          </h4>
          {gateioBalance ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>연동 상태:</span>
                <span style={{ color: 'var(--success-color)', fontWeight: '700' }}>● 실거래 가동 중</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>거래소 보유 SUT:</span>
                <span style={{ color: '#FFF', fontWeight: '700' }}>{parseFloat(gateioBalance.SUT).toFixed(2)} SUT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>거래소 보유 USDT:</span>
                <span style={{ color: '#FFF', fontWeight: '700' }}>{parseFloat(gateioBalance.USDT).toFixed(2)} USDT</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'left', fontSize: '11px', lineHeight: '1.5' }}>
              <span style={{ color: '#F59E0B', fontWeight: '700', display: 'block', marginBottom: '4px' }}>⚠️ API 키 미등록 (가상 데모 모드)</span>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                아래 로컬 설정을 통해 API 키를 등록하면, 실제 거래소 SUT/USDT 자금 조회 및 소액 자동매매 실거래 연동이 활성화됩니다.
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const addr = localStorage.getItem('gateio_deposit_address');
              if (!addr) {
                alert('Gate.io SUT 입금 주소를 로컬 설정에서 먼저 입력하고 저장해 주세요.');
              } else {
                setShowSendSutModal(true);
              }
            }}
            style={{ width: '100%', padding: '8px 12px', fontSize: '11px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', border: 'none', borderRadius: '6px', fontWeight: '700', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <ArrowUpDown size={12} /> 내 지갑에서 Gate.io로 SUT 송금
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
        <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>💰</span> SUT 자산 통합 관리 현황
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>매니저 개인 지갑 (온체인):</span>
            <span style={{ color: '#60A5FA', fontWeight: '700' }}>{walletSutBalance.toFixed(2)} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>회원들이 맡긴 총 SUT (수납):</span>
            <span style={{ color: '#A78BFA', fontWeight: '700' }}>{stats ? stats.totalRevenue.toFixed(2) : '0.00'} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>본사 보유 SUT (자기 돈):</span>
            <span style={{ color: '#10B981', fontWeight: '700' }}>{stats ? stats.companyRevenue.toFixed(2) : '0.00'} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>회원 배분 SUT:</span>
            <span style={{ color: '#F59E0B', fontWeight: '700' }}>{stats ? stats.totalDistributed.toFixed(2) : '0.00'} SUT</span>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Settings size={18} color="#A78BFA" />
          로컬 전용 Gate.io API 키 및 주소 설정
        </h4>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
          보안 유지를 위해 입력 정보는 <strong>현재 기기 브라우저에만 저장</strong>되며 서버 DB나 설정 파일에 등록되지 않습니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="password"
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
            placeholder="Gate.io API Key 입력"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#FFF', outline: 'none' }}
          />
          <input
            type="password"
            value={localApiSecret}
            onChange={(e) => setLocalApiSecret(e.target.value)}
            placeholder="Gate.io API Secret Key 입력"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#FFF', outline: 'none' }}
          />
          <input
            type="text"
            value={localDepositAddress}
            onChange={(e) => setLocalDepositAddress(e.target.value)}
            placeholder="Gate.io SUT 입금 주소 (Polygon) 입력"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#FFF', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveApiKeys}
            style={{ flex: 1, padding: '10px', fontSize: '11px', background: 'var(--primary-gradient)', fontWeight: 'bold' }}
          >
            💾 기기 저장
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClearApiKeys}
            style={{ flex: 1, padding: '10px', fontSize: '11px', color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.2)', fontWeight: 'bold' }}
          >
            🗑️ 삭제
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(20, 16, 45, 0.4) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <h4 style={{ fontSize: '15px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpDown size={18} color="#8B5CF6" />
          메니져 Gate.io 실거래 주문 관리
        </h4>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
          현재 기기에 임시 보관된 API 키를 통하여 Gate.io 현물 거래소에 SUT/USDT 실제 매매 주문을 실행합니다.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>주문 수량</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <input
                type="number"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                placeholder="SUT 수량 입력 (예: 10)"
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px', fontWeight: 'bold' }}>SUT</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>지정가 가격</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <input
                type="number"
                value={orderPrice}
                onChange={(e) => setOrderPrice(e.target.value)}
                placeholder="USDT 가격 입력 (예: 0.19)"
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px', fontWeight: 'bold' }}>USDT</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>

          <button
            type="button"
            className="btn-primary"
            disabled={submittingOrder}
            style={{ flex: 1, padding: '12px', fontSize: '13px', fontWeight: 'bold', background: 'linear-gradient(90deg, #10B981, #059669)' }}
            onClick={() => handleGateIoOrder('buy')}
          >
            {submittingOrder ? '전송 중...' : '🟢 SUT 매수'}
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={submittingOrder}
            style={{ flex: 1, padding: '12px', fontSize: '13px', fontWeight: 'bold', background: 'linear-gradient(90deg, #EF4444, #DC2626)' }}
            onClick={() => handleGateIoOrder('sell')}
          >
            {submittingOrder ? '전송 중...' : '🔴 SUT 매도'}
          </button>
        </div>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>

          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(139,92,246,0.08)', marginBottom: '6px' }}>
              <Users size={16} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>1차 승인 정원 제한</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F3F4F6', marginTop: '4px' }}>
              {stats.totalApproved} <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>/ {stats.limit}</span>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(245,158,11,0.08)', marginBottom: '6px' }}>
              <ShieldAlert size={16} color="#F59E0B" />
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>가입 심사 대기자</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F59E0B', marginTop: '4px' }}>
              {stats.totalPending} 명
            </div>
          </div>

        </div>
      )}

      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="#F59E0B" />
          신규 가입 심사 접수 목록 ({pendingUsers.length}건)
        </h3>

        {pendingUsers.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            현재 새로 접수된 가입 신청이나 신원 서류 심사 대기자가 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', color: '#F3F4F6' }}>{user.name} ({user.country})</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>구글인증: {user.email}</span>
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>
                    {new Date(user.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                  <div style={{ wordBreak: 'break-all' }}>지갑: **{user.wallet_address}**</div>
                  <div>전화번호: {user.phone}</div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px', gap: '4px' }}
                    onClick={() => {
                      const backendOrigin = API_BASE.replace('/api', '');
                      setSelectedIdCard(`${backendOrigin}${user.id_card_path}`);
                    }}
                  >
                    <Eye size={12} />
                    신분증 확인
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1, padding: '8px', fontSize: '11px', borderRadius: '8px', gap: '4px', background: 'var(--success-color)', boxShadow: 'none' }}
                    onClick={() => handleApprove(user.wallet_address)}
                    disabled={submittingId === user.wallet_address}
                  >
                    <Check size={12} />
                    승인
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: '40px', padding: '8px', fontSize: '11px', borderRadius: '8px', background: 'var(--danger-color)', boxShadow: 'none' }}
                    onClick={() => handleReject(user.wallet_address)}
                    disabled={submittingId === user.wallet_address}
                  >
                    <X size={12} />
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ border: '1px solid rgba(245, 158, 11, 0.3)' }}>
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={18} color="#F59E0B" />
          출금 심사 보드 (대기: {withdrawals.length}건)
        </h3>

        {withdrawals.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            현재 회원이 접수한 출금(지급) 신청이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {withdrawals.map((req) => (
              <div key={req.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#F3F4F6' }}>{req.name} 회원의 출금 신청</div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>{new Date(req.created_at).toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1, background: 'rgba(16,185,129,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.1)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--success-color)' }}>회원이 신청한 출금(소멸) 금액</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFF' }}>{req.requested_amount} SUT</div>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', marginBottom: '15px', wordBreak: 'break-all' }}>
                  <strong>지급 대상 지갑 주소:</strong><br />
                  <span style={{ color: '#A78BFA' }}>{req.wallet_address}</span>
                </div>

                <button
                  className="btn-primary"
                  style={{ width: '100%', background: 'var(--success-color)' }}
                  onClick={() => handleApproveWithdrawal(req.id, req.requested_amount, req.name)}
                >
                  <Check size={16} /> 트러스트월렛 송금 완료 (장부 {req.requested_amount} SUT 삭감)
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Recent Payment and On-chain Distribution History List */}
      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={18} color="#8B5CF6" />
          최근 온체인 청구/수납 이력
        </h3>

        {recentPayments.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            현재까지 플랫폼 스마트 컨트랙트를 통해 결제 및 분배된 수납 이력이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', scrollbarWidth: 'none' }}>
            {recentPayments.map((pay) => (
              <div
                key={pay.id}
                style={{
                  background: 'rgba(0,0,0,0.15)',
                  border: '1px solid rgba(255,255,255,0.02)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#F3F4F6' }}>
                    {pay.name} ({pay.type === 'MEMBERSHIP_FEE' ? '가입비 수납' : '월정액 수납'})
                  </div>
                  <a
                    href={`https://amoy.polygonscan.com/tx/${pay.tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '9px', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                  >
                    TX: {pay.tx_hash.substring(0, 10)}... <ExternalLink size={8} />
                  </a>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--success-color)' }}>
                    +{pay.amount} SUT
                  </div>
                  <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>
                    50% 초대인 분배 완료
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. All Registered Members Roster Panel */}
      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="#10B981" />
          전체 등록 회원 명부 ({allUsers.length}명)
        </h3>

        {allUsers.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            등록된 플랫폼 회원이 존재하지 않습니다.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', scrollbarWidth: 'thin' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '650px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '11px' }}>
                  <th style={{ padding: '10px 8px' }}>이름 (국가)</th>
                  <th style={{ padding: '10px 8px' }}>이메일 / 연락처</th>
                  <th style={{ padding: '10px 8px' }}>지갑 주소</th>
                  <th style={{ padding: '10px 8px' }}>심사 상태</th>
                  <th style={{ padding: '10px 8px' }}>가입 등급</th>
                  <th style={{ padding: '10px 8px' }}>가입일</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user) => {
                  const isMaster = user.wallet_address.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase();
                  return (
                    <tr
                      key={user.id}
                      onClick={() => navigate(`/manager/edit-user/${user.wallet_address}`)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        fontSize: '11px',
                        color: '#E5E7EB',
                        background: isMaster ? 'rgba(139,92,246,0.06)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isMaster ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isMaster ? 'rgba(139,92,246,0.06)' : 'transparent'}
                    >
                      <td style={{ padding: '12px 8px', fontWeight: '600' }}>
                        <span style={{ color: isMaster ? '#C084FC' : '#FFF' }}>{user.name}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>({user.country})</span>
                        {isMaster && (
                          <span style={{ marginLeft: '6px', background: 'rgba(139,92,246,0.2)', color: '#C084FC', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: '800' }}>Master</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div>{user.email}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-dark)' }}>{user.phone}</div>
                      </td>
                      <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '10px', color: '#A7F3D0' }}>
                        {user.wallet_address.substring(0, 10)}...{user.wallet_address.substring(user.wallet_address.length - 8)}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '9px',
                          fontWeight: '700',
                          background: user.status === 'APPROVED' ? 'rgba(16,185,129,0.12)' : user.status === 'PENDING_KYC' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                          color: user.status === 'APPROVED' ? 'var(--success-color)' : user.status === 'PENDING_KYC' ? '#F59E0B' : 'var(--danger-color)'
                        }}>
                          {user.status === 'APPROVED' ? '승인완료' : user.status === 'PENDING_KYC' ? ' KYC대기 ' : ' 가입반려 '}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '9px',
                          fontWeight: '700',
                          background: user.tier === 'ACTIVE' ? 'rgba(139,92,246,0.12)' : user.tier === 'TRIAL' ? 'rgba(59,130,246,0.12)' : 'rgba(156,163,175,0.12)',
                          color: user.tier === 'ACTIVE' ? '#C084FC' : user.tier === 'TRIAL' ? '#60A5FA' : '#9CA3AF'
                        }}>
                          {user.tier === 'ACTIVE' ? '정회원' : user.tier === 'TRIAL' ? '무료체험' : '만료됨'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-dark)', fontSize: '9px' }}>
                        {new Date(user.joined_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. ID Magnified View Lightbox Modal */}
      {selectedIdCard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(10px)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <img
            src={selectedIdCard}
            alt="Submitted KYC ID Card"
            style={{
              maxWidth: '90%',
              maxHeight: '75%',
              borderRadius: '12px',
              boxShadow: '0 0 40px rgba(0,0,0,0.8)',
              border: '2px solid rgba(255,255,255,0.1)'
            }}
          />
          <button
            className="btn-primary"
            onClick={() => setSelectedIdCard(null)}
            style={{ width: 'auto', padding: '10px 24px' }}
          >
            이미지 뷰어 닫기
          </button>
        </div>
      )}

      {/* 👑 For Manager Real Deposit/Withdrawal Modal Popup */}
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
          <div className="glass-card" style={{ width: '100%', maxWidth: '360px', background: '#111827', padding: '24px', margin: '0 20px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#FFF', fontWeight: '700' }}>
              {txType === 'DEPOSIT' ? '💸 SUT 투자 실제 예치' : '📤 SUT 투자 출금 신청'}
            </h3>

            <form onSubmit={handleTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#A78BFA', fontSize: '12px' }}>
                  {txType === 'DEPOSIT' ? '예치할 SUT 수량 입력 (실제 온체인 전송)' : '인출할 SUT 수량 입력'}
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="예: 10"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                {txType === 'DEPOSIT'
                  ? '💡 폴리곤 메인넷 상의 SUT 실제 온체인 전송입니다. 트러스트월렛/메타마스크 승인 창이 열리며 가스비(POL)와 토큰이 소모됩니다.'
                  : '💡 출금 요청 시 봇 거래 정산이 수동으로 진행되며, 매니저 최종 승인 후 입력하신 가상 지갑 주소로 SUT가 전달됩니다.'}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowTxModal(false)}
                  style={{ flex: 1, padding: '12px', fontSize: '13px' }}
                  disabled={processingTx}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: '12px', fontSize: '13px' }}
                  disabled={processingTx}
                >
                  {processingTx ? '처리중...' : (txType === 'DEPOSIT' ? '승인 및 예치' : '출금 신청')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 👑 Gate.io On-chain SUT Transfer Modal Popup (Mobile) */}
      {showSendSutModal && (
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
          <div className="glass-card" style={{ width: '100%', maxWidth: '360px', background: '#111827', padding: '24px', margin: '0 20px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '12px', color: '#FFF', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowUpDown size={20} color="#3B82F6" />
              Gate.io로 SUT 온체인 송금
            </h3>

            <form onSubmit={handleSendSutToGateIo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '10px', padding: '12px', fontSize: '11px', color: '#FFF' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>수신 Gate.io 입금 주소 (Polygon):</div>
                <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontWeight: '700' }}>{localStorage.getItem('gateio_deposit_address')}</div>
                <div style={{ color: '#93C5FD', marginTop: '6px' }}>⚠️ 반드시 Gate.io의 SUT (Polygon) 입금 주소인지 더블체크해 주세요!</div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#A78BFA', fontSize: '12px' }}>
                  송금할 SUT 수량 입력
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="예: 50"
                  value={sendSutAmount}
                  onChange={(e) => setSendSutAmount(e.target.value)}
                  min="0.0001"
                  step="any"
                  required
                />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                💡 <b>가스비 안내</b>: 이 송금 트랜잭션은 <b>현재 서명하는 본인 지갑</b>에서 가스비(폴리곤 POL 코인)와 SUT 코인이 차감됩니다. 마스터 지갑의 가스비는 사용되지 않습니다.
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowSendSutModal(false);
                    setSendSutAmount('');
                  }}
                  style={{ flex: 1, padding: '12px', fontSize: '13px' }}
                  disabled={sendingSut}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: '12px', fontSize: '13px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
                  disabled={sendingSut}
                >
                  {sendingSut ? '전송중...' : 'SUT 송금'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ManagerDashboard;
