import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../App';
import { ethers } from 'ethers';
import { buildAuthHeaders } from '../lib/authSession';
import { normalizeAisTrainingStats } from '../lib/aisTrainingView';

export function useAdminLogic(managerEmail) {

  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoteWallet, setPromoteWallet] = useState('');
  const [submittingPromote, setSubmittingPromote] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(null);

  const [globalAiModel, setGlobalAiModel] = useState('Gemini 3.5 Flash');
  const [globalGeminiApiKey, setGlobalGeminiApiKey] = useState('');
  const [globalAiInterval, setGlobalAiInterval] = useState('5');
  const [globalAiIntervalAuto, setGlobalAiIntervalAuto] = useState('OFF');
  const [globalGeminiTimeoutMs, setGlobalGeminiTimeoutMs] = useState('30000');
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const [automaticPromotionEnabled, setAutomaticPromotionEnabled] = useState(false);
  const [aidlContextMutationRate, setAidlContextMutationRate] = useState('0.10');
  const [aidlStateMutationRate, setAidlStateMutationRate] = useState('0.10');
  const [aidlProfileMutationRate, setAidlProfileMutationRate] = useState('0.08');
  const [aidlCopyNumberMutationRate, setAidlCopyNumberMutationRate] = useState('0.06');
  const [aidlWeightNudgeSize, setAidlWeightNudgeSize] = useState('0.02');


  const [vaultSutBalance, setVaultSutBalance] = useState(0);
  const [stats, setStats] = useState(null);
  const [aiLogs, setAiLogs] = useState([]);
  

  const [globalAiEngine, setGlobalAiEngine] = useState('GEMINI_ONLY');
  const [trainingDataCount, setTrainingDataCount] = useState(0);
  const [aisLastTrainedAt, setAisLastTrainedAt] = useState('');
  const [aisModelAccuracy, setAisModelAccuracy] = useState('0.00');
  const [aisTrainingStats, setAisTrainingStats] = useState(
    normalizeAisTrainingStats()
  );
  const [savingAiEngine, setSavingAiEngine] = useState(false);
  const [submittingAidlGeneState, setSubmittingAidlGeneState] = useState('');
  const [submittingAidlGeneContext, setSubmittingAidlGeneContext] = useState('');


  const [councilStats, setCouncilStats] = useState(null);
  const [loadingCouncilStats, setLoadingCouncilStats] = useState(true);


  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  const ADMIN_EMAIL = 'lemaiiisk@gmail.com'.toLowerCase();
  const isAdmin = managerEmail && managerEmail.toLowerCase().trim() === ADMIN_EMAIL;


  const getAdminHeaders = () => {
    return {
      headers: {
        ...buildAuthHeaders(),
        'x-admin-email': ADMIN_EMAIL
      }
    };
  };

  const fetchManagers = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/admin/managers`, getAdminHeaders());
      if (res.data.success) {
        setManagers(res.data.managers);
      }
    } catch (err) {
      console.error('매니저 목록 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiConfig = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/admin/ai-config`, getAdminHeaders());
      if (res.data.success && res.data.config) {
        setGlobalAiModel(res.data.config.model || 'Gemini 3.5 Flash');
        setGlobalGeminiApiKey(res.data.config.apiKey || '');
        setGlobalAiInterval(res.data.config.interval || '5');
        setGlobalAiIntervalAuto(res.data.config.intervalAuto || 'OFF');
        setGlobalGeminiTimeoutMs(res.data.config.geminiTimeoutMs || '30000');
        setAutomaticPromotionEnabled(res.data.config.automaticPromotionEnabled === 'ON');
        setAidlContextMutationRate(res.data.config.aidlPolicy?.contextMutationRate || '0.10');
        setAidlStateMutationRate(res.data.config.aidlPolicy?.stateMutationRate || '0.10');
        setAidlProfileMutationRate(res.data.config.aidlPolicy?.profileMutationRate || '0.08');
        setAidlCopyNumberMutationRate(res.data.config.aidlPolicy?.copyNumberMutationRate || '0.06');
        setAidlWeightNudgeSize(res.data.config.aidlPolicy?.weightNudgeSize || '0.02');
      }
    } catch (err) {
      console.error('글로벌 AI 설정 로드 실패:', err);
    }
  };

  const fetchVaultSutBalance = async () => {
    if (!isAdmin) return;
    try {
      const rpcProvider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
      const sutContractAddress = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55'.toLowerCase();
      const sutAbi = ['function balanceOf(address account) external view returns (uint256)'];
      const sutContract = new ethers.Contract(sutContractAddress, sutAbi, rpcProvider);

      const vaultAddress = '0x855c880D538892fD899eECb72D4b1Ac5B46089eA'.toLowerCase();
      const vaultBalanceWei = await sutContract.balanceOf(vaultAddress);
      setVaultSutBalance(parseFloat(ethers.formatUnits(vaultBalanceWei, 18)));
    } catch (err) {
      console.error('Failed to load on-chain vault SUT balance in Admin:', err.message);
      setVaultSutBalance(0);
    }
  };

  const fetchStats = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/manager/stats`, {
        headers: {
          ...buildAuthHeaders(),
          'x-manager-email': ADMIN_EMAIL
        }
      });
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to load stats in Admin:', err.message);
    }
  };

  const fetchAiLogs = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/manager/ai-logs?limit=50`, {
        headers: {
          ...buildAuthHeaders(),
          'x-manager-email': ADMIN_EMAIL
        }
      });
      if (res.data.success) {
        setAiLogs(res.data.logs || []);
      }
    } catch (err) {
      console.error('AI 로그 로드 실패 in Admin:', err.message);
    }
  };

  const fetchAiEngineConfig = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/admin/ai-engine`, getAdminHeaders());
      if (res.data.success) {
        setGlobalAiEngine(res.data.engineMode || 'GEMINI_ONLY');
      }
    } catch (err) {
      console.error('Failed to load global AI engine mode:', err.message);
    }
  };

  const fetchTrainingStats = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/admin/training-stats`, getAdminHeaders());
      if (res.data.success) {
        setTrainingDataCount(res.data.count || 0);
        setAisLastTrainedAt(res.data.lastTrainedAt || '');
        setAisModelAccuracy(res.data.modelAccuracy || '0.00');
        setAisTrainingStats(normalizeAisTrainingStats(res.data));
      }
    } catch (err) {
      console.error('Failed to load training dataset count:', err.message);
    }
  };

  const fetchCouncilStats = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API_BASE}/admin/council-stats`, getAdminHeaders());
      if (res.data.success) {
        setCouncilStats({
          totalCount: res.data.totalCount || 0,
          factionStats: res.data.factionStats || [],
          activeMembers: res.data.activeMembers || [],
          recentVotes: res.data.recentVotes || [],
          briefing: res.data.briefing || '',
          briefingGeneratedAt: res.data.briefingGeneratedAt || '',
          briefingStatus: res.data.briefingStatus || '',
          briefingRefreshing: Boolean(res.data.briefingRefreshing),
          healthReport: res.data.healthReport || null
        });
      }
    } catch (err) {
      console.error('Failed to load council stats in Admin:', err.message);
    } finally {
      setLoadingCouncilStats(false);
    }
  };

  const fetchDiagnostics = async () => {
    if (!isAdmin) return;
    setLoadingDiagnostics(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/diagnostics`, getAdminHeaders());
      if (res.data.success) {
        setDiagnosticsData(res.data);
      }
    } catch (err) {
      console.error('시스템 진단 로드 실패:', err);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const runDiagnostics = async () => {
    if (!isAdmin) return;
    setRunningDiagnostics(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/run-diagnostics`, {}, getAdminHeaders());
      if (res.data.success) {
        setDiagnosticsData(res.data);
        alert("🎉 모든 시스템 자가 진단이 100% 정상 통과되었습니다!");
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 자가 진단 실패: ${errMsg}`);
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const handleSaveAiEngine = async (engineMode) => {
    if (!isAdmin) return;
    setSavingAiEngine(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/save-ai-engine`, {
        engineMode
      }, getAdminHeaders());
      if (res.data.success) {
        setGlobalAiEngine(engineMode);
        if (engineMode === 'GEMINI_ONLY' || engineMode === 'GEMINI_AIS_SHADOW') {
          setAutomaticPromotionEnabled(false);
        }
        alert(res.data.message);
        fetchTrainingStats();
      }
    } catch (err) {
      console.error('Failed to save global AI engine:', err.message);
      alert('AI 엔진 설정 저장 실패: ' + err.message);
    } finally {
      setSavingAiEngine(false);
    }
  };

  const handleToggleAutomaticPromotion = async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.post(`${API_BASE}/admin/toggle-automatic-promotion`, {}, getAdminHeaders());
      if (res.data.success) {
        setAutomaticPromotionEnabled(res.data.enabled);
        fetchTrainingStats();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`자동 실전 승격 전환 실패: ${errMsg}`);
    }
  };

  const handleAidlGeneStateUpdate = async (memberId, geneId, nextState) => {
    if (!isAdmin) return;
    const actionKey = `${memberId}:${geneId}:${nextState}`;
    setSubmittingAidlGeneState(actionKey);
    try {
      const res = await axios.post(`${API_BASE}/admin/aidl-gene-state`, {
        memberId,
        geneId,
        nextState,
      }, getAdminHeaders());
      if (res.data.success) {
        await Promise.all([fetchTrainingStats(), fetchCouncilStats()]);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      alert(`AIDL gene state 변경 실패: ${errMsg}`);
    } finally {
      setSubmittingAidlGeneState('');
    }
  };

  const handleAidlGeneContextUpdate = async (memberId, geneId, contextKey, enabled) => {
    if (!isAdmin) return;
    const actionKey = `${memberId}:${geneId}:${contextKey}:${enabled ? 'ON' : 'OFF'}`;
    setSubmittingAidlGeneContext(actionKey);
    try {
      const res = await axios.post(`${API_BASE}/admin/aidl-gene-context`, {
        memberId,
        geneId,
        contextKey,
        enabled,
      }, getAdminHeaders());
      if (res.data.success) {
        await Promise.all([fetchTrainingStats(), fetchCouncilStats()]);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      alert(`AIDL context override 변경 실패: ${errMsg}`);
    } finally {
      setSubmittingAidlGeneContext('');
    }
  };


  const handleSaveAiConfig = async (e) => {
    if (e) e.preventDefault();
    if (!globalGeminiApiKey.trim()) {
      alert("Gemini API Key를 입력해 주십시오.");
      return;
    }

    setSavingAiConfig(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/save-ai-config`, {
        model: globalAiModel,
        apiKey: globalGeminiApiKey.trim(),
        interval: globalAiInterval,
        intervalAuto: globalAiIntervalAuto,
        geminiTimeoutMs: globalGeminiTimeoutMs,
        automaticPromotionEnabled: automaticPromotionEnabled ? 'ON' : 'OFF',
        aidlPolicy: {
          contextMutationRate: aidlContextMutationRate,
          stateMutationRate: aidlStateMutationRate,
          profileMutationRate: aidlProfileMutationRate,
          copyNumberMutationRate: aidlCopyNumberMutationRate,
          weightNudgeSize: aidlWeightNudgeSize,
        }
      }, getAdminHeaders());

      if (res.data.success) {
        alert("🎉 글로벌 AI 설정이 서버 DB에 정상적으로 저장되었습니다. 이제 모든 매니저 봇이 이 AI 두뇌를 사용해 오토 봇 매매를 실행합니다.");
        fetchAiConfig();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 설정 저장 실패: ${errMsg}`);
    } finally {
      setSavingAiConfig(false);
    }
  };

  useEffect(() => {
    fetchManagers();
    fetchAiConfig();
    fetchVaultSutBalance();
    fetchStats();
    fetchAiLogs();
    fetchAiEngineConfig();
    fetchTrainingStats();
    fetchCouncilStats();
    fetchDiagnostics();

    const interval = setInterval(() => {
      fetchManagers();
      fetchVaultSutBalance();
      fetchStats();
      fetchAiLogs();
      fetchTrainingStats();
      fetchCouncilStats();
      fetchDiagnostics();
    }, 60000);
    return () => clearInterval(interval);
  }, [managerEmail]);


  const handlePromoteManager = async (e) => {
    if (e) e.preventDefault();
    if (!promoteWallet || promoteWallet.trim().length !== 42) {
      alert("올바른 42자리 지갑 주소를 입력해 주십시오.");
      return;
    }

    if (!confirm(`해당 회원(${promoteWallet.trim()})을 매니저로 정식 승격시키겠습니까?\n\n승격 시 기존 매니저 소속에서 이탈하여 독립 500명 가입 정원을 가집니다.`)) {
      return;
    }

    setSubmittingPromote(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/promote-manager`, {
        walletAddress: promoteWallet.trim()
      }, getAdminHeaders());

      if (res.data.success) {
        alert(`🎉 ${res.data.message}`);
        setPromoteWallet('');
        fetchManagers();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 승격 실패: ${errMsg}`);
    } finally {
      setSubmittingPromote(false);
    }
  };

  const handleDeleteManager = async (walletAddr, name) => {
    if (!confirm(`⚠️ 경고: [${name}] 매니저 계정을 데이터베이스에서 영구 삭제하시겠습니까?\n\n이 작업은 취소할 수 없으며, 해당 매니저 산하의 모든 회원은 마스터 매니저 밑으로 강제 자동 이관됩니다.`)) {
      return;
    }

    setSubmittingDelete(walletAddr);
    try {
      const res = await axios.post(`${API_BASE}/admin/delete-manager`, {
        walletAddress: walletAddr
      }, getAdminHeaders());

      if (res.data.success) {
        alert(`🗑️ ${res.data.message}`);
        fetchManagers();
      }
    } catch (err) {
      const errMsg = err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
      alert(`❌ 삭제 실패: ${errMsg}`);
    } finally {
      setSubmittingDelete(null);
    }
  };

  return {
    managers,
    loading,
    promoteWallet,
    setPromoteWallet,
    submittingPromote,
    submittingDelete,
    globalAiModel,
    setGlobalAiModel,
    globalGeminiApiKey,
    setGlobalGeminiApiKey,
    globalAiInterval,
    setGlobalAiInterval,
    globalAiIntervalAuto,
    setGlobalAiIntervalAuto,
    globalGeminiTimeoutMs,
    setGlobalGeminiTimeoutMs,
    aidlContextMutationRate,
    setAidlContextMutationRate,
    aidlStateMutationRate,
    setAidlStateMutationRate,
    aidlProfileMutationRate,
    setAidlProfileMutationRate,
    aidlCopyNumberMutationRate,
    setAidlCopyNumberMutationRate,
    aidlWeightNudgeSize,
    setAidlWeightNudgeSize,
    savingAiConfig,
    isAdmin,
    handlePromoteManager,
    handleDeleteManager,
    handleSaveAiConfig,
    vaultSutBalance,
    stats,
    aiLogs,
    globalAiEngine,
    setGlobalAiEngine,
    trainingDataCount,
    aisLastTrainedAt,
    aisModelAccuracy,
    aisTrainingStats,
    savingAiEngine,
    handleSaveAiEngine,
    councilStats,
    loadingCouncilStats,
    fetchCouncilStats,
    automaticPromotionEnabled,
    setAutomaticPromotionEnabled,
    handleToggleAutomaticPromotion,
    submittingAidlGeneState,
    handleAidlGeneStateUpdate,
    submittingAidlGeneContext,
    handleAidlGeneContextUpdate,
    diagnosticsData,
    loadingDiagnostics,
    runningDiagnostics,
    fetchDiagnostics,
    runDiagnostics
  };

}
