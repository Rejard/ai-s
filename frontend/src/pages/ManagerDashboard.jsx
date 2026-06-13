import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Users, ArrowLeft, Eye, Check, X,
  ShieldCheck, Wallet, Settings, ArrowUpDown, Receipt, ExternalLink
} from 'lucide-react';
import SutPriceCard from '../components/SutPriceCard';
import { API_BASE } from '../App';
import { ethers } from 'ethers';
import {
  approveManagerUser,
  approveManagerWithdrawal,
  rejectManagerWithdrawal,
  buildManagerHeaders,
  clearManagerGateIoCredentials,
  loadManagerDashboardData,
  normalizeManagerGridSettings,
  toggleManagerAutoRangePreview,
  rejectManagerUser,
  saveManagerAiSettings,
  saveManagerGateIoCredentials,
  sendSutToGateIoDepositAddress,
  submitManagerGateIoOrder,
  cancelManagerGateIoOrder,
} from '../lib/managerDashboard';
import {
  loadUserDashboardData,
} from '../lib/userDashboard';
import ManagerAiDecisionHistory from '../components/ManagerAiDecisionHistory';
import ManagerTradeExecutions from '../components/ManagerTradeExecutions';
import EditUserModal from '../components/EditUserModal';
import ManagerManagementSection from '../components/ManagerManagementSection';
import ManagerAiConfigSection from '../components/ManagerAiConfigSection';
import { saveIdCardLocally, getIdCardLocally, deleteIdCardLocally } from '../lib/idCardStorage';

