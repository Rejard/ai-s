import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, DollarSign, Award, ArrowLeft, Check, X, 
  Eye, ShieldAlert, BarChart3, Receipt, ExternalLink, HelpCircle, ShieldCheck, Wallet, Settings,
  ArrowUpDown
} from 'lucide-react';
import { API_BASE } from '../App';
import { ethers } from 'ethers';

function PcManagerDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();

  // 대기 유저 및 전체 회원, 통계 데이터 상태
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);

  // AI 그리드 봇 설정 상태
  const [gridSettings, setGridSettings] = useState({
    ai_grid_status: 'OFF',
    ai_grid_lower: '0.15',
    ai_grid_upper: '0.30',
    ai_grid_count: '10',
    ai_grid_frequency: '5'
  });

  // 매니저 본인 AI 투자 현황 및 지갑 잔고 상태
  const [portfolio, setPortfolio] = useState(null);
  const [walletSutBalance, setWalletSutBalance] = useState(0);
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('DEPOSIT');
  const [txAmount, setTxAmount] = useState('');
  const [processingTx, setProcessingTx] = useState(false);
  const [gateioBalance, setGateioBalance] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [yieldHistory, setYieldHistory] = useState([]);

  // Gate.io 실거래 주문 전용 상태
  const [orderAmount, setOrderAmount] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // 로컬 기기 보관용 Gate.io API 키 및 입금 주소 상태
  const [localApiKey, setLocalApiKey] = useState(localStorage.getItem('gateio_api_key') || '');
  const [localApiSecret, setLocalApiSecret] = useState(localStorage.getItem('gateio_api_secret') || '');
  const [localDepositAddress, setLocalDepositAddress] = useState(localStorage.getItem('gateio_deposit_address') || '');

  // 온체인 Gate.io 송금 모달 상태
  const [showSendSutModal, setShowSendSutModal] = useState(false);
  const [sendSutAmount, setSendSutAmount] = useState('');
  const [sendingSut, setSendingSut] = useState(false);

  // 모달 이미지 뷰어 상태
  const [selectedIdCard, setSelectedIdCard] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);

  // 🌟 마스터 매니저 구글 이메일 고정 정의
  const MASTER_MANAGER_EMAIL = 'lemaiiisk@gmail.com'.toLowerCase();
  
  // 백엔드 보안 미들웨어를 통과하기 위한 x-manager-email 헤더 빌드 및 로컬 Gate.io API 키 적재
  const getManagerHeaders = () => {
    const apiKey = localStorage.getItem('gateio_api_key') || '';
    const apiSecret = localStorage.getItem('gateio_api_secret') || '';
    return {
      headers: {
        'x-manager-email': MASTER_MANAGER_EMAIL,
        'x-gateio-api-key': apiKey,
        'x-gateio-api-secret': apiSecret
      }
    };
  };

  // Gate.io 실제 지정가 주문 격발 핸들러
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
      const res = await axios.post(`${API_BASE}/manager/gateio-order`, {
        side,
        amount: parseFloat(orderAmount),
        price: parseFloat(orderPrice)
      }, getManagerHeaders());

      if (res.data.success) {
        alert(`🎉 ${res.data.message}\n주문 ID: ${res.data.order.id}`);
        setOrderAmount('');
        setOrderPrice('');
        fetchManagerData(); // 잔고 갱신
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

  // Gate.io API 키 및 입금 주소 로컬 기기 저장 핸들러
  const handleSaveApiKeys = () => {
    localStorage.setItem('gateio_api_key', localApiKey.trim());
    localStorage.setItem('gateio_api_secret', localApiSecret.trim());
    localStorage.setItem('gateio_deposit_address', localDepositAddress.trim());
    alert('💾 Gate.io API 키 및 입금 주소가 브라우저 로컬 스토리지에 저장되었습니다. (서버에는 전송/저장되지 않음)');
    fetchManagerData(); // 잔고 정보 즉시 갱신
  };

  // Gate.io API 키 및 입금 주소 로컬 기기 삭제 핸들러
  const handleClearApiKeys = () => {
    localStorage.removeItem('gateio_api_key');
    localStorage.removeItem('gateio_api_secret');
    localStorage.removeItem('gateio_deposit_address');
    setLocalApiKey('');
    setLocalApiSecret('');
    setLocalDepositAddress('');
    alert('🗑️ 저장된 API 키 및 입금 주소가 브라우저 로컬 스토리지에서 삭제되었습니다.');
    fetchManagerData(); // 데모 모드로 전환 확인
  };

  // 내 지갑에서 Gate.io로 SUT 송금 핸들러
  const handleSendSutToGateIo = async (e) => {
    if (e) e.preventDefault();
    
    const depositAddr = localStorage.getItem('gateio_deposit_address') || '';
    if (!depositAddr) {
      alert('Gate.io SUT 입금 주소를 로컬 설정에서 먼저 입력하고 저장해 주세요.');
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
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // SUT 토큰 정보
      const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
      const sutAbi = ["function transfer(address recipient, uint256 amount) external returns (bool)"];
      
      const sutContract = new ethers.Contract(sutContractAddress, sutAbi, signer);

      // 금액 파싱 (18 decimals)
      const parsedAmount = ethers.parseUnits(sendSutAmount.toString(), 18);

      // 실제 온체인 토큰 전송 실행 (Gate.io 입금 주소로 전송)
      const tx = await sutContract.transfer(depositAddr, parsedAmount);
      
      // 블록 확정 대기
      await tx.wait();

      alert(`🎉 성공적으로 ${sendSutAmount} SUT가 지정하신 Gate.io 입금 주소로 전송되었습니다.\nTxHash: ${tx.hash}`);
      setShowSendSutModal(false);
      setSendSutAmount('');
    } catch (err) {
      console.error(err);
      alert(`❌ 전송 실패: ${err.message || err}`);
    } finally {
      setSendingSut(false);
    }
  };

  // 1. 메니져 통합 데이터 로드
  const fetchManagerData = async () => {
    try {
      // 1-1. KYC 승인 대기 목록
      const pendingRes = await axios.get(`${API_BASE}/manager/pending-users`, getManagerHeaders());
      if (pendingRes.data.success) {
        setPendingUsers(pendingRes.data.users);
      }

      // 1-2. 통계 및 최근 결제
      const statsRes = await axios.get(`${API_BASE}/manager/stats`, getManagerHeaders());
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
        setRecentPayments(statsRes.data.recentPayments);
      }

      // 1-3. 전체 회원 정보 목록
      const allUsersRes = await axios.get(`${API_BASE}/manager/users`, getManagerHeaders());
      if (allUsersRes.data.success) {
        setAllUsers(allUsersRes.data.users);
      }

      // 1-4. 출금 심사 대기 목록 로드
      const withdrawRes = await axios.get(`${API_BASE}/manager/withdrawals`, getManagerHeaders());
      if (withdrawRes.data.success) {
        setWithdrawals(withdrawRes.data.withdrawals);
      }

      // 1-5. AI 그리드 설정 로드
      const aiRes = await axios.get(`${API_BASE}/manager/ai-settings`, getManagerHeaders());
      if (aiRes.data.success) {
        setGridSettings(aiRes.data.settings);
      }

      // 1-6. 매니저 본인 AI 투자 현황 및 지갑 잔고 로드
      if (walletAddress) {
        try {
          const portRes = await axios.get(`${API_BASE}/investment/portfolio/${walletAddress}`);
          if (portRes.data.success) {
            setPortfolio(portRes.data.portfolio);
          }

          // 실제 SUT 지갑 잔고 조회
          const rpcProvider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
          const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55".toLowerCase();
          const sutAbi = ["function balanceOf(address account) external view returns (uint256)"];
          const sutContract = new ethers.Contract(sutContractAddress, sutAbi, rpcProvider);
          const balanceWei = await sutContract.balanceOf(walletAddress);
          setWalletSutBalance(parseFloat(ethers.formatUnits(balanceWei, 18)));
        } catch (portErr) {
          console.error("매니저 자산 조회 에러:", portErr);
        }
      }

      // 1-7. Gate.io 거래소 잔고 로드
      try {
        const gateioRes = await axios.get(`${API_BASE}/manager/gateio-balance`, getManagerHeaders());
        if (gateioRes.data.success) {
          setGateioBalance(gateioRes.data.balances);
        } else {
          setGateioBalance(null);
        }
      } catch (gateioErr) {
        console.error("Gate.io 잔고 로드 에러:", gateioErr);
        setGateioBalance(null);
      }

      // 1-8. Gate.io 실시간 수익률 성과 로드
      try {
        const perfRes = await axios.get(`${API_BASE}/manager/gateio-performance`, getManagerHeaders());
        if (perfRes.data.success && perfRes.data.isConfigured && perfRes.data.totalBuyUsdt > 0) {
          setPerformance(perfRes.data);
          const curYield = perfRes.data.yieldPercent;
          setYieldHistory(prev => {
            let nextHistory = [...prev, curYield];
            if (nextHistory.length > 30) {
              nextHistory.shift();
            }
            return nextHistory;
          });
        } else {
          setPerformance(null);
          setYieldHistory([]);
        }
      } catch (perfErr) {
        console.error("Gate.io 성과 조회 에러:", perfErr);
        setPerformance(null);
        setYieldHistory([]);
      }

    } catch (err) {
      console.error('메니져 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerData();
    // 5초마다 실시간 동기화 리프레시
    const interval = setInterval(fetchManagerData, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. KYC 승인 처리
  const handleApprove = async (walletAddressToApprove) => {
    if (!confirm('해당 회원의 신분증 및 구글 계정을 승인하고 10일 무료 체험(TRIAL) 등급으로 가입을 허가하시겠습니까?')) {
      return;
    }
    setSubmittingId(walletAddressToApprove);
    try {
      const res = await axios.post(`${API_BASE}/manager/approve-user`, { walletAddress: walletAddressToApprove }, getManagerHeaders());
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

  // 3. KYC 반려 처리
  const handleReject = async (walletAddressToReject) => {
    if (!confirm('해당 회원의 신원 서류가 부적합하여 가입 신청을 반려하시겠습니까?')) {
      return;
    }
    setSubmittingId(walletAddressToReject);
    try {
      const res = await axios.post(`${API_BASE}/manager/reject-user`, { walletAddress: walletAddressToReject }, getManagerHeaders());
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

  // 4. 출금(지급) 수동 승인 처리
  const handleApproveWithdrawal = async (id, requestedAmount, name) => {
    const actualPayoutStr = prompt(`[수동 지급 확정]\n\n${name} 회원님이 신청한 출금액은 [${requestedAmount} SUT] 입니다.\n\n매니저님께서 실제로 트러스트월렛을 통해 송금하신 실제 금액을 메모용으로 입력해주세요.\n(참고: 회원의 장부에서는 무조건 신청 원금인 ${requestedAmount} SUT가 소멸됩니다.)`, requestedAmount);
    
    if (actualPayoutStr === null) return; // 취소

    try {
      const res = await axios.post(`${API_BASE}/manager/withdrawals/${id}/approve`, {
        actualPayoutAmount: parseFloat(actualPayoutStr)
      }, getManagerHeaders());
      if (res.data.success) {
        alert(res.data.message);
        fetchManagerData();
      }
    } catch (err) {
      alert('출금 승인 처리 중 오류 발생: ' + err.message);
    }
  };

  // 5. AI 트레이딩 그리드 봇 설정 변경 및 면책 조항
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
      const res = await axios.post(`${API_BASE}/manager/ai-settings`, {
        status: newStatus
      }, getManagerHeaders());
      
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
      const res = await axios.post(`${API_BASE}/manager/ai-settings`, {
        status: gridSettings.ai_grid_status,
        lower: gridSettings.ai_grid_lower,
        upper: gridSettings.ai_grid_upper,
        count: gridSettings.ai_grid_count,
        frequency: gridSettings.ai_grid_frequency
      }, getManagerHeaders());
      
      if (res.data.success) {
        alert('그리드 봇 파라미터가 안전하게 저장되었습니다.');
      }
    } catch (err) {
      alert('설정 저장 중 오류: ' + err.message);
    }
  };

  // 매니저 전용 온체인 입금(Deposit) 및 출금(Withdrawal) 처리
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

        // SUT 토큰 정보
        const sutContractAddress = "0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55";
        const vaultAddress = "0x855c880D538892fD899eECb72D4b1Ac5B46089eA";
        const sutAbi = ["function transfer(address recipient, uint256 amount) external returns (bool)"];
        
        const sutContract = new ethers.Contract(sutContractAddress, sutAbi, signer);

        // 금액 파싱 (18 decimals)
        const parsedAmount = ethers.parseUnits(txAmount.toString(), 18);

        // 실제 온체인 토큰 전송 실행
        const tx = await sutContract.transfer(vaultAddress, parsedAmount);
        
        // 블록 확정 대기
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

  // 6. 수동 분배 기능
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
      <div className="pc-layout-wrapper" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="shimmer-loading" style={{ width: '60px', height: '60px', borderRadius: '50%', margin: '0 auto 20px' }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>본사 매니저 통계 모듈을 빌드 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pc-layout-wrapper" style={{ alignItems: 'stretch', gap: '30px', padding: '40px 50px', flexDirection: 'column' }}>
      
      {/* 상단 통합 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>👑</span>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '22px', color: '#FFF', margin: 0, fontWeight: '800' }}>마스터 메니져 대시보드</h1>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🏢 본사 전용 회원 관리 및 AI 시뮬레이션 제어 시스템</span>
          </div>
        </div>
        <button 
          className="btn-secondary" 
          onClick={() => navigate('/dashboard')}
          style={{ width: 'auto', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', gap: '8px', fontWeight: '700' }}
        >
          <ArrowLeft size={18} />
          일반 회원 화면으로 복귀
        </button>
      </div>

      {/* 3컬럼 레이아웃 */}
      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', width: '100%' }}>
        
        {/* [1컬럼] 좌측: 매니저 프로필, API 설정, 요약 */}
        <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0 }}>
          
          {/* 매니저 연결 계정 정보 */}
          <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', fontWeight: 'bold', color: '#FFF' }}>
                M
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '16px', color: '#FFF', margin: 0 }}>이명학 마스터 메니져</h4>
                <span style={{ fontSize: '11px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: '700' }}>
                  <ShieldCheck size={12} /> 최고 권한 인증됨
                </span>
              </div>
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><b>연동 구글 계정:</b> {managerEmail}</div>
              <div style={{ wordBreak: 'break-all' }}><b>지갑 주소:</b> <span style={{ fontFamily: 'monospace' }}>{walletAddress}</span></div>
            </div>
          </div>

          {/* 🌟 로컬 Gate.io API 키 설정 카드 */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

          {/* 핵심 지표 요약 카드 */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', padding: '8px', borderRadius: '50%', background: 'rgba(139,92,246,0.1)', marginBottom: '8px' }}>
                  <Users size={20} color="#8B5CF6" />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1차 가입 정원 현황</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFF', marginTop: '6px', fontFamily: 'var(--font-title)' }}>
                  {stats.totalApproved} <span style={{ fontSize: '12px', color: 'var(--text-dark)' }}>/ {stats.limit} 명</span>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '20px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <div style={{ display: 'inline-flex', padding: '8px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', marginBottom: '8px' }}>
                  <ShieldAlert size={20} color="#F59E0B" />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>신원 가입 대기자</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#F59E0B', marginTop: '6px', fontFamily: 'var(--font-title)' }}>
                  {stats.totalPending} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>명</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* [2컬럼] 중앙: 실시간 차트 & 트레이딩 관리 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 📈 Gate.io 실시간 투자 수익률 차트 카드 */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden', position: 'relative', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <div style={{ padding: '24px 24px 10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>📈 Gate.io 실시간 투자 수익률 (원금 대비)</span>
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ 
                    fontSize: '26px', 
                    fontWeight: '800', 
                    color: performance ? (performance.yieldPercent >= 0 ? 'var(--success-color)' : 'var(--danger-color)') : '#FFF', 
                    fontFamily: 'var(--font-title)' 
                  }}>
                    {performance ? `${performance.yieldPercent >= 0 ? '+' : ''}${performance.yieldPercent.toFixed(2)}%` : '0.00%'}
                  </span>
                  {performance && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      (원금: {performance.totalBuyUsdt.toFixed(2)} USDT / SUT 평가 가치: {performance.currentValue.toFixed(2)} USDT)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="glow-active" style={{ fontSize: '11px', color: performance ? 'var(--success-color)' : 'var(--text-dark)', background: performance ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', padding: '5px 12px', borderRadius: '12px', fontWeight: '700', border: performance ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255,255,255,0.1)' }}>
                  ● {performance ? 'LIVE YIELD' : 'DEMO'}
                </span>
              </div>
            </div>

            {/* SVG 차트 영역 */}
            <div style={{ width: '100%', height: '170px', position: 'relative', display: 'block', padding: '10px 24px 20px 24px' }}>
              <svg width="100%" height="150" viewBox="0 0 500 150" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="managerYieldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="managerYieldLineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>

                <line x1="0" y1="25" x2="500" y2="25" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
                <line x1="0" y1="75" x2="500" y2="75" stroke="rgba(255,255,255,0.08)" />
                <line x1="0" y1="125" x2="500" y2="125" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />

                {(() => {
                  const data = (performance && yieldHistory.length > 0) ? yieldHistory : [0];
                  const height = 150;
                  const minVal = Math.min(...data) - 0.5;
                  const maxVal = Math.max(...data) + 0.5;
                  const valRange = maxVal - minVal || 1;
                  const points = data.map((val, idx) => {
                    const x = data.length > 1 ? (idx / (data.length - 1)) * 500 : 250; 
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
                    dArea = `${dPath} L ${points[points.length - 1].x} 150 L ${points[0].x} 150 Z`;
                  }
                  return (
                    <>
                      {dArea && performance && <path d={dArea} fill="url(#managerYieldGrad)" style={{ transition: 'all 0.5s ease' }} />}
                      {dPath && <path d={dPath} fill="none" stroke={performance ? "url(#managerYieldLineGrad)" : "rgba(255,255,255,0.15)"} strokeDasharray={performance ? "none" : "4,4"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />}
                      {points.length > 0 && performance && (
                        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="5" fill="var(--success-color)" stroke="#FFF" strokeWidth="2" style={{ transition: 'all 0.5s ease' }} />
                      )}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* API 키 미설정 또는 거래 내역이 없을 시 폴백 안내 오버레이 */}
            {!performance && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(10, 8, 20, 0.7)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  <span style={{ color: '#F59E0B', fontWeight: '700', display: 'block', marginBottom: '6px', fontSize: '14px' }}>⚠️ 수익률 차트 비활성화</span>
                  로컬 Gate.io API 키를 등록하고 거래소에서 SUT를 실제 매수하면 수익률 차트가 여기에 활성화됩니다.
                </div>
              </div>
            )}
          </div>

          {/* Gate.io API 상태 및 수동 주문 패널 가로 배치 */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
            
            {/* Gate.io API 실거래 연동 현황 카드 */}
            <div className="glass-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: gateioBalance ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)', background: gateioBalance ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255, 255, 255, 0.02)', margin: 0 }}>
              <div>
                <h4 style={{ fontSize: '13px', color: '#FFF', margin: '0 0 12px 0', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px' }}>📊</span> Gate.io API 실거래 연동 현황
                </h4>
                {gateioBalance ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
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
                    <span style={{ color: '#F59E0B', fontWeight: '700', display: 'block', marginBottom: '6px' }}>⚠️ API 키 미등록 (가상 데모 모드)</span>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                      API 키를 등록하면, 실제 거래소 SUT/USDT 자금 조회 및 자동매매 실거래 연동이 활성화됩니다.
                    </p>
                  </div>
                )}
              </div>
              
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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

            {/* 👑 마스터 매니저 본인 Gate.io 실거래 주문 관리 패널 */}
            <div className="glass-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(20, 16, 45, 0.4) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', margin: 0 }}>
              <h4 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowUpDown size={16} color="#8B5CF6" />
                SUT 실거래 수동 주문
              </h4>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '6px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input 
                      type="number" 
                      value={orderAmount}
                      onChange={(e) => setOrderAmount(e.target.value)}
                      placeholder="수량 (SUT)"
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '11px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '6px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input 
                      type="number" 
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(e.target.value)}
                      placeholder="가격 (USDT)"
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '11px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button"
                  className="btn-primary" 
                  disabled={submittingOrder}
                  style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold', background: 'linear-gradient(90deg, #10B981, #059669)', border: 'none', boxShadow: 'none' }}
                  onClick={() => handleGateIoOrder('buy')}
                >
                  {submittingOrder ? '...' : '🟢 매수'}
                </button>
                <button 
                  type="button"
                  className="btn-primary" 
                  disabled={submittingOrder}
                  style={{ flex: 1, padding: '8px', fontSize: '11px', fontWeight: 'bold', background: 'linear-gradient(90deg, #EF4444, #DC2626)', border: 'none', boxShadow: 'none' }}
                  onClick={() => handleGateIoOrder('sell')}
                >
                  {submittingOrder ? '...' : '🔴 매도'}
                </button>
              </div>
            </div>

          </div>

          {/* AI 그리드 트레이딩 오토 봇 패널 */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BarChart3 size={24} color="var(--success-color)" />
                <h4 style={{ fontSize: '16px', color: '#F3F4F6', margin: 0, fontWeight: '700' }}>AI 그리드 트레이딩 봇 설정</h4>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: gridSettings.ai_grid_status === 'ON' ? 'var(--success-color)' : 'var(--text-muted)' }}>
                  {gridSettings.ai_grid_status === 'ON' ? 'LIVE 가동' : '중지'}
                </span>
                <button 
                  onClick={handleToggleAiStatus}
                  style={{
                    width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                    background: gridSettings.ai_grid_status === 'ON' ? 'var(--success-color)' : 'rgba(255,255,255,0.15)',
                    position: 'relative', transition: 'background 0.3s'
                  }}
                >
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', background: '#FFF', position: 'absolute', top: '2px',
                    left: gridSettings.ai_grid_status === 'ON' ? '24px' : '2px', transition: 'left 0.3s'
                  }}></div>
                </button>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
              설정한 상/하한가 범위 내에서 자동 매매 시뮬레이션을 수행하고 매일 정해진 주기마다 회원 이자를 분배합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>하한가 (Min)</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>SUT</span>
                    <input 
                      type="number" 
                      value={gridSettings.ai_grid_lower}
                      onChange={(e) => setGridSettings({...gridSettings, ai_grid_lower: e.target.value})}
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>상한가 (Max)</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>SUT</span>
                    <input 
                      type="number" 
                      value={gridSettings.ai_grid_upper}
                      onChange={(e) => setGridSettings({...gridSettings, ai_grid_upper: e.target.value})}
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>그리드 수 (Count)</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input 
                      type="number" 
                      value={gridSettings.ai_grid_count}
                      onChange={(e) => setGridSettings({...gridSettings, ai_grid_count: e.target.value})}
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
                    />
                    <span style={{ color: 'var(--text-dark)', fontSize: '12px', marginLeft: '4px' }}>개</span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>일일 빈도 (Frequency)</label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <input 
                      type="number" 
                      value={gridSettings.ai_grid_frequency}
                      onChange={(e) => setGridSettings({...gridSettings, ai_grid_frequency: e.target.value})}
                      style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
                    />
                    <span style={{ color: 'var(--text-dark)', fontSize: '12px', marginLeft: '4px' }}>회</span>
                  </div>
                </div>
              </div>

            </div>

            {/* API 제한 경고 */}
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '10px', display: 'flex', gap: '8px' }}>
              <ShieldAlert size={16} color="var(--danger-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'left' }}>
                <strong style={{ color: 'var(--danger-color)' }}>거래소 API 밴 주의</strong><br />
                과도한 요청(하루 20회 초과)은 거래소 보안 정책 위반으로 차단될 수 있습니다. 기본 빈도를 유지해 주십시오.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleSaveGridSettings}
                style={{ flex: 1, padding: '12px', fontSize: '13px' }}
              >
                💾 봇 파라미터 저장
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleTriggerAIProfit}
                style={{ flex: 1, padding: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.04)' }}
              >
                ⚡ 수동 수익금 배분
              </button>
            </div>

          </div>

        </div>

        {/* [3컬럼] 우측: 가입 심사, 출금 심사 및 회원 명부 (오퍼레이션 센터) */}
        <div style={{ width: '480px', display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0 }}>
          
          {/* KYC 심사 보드 */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
              <ShieldAlert size={18} color="#F59E0B" />
              신규 가입 신원 심사 보드 ({pendingUsers.length}건)
            </h3>

            {pendingUsers.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                📥 현재 심사 대기 중인 신규 가입자가 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {pendingUsers.map((user) => (
                  <div 
                    key={user.id} 
                    style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      border: '1px solid rgba(255,255,255,0.04)', 
                      borderRadius: '12px', 
                      padding: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#FFF' }}>{user.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({user.country})</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <div>구글: {user.email}</div>
                        <div style={{ fontFamily: 'monospace', color: '#A7F3D0', fontSize: '10px' }}>지갑: {user.wallet_address.substring(0, 10)}...</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100px', flexShrink: 0 }}>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        style={{ padding: '6px', fontSize: '10px', gap: '4px', borderRadius: '6px' }}
                        onClick={() => {
                          const backendOrigin = API_BASE.replace('/api', '');
                          setSelectedIdCard(`${backendOrigin}${user.id_card_path}`);
                        }}
                      >
                        신분증 확인
                      </button>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          type="button" 
                          className="btn-primary" 
                          style={{ flex: 1, padding: '6px', fontSize: '10px', background: 'var(--success-color)', borderRadius: '6px', boxShadow: 'none' }}
                          onClick={() => handleApprove(user.wallet_address)}
                          disabled={submittingId === user.wallet_address}
                        >
                          승인
                        </button>
                        <button 
                          type="button" 
                          className="btn-primary" 
                          style={{ flex: 1, padding: '6px', fontSize: '10px', background: 'var(--danger-color)', borderRadius: '6px', boxShadow: 'none' }}
                          onClick={() => handleReject(user.wallet_address)}
                          disabled={submittingId === user.wallet_address}
                        >
                          반려
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 출금 심사 보드 */}
          <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
            <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
              <Receipt size={18} color="#F59E0B" />
              출금(지급) 심사 보드 ({withdrawals.length}건)
            </h3>

            {withdrawals.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                💸 대기 중인 회원 출금 신청 건이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {withdrawals.map((req) => (
                  <div 
                    key={req.id} 
                    style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      border: '1px solid rgba(255,255,255,0.04)', 
                      borderRadius: '12px', 
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#FFF' }}>{req.name} 회원</span>
                      </div>
                      
                      <div style={{ background: 'rgba(16,185,129,0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--success-color)', fontSize: '13px', fontWeight: 'bold' }}>
                        {req.requested_amount} SUT
                      </div>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px', wordBreak: 'break-all' }}>
                      <b>송금 주소:</b> <span style={{ color: '#A78BFA', fontFamily: 'monospace' }}>{req.wallet_address}</span>
                    </div>

                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ background: 'var(--success-color)', padding: '8px', fontSize: '11px', fontWeight: '700', borderRadius: '8px', boxShadow: 'none' }}
                      onClick={() => handleApproveWithdrawal(req.id, req.requested_amount, req.name)}
                    >
                      ✓ 트러스트월렛 송금 승인 완료
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 전체 회원 명부 */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
              <Users size={18} color="#10B981" />
              전체 회원 관리 명부 ({allUsers.length}명)
            </h3>

            <div style={{ overflowY: 'auto', maxHeight: '300px', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allUsers.map((user) => {
                const isMaster = user.wallet_address.toLowerCase() === MASTER_MANAGER_EMAIL.toLowerCase() || user.wallet_address.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase();
                return (
                  <div 
                    key={user.id}
                    onClick={() => navigate(`/manager/edit-user/${user.wallet_address}`)}
                    style={{ 
                      background: isMaster ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isMaster ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.01)'}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {user.name}
                        <span style={{ fontSize: '9px', color: 'var(--text-dark)', fontWeight: 'normal' }}>({user.country})</span>
                        {isMaster && <span style={{ background: 'rgba(139,92,246,0.2)', color: '#C084FC', padding: '1px 4px', borderRadius: '4px', fontSize: '8px', fontWeight: '800' }}>마스터</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                        {user.wallet_address.substring(0, 12)}...{user.wallet_address.substring(user.wallet_address.length - 8)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                      <span style={{ 
                        padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700',
                        background: user.status === 'APPROVED' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                        color: user.status === 'APPROVED' ? 'var(--success-color)' : '#F59E0B'
                      }}>
                        {user.status === 'APPROVED' ? '승인' : '대기'}
                      </span>
                      <span style={{ 
                        padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700',
                        background: user.tier === 'ACTIVE' ? 'rgba(139,92,246,0.12)' : 'rgba(59,130,246,0.12)',
                        color: user.tier === 'ACTIVE' ? '#C084FC' : '#60A5FA'
                      }}>
                        {user.tier === 'ACTIVE' ? '정회원' : '체험'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 최근 온체인 결제 이력 */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
              <Receipt size={18} color="#8B5CF6" />
              최근 온체인 청구/수납 이력
            </h3>

            {recentPayments.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                아직 플랫폼 수납 이력이 존재하지 않습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'none' }}>
                {recentPayments.map((pay) => (
                  <div 
                    key={pay.id} 
                    style={{ 
                      background: 'rgba(0,0,0,0.15)', 
                      border: '1px solid rgba(255,255,255,0.02)', 
                      borderRadius: '10px', 
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#FFF' }}>
                        {pay.name} ({pay.type === 'MEMBERSHIP_FEE' ? '가입비 수납' : '월정액 수납'})
                      </div>
                      <a 
                        href={`https://amoy.polygonscan.com/tx/${pay.tx_hash}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ fontSize: '9px', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}
                      >
                        TX: {pay.tx_hash.substring(0, 12)}... <ExternalLink size={10} />
                      </a>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--success-color)' }}>
                        +{pay.amount} SUT
                      </div>
                      <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>
                        50% 초대인 자동 정산 완료
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>


      {/* 신분증 라이트박스 모달 */}
      {selectedIdCard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(15px)',
          zIndex: 99999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <img 
            src={selectedIdCard} 
            alt="Submitted KYC ID Card" 
            style={{ 
              maxWidth: '90%', 
              maxHeight: '80%', 
              borderRadius: '16px', 
              boxShadow: '0 0 50px rgba(0,0,0,0.9)',
              border: '2px solid rgba(255,255,255,0.15)'
            }} 
          />
          <button 
            className="btn-primary" 
            onClick={() => setSelectedIdCard(null)}
            style={{ width: 'auto', padding: '12px 36px', fontSize: '14px', borderRadius: '12px' }}
          >
            이미지 확인 완료 (닫기)
          </button>
        </div>
      )}

      {/* 👑 매니저용 실제 입출금 모달 팝업 */}
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
              {txType === 'DEPOSIT' ? '💸 SUT 투자 봇 자본금 실제 예치' : '📤 SUT 투자 봇 자본금 출금 신청'}
            </h3>
            
            <form onSubmit={handleTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#A78BFA' }}>
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

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px' }}>
                {txType === 'DEPOSIT' 
                  ? '💡 폴리곤 메인넷 상의 SUT 실제 온체인 전송입니다. 트러스트월렛/메타마스크 승인 창이 열리며 가스비(POL)와 토큰이 소모됩니다.' 
                  : '💡 출금 요청 시 봇 거래 정산이 수동으로 진행되며, 매니저 최종 승인 후 입력하신 가상 지갑 주소로 SUT가 전달됩니다.'}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setShowTxModal(false)}
                  style={{ flex: 1, padding: '14px' }}
                  disabled={processingTx}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 1, padding: '14px' }}
                  disabled={processingTx}
                >
                  {processingTx ? '처리중...' : (txType === 'DEPOSIT' ? '승인 및 예치' : '출금 신청')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 👑 Gate.io 온체인 SUT 송금 모달 팝업 */}
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
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', background: '#111827', padding: '30px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px', color: '#FFF', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowUpDown size={20} color="#3B82F6" />
              Gate.io로 SUT 온체인 송금
            </h3>
            
            <form onSubmit={handleSendSutToGateIo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '10px', padding: '12px', fontSize: '11px', color: '#FFF' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>수신 Gate.io 입금 주소 (Polygon):</div>
                <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontWeight: '700' }}>{localStorage.getItem('gateio_deposit_address')}</div>
                <div style={{ color: '#93C5FD', marginTop: '6px' }}>⚠️ 반드시 Gate.io의 SUT (Polygon) 입금 주소인지 더블체크하세요!</div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#A78BFA' }}>
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

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px' }}>
                💡 <b>가스비 안내</b>: 이 송금 트랜잭션은 <b>현재 서명하는 본인 지갑</b>에서 가스비(폴리곤 POL 코인)와 SUT 코인이 차감됩니다. 마스터 지갑의 가스비는 사용되지 않습니다.
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => {
                    setShowSendSutModal(false);
                    setSendSutAmount('');
                  }}
                  style={{ flex: 1, padding: '14px' }}
                  disabled={sendingSut}
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
                  disabled={sendingSut}
                >
                  {sendingSut ? '전송 처리중...' : 'SUT 송금하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default PcManagerDashboard;
