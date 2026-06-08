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
  rejectManagerWithdrawal,
  buildManagerHeaders,
  clearManagerGateIoCredentials,
  loadManagerDashboardData,
  rejectManagerUser,
  saveManagerAiSettings,
  saveManagerGateIoCredentials,
  sendSutToGateIoDepositAddress,
  submitManagerGateIoOrder,
} from '../lib/managerDashboard';
import {
  loadUserDashboardData,
  buildNextPriceHistory,
} from '../lib/userDashboard';

function ManagerDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [withdrawals, setWithdrawals] = useState([]);

  const [gridSettings, setGridSettings] = useState({
    ai_grid_status: 'OFF',
    ai_grid_lower: '0.15',
    ai_grid_upper: '0.30',
    ai_grid_count: '5',
    ai_grid_frequency: '5'
  });

  const gridSettingsRef = useRef(gridSettings);
  useEffect(() => {
    gridSettingsRef.current = gridSettings;
  }, [gridSettings]);

  const [portfolio, setPortfolio] = useState(null);
  const [walletSutBalance, setWalletSutBalance] = useState(0);
  const [vaultSutBalance, setVaultSutBalance] = useState(0);
  const [sutPrice, setSutPrice] = useState(0.19);
  const [sutChange24h, setSutChange24h] = useState(0);
  const [priceHistory, setPriceHistory] = useState([]);
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
  const lastServerGridSettingsRef = useRef(null);
  const lastRequestIdRef = useRef(0);

  const [confirmMode, setConfirmMode] = useState('NONE');
  const confirmTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
      }
    };
  }, []);

  const [selectedIdCard, setSelectedIdCard] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);

  const [orderAmount, setOrderAmount] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderTotal, setOrderTotal] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const handleOrderAmountChange = (val) => {
    setOrderAmount(val);
    const amt = parseFloat(val);
    const prc = parseFloat(orderPrice);
    if (!isNaN(amt) && !isNaN(prc)) {
      setOrderTotal((amt * prc).toFixed(4));
    } else {
      setOrderTotal('');
    }
  };

  const handleOrderPriceChange = (val) => {
    setOrderPrice(val);
    const amt = parseFloat(orderAmount);
    const prc = parseFloat(val);
    if (!isNaN(amt) && !isNaN(prc)) {
      setOrderTotal((amt * prc).toFixed(4));
    } else {
      setOrderTotal('');
    }
  };

  const handleOrderTotalChange = (val) => {
    setOrderTotal(val);
    const tot = parseFloat(val);
    const prc = parseFloat(orderPrice);
    if (!isNaN(tot) && !isNaN(prc) && prc > 0) {
      setOrderAmount((tot / prc).toFixed(4));
    } else {
      setOrderAmount('');
    }
  };

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
        setOrderTotal('');
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

  const handleGateIoOrderClick = (side) => {
    if (!orderAmount || parseFloat(orderAmount) <= 0) {
      alert("주문 수량을 입력하세요.");
      return;
    }
    if (!orderPrice || parseFloat(orderPrice) <= 0) {
      alert("주문 가격을 입력하세요.");
      return;
    }

    const upperSide = side.toUpperCase();
    if (confirmMode === upperSide) {
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      setConfirmMode('NONE');
      handleGateIoOrder(side);
    } else {
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
      }
      setConfirmMode(upperSide);
      confirmTimerRef.current = setTimeout(() => {
        setConfirmMode('NONE');
      }, 3000);
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

  const handleSyncTransactions = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API_BASE}/manager/sync-transactions`, { managerAddress: walletAddress }, getManagerHeaders());
      if (res.data.success) {
        alert(`🎉 ${res.data.message}`);
        fetchManagerData();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 온체인 동기화 실패: ${errMsg}`);
    } finally {
      setSyncing(false);
    }
  };

  const fetchManagerData = async () => {
    const currentRequestId = ++lastRequestIdRef.current;
    try {
      if (walletAddress) {
        try {
          const userData = await loadUserDashboardData({
            apiBase: API_BASE,
            walletAddress,
            axiosClient: axios,
            ethersLib: ethers,
          });
          if (userData.sutPrice !== undefined) setSutPrice(userData.sutPrice);
          if (userData.sutChange24h !== undefined) setSutChange24h(userData.sutChange24h);
          if (userData.sutPrice !== undefined) {
            setPriceHistory((prev) => buildNextPriceHistory(prev, userData.sutPrice, userData.portfolio?.sutHistory || []));
          }
        } catch (err) {
          console.error('Failed to load SUT price for manager:', err);
        }
      }

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

      if (currentRequestId !== lastRequestIdRef.current) {
        return;
      }

      if (managerData.pendingUsers !== undefined) setPendingUsers(managerData.pendingUsers);
      if (managerData.stats !== undefined) setStats(managerData.stats);
      if (managerData.recentPayments !== undefined) setRecentPayments(managerData.recentPayments);
      if (managerData.allUsers !== undefined) setAllUsers(managerData.allUsers);
      if (managerData.withdrawals !== undefined) setWithdrawals(managerData.withdrawals);
      if (managerData.gridSettings !== undefined) {
        const currentSettings = gridSettingsRef.current;
        const isDirty = lastServerGridSettingsRef.current && (
          currentSettings.ai_grid_lower !== lastServerGridSettingsRef.current.ai_grid_lower ||
          currentSettings.ai_grid_upper !== lastServerGridSettingsRef.current.ai_grid_upper ||
          currentSettings.ai_grid_count !== lastServerGridSettingsRef.current.ai_grid_count ||
          currentSettings.ai_grid_frequency !== lastServerGridSettingsRef.current.ai_grid_frequency ||
          currentSettings.ai_grid_status !== lastServerGridSettingsRef.current.ai_grid_status
        );
        if (!isDirty) {
          setGridSettings(managerData.gridSettings);
          lastServerGridSettingsRef.current = managerData.gridSettings;
        }
      }
      if (managerData.portfolio !== undefined) setPortfolio(managerData.portfolio);
      if (managerData.walletSutBalance !== undefined) setWalletSutBalance(managerData.walletSutBalance);
      if (managerData.vaultSutBalance !== undefined) setVaultSutBalance(managerData.vaultSutBalance);
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

  const [councilStats, setCouncilStats] = useState(null);
  const [loadingCouncilStats, setLoadingCouncilStats] = useState(true);

  const fetchCouncilStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/council-stats`);
      if (res.data.success) {
        setCouncilStats({
          totalCount: res.data.totalCount || 0,
          factionStats: res.data.factionStats || [],
          activeMembers: res.data.activeMembers || [],
          recentVotes: res.data.recentVotes || []
        });
      }
    } catch (err) {
      console.error('Failed to load council stats in Manager:', err.message);
    } finally {
      setLoadingCouncilStats(false);
    }
  };

  useEffect(() => {
    fetchManagerData();
    fetchCouncilStats();
    const interval = setInterval(() => {
      fetchManagerData();
      fetchCouncilStats();
    }, 5000);
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

    const actualPayoutStr = prompt(`[수동 지급 확정]\n\n${name} 회원님이 신청한 출금 신청 금액은 [${requestedAmount} SUT] 입니다.\n\n매니저님께서 출금 승인 처리하여 지급하신 금액을 메모용으로 입력해 주세요.\n(참고: 회원의 자산 장부에서는 출금 신청 원금인 ${requestedAmount} SUT가 차감 정산됩니다.)`, requestedAmount);

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

  const handleRejectWithdrawal = async (id, requestedAmount, name) => {
    if (!confirm(`[출금 신청 반려]\n\n정말로 ${name} 회원님의 출금 신청 [${requestedAmount} SUT]을 반려 처리하시겠습니까?\n이 작업은 즉시 반영되며 장부 원장 차감은 발생하지 않습니다.`)) {
      return;
    }

    try {
      const res = await rejectManagerWithdrawal({
        apiBase: API_BASE,
        managerEmail,
        withdrawalId: id,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchManagerData();
      }
    } catch (err) {
      alert('출금 반려 처리 중 오류 발생: ' + err.message);
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
        lastServerGridSettingsRef.current = null;
        alert(newStatus === 'ON' ? '🤖 완전 자동화 AI 트레이딩 봇이 가동되었습니다!' : 'AI 트레이딩 봇이 정지되었습니다.');
        fetchManagerData();
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
        lastServerGridSettingsRef.current = null;
        alert('그리드 봇 설정 변경사항이 정상적으로 적용되었습니다.');
        fetchManagerData();
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
    const profitPercentage = prompt(`[AI 트레이딩 시뮬레이션 수익 정산 배분]\n\n현재 가입된 정식(ACTIVE) 회원들에게 배분할 'SUT 수익률(%)'을 숫자로 입력해 주세요.\n(예: 0.5 입력 시, 회원의 SUT 총액 기준 0.5%의 SUT가 추가로 배분 정산됩니다.)`, "0.5");

    if (profitPercentage === null || isNaN(parseFloat(profitPercentage))) return;

    if (!confirm(`전체 정회원을 대상으로 ${profitPercentage}%의 AI 수익 배분을 가동하시겠습니까? (이 작업은 정정할 수 없으며 즉시 각 회원의 SUT 잔고가 증가합니다.)`)) {
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

  const hasUnsavedChanges = !!(lastServerGridSettingsRef.current && (
    gridSettings.ai_grid_lower !== lastServerGridSettingsRef.current.ai_grid_lower ||
    gridSettings.ai_grid_upper !== lastServerGridSettingsRef.current.ai_grid_upper ||
    gridSettings.ai_grid_count !== lastServerGridSettingsRef.current.ai_grid_count ||
    gridSettings.ai_grid_frequency !== lastServerGridSettingsRef.current.ai_grid_frequency
  ));

  if (loading) {
    return (
      <div style={{ margin: 'auto', textAlign: 'center', padding: '20px' }}>
        <div className="shimmer-loading" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 15px' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>매니저 대시보드를 불러오는 중입니다...</p>
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
          🏢 <strong>매니저 대시보드</strong>
        </span>
      </div>

      {portfolio ? (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>📊 SUT 실시간 시세 (Gate.io)</span>
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
                <linearGradient id="managerDbSutPriceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="managerDbSutPriceLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
                <filter id="managerDbSutPriceGlow" x="-20%" y="-20%" width="140%" height="140%">
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
                    {dArea && <path d={dArea} fill="url(#managerDbSutPriceGrad)" style={{ transition: 'all 0.5s ease' }} />}
                    {dPath && <path d={dPath} fill="none" stroke="url(#managerDbSutPriceLineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />}
                    {points.length > 0 && (
                      <circle cx={`${points[points.length - 1].x}%`} cy={points[points.length - 1].y} r="4" fill="var(--success-color)" stroke="#FFF" strokeWidth="1.5" style={{ transition: 'all 0.5s ease' }} filter="url(#managerDbSutPriceGlow)" />
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
              로컬 Gate.io API 키를 등록하고 거래소에서 SUT를 매수하면 수익률 차트가 여기에 표기됩니다.
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
                        {(() => {
                          const dateStr = String(log.created_at || '').replace(' ', 'T') + 'Z';
                          const dateObj = new Date(dateStr);
                          if (isNaN(dateObj.getTime())) return log.created_at;
                          const utcFormatted = `${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}/${String(dateObj.getUTCDate()).padStart(2, '0')} ${String(dateObj.getUTCHours()).padStart(2, '0')}:${String(dateObj.getUTCMinutes()).padStart(2, '0')}`;
                          const kstFormatted = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                          return `현지시간 : ${utcFormatted} (한국시간: ${kstFormatted})`;
                        })()}
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
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>USDT</span>
              <input
                type="number"
                className="grid-setting-input"
                value={gridSettings.ai_grid_lower}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_lower: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>상한가 (최고)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px', fontWeight: 'bold' }}>USDT</span>
              <input
                type="number"
                className="grid-setting-input"
                value={gridSettings.ai_grid_upper}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_upper: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>그리드 분할 수</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <input
                type="number"
                className="grid-setting-input"
                value={gridSettings.ai_grid_count}
                onChange={(e) => setGridSettings({ ...gridSettings, ai_grid_count: e.target.value })}
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ color: 'var(--text-dark)', fontSize: '11px', marginLeft: '4px' }}>개</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textAlign: 'left' }}>일일 매매 빈도</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px' }}>
              <input
                type="number"
                className="grid-setting-input"
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-secondary"
            onClick={handleTriggerAIProfit}
            style={{ fontSize: '11px', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', flexShrink: 0, width: 'auto' }}
          >
            수동 수익 정산 배분
          </button>

          {hasUnsavedChanges && (
            <span className="pulse-indicator" style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 'bold', marginRight: 'auto', whiteSpace: 'nowrap' }}>
              ⚠️ 적용 대기중
            </span>
          )}

          <button
            className={hasUnsavedChanges ? "btn-primary glow-active" : "btn-primary"}
            onClick={handleSaveGridSettings}
            style={{
              background: hasUnsavedChanges
                ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              boxShadow: hasUnsavedChanges
                ? '0 0 12px rgba(245, 158, 11, 0.5)'
                : '0 4px 12px rgba(139, 92, 246, 0.25)',
              border: hasUnsavedChanges
                ? '1px solid #F59E0B'
                : '1px solid rgba(255, 255, 255, 0.15)',
              padding: '8px 16px',
              fontSize: '12px',
              width: 'auto',
              borderRadius: '10px',
              color: '#FFF',
              cursor: 'pointer',
              fontWeight: '850',
              flexShrink: 0
            }}
          >
            변경사항 적용
          </button>
        </div>
      </div>

      {/* 🏛️ AI Council (의회) 현황 및 분파 의석 지분율 섹션 */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(20, 16, 45, 0.3) 100%)', border: '1px solid rgba(59, 130, 246, 0.25)', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '18px' }}>🏛️</span>
          </div>
          <div>
            <h3 style={{ fontSize: '15px', color: '#F3F4F6', margin: 0, fontWeight: '800' }}>🏛️ AI Council (의회) 지분율 및 의정 현황</h3>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>유전적 진화 풀 500인과 현역 의원 탑 11인의 분파 지분 현황입니다.</p>
          </div>
        </div>

        {loadingCouncilStats ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>의원 명부를 분석 중입니다...</span>
          </div>
        ) : !councilStats ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>의회 정보를 불러오지 못했습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 1. 500인 전체 의회 분파 점유율 게이지 */}
            <div>
              <h4 style={{ fontSize: '12px', color: '#FFF', margin: '0 0 10px 0', fontWeight: '700' }}>
                📊 500인 후보군 분파별 점유율 (의석)
              </h4>
              <div style={{ display: 'flex', height: '20px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {councilStats.factionStats.map((f, idx) => {
                  let color = '#6B7280'; // Default
                  if (f.faction === 'TREND_FOLLOWER') color = '#EF4444'; // Red
                  if (f.faction === 'VALUE_SEEKER') color = '#3B82F6'; // Blue
                  if (f.faction === 'CONSERVATIVE_WATCHER') color = '#10B981'; // Green
                  if (f.faction === 'MUTANT_ROOKIE') color = '#8B5CF6'; // Purple

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
                        fontSize: '9px',
                        fontWeight: 'bold',
                        transition: 'width 0.5s ease'
                      }}
                      title={`${f.faction}: ${f.count}석 (${f.percentage}%)`}
                    >
                      {f.percentage >= 12 ? `${f.percentage}%` : ''}
                    </div>
                  );
                })}
              </div>
              
              {/* 범례 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {[
                  { key: 'TREND_FOLLOWER', label: '추세추종파 (SMA)', color: '#EF4444' },
                  { key: 'VALUE_SEEKER', label: '기술반등파 (RSI)', color: '#3B82F6' },
                  { key: 'CONSERVATIVE_WATCHER', label: '변동방어파 (안정)', color: '#10B981' },
                  { key: 'MUTANT_ROOKIE', label: '돌연변이 혁신파 (진화)', color: '#8B5CF6' }
                ].map(item => {
                  const stat = councilStats.factionStats.find(s => s.faction === item.key) || { count: 0, percentage: 0 };
                  return (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                      <span><b>{item.label}:</b> {stat.count}석 ({stat.percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. 현재 당선된 11인의 ACTIVE 의원 명부 */}
            <div>
              <h4 style={{ fontSize: '12px', color: '#FFF', margin: '0 0 10px 0', fontWeight: '700' }}>
                🏛️ 현직 라이브 의원 탑 11 (ACTIVE)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                        <div style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                          <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 'bold' }}>{member.name}</span>
                        </div>
                        <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', color: factionColor, padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
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

            {/* 3. 최근 의결 투표 흐름 */}
            <div>
              <h4 style={{ fontSize: '12px', color: '#FFF', margin: '0 0 8px 0', fontWeight: '700' }}>
                🔔 최근 AI 의원 투표 현황
              </h4>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
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
                    <div key={v.id} style={{ flexShrink: 0, width: '120px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'left' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{v.timestamp.substring(11)}</span>
                      <span style={{ fontSize: '10px', color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1px' }}>
                        <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>{v.faction === 'TREND_FOLLOWER' ? '추세' : v.faction === 'VALUE_SEEKER' ? '기술' : v.faction === 'CONSERVATIVE_WATCHER' ? '방어' : '변동'}</span>
                        <span style={{ fontSize: '9px', color: voteColor, background: voteBg, padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>{v.decision_vote}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
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
                아래 로컬 설정을 통해 API 키를 등록하면, 거래소 SUT/USDT 자금 조회 및 소액 자동매매 실거래 연동이 활성화됩니다.
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
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>매니저 SUT 총 보유 (지갑 + 거래소):</span>
              <span style={{ color: '#60A5FA', fontWeight: '700' }}>{(walletSutBalance + (gateioBalance ? parseFloat(gateioBalance.SUT || 0) : 0)).toFixed(2)} SUT</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px', borderLeft: '2px solid rgba(96, 165, 250, 0.3)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <div>• 개인 지갑: <span style={{ color: '#FFF', fontWeight: '600' }}>{walletSutBalance.toFixed(2)} SUT</span></div>
              <div>• 거래소 (Gate.io): <span style={{ color: '#FFF', fontWeight: '600' }}>{(gateioBalance ? parseFloat(gateioBalance.SUT || 0) : 0).toFixed(2)} SUT</span></div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>회원 누적 예치금 (누적 입금액):</span>
            <span style={{ color: '#3B82F6', fontWeight: '700' }}>{stats ? stats.totalDeposited.toFixed(2) : '0.00'} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>회원 누적 배분액 (출금 완료):</span>
            <span style={{ color: '#F59E0B', fontWeight: '700' }}>{stats ? stats.totalDistributed.toFixed(2) : '0.00'} SUT</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>회원 총 운용 자산 (볼트 잔고):</span>
            <span style={{ color: '#A78BFA', fontWeight: '700' }}>{vaultSutBalance.toFixed(2)} SUT</span>
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
          SUT 실거래 수동 주문
        </h4>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
          현재 기기에 임시 보관된 API 키를 통하여 Gate.io 현물 거래소에 SUT/USDT 매매 주문을 실행합니다.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textAlign: 'left' }}>
              단가 (USDT) <span style={{ color: 'var(--success-color)', fontWeight: '700', marginLeft: '4px' }}>(현재 시세: {performance ? performance.sutPrice.toFixed(4) : '0.1900'})</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <input
                type="number"
                step="any"
                value={orderPrice}
                onChange={(e) => handleOrderPriceChange(e.target.value)}
                placeholder="USDT 가격 입력 (예: 0.19)"
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px', fontWeight: 'bold' }}>USDT</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>주문 수량 (SUT)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <input
                type="number"
                step="any"
                value={orderAmount}
                onChange={(e) => handleOrderAmountChange(e.target.value)}
                placeholder="SUT 수량 입력 (예: 10)"
                style={{ background: 'transparent', border: 'none', color: '#FFF', width: '100%', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px', fontWeight: 'bold' }}>SUT</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>총 주문 금액 (USDT)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <input
                type="number"
                step="any"
                value={orderTotal}
                onChange={(e) => handleOrderTotalChange(e.target.value)}
                placeholder="총 주문액 입력 (예: 3)"
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
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              background: confirmMode === 'BUY'
                ? 'linear-gradient(90deg, #059669, #047857)'
                : 'linear-gradient(90deg, #10B981, #059669)',
              border: confirmMode === 'BUY' ? '1px dashed #FFF' : 'none',
              boxShadow: confirmMode === 'BUY' ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
              transition: 'all 0.2s'
            }}
            onClick={() => handleGateIoOrderClick('buy')}
          >
            {submittingOrder ? '전송 중...' : confirmMode === 'BUY' ? '⚡ 매수 최종 확정' : '🟢 SUT 매수'}
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={submittingOrder}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '13px',
              fontWeight: 'bold',
              background: confirmMode === 'SELL'
                ? 'linear-gradient(90deg, #DC2626, #B91C1C)'
                : 'linear-gradient(90deg, #EF4444, #DC2626)',
              border: confirmMode === 'SELL' ? '1px dashed #FFF' : 'none',
              boxShadow: confirmMode === 'SELL' ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none',
              transition: 'all 0.2s'
            }}
            onClick={() => handleGateIoOrderClick('sell')}
          >
            {submittingOrder ? '전송 중...' : confirmMode === 'SELL' ? '⚡ 매도 최종 확정' : '🔴 SUT 매도'}
          </button>
        </div>
      </div>

      {/* 최근 Gate.io 실거래 체결 내역 카드 추가 (모바일용) */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <h3 style={{ fontSize: '15px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={18} color="#10B981" />
          최근 Gate.io 실거래 체결 내역 (수동/자동 통합)
        </h3>

        {(!performance || !performance.trades || performance.trades.length === 0) ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            API가 연동되지 않았거나 최근 체결된 거래 내역이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {performance.trades.map((trade, idx) => {
              const isBuy = trade.side === 'buy';
              const formattedTime = (() => {
                try {
                  const ts = parseFloat(trade.create_time_ms || (trade.create_time * 1000));
                  const date = new Date(ts);
                  return date.toLocaleString();
                } catch (e) {
                  return '-';
                }
              })();
              const amount = parseFloat(trade.amount).toFixed(2);
              const price = parseFloat(trade.price).toFixed(4);
              const total = (parseFloat(trade.amount) * parseFloat(trade.price)).toFixed(4);
              const fee = trade.fee ? `${parseFloat(trade.fee).toFixed(4)} ${trade.fee_currency}` : '0';

              return (
                <div key={trade.id || idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      color: isBuy ? 'var(--success-color)' : 'var(--danger-color)',
                      background: isBuy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '10px'
                    }}>
                      {isBuy ? '🟢 매수' : '🔴 매도'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-dark)', fontFamily: 'monospace' }}>{formattedTime}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>단가:</span> <strong style={{ color: '#FFF' }}>{price} USDT</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>수량:</span> <strong style={{ color: '#FFF' }}>{amount} SUT</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px', marginTop: '2px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>총액:</span> <strong style={{ color: isBuy ? 'var(--success-color)' : 'var(--danger-color)' }}>{total} USDT</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dark)' }}>수수료:</span> <span style={{ color: 'var(--text-muted)' }}>{fee}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>

          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(139,92,246,0.08)', marginBottom: '6px' }}>
              <Users size={16} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>승인 회원 현황</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F3F4F6', marginTop: '4px' }}>
              {stats.totalApproved} <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>/ {stats.limit}</span>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'rgba(245,158,11,0.08)', marginBottom: '6px' }}>
              <ShieldAlert size={16} color="#F59E0B" />
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>가입 심사 대기</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#F59E0B', marginTop: '4px' }}>
              {stats.totalPending} 명
            </div>
          </div>

        </div>
      )}

      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="#F59E0B" />
          신규 가입 심사 ({pendingUsers.length}건)
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
          지급 요청 심사 (대기: {withdrawals.length}건)
        </h3>

        {withdrawals.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            현재 접수된 회원 지급 요청이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {withdrawals.map((req) => (
              <div key={req.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#F3F4F6' }}>{req.name} 회원의 지급 요청</div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>{new Date(req.created_at).toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ flex: 1, background: 'rgba(16,185,129,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.1)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--success-color)' }}>지급 요청 금액</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFF' }}>{req.requested_amount} SUT</div>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', marginBottom: '15px', wordBreak: 'break-all' }}>
                  <strong>지급 지갑 주소:</strong><br />
                  <span style={{ color: '#A78BFA' }}>{req.wallet_address}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'var(--success-color)', fontSize: '12px', padding: '10px 8px', boxShadow: 'none' }}
                    onClick={() => handleApproveWithdrawal(req.id, req.requested_amount, req.name)}
                  >
                    <Check size={14} style={{ marginRight: '4px' }} /> 지급 승인 완료
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#FCA5A5', fontSize: '12px', padding: '10px 8px' }}
                    onClick={() => handleRejectWithdrawal(req.id, req.requested_amount, req.name)}
                  >
                    <X size={14} style={{ marginRight: '4px' }} /> 지급 요청 반려
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Recent Payment and On-chain Distribution History List */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', color: '#F3F4F6', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={18} color="#8B5CF6" />
            최근 자산 예치/정산 내역
          </h3>
          <button
            type="button"
            className="btn-primary"
            disabled={syncing}
            onClick={handleSyncTransactions}
            style={{
              width: 'auto',
              padding: '6px 12px',
              fontSize: '11px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '700',
              color: '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: 'none'
            }}
          >
            {syncing ? '🔄 동기화 중...' : '🔄 거래 동기화'}
          </button>
        </div>

        {recentPayments.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            현재까지 플랫폼을 통해 발생한 예치 및 정산 내역이 없습니다.
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
                    {pay.name} ({pay.type === 'WITHDRAW_REQUEST' ? '지급 요청 정상 처리' : (pay.type === 'DEPOSIT' ? '자산 예치' : '수익 정산 배분')})
                  </div>
                  {pay.tx_hash && pay.tx_hash.length === 66 && pay.tx_hash.startsWith('0x') ? (
                    <a
                      href={`https://polygonscan.com/tx/${pay.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '9px', color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                    >
                      TX: {pay.tx_hash.substring(0, 10)}... <ExternalLink size={8} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                      내부 수동 처리 (TX: {pay.tx_hash ? pay.tx_hash.substring(0, 16) : 'N/A'}...)
                    </span>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: pay.type === 'WITHDRAW_REQUEST' ? 'var(--danger-color)' : 'var(--success-color)' }}>
                    {pay.type === 'WITHDRAW_REQUEST' ? `-${pay.amount}` : `+${pay.amount}`} SUT
                  </div>
                  <span style={{ fontSize: '8px', color: 'var(--text-dark)' }}>
                    {pay.type === 'WITHDRAW_REQUEST' ? '지급 완료' : (pay.type === 'DEPOSIT' ? '예치 완료' : '수익 배분 완료')}
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
          전체 회원 명부 ({allUsers.length}명)
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
                  <th style={{ padding: '10px 8px' }}>회원 상태</th>
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
                          background: user.status === 'APPROVED' ? 'rgba(139,92,246,0.12)' : user.status === 'PENDING_KYC' ? 'rgba(59,130,246,0.12)' : 'rgba(156,163,175,0.12)',
                          color: user.status === 'APPROVED' ? '#C084FC' : user.status === 'PENDING_KYC' ? '#60A5FA' : '#9CA3AF'
                        }}>
                          {user.status === 'APPROVED' ? '정회원' : user.status === 'PENDING_KYC' ? '승인대기' : '반려됨'}
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
              {txType === 'DEPOSIT' ? '💸 SUT 투자 자본금 예치' : '📤 SUT 투자 출금 신청'}
            </h3>

            <form onSubmit={handleTxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#A78BFA', fontSize: '12px' }}>
                  {txType === 'DEPOSIT' ? '예치할 SUT 수량 입력 (온체인 전송)' : '인출할 SUT 수량 입력'}
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
                  ? '💡 폴리곤 메인넷 상의 SUT 온체인 전송입니다. 트러스트월렛/메타마스크 승인 창이 열리며 가스비(POL)와 토큰이 소모됩니다.'
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