function ManagerDashboard({ walletAddress, managerEmail }) {
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [withdrawals, setWithdrawals] = useState([]);
  const [hasDownloadedId, setHasDownloadedId] = useState({});
  const [idCardViewerUrl, setIdCardViewerUrl] = useState(null);
  const [idCardViewerName, setIdCardViewerName] = useState(null);

  const [gridSettings, setGridSettings] = useState({
    ai_grid_status: 'OFF',
    ai_grid_lower: '0.15',
    ai_grid_upper: '0.30',
    ai_grid_auto_range: 'OFF',
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
  const [tradeExecutions, setTradeExecutions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);

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
  const [editingUserWallet, setEditingUserWallet] = useState(null);
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
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);

  const [showSendSutModal, setShowSendSutModal] = useState(false);
  const [sendSutAmount, setSendSutAmount] = useState('');
  const [sendingSut, setSendingSut] = useState(false);

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

  const handleCancelOrder = async (orderId) => {
    if (!confirm('정말로 이 대기 주문을 취소하시겠습니까?')) return;
    try {
      const res = await cancelManagerGateIoOrder({
        apiBase: API_BASE,
        managerEmail,
        orderId,
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });
      if (res.data.success) {
        alert('가입이 승인되었습니다.');
        // Remove ID card from IndexedDB upon approval
        await deleteIdCardLocally(userWallet);
        fetchDashboardData();
      } else {
        alert('주문 취소 실패: ' + (res.data.error || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('주문 취소 중 오류 발생: ' + (err.response?.data?.message || err.message));
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

    setIsSavingCredentials(true);
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
    } finally {
      setIsSavingCredentials(false);
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
          if (userData.priceHistory !== undefined) {
            setPriceHistory(userData.priceHistory);
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
        previousGridSettings: gridSettingsRef.current,
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
          currentSettings.ai_grid_auto_range !== (lastServerGridSettingsRef.current.ai_grid_auto_range || 'OFF') ||
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
      if (managerData.tradeExecutions !== undefined) setTradeExecutions(managerData.tradeExecutions);
      if (managerData.gateioOpenOrders !== undefined) setOpenOrders(managerData.gateioOpenOrders);

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
      const res = await axios.get(`${API_BASE}/investment/council-stats`);
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
    }, 60000); // 60초 주기 (기존 5초)
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gridSettings.ai_grid_status !== 'ON' || !aiLogs || aiLogs.length === 0) return;

    const latestStrategy = aiLogs[0];
    if (lastExecutedStrategyIdRef.current === latestStrategy.id) return;
    lastExecutedStrategyIdRef.current = latestStrategy.id;
  }, [aiLogs, gridSettings.ai_grid_status]);

  const handleToggleAutoRangePreview = (enabled) => {
    setGridSettings((currentSettings) => toggleManagerAutoRangePreview({
      enabled,
      currentSettings,
      serverSettings: lastServerGridSettingsRef.current || currentSettings,
      latestAiLog: aiLogs?.[0] || null,
    }));
  };
  const handleDownloadIdCard = async (userId, name) => {
    try {
      // 1. Try to load from IndexedDB first
      let blob = await getIdCardLocally(userId);

      // 2. If not in IndexedDB, fetch from server and save to IndexedDB
      if (!blob) {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('sut_token') || localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/manager/download-id-card/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        blob = new Blob([res.data]);
        await saveIdCardLocally(userId, blob);
      }
      
      const url = window.URL.createObjectURL(blob);
      setIdCardViewerUrl(url);
      setIdCardViewerName(name);
      setHasDownloadedId(prev => ({ ...prev, [userId]: true }));
    } catch (err) {
      console.error(err);
      alert('신분증 이미지를 불러오지 못했습니다. 이미 확인 완료되어 삭제되었을 수 있습니다.');
    }
  };


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
        const savedSettings = normalizeManagerGridSettings(
          res.data.settings || { ai_grid_status: newStatus },
          { ...gridSettingsRef.current, ai_grid_status: newStatus }
        );
        setGridSettings(savedSettings);
        lastServerGridSettingsRef.current = savedSettings;
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
          autoRange: gridSettings.ai_grid_auto_range,
          count: gridSettings.ai_grid_count,
          frequency: gridSettings.ai_grid_frequency,
        },
        axiosClient: axios,
        getStorageItem: (key) => localStorage.getItem(key),
      });

      if (res.data.success) {
        const savedSettings = normalizeManagerGridSettings(res.data.settings || {}, gridSettingsRef.current);
        setGridSettings(savedSettings);
        lastServerGridSettingsRef.current = savedSettings;
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
    gridSettings.ai_grid_auto_range !== (lastServerGridSettingsRef.current.ai_grid_auto_range || 'OFF') ||
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
        <SutPriceCard 
          sutPrice={sutPrice}
          sutChange24h={sutChange24h}
          krwRate={portfolio.krwRate}
          priceHistory={priceHistory}
          sutHigh24h={performance?.sutHigh24h || portfolio.sutHigh24h}
          sutLow24h={performance?.sutLow24h || portfolio.sutLow24h}
          isMobile={true}
        />
      ) : (
        <div className="shimmer-loading" style={{ height: '160px', borderRadius: '12px' }}></div>
      )}

      <div className="glass-card" style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '20px' }}>🛡️</div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#10B981', fontWeight: '800' }}>고급 보안 및 양자 알고리즘 탑재</h4>
          <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.4', wordBreak: 'keep-all' }}>
            본 시스템은 <strong>제로 트러스트(Zero Trust)</strong> 이상 탐지 필터로 스팸 및 외부 위협을 실시간 차단하며, 최신 <strong>시장 변동성 기반 동적 세대교체(QAOA-inspired)</strong> 로직으로 급변장에서도 강력한 수익 방어 구조를 유지합니다.
          </p>
        </div>
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
              const dummyYield = [0.0, 0.12, 0.08, 0.25, 0.38, 0.31, 0.45, 0.58, 0.52, 0.68, 0.82, 0.75, 0.95, 1.12, 1.05, 1.28, 1.42, 1.35, 1.55, 1.72];
              const data = (performance && yieldHistory.length > 0) ? yieldHistory : dummyYield;
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
                  {dArea && <path d={dArea} fill="url(#mobileManagerYieldGrad)" style={{ transition: 'all 0.5s ease' }} />}
                  {dPath && <path d={dPath} fill="none" stroke="url(#mobileManagerYieldLineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.5s ease' }} />}
                  {points.length > 0 && (
                    <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="var(--success-color)" stroke="#FFF" strokeWidth="1.5" style={{ transition: 'all 0.5s ease' }} />
                  )}
                </>
              );
            })()}
          </svg>
        </div>
      </div>

      <ManagerAiDecisionHistory logs={aiLogs} isMobile />
      <ManagerTradeExecutions executions={tradeExecutions} isMobile />

      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>⏳</span>
          실거래 미체결 대기 주문 (Open Orders)
        </h3>

        {!openOrders || openOrders.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            현재 거래소 호가창에 대기 중인 주문이 없습니다. (체결 완료 혹은 미접수)
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {openOrders.map((order, idx) => {
              const isBuy = order.side === 'buy';
              const formattedTime = (() => {
                try {
                  const ts = parseFloat(order.create_time_ms || (order.create_time * 1000));
                  const date = new Date(ts);
                  return date.toLocaleString();
                } catch (e) {
                  return '-';
                }
              })();
              const amount = parseFloat(order.amount).toFixed(2);
              const price = parseFloat(order.price).toFixed(4);
              const left = parseFloat(order.left || 0).toFixed(2);
              const total = (parseFloat(order.amount) * parseFloat(order.price)).toFixed(4);

              return (
                <div key={order.id || idx} style={{ background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      color: isBuy ? 'var(--success-color)' : 'var(--danger-color)',
                      background: isBuy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '11px'
                    }}>
                      {isBuy ? '🟢 매수 대기' : '🔴 매도 대기'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-dark)' }}>{formattedTime}</span>
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#EF4444',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                    <div>수량: <span style={{ color: '#FFF', fontWeight: 'bold' }}>{amount} SUT</span></div>
                    <div>가격: <span style={{ color: '#FFF', fontWeight: 'bold' }}>{price} USDT</span></div>
                    <div>남은수량: <span style={{ color: 'var(--warning-color)', fontWeight: 'bold' }}>{left} SUT</span></div>
                    <div>총액: <span style={{ color: '#10B981', fontWeight: 'bold' }}>{total} USDT</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🤖 분리된 AI 트레이딩 설정 및 API 연동 섹션 컴포넌트 마운트 */}
      <ManagerAiConfigSection
        gridSettings={gridSettings}
        setGridSettings={setGridSettings}
        handleToggleAutoRangePreview={handleToggleAutoRangePreview}
        handleToggleAiStatus={handleToggleAiStatus}
        handleTriggerAIProfit={handleTriggerAIProfit}
        handleSaveGridSettings={handleSaveGridSettings}
        hasUnsavedChanges={hasUnsavedChanges}
        gateioBalance={gateioBalance}
        vaultSutBalance={vaultSutBalance}
        walletSutBalance={walletSutBalance}
        stats={stats}
        localApiKey={localApiKey}
        setLocalApiKey={setLocalApiKey}
        localApiSecret={localApiSecret}
        setLocalApiSecret={setLocalApiSecret}
        localDepositAddress={localDepositAddress}
        setLocalDepositAddress={setLocalDepositAddress}
        handleSaveApiKeys={handleSaveApiKeys}
        isSavingCredentials={isSavingCredentials}
        handleClearApiKeys={handleClearApiKeys}
        setShowSendSutModal={setShowSendSutModal}
      />

      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(20, 16, 45, 0.4) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <h4 style={{ fontSize: '15px', color: '#FFF', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpDown size={18} color="#8B5CF6" />
          Gate.io SUT 직접 수동 주문
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

      {/* 🛡️ 분리된 가입 신청/지급 요청 심사 및 통계 섹션 컴포넌트 마운트 */}
      <ManagerManagementSection
        pendingUsers={pendingUsers}
        withdrawals={withdrawals}
        stats={stats}
        submittingId={submittingId}
        handleApprove={handleApprove}
        handleReject={handleReject}
        handleApproveWithdrawal={handleApproveWithdrawal}
        handleRejectWithdrawal={handleRejectWithdrawal}
        setSelectedIdCard={setSelectedIdCard}
        API_BASE={API_BASE}
        handleDownloadIdCard={handleDownloadIdCard}
        hasDownloadedId={hasDownloadedId}
      />

      {/* 최근 자산 예치/정산 내역 */}
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
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
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

      {/* 전체 회원 명부 */}
      <div className="glass-card">
        <h3 style={{ fontSize: '15px', color: '#F3F4F6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
          <Users size={18} color="#10B981" />
          전체 회원 명부 ({allUsers.length}명)
        </h3>

        {allUsers.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>
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
                      onClick={() => setEditingUserWallet(user.wallet_address)}
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

      {/* 신분증 이미지 팝업 모달 */}
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


      {editingUserWallet && (
        <EditUserModal
          walletAddress={editingUserWallet}
          managerEmail={managerEmail}
          onClose={() => setEditingUserWallet(null)}
          onSuccess={fetchManagerData}
        />
      )}

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

      {idCardViewerUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#1E293B', padding: '20px', borderRadius: '12px', maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #3B82F6', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '18px' }}>[{idCardViewerName}] 회원 신분증 확인</h3>
            
            <div style={{ overflow: 'auto', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: '15px', minHeight: '200px', background: '#0F172A', borderRadius: '8px', padding: '10px' }}>
              <img src={idCardViewerUrl} alt="신분증" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
              <span style={{ fontSize: '16px', marginTop: '2px' }}>⚠️</span>
              <p style={{ color: '#F87171', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>
                보안을 위해 서버에서 원본 신분증 파일이 영구 삭제되었습니다.<br/>
                <strong>창을 닫으면 다시 볼 수 없습니다.</strong> 가입 심사를 완료해주세요.
              </p>
            </div>
            
            <button 
              type="button"
              className="btn-primary"
              style={{ padding: '12px 30px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              onClick={() => {
                window.URL.revokeObjectURL(idCardViewerUrl);
                setIdCardViewerUrl(null);
              }}
            >
              확인 완료 (창 닫기)
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default ManagerDashboard;
