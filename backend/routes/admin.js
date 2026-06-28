const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const axios = require('axios');
const { ethers } = require('ethers');
const {
  extractCompleteGeminiText,
  makeCouncilBriefingGenerationConfig
} = require('../councilBriefing');
const {
  createRefreshCoordinator,
  getLatestSuccessfulBriefing,
  shouldRefreshBriefing,
  startBriefingRefresh,
  finishBriefingRefreshSuccess,
  finishBriefingRefreshFailure
} = require('../councilBriefingHistory');
const { buildCouncilHealthReport } = require('../councilHealthReport');
const { requireAuthenticatedSession } = require('../authSession');
const { getAisTrainingStats } = require('../aisAdminStats');
const { zeroTrustMiddleware } = require('../zeroTrustFilter');

const DEFAULT_GEMINI_TIMEOUT_MS = '30000';
const MIN_GEMINI_TIMEOUT_MS = 5000;
const MAX_GEMINI_TIMEOUT_MS = 120000;

const DEFAULT_AIDL_POLICY_CONFIG = {
  contextMutationRate: '0.10',
  stateMutationRate: '0.10',
  profileMutationRate: '0.08',
  copyNumberMutationRate: '0.06',
  weightNudgeSize: '0.02',
};
const AIDL_FEATURE_ORDER = [
  'price_change_pct',
  'rsi_scaled',
  'sma5_distance_pct',
  'sma20_distance_pct',
  'sma5_to_sma20_spread_pct',
];
const AIDL_ACTIONS = ['BUY', 'SELL', 'HOLD'];
const AIDL_STATES = new Set(['A', 'I', 'D', 'L']);

function normalizeAidlPolicyValue(value, fallback) {
  const parsed = Number.parseFloat(value);
  const fallbackValue = Number.parseFloat(fallback);
  const safeValue = Number.isFinite(parsed) ? parsed : fallbackValue;
  const clamped = Math.max(0, Math.min(1, safeValue));
  return clamped.toFixed(2);
}

function normalizeAidlPolicyConfig(policy = {}) {
  return {
    contextMutationRate: normalizeAidlPolicyValue(
      policy.contextMutationRate,
      DEFAULT_AIDL_POLICY_CONFIG.contextMutationRate
    ),
    stateMutationRate: normalizeAidlPolicyValue(
      policy.stateMutationRate,
      DEFAULT_AIDL_POLICY_CONFIG.stateMutationRate
    ),
    profileMutationRate: normalizeAidlPolicyValue(
      policy.profileMutationRate,
      DEFAULT_AIDL_POLICY_CONFIG.profileMutationRate
    ),
    copyNumberMutationRate: normalizeAidlPolicyValue(
      policy.copyNumberMutationRate,
      DEFAULT_AIDL_POLICY_CONFIG.copyNumberMutationRate
    ),
    weightNudgeSize: normalizeAidlPolicyValue(
      policy.weightNudgeSize,
      DEFAULT_AIDL_POLICY_CONFIG.weightNudgeSize
    ),
  };
}

function buildAidlPolicyConfig(settings = []) {
  const policy = { ...DEFAULT_AIDL_POLICY_CONFIG };
  settings.forEach((setting) => {
    if (setting.key === 'aidl_context_mutation_rate') policy.contextMutationRate = setting.value;
    if (setting.key === 'aidl_state_mutation_rate') policy.stateMutationRate = setting.value;
    if (setting.key === 'aidl_profile_mutation_rate') policy.profileMutationRate = setting.value;
    if (setting.key === 'aidl_copy_number_mutation_rate') policy.copyNumberMutationRate = setting.value;
    if (setting.key === 'aidl_weight_nudge_size') policy.weightNudgeSize = setting.value;
  });
  return normalizeAidlPolicyConfig(policy);
}
function normalizeGeminiTimeoutMs(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return parseInt(DEFAULT_GEMINI_TIMEOUT_MS, 10);
  return Math.max(MIN_GEMINI_TIMEOUT_MS, Math.min(MAX_GEMINI_TIMEOUT_MS, parsed));
}

function buildGeminiTimeoutConfig(settings = []) {
  const match = settings.find((setting) => setting.key === 'global_gemini_timeout_ms');
  return String(normalizeGeminiTimeoutMs(match ? match.value : DEFAULT_GEMINI_TIMEOUT_MS));
}

function buildAidlExpressionPlan(dna, currentContext = null) {
  const expressed = [];
  const profile = dna && typeof dna.regulatory_profile === 'object' ? dna.regulatory_profile : {};
  let budgetRemaining = Number(profile.expression_budget || 12);
  const dominanceBias = Number(profile.dominance_bias || 1);
  const strategyGenes = Array.isArray(dna?.strategy_genes) ? dna.strategy_genes : [];

  for (const strategy of strategyGenes) {
    if (!strategy || strategy.state === 'I' || strategy.state === 'L') continue;
    const mask = Array.isArray(strategy.context_mask) ? strategy.context_mask : [];
    if (currentContext && !mask.includes(currentContext)) continue;
    const strategyLength = Math.max(1, Number(strategy.length || 1));
    const copyNumber = Math.max(1, Number(strategy.copy_number || 1));
    const strategyCost = Math.max(1, Math.ceil(strategyLength / copyNumber));
    if (budgetRemaining < strategyCost) continue;
    budgetRemaining -= strategyCost;
    const strategyFactor = Number(strategy.dominance || 1) * dominanceBias;

    for (const subgene of Array.isArray(strategy.subgenes) ? strategy.subgenes : []) {
      if (!subgene || (subgene.state !== 'A' && subgene.state !== 'D')) continue;
      const expressionFactor = strategy.state === 'D' || subgene.state === 'D' ? 0.5 : 1;
      expressed.push({
        ...subgene,
        weight: Number((Number(subgene.weight || 0) * expressionFactor * strategyFactor).toFixed(4)),
      });
    }
  }

  return expressed;
}

function buildPhenotypeFromDnaForAdmin(dna, currentContext = null) {
  const phenotype = Object.fromEntries(
    AIDL_ACTIONS.map((action) => [action, AIDL_FEATURE_ORDER.map(() => 0)])
  );
  const counts = Object.fromEntries(
    AIDL_ACTIONS.map((action) => [action, AIDL_FEATURE_ORDER.map(() => 0)])
  );
  for (const subgene of buildAidlExpressionPlan(dna, currentContext)) {
    const action = subgene.action;
    const featureIndex = AIDL_FEATURE_ORDER.indexOf(subgene.feature);
    if (!AIDL_ACTIONS.includes(action) || featureIndex < 0) continue;
    phenotype[action][featureIndex] += Number(subgene.weight || 0);
    counts[action][featureIndex] += 1;
  }
  for (const action of AIDL_ACTIONS) {
    for (let index = 0; index < AIDL_FEATURE_ORDER.length; index += 1) {
      if (counts[action][index]) {
        phenotype[action][index] = Number((phenotype[action][index] / counts[action][index]).toFixed(4));
      }
    }
  }
  return phenotype;
}

function summarizeLatestFitnessSnapshot(dna) {
  const fitnessHistory = Array.isArray(dna?.fitness_history) ? dna.fitness_history : [];
  if (!fitnessHistory.length) {
    return { validationScore: 0, holdoutScore: 0, runKey: '' };
  }
  const latest = fitnessHistory[fitnessHistory.length - 1] || {};
  return {
    validationScore: Number(latest.validationScore || 0),
    holdoutScore: Number(latest.holdoutScore || 0),
    runKey: typeof latest.runKey === 'string' ? latest.runKey : '',
  };
}

function applyAidlGeneStateOverride({ dna, geneId, nextState }) {
  if (!dna || typeof dna !== 'object') {
    throw new Error('DNA payload is required');
  }
  if (!geneId || typeof geneId !== 'string') {
    throw new Error('geneId is required');
  }
  if (!AIDL_STATES.has(nextState)) {
    throw new Error('nextState must be one of A, I, D, L');
  }

  const nextDna = JSON.parse(JSON.stringify(dna));
  let targetGene = null;
  for (const strategy of Array.isArray(nextDna.strategy_genes) ? nextDna.strategy_genes : []) {
    if (strategy?.gene_id === geneId) {
      targetGene = strategy;
      break;
    }
    for (const subgene of Array.isArray(strategy?.subgenes) ? strategy.subgenes : []) {
      if (subgene?.gene_id === geneId) {
        targetGene = subgene;
        break;
      }
    }
    if (targetGene) break;
  }
  if (!targetGene) {
    throw new Error('gene not found');
  }

  const fromState = targetGene.state;
  const latestFitness = summarizeLatestFitnessSnapshot(nextDna);
  targetGene.state = nextState;
  nextDna.mutation_log = Array.isArray(nextDna.mutation_log) ? nextDna.mutation_log : [];
  nextDna.mutation_log.push({
    generation: Number(nextDna.generation || 1),
    event: 'admin_state_override',
    gene_id: geneId,
    from_state: fromState,
    to_state: nextState,
    pre_validation_score: latestFitness.validationScore,
    pre_holdout_score: latestFitness.holdoutScore,
    pre_run_key: latestFitness.runKey,
  });

  return {
    dna: nextDna,
    phenotype: buildPhenotypeFromDnaForAdmin(nextDna),
  };
}

function applyAidlGeneContextOverride({ dna, geneId, contextKey, enabled }) {
  if (!dna || typeof dna !== 'object') {
    throw new Error('DNA payload is required');
  }
  if (!geneId || typeof geneId !== 'string') {
    throw new Error('geneId is required');
  }
  if (contextKey !== 'BLACK_SWAN') {
    throw new Error('contextKey must be BLACK_SWAN');
  }
  if (typeof enabled !== 'boolean') {
    throw new Error('enabled must be boolean');
  }

  const nextDna = JSON.parse(JSON.stringify(dna));
  const targetGene = Array.isArray(nextDna.strategy_genes)
    ? nextDna.strategy_genes.find((strategy) => strategy?.gene_id === geneId)
    : null;
  if (!targetGene) {
    throw new Error('strategy gene not found');
  }

  const fromMask = Array.isArray(targetGene.context_mask) ? [...targetGene.context_mask] : [];
  const latestFitness = summarizeLatestFitnessSnapshot(nextDna);
  const hasContext = fromMask.includes(contextKey);
  let toMask = [...fromMask];
  let action = 'noop';
  if (enabled && !hasContext) {
    toMask = [...toMask, contextKey];
    action = 'added';
  } else if (!enabled && hasContext) {
    toMask = toMask.filter((value) => value !== contextKey);
    action = 'removed';
  }
  targetGene.context_mask = toMask;
  nextDna.mutation_log = Array.isArray(nextDna.mutation_log) ? nextDna.mutation_log : [];
  nextDna.mutation_log.push({
    generation: Number(nextDna.generation || 1),
    event: 'admin_context_override',
    gene_id: geneId,
    context_key: contextKey,
    action,
    from_mask: fromMask,
    to_mask: [...toMask],
    pre_validation_score: latestFitness.validationScore,
    pre_holdout_score: latestFitness.holdoutScore,
    pre_run_key: latestFitness.runKey,
  });

  return {
    dna: nextDna,
    phenotype: buildPhenotypeFromDnaForAdmin(nextDna),
  };
}


const MASTER_MANAGER_WALLET = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
const sutAddress = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
const sutAbi = ["function balanceOf(address account) external view returns (uint256)"];
const sutContract = new ethers.Contract(sutAddress, sutAbi, provider);

const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const multicallAbi = [
  "function aggregate(tuple(address target, bytes callData)[] calls) external view returns (uint256 blockNumber, bytes[] returnData)"
];
const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, provider);
const sutInterface = new ethers.Interface([
  "function balanceOf(address account) external view returns (uint256)"
]);

const adminAuthMiddleware = (req, res, next) => {
  if (req.authEmail !== 'lemaiiisk@gmail.com') {
    return res.status(403).json({
      success: false,
      message: '보안 경보: 관리자 권한이 존재하지 않습니다. 어드민 이메일(lemaiiisk@gmail.com)로 연동해 주십시오.'
    });
  }
  next();
};

router.use(zeroTrustMiddleware);
router.use(requireAuthenticatedSession);
router.use(adminAuthMiddleware);

router.get('/managers', async (req, res) => {
  try {

    const managers = await queries.all(`
      SELECT id, wallet_address, email, name, phone, country, joined_at
      FROM users
      WHERE is_manager = 1
      ORDER BY joined_at ASC
    `);

    const enrichedManagers = await Promise.all(managers.map(async (m) => {

      const subUsersRow = await queries.get(`
        SELECT COUNT(*) as count
        FROM users
        WHERE LOWER(manager_address) = LOWER(?) AND status = 'APPROVED'
      `, [m.wallet_address]);
      const userCount = subUsersRow ? subUsersRow.count : 0;

      const subUsers = await queries.all(`
        SELECT wallet_address
        FROM users
        WHERE LOWER(manager_address) = LOWER(?) AND status = 'APPROVED'
      `, [m.wallet_address]);

      let performance = 0;
      if (subUsers && subUsers.length > 0) {
        try {

          const calls = subUsers.map(u => ({
            target: sutAddress,
            callData: sutInterface.encodeFunctionData("balanceOf", [u.wallet_address])
          }));

          const [blockNumber, returnData] = await multicallContract.aggregate(calls);

          const balances = returnData.map(data => {
            try {
              const [balance] = sutInterface.decodeFunctionResult("balanceOf", data);
              return parseFloat(ethers.formatUnits(balance, 18));
            } catch (decErr) {
              return 0;
            }
          });

          performance = balances.reduce((sum, val) => sum + val, 0);
          performance = parseFloat(performance.toFixed(2));
        } catch (err) {
          console.error(`[Admin Multicall3 Query Error] Manager: ${m.wallet_address}`, err.message);
          performance = 0;
        }
      }

      let onchainBalance = "0.00";
      try {
        const balanceWei = await sutContract.balanceOf(m.wallet_address);
        onchainBalance = parseFloat(ethers.formatUnits(balanceWei, 18)).toFixed(2);
      } catch (err) {
        console.error(`[Admin CEX Onchain SUT Query Error] ${m.wallet_address}:`, err.message);
      }

      return {
        ...m,
        userCount,
        performance,
        onchainBalance
      };
    }));

    res.json({ success: true, managers: enrichedManagers });
  } catch (err) {
    console.error("❌ 어드민 매니저 목록 로드 에러:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/promote-manager', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '지갑 주소가 누락되었습니다.' });
  }

  const cleanWallet = walletAddress.trim();

  try {

    const user = await queries.get(
      "SELECT id, status, is_manager FROM users WHERE LOWER(wallet_address) = LOWER(?)",
      [cleanWallet]
    );
    if (!user) {
      return res.status(444).json({ success: false, message: '등록되지 않은 회원 지갑 주소입니다. 가입을 먼저 완료해 주십시오.' });
    }
    if (user.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: '가입 승인(APPROVED)이 완료되지 않은 회원입니다. KYC 승인을 먼저 완료해 주십시오.' });
    }
    if (user.is_manager === 1) {
      return res.status(400).json({ success: false, message: '이미 매니저 등급인 회원입니다.' });
    }

    await queries.run(`
      UPDATE users
      SET is_manager = 1,
          manager_address = 'none',
          referrer_address = 'none'
      WHERE LOWER(wallet_address) = LOWER(?)
    `, [cleanWallet]);

    res.json({
      success: true,
      message: '회원이 매니저로 성공적으로 승격되었습니다. 이제 독립적인 500명 정원 할당이 가능합니다.'
    });

  } catch (err) {
    console.error("❌ 매니저 승격 에러:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/delete-manager', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '삭제할 매니저의 지갑 주소가 누락되었습니다.' });
  }

  const cleanWallet = walletAddress.trim();

  if (cleanWallet.toLowerCase() === MASTER_MANAGER_WALLET.toLowerCase()) {
    return res.status(400).json({ success: false, message: '경고: 최초 마스터 매니저 지갑 계정은 관리 목적상 삭제가 불가능합니다.' });
  }

  try {

    const user = await queries.get("SELECT id, is_manager FROM users WHERE wallet_address = ?", [cleanWallet]);
    if (!user || user.is_manager !== 1) {
      return res.status(404).json({ success: false, message: '해당 매니저 계정을 찾을 수 없거나 이미 강등/삭제되었습니다.' });
    }

    const migrateRes = await queries.run(`
      UPDATE users
      SET manager_address = ?
      WHERE manager_address = ?
    `, [MASTER_MANAGER_WALLET, cleanWallet]);

    console.log(`[Admin Account Cleanup] Migrated ${migrateRes.changes} users under ${cleanWallet} to Master Manager ${MASTER_MANAGER_WALLET}.`);

    await queries.run("DELETE FROM payments WHERE wallet_address = ?", [cleanWallet]);

    await queries.run("DELETE FROM users WHERE wallet_address = ?", [cleanWallet]);

    res.json({
      success: true,
      message: `성공적으로 매니저 계정이 삭제되었습니다. 소속되어 있던 회원들은 마스터 매니저 밑으로 정상 이관 완료되었습니다.`
    });

  } catch (err) {
    console.error("❌ 매니저 삭제 및 이관 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/save-ai-config', async (req, res) => {
  const { model, apiKey, interval, intervalAuto, automaticPromotionEnabled, aidlPolicy, geminiTimeoutMs } = req.body;
  try {
    if (model) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_model', ?)`, [model.trim()]);
    if (apiKey) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_gemini_api_key', ?)`, [apiKey.trim()]);
    if (interval) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_interval', ?)`, [interval.toString()]);
    if (intervalAuto) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_interval_auto', ?)`, [intervalAuto.toString()]);
    if (geminiTimeoutMs !== undefined) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_gemini_timeout_ms', ?)`, [String(normalizeGeminiTimeoutMs(geminiTimeoutMs))]);
    if (automaticPromotionEnabled !== undefined) {
      await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('automatic_promotion_enabled', ?)`, [automaticPromotionEnabled.toString()]);
    }
    if (aidlPolicy) {
      const normalizedAidlPolicy = normalizeAidlPolicyConfig(aidlPolicy);
      await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_context_mutation_rate', ?)`, [normalizedAidlPolicy.contextMutationRate]);
      await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_state_mutation_rate', ?)`, [normalizedAidlPolicy.stateMutationRate]);
      await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_profile_mutation_rate', ?)`, [normalizedAidlPolicy.profileMutationRate]);
      await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_copy_number_mutation_rate', ?)`, [normalizedAidlPolicy.copyNumberMutationRate]);
      await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('aidl_weight_nudge_size', ?)`, [normalizedAidlPolicy.weightNudgeSize]);
    }

    res.json({ success: true, message: '글로벌 AI 두뇌 및 API Key 설정이 서버 DB에 안전하게 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ai-config', async (req, res) => {
  try {
    const settings = await queries.all("SELECT key, value FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key', 'global_ai_interval', 'global_ai_interval_auto', 'global_gemini_timeout_ms', 'automatic_promotion_enabled', 'aidl_context_mutation_rate', 'aidl_state_mutation_rate', 'aidl_profile_mutation_rate', 'aidl_copy_number_mutation_rate', 'aidl_weight_nudge_size')");
    const config = {
      model: 'Gemini 3.5 Flash',
      hasApiKey: false,
      apiKey: '',
      interval: '5',
      intervalAuto: 'OFF',
      geminiTimeoutMs: DEFAULT_GEMINI_TIMEOUT_MS,
      automaticPromotionEnabled: 'OFF',
      aidlPolicy: { ...DEFAULT_AIDL_POLICY_CONFIG }
    };

    settings.forEach(s => {
      if (s.key === 'global_ai_model') config.model = s.value;
      if (s.key === 'global_gemini_api_key' && s.value) {
        config.hasApiKey = true;
        config.apiKey = s.value;
      }
      if (s.key === 'global_ai_interval') config.interval = s.value;
      if (s.key === 'global_ai_interval_auto') config.intervalAuto = s.value;
      if (s.key === 'global_gemini_timeout_ms') config.geminiTimeoutMs = buildGeminiTimeoutConfig([s]);
      if (s.key === 'automatic_promotion_enabled') config.automaticPromotionEnabled = s.value;
    });
    config.aidlPolicy = buildAidlPolicyConfig(settings);

    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ai-engine', async (req, res) => {
  try {
    const row = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
    const engineMode = row ? row.value : 'GEMINI';
    res.json({ success: true, engineMode });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/save-ai-engine', async (req, res) => {
  const { engineMode } = req.body;
  const validModes = ['GEMINI', 'AIS_ONLY', 'HYBRID_COOP'];
  if (!engineMode || !validModes.includes(engineMode)) {
    return res.status(400).json({ success: false, message: '올바르지 않은 AI 구동 모드 선택입니다.' });
  }
  try {
    await queries.run(`
      INSERT INTO platform_settings (key, value)
      VALUES ('global_ai_engine', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [engineMode]);

    if (engineMode === 'GEMINI') {
      await queries.run(`
        INSERT INTO platform_settings (key, value)
        VALUES ('automatic_promotion_enabled', 'OFF')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
    }

    res.json({ success: true, message: `🎉 글로벌 AI 작동 엔진이 성공적으로 [${engineMode}] 모드로 저장되었습니다.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/toggle-automatic-promotion', async (req, res) => {
  try {
    const engineRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
    const engineMode = engineRow ? engineRow.value : 'GEMINI';
    
    if (engineMode === 'GEMINI') {
      return res.status(400).json({
        success: false,
        message: '작동 엔진이 [공동 합의] 또는 [AiS 독자 모델] 모드일 때만 자동 실전 승격을 활성화할 수 있습니다.'
      });
    }

    const promoRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'automatic_promotion_enabled'");
    const currentStatus = promoRow ? promoRow.value : 'OFF';
    const nextStatus = currentStatus === 'ON' ? 'OFF' : 'ON';

    await queries.run(`
      INSERT INTO platform_settings (key, value)
      VALUES ('automatic_promotion_enabled', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [nextStatus]);

    res.json({
      success: true,
      enabled: nextStatus === 'ON',
      message: `자동 실전 승격 설정이 [${nextStatus}] 상태로 성공적으로 변경되었습니다.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/training-stats', async (req, res) => {
  try {
    const trainingStats = await getAisTrainingStats(queries);

    const settings = await queries.all(`
      SELECT key, value FROM platform_settings 
      WHERE key IN ('ais_last_trained_at', 'ais_model_accuracy')
    `);

    let lastTrainedAt = '';
    let modelAccuracy = '0.00';

    settings.forEach(s => {
      if (s.key === 'ais_last_trained_at') lastTrainedAt = s.value;
      if (s.key === 'ais_model_accuracy') modelAccuracy = s.value;
    });

    res.json({ 
      success: true, 
      count: trainingStats.total,
      lastTrainedAt,
      modelAccuracy: trainingStats.latestRun
        ? trainingStats.latestRun.holdoutScore.toFixed(2)
        : modelAccuracy,
      ...trainingStats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/aidl-gene-state', async (req, res) => {
  const { memberId, geneId, nextState } = req.body || {};
  if (!memberId || !geneId || !nextState) {
    return res.status(400).json({ success: false, message: 'memberId, geneId, nextState are required.' });
  }

  try {
    const row = await queries.get(`
      SELECT member_id, dna_json
      FROM ais_council_members
      WHERE member_id = ?
    `, [memberId]);
    if (!row || !row.dna_json) {
      return res.status(404).json({ success: false, message: 'Target DNA member not found.' });
    }

    const parsed = JSON.parse(row.dna_json);
    const { dna, phenotype } = applyAidlGeneStateOverride({
      dna: parsed,
      geneId,
      nextState,
    });

    await queries.run(`
      UPDATE ais_council_members
      SET dna_json = ?, phenotype_json = ?, weights_json = ?
      WHERE member_id = ?
    `, [
      JSON.stringify(dna),
      JSON.stringify(phenotype),
      JSON.stringify(phenotype),
      memberId,
    ]);

    res.json({
      success: true,
      memberId,
      geneId,
      nextState,
      phenotype,
    });
  } catch (error) {
    const status = /gene not found|nextState|DNA payload|geneId/i.test(error.message) ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

router.post('/aidl-gene-context', async (req, res) => {
  const { memberId, geneId, contextKey, enabled } = req.body || {};
  if (!memberId || !geneId || !contextKey || typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'memberId, geneId, contextKey, enabled are required.' });
  }

  try {
    const row = await queries.get(`
      SELECT member_id, dna_json
      FROM ais_council_members
      WHERE member_id = ?
    `, [memberId]);
    if (!row || !row.dna_json) {
      return res.status(404).json({ success: false, message: 'Target DNA member not found.' });
    }

    const parsed = JSON.parse(row.dna_json);
    const { dna, phenotype } = applyAidlGeneContextOverride({
      dna: parsed,
      geneId,
      contextKey,
      enabled,
    });

    await queries.run(`
      UPDATE ais_council_members
      SET dna_json = ?, phenotype_json = ?, weights_json = ?
      WHERE member_id = ?
    `, [
      JSON.stringify(dna),
      JSON.stringify(phenotype),
      JSON.stringify(phenotype),
      memberId,
    ]);

    res.json({
      success: true,
      memberId,
      geneId,
      contextKey,
      enabled,
      phenotype,
    });
  } catch (error) {
    const status = /strategy gene not found|contextKey|enabled|DNA payload|geneId/i.test(error.message) ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

router.get('/export-training-csv', async (req, res) => {
  try {
    const rows = await queries.all(`
      SELECT timestamp, current_price, price_change_ratio, rsi_14, sma_5, sma_20,
             gemini_decision, gemini_proposed_price, gemini_amount_ratio, gemini_reason,
             next_price_5m, realized_price_change, is_correct_decision,
             evaluation_due_at, evaluation_status, label_version
      FROM ais_training_data
      ORDER BY id ASC
    `);

    const header = 'timestamp,current_price,price_change_ratio,rsi_14,sma_5,sma_20,gemini_decision,gemini_proposed_price,gemini_amount_ratio,gemini_reason,next_price_5m,realized_price_change,is_correct_decision,evaluation_due_at,evaluation_status,label_version\n';
    
    let csvContent = header;
    rows.forEach(r => {
      const escapedReason = String(r.gemini_reason || '')
        .replace(/"/g, '""')
        .replace(/\r?\n|\r/g, ' ');
      
      const line = `"${r.timestamp}",${r.current_price},${r.price_change_ratio},${r.rsi_14},${r.sma_5},${r.sma_20},"${r.gemini_decision}",${r.gemini_proposed_price},${r.gemini_amount_ratio},"${escapedReason}",${r.next_price_5m},${r.realized_price_change},${r.is_correct_decision},"${r.evaluation_due_at || ''}","${r.evaluation_status || ''}",${r.label_version || ''}\n`;
      csvContent += line;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ais_training_dataset.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    console.error("❌ CSV 다운로드 내보내기 에러:", err);
    res.status(500).send(`CSV 내보내기 실패: ${err.message}`);
  }
});

const adminBriefingRefreshCoordinator = createRefreshCoordinator();
const ADMIN_BRIEFING_SCOPE = 'ADMIN';
const BRIEFING_CACHE_DURATION = 12 * 60 * 60 * 1000;

async function generateCouncilOpinionBriefing(factionStats, activeMembers, generationStats) {
  try {
    const apiKeyRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_gemini_api_key'");
    const modelRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_model'");
    
    if (!apiKeyRow || !apiKeyRow.value) {
      return generateFallbackBriefing(factionStats, activeMembers, generationStats);
    }
    
    const apiKey = apiKeyRow.value;
    const modelName = modelRow ? modelRow.value : 'Gemini 3.5 Flash';
    
    let modelId = 'gemini-2.5-flash';
    const lowerName = modelName.toLowerCase();
    if (lowerName.includes('3.5')) {
      modelId = 'gemini-3.5-flash';
    } else if (lowerName.includes('2.5 pro') || lowerName.includes('pro')) {
      modelId = 'gemini-2.5-pro';
    } else if (lowerName.includes('2.5 flash')) {
      modelId = 'gemini-2.5-flash';
    } else if (lowerName.includes('3.1') || lowerName.includes('lite')) {
      modelId = 'gemini-3.1-flash-lite';
    }

    const leadersInfo = activeMembers.slice(0, 3).map((m, idx) => {
      const title = idx === 0 ? '의장' : idx === 1 ? '부의장' : '상임위원장';
      return `${title}: ${m.name} (${m.generation}세대, ${m.faction} 분파, 정확도 ${m.correct_count}%)`;
    }).join(', ');

    const factionInfo = factionStats.map(f => `${f.faction}: ${f.count}석 (${f.percentage}%)`).join(', ');

    const generationInfo = generationStats ? generationStats.map(g => `${g.generation}세대: ${g.count}명 (${g.percentage}%)`).join(', ') : '1세대: 500명 (100%)';

    const promptText = `
You are an expert system analyst observing the "AiS Virtual Council" (an AI assembly of 500 neural net trading bots evolving via genetic algorithms).
Based on the current faction distribution, generation composition, and top leaders of the 500-member AI candidate pool, analyze the overall genetic and philosophical characteristics of these 500 AI candidates. Write a concise executive briefing in Korean within 600 Korean characters. (Output example: "이번 세대 교체를 통해 2세대 AI가 N명으로 새롭게 등장했으며... 특히 기술반등파가 다수를 차지하게 된 배경에는... 반면 추세추종파가 소수로 전락한 이유는...")

Input data:
- Faction Counts (500 candidates): ${factionInfo}
- Generation Distribution: ${generationInfo}
- Top 3 Leaders in Office (Chairman, Vice Chairman, Committee Chair): ${leadersInfo}

Rules:
1. Speak of them as distinct virtual factions with conflicting trading philosophies:
   - TREND_FOLLOWER: 추세추종파 (SMA/모멘텀)
   - VALUE_SEEKER: 기술반등파 (RSI/역추세)
   - CONSERVATIVE_WATCHER: 변동성방어파 (안정지향)
   - MUTANT_ROOKIE: 돌연변이 혁신파 (진화/알고리즘)
2. MUST explicitly mention the current generation landscape based on Generation Distribution (e.g. "현재 1세대가 500명을 100% 점유하고 있으며..." or "이번 진화를 통해 새로운 2세대가 O명으로 주류를 이루었고 살아남은 1세대는 O명뿐입니다...").
3. Deeply analyze the REASONS behind the current distribution. Why are the dominant factions succeeding and multiplying in this generation? Why did the minority factions fail to secure seats or dwindle? Create a logical evolutionary narrative explaining these market-survival dynamics in detail.
4. MUST explain the "birth background (탄생 배경)" of each major faction in the context of the AI's evolutionary history (e.g., what kind of market crash or bull run birthed the Value Seekers or Mutant Rookies).
5. Do NOT talk about real-time market trends or recent trades. Focus purely on their genetic character, dominant factions, and historical evolution traits.
6. Keep the report within 600 Korean characters. Return ONLY the raw text response in Korean without any formatting or markdown.
7. You MUST explicitly analyze the non-active candidates (non-elected candidates) who haven't entered the active top 11 but represent higher generations (e.g. 5th or 6th gen). Explain what their existence represents and how their trading philosophies are waiting in the candidate pool for the next evolutionary shift.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    
    let retries = 3;
    while (retries > 0) {
      try {
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: makeCouncilBriefingGenerationConfig()
        }, { timeout: 300000 });

        return extractCompleteGeminiText(response.data);
      } catch (err) {
        retries--;
        console.error(`❌ Gemini Council Opinion Briefing Error. Retries left: ${retries}`, err.message);
        if (retries === 0) {
          return generateFallbackBriefing(factionStats, activeMembers, generationStats);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    return generateFallbackBriefing(factionStats, activeMembers, generationStats);
  } catch (err) {
    console.error("❌ Gemini Council Opinion Briefing Error:", err.message);
    return generateFallbackBriefing(factionStats, activeMembers, generationStats);
  }
}

function generateFallbackBriefing(factionStats, activeMembers, generationStats) {
  if (!factionStats || factionStats.length === 0) {
    return "현재 AI 의회 데이터 집계 중입니다. 잠시 후 여론이 형성됩니다.";
  }
  
  const sortedFactions = [...factionStats].sort((a, b) => b.count - a.count);
  const leadingFaction = sortedFactions[0];
  
  let factionName = '분파';
  let opinionText = '신중한 시장 관망세를 유지하고 있습니다.';
  
  if (leadingFaction.faction === 'TREND_FOLLOWER') {
    factionName = '추세추종파 (SMA/모멘텀)';
    opinionText = '강력한 모멘텀을 타며 상승 추세에 올라타려는 적극적인 매수/매도 여론이 지배적입니다.';
  } else if (leadingFaction.faction === 'VALUE_SEEKER') {
    factionName = '기술반등파 (RSI/역추세)';
    opinionText = '저점 과매도 구간을 호시탐탐 노리며, 반등 시점에 공격적으로 진입하자는 여론이 강세입니다.';
  } else if (leadingFaction.faction === 'CONSERVATIVE_WATCHER') {
    factionName = '변동성방어파 (안정지향)';
    opinionText = '시장의 급격한 변화를 경계하며 자산을 보수적으로 지키고 지켜보자는 신중한 심리가 팽배합니다.';
  } else if (leadingFaction.faction === 'MUTANT_ROOKIE') {
    factionName = '돌연변이 혁신파 (알고리즘)';
    opinionText = '돌연변이 진화 모델이 활성화되며 기존 패러다임을 깨는 예측 불가능한 실험적인 매매 의견들이 늘고 있습니다.';
  }
  
  const chairman = activeMembers[0];
  const chairmanText = chairman ? `현재 의장인 ${chairman.name}(${chairman.generation}세대, ${chairman.faction})을 중심으로` : "의회를 중심으로";
  
  return `현재 500인의 후보군 중 ${factionName}가 ${leadingFaction.percentage}%의 의석을 확보하여 다수당을 차지하고 있습니다. ${chairmanText} 시장의 움직임에 대응하여 ${opinionText}`;
}

router.get('/council-stats', async (req, res) => {
  try {
    const factionRows = await queries.all(`
      SELECT COALESCE(faction, 'MUTANT_ROOKIE') as faction, COUNT(*) as count 
      FROM ais_council_members 
      GROUP BY COALESCE(faction, 'MUTANT_ROOKIE')
    `);

    const totalRow = await queries.get("SELECT COUNT(*) as total FROM ais_council_members");
    const totalCount = totalRow ? totalRow.total : 0;

    const factionStats = factionRows.map(r => ({
      faction: r.faction,
      count: r.count,
      percentage: totalCount > 0 ? parseFloat(((r.count / totalCount) * 100).toFixed(1)) : 0
    }));

    const activeMembers = await queries.all(`
      SELECT member_id, name, voting_power, correct_count, total_count, faction, generation, dna_json, phenotype_json
      FROM ais_council_members 
      WHERE status = 'ACTIVE' 
      ORDER BY voting_power DESC, member_id ASC
    `);

    const recentVotes = await queries.all(`
      SELECT h.id, h.timestamp, h.decision_vote, h.weight_at_vote, m.name, m.faction, m.generation 
      FROM ais_council_voting_history h 
      LEFT JOIN ais_council_members m ON h.member_id = m.member_id 
      ORDER BY h.id DESC 
      LIMIT 11
    `);

    const generationRows = await queries.all(`
      SELECT generation, COUNT(*) as count 
      FROM ais_council_members 
      GROUP BY generation
      ORDER BY generation DESC
    `);
    const generationStats = generationRows.map(r => ({
      generation: r.generation,
      count: r.count,
      percentage: totalCount > 0 ? parseFloat(((r.count / totalCount) * 100).toFixed(1)) : 0
    }));


    const allMembers = await queries.all("SELECT weights_json, phenotype_json FROM ais_council_members");
    let diversityScore = 100;
    let rawStdDev = 0.15;
    
    if (allMembers && allMembers.length > 0) {
      const vectors = [];
      allMembers.forEach(m => {
        try {
          const w = JSON.parse(m.phenotype_json || m.weights_json);
          const buyVec = Array.isArray(w.BUY) ? w.BUY : [];
          const sellVec = Array.isArray(w.SELL) ? w.SELL : [];
          const holdVec = Array.isArray(w.HOLD) ? w.HOLD : [];
          const flat = [...buyVec, ...sellVec, ...holdVec];
          if (flat.length > 0) {
            vectors.push(flat);
          }
        } catch (e) {}
      });

      if (vectors.length > 1) {
        const numDimensions = vectors[0].length;
        const numSamples = vectors.length;
        let totalStdDev = 0;
        let validDimensions = 0;

        for (let d = 0; d < numDimensions; d++) {
          let sum = 0;
          for (let s = 0; s < numSamples; s++) {
            sum += vectors[s][d] || 0;
          }
          const mean = sum / numSamples;

          let varianceSum = 0;
          for (let s = 0; s < numSamples; s++) {
            varianceSum += Math.pow((vectors[s][d] || 0) - mean, 2);
          }
          const variance = varianceSum / (numSamples - 1);
          const stdDev = Math.sqrt(variance);
          
          if (!isNaN(stdDev)) {
            totalStdDev += stdDev;
            validDimensions++;
          }
        }

        rawStdDev = validDimensions > 0 ? (totalStdDev / validDimensions) : 0.15;
        diversityScore = Math.min(100, Math.max(0, Math.round((rawStdDev / 0.25) * 100)));
      }
    }


    const latestRun = await queries.get(`
      SELECT run_key, created_at, completed_at 
      FROM ais_model_runs 
      WHERE status = 'SHADOW_CHALLENGER' 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    let computationMargin = 90.0;
    let elapsedSeconds = 30.0;
    
    if (latestRun && latestRun.created_at && latestRun.completed_at) {
      const createdTime = new Date(latestRun.created_at).getTime();
      const completedTime = new Date(latestRun.completed_at).getTime();
      if (!isNaN(createdTime) && !isNaN(completedTime)) {
        elapsedSeconds = Math.max(1, (completedTime - createdTime) / 1000);
        computationMargin = Math.max(0, parseFloat(((300 - elapsedSeconds) / 300 * 100).toFixed(1)));
      }
    }


    let diversityGrade = 'GOOD';
    let recommendationText = `현재 ${totalCount}명 정원은 유전자 다양성(${diversityScore}%)과 서버 연산 마진(${computationMargin}%) 모두 최상의 밸런스를 유지하고 있습니다. 무작정 정원을 늘릴 필요가 없는 매우 이상적인 규모입니다.`;
    let diagnosticClass = 'success';

    if (diversityScore < 20) {
      diversityGrade = 'CRITICAL';
      diagnosticClass = 'danger';
      recommendationText = `⚠️ 경고: AI 의원들의 유전적 다양성(${diversityScore}%)이 바닥나 거의 똑같이 판단하는 획일화 현상이 감지되었습니다. 다양성 확보를 위해 의원 정원을 800~1,000명으로 확장하거나, 돌연변이 수혈 비중을 강제로 높여야 합니다.`;
    } else if (diversityScore < 40) {
      diversityGrade = 'WARNING';
      diagnosticClass = 'warning';
      recommendationText = `⚠️ 주의: 유전자 수렴 현상이 시작되었습니다. 현재 ${totalCount}명 정원은 유지 가능하나, 성적이 정체될 경우 정원을 800명 수준으로 늘려 다양성을 수급하는 것을 권장합니다.`;
    } else if (computationMargin < 20) {
      diversityGrade = 'WARNING';
      diagnosticClass = 'warning';
      recommendationText = `⚠️ 서버 과부하 주의: 실시간 5분 틱당 AI 학습·검증 연산 시간(${elapsedSeconds}초)이 한계에 달해 여유 마진이 부족합니다. 정원을 더 이상 늘리면 실거래 판단 지연이 발생할 수 있으므로, 현재의 ${totalCount}명 정원 유지가 적극 권장됩니다.`;
    }

    const healthReport = buildCouncilHealthReport({ totalCount, allMembers, latestRun });
    const now = Date.now();
    let lastEvoTime = 0;
    const modelRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_model'");
    try {
      const evoRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'last_evolution_time'");
      if (evoRow && evoRow.value) lastEvoTime = parseInt(evoRow.value, 10);
    } catch(e) {}

    const latestBriefing = await getLatestSuccessfulBriefing(queries, ADMIN_BRIEFING_SCOPE);
    const lastBriefingUpdate = latestBriefing && latestBriefing.generatedAt
      ? new Date(latestBriefing.generatedAt).getTime()
      : 0;
    const refreshNeeded = shouldRefreshBriefing({
      latestSuccess: latestBriefing,
      now,
      lastEvolutionTime: lastEvoTime,
      cacheDurationMs: BRIEFING_CACHE_DURATION
    });
    if (!latestBriefing || (now - lastBriefingUpdate > BRIEFING_CACHE_DURATION) || (lastBriefingUpdate < lastEvoTime)) {
      if (adminBriefingRefreshCoordinator.start(ADMIN_BRIEFING_SCOPE)) {
        const refreshRow = await startBriefingRefresh(queries, {
          scope: ADMIN_BRIEFING_SCOPE,
          triggeredBy: latestBriefing ? 'CACHE_REFRESH' : 'INITIAL',
          evolutionTime: lastEvoTime ? String(lastEvoTime) : null,
          modelName: modelRow && modelRow.value ? modelRow.value : null
        });

        generateCouncilOpinionBriefing(factionStats, activeMembers, generationStats).then(async (result) => {
          await finishBriefingRefreshSuccess(queries, refreshRow.id, {
            briefingText: result,
            generatedAt: new Date().toISOString()
          });
        }).catch(async (err) => {
          console.error("Background briefing fetch failed:", err.message);
          await finishBriefingRefreshFailure(queries, refreshRow.id, err.message);
        }).finally(() => {
          adminBriefingRefreshCoordinator.finish(ADMIN_BRIEFING_SCOPE);
        });
      }
    }

    const visibleBriefing = latestBriefing
      ? latestBriefing.briefingText
      : generateFallbackBriefing(factionStats, activeMembers, generationStats);

    res.json({
      success: true,
      totalCount,
      factionStats,
      activeMembers,
      recentVotes,
      briefing: visibleBriefing,
      briefingGeneratedAt: latestBriefing ? latestBriefing.generatedAt : null,
      briefingStatus: latestBriefing ? latestBriefing.status : 'FALLBACK',
      briefingRefreshing: refreshNeeded || adminBriefingRefreshCoordinator.isRefreshing(ADMIN_BRIEFING_SCOPE),
      healthReport
    });
  } catch (err) {
    console.error("Admin /council-stats Error:", err);
    res.status(500).json({ error: "Failed to fetch council stats" });
  }
});

router.post('/force-evolution', async (req, res) => {
  try {
    const { runDailyEvolution } = require('../evolution.js');
    const stats = await runDailyEvolution();
    
    await queries.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('last_evolution_time', ?)", [Date.now().toString()]);
    
    res.json({ success: true, stats, message: "강제 세대 진화 알고리즘이 완료되었습니다." });
  } catch(err) {
    console.error("Force Evolution Error:", err);
    res.status(500).json({ error: "진화 알고리즘 실행 실패" });
  }
});


async function getWindowsDiskSpace() {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  try {
    const { stdout } = await execPromise('wmic logicaldisk get caption,freeSpace,size', { windowsHide: true });
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      if (line.includes('C:')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const free = parseInt(parts[1], 10);
          const size = parseInt(parts[2], 10);
          if (!Number.isNaN(free) && !Number.isNaN(size) && size > 0) {
            return {
              freeGb: parseFloat((free / 1024 / 1024 / 1024).toFixed(1)),
              totalGb: parseFloat((size / 1024 / 1024 / 1024).toFixed(1)),
              freePct: parseFloat(((free / size) * 100).toFixed(1))
            };
          }
        }
      }
    }
  } catch (e) {
    console.error("Disk check fail:", e.message);
  }
  return null;
}


async function performSystemDiagnostics(runHeavyTests) {
  const fs = require('fs');
  const path = require('path');
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  const errors = [];
  const warnings = [];
  
  const details = {
    envCheck: { status: "OK", message: "정상" },
    dbCheck: { status: "OK", message: "정상" },
    fileCheck: { status: "OK", message: "정상" },
    modelCheck: { status: "OK", message: "정상" },
    pythonCheck: { status: "OK", message: "정상" },
    frontendCheck: { status: "OK", message: "정상" },
    traderCheck: { status: "OK", message: "정상" },
    councilCheck: { status: "OK", message: "정상" },

    gateioApiCheck: { status: "OK", message: "진단 대기" },
    web3Check: { status: "OK", message: "진단 대기" },
    systemResourceCheck: { status: "OK", message: "진단 대기" },
    dataPipelineCheck: { status: "OK", message: "진단 대기" },
    geminiCheck: { status: "OK", message: "진단 대기" },

    pm2Check: { status: "OK", message: "진단 대기" },
    networkBenchmarkCheck: { status: "OK", message: "진단 대기" },
    dbPerformanceCheck: { status: "OK", message: "진단 대기" },
    geneDiversityHhiCheck: { status: "OK", message: "진단 대기" },
    councilSchedulerCheck: { status: "OK", message: "진단 대기" },
    sslCertificateCheck: { status: "OK", message: "진단 대기" },
    councilNullFactionCheck: { status: "OK", message: "진단 대기" },
    councilDnaIntegrityCheck: { status: "OK", message: "진단 대기" },
    councilWeightsShapeCheck: { status: "OK", message: "진단 대기" },
    geminiApiKeyCheck: { status: "OK", message: "진단 대기" },
    enginePromoConsistencyCheck: { status: "OK", message: "진단 대기" }
  };


  let apiStatus = "OK";
  let apiDetails = "Express 서버 정상 및 세션 인증 통과";
  const envPath = path.join(__dirname, '..', '.env');
  const envExists = fs.existsSync(envPath);
  if (!envExists) {
    apiStatus = "ERROR";
    apiDetails = ".env 환경설정 파일 누락됨";
    errors.push(".env 환경설정 파일 누락");
    details.envCheck = { status: "ERROR", message: "환경설정 파일 누락됨" };
  } else {

    const envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('AUTH_SESSION_SECRET')) {
      apiStatus = "WARNING";
      apiDetails = ".env 파일 내 AUTH_SESSION_SECRET 설정 필요";
      warnings.push("AUTH_SESSION_SECRET 미설정");
      details.envCheck = { status: "WARNING", message: "AUTH_SESSION_SECRET 환경변수가 구성되어 있지 않습니다." };
    }
  }

  if (runHeavyTests && apiStatus !== "ERROR") {
    try {
      await execPromise('node adminAidlPolicy.test.js', { cwd: path.join(__dirname, '..'), windowsHide: true });
      apiDetails = "Express API 코어 및 어드민 정책 설정 테스트 통과";
    } catch (e) {
      apiStatus = "ERROR";
      apiDetails = `어드민 정책 테스트 실패: ${e.message.split('\n')[0]}`;
      errors.push(`어드민 정책 테스트 오류: ${e.message.split('\n')[0]}`);
      details.envCheck = { status: "ERROR", message: `테스트 실패: ${e.message.split('\n')[0]}` };
    }
  }


  let traderStatus = "OK";
  let traderDetails = "Gate.io 거래소 모니터링 정상 작동 중";
  const requiredTraderFiles = ['gridBot.js', 'gateioHelper.js', 'PlatformVaultBuild.json'];
  const missingTraderFiles = requiredTraderFiles.filter(f => !fs.existsSync(path.join(__dirname, '..', f)));
  if (missingTraderFiles.length > 0) {
    traderStatus = "ERROR";
    traderDetails = `핵심 파일 누락: ${missingTraderFiles.join(', ')}`;
    errors.push(`매매 집행기 핵심 파일 누락: ${missingTraderFiles.join(', ')}`);
    details.fileCheck = { status: "ERROR", message: `누락 파일: ${missingTraderFiles.join(', ')}` };
  } else {
    try {
      const credentialCheck = await queries.get(`
        SELECT COUNT(*) as cnt 
        FROM manager_gateio_credentials 
        WHERE encrypted_api_key IS NOT NULL 
          AND encrypted_api_key != '' 
          AND encrypted_api_secret IS NOT NULL 
          AND encrypted_api_secret != ''
      `);
      if (!credentialCheck || credentialCheck.cnt === 0) {
        traderStatus = "WARNING";
        traderDetails = "DB 내 암호화된 Gate.io API 키 설정 필요 (비활성 또는 모의 투자 모드)";
        warnings.push("DB 내 Gate.io API 키 설정 누락");
        details.traderCheck = { status: "WARNING", message: "암호화 저장된 거래소 API 키가 없습니다." };
      } else {
        traderDetails = `Gate.io 거래소 API 키 로드 완료 (총 ${credentialCheck.cnt}명의 매니저 연동 중)`;
      }
    } catch (e) {
      traderStatus = "WARNING";
      traderDetails = "거래소 연동 정보 테이블 조회 실패";
      warnings.push("DB 내 Gate.io 크레덴셜 테이블(manager_gateio_credentials) 조회 에러");
      details.traderCheck = { status: "WARNING", message: `조회 오류: ${e.message}` };
    }
  }


  let evolutionStatus = "OK";
  let evolutionDetails = "유전자 진화 모델 상태 정상";
  const requiredEvolFiles = ['train_ais.py', 'ais_dna.py', 'test_ais_dna.py'];
  const missingEvolFiles = requiredEvolFiles.filter(f => !fs.existsSync(path.join(__dirname, '..', f)));
  if (missingEvolFiles.length > 0) {
    evolutionStatus = "ERROR";
    evolutionDetails = `유전자 스크립트 파일 누락: ${missingEvolFiles.join(', ')}`;
    errors.push(`진화 엔진 파일 누락: ${missingEvolFiles.join(', ')}`);
    details.fileCheck = { status: "ERROR", message: `진화 모듈 누락: ${missingEvolFiles.join(', ')}` };
  } else {
    const weightsPath = path.join(__dirname, '..', 'ais_model_weights.json');
    if (!fs.existsSync(weightsPath)) {
      evolutionStatus = "WARNING";
      evolutionDetails = "AI 유전자 모델 가중치 파일(ais_model_weights.json) 누락";
      warnings.push("모델 가중치 파일 없음");
      details.modelCheck = { status: "WARNING", message: "ais_model_weights.json 파일 없음" };
    } else {
      try {
        const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));
        const hasBuy = Array.isArray(weights.BUY) && weights.BUY.length === 5;
        const hasSell = Array.isArray(weights.SELL) && weights.SELL.length === 5;
        const hasHold = Array.isArray(weights.HOLD) && weights.HOLD.length === 5;
        if (!hasBuy || !hasSell || !hasHold) {
          evolutionStatus = "WARNING";
          evolutionDetails = "AI 가중치 파일 스키마 형식 오류 (BUY/SELL/HOLD 키 또는 피처 배열 규격 미달)";
          warnings.push("모델 가중치 스키마 비정상");
          details.modelCheck = { status: "WARNING", message: "가중치 스키마 비정상" };
        }
      } catch (e) {
        evolutionStatus = "ERROR";
        evolutionDetails = "AI 가중치 JSON 파일 손상(파싱 오류)";
        errors.push("모델 가중치 JSON 파싱 오류");
        details.modelCheck = { status: "ERROR", message: "JSON 손상" };
      }
    }
  }


  try {
    const latestRun = await queries.get(`
      SELECT run_key, status, error_message, completed_at
      FROM ais_model_runs
      ORDER BY id DESC
      LIMIT 1
    `);
    if (latestRun) {
      if (latestRun.status === 'FAILED' || latestRun.error_message) {
        if (evolutionStatus !== "ERROR") {
          evolutionStatus = "WARNING";
          evolutionDetails = `최근 자동 학습 실패: ${latestRun.error_message}`;
        }
        warnings.push(`최근 자동 학습 에러: ${latestRun.error_message}`);
      } else if (latestRun.completed_at) {
        const lastCompleted = new Date(latestRun.completed_at).getTime();
        const elapsed = Date.now() - lastCompleted;
        if (elapsed > 24 * 60 * 60 * 1000) {
          if (evolutionStatus !== "ERROR") {
            evolutionStatus = "WARNING";
            evolutionDetails = "최근 24시간 동안 완료된 학습 기록 없음";
          }
          warnings.push("최근 24시간 동안 유전자 학습 없음");
        } else {
          if (evolutionStatus === "OK") {
            evolutionDetails = `최근 학습 완료: ${latestRun.run_key}`;
          }
        }
      }
    }
  } catch (e) {
    if (evolutionStatus !== "ERROR") {
      evolutionStatus = "WARNING";
      evolutionDetails = "자동 학습 기록 조회 실패";
    }
    warnings.push("DB 학습 이력 테이블 조회 오류");
  }

  if (runHeavyTests && evolutionStatus !== "ERROR") {

    try {
      await execPromise('py --version', { windowsHide: true });
    } catch (e) {
      evolutionStatus = "ERROR";
      evolutionDetails = "로컬 Python py 런처를 실행할 수 없습니다.";
      errors.push("파이썬 런처(py) 미설치 또는 환경변수 오류");
      details.pythonCheck = { status: "ERROR", message: "파이썬 런처(py) 실행기 오작동" };
    }

    if (evolutionStatus !== "ERROR") {
      try {
        await execPromise('py test_ais_dna.py', { cwd: path.join(__dirname, '..'), windowsHide: true });
        evolutionDetails = "유전자 진화 모델 및 DNA 구조 테스트 통과 완료";
      } catch (e) {
        evolutionStatus = "ERROR";
        evolutionDetails = `DNA 테스트 실패: ${e.message.split('\n')[0]}`;
        errors.push(`유전자 DNA 테스트 실패: ${e.message.split('\n')[0]}`);
      }
    }
  }


  let vepStatus = "OK";
  let vepDetails = "이상 돌연변이 사전 위험 필터(AI-VEP) 활성화";
  const requiredVepFiles = ['zeroTrustFilter.js', 'aisEvaluation.js', 'aisEvaluation.test.js'];
  const missingVepFiles = requiredVepFiles.filter(f => !fs.existsSync(path.join(__dirname, '..', f)));
  if (missingVepFiles.length > 0) {
    vepStatus = "ERROR";
    vepDetails = `사전 필터 파일 누락: ${missingVepFiles.join(', ')}`;
    errors.push(`AI-VEP 파일 누락: ${missingVepFiles.join(', ')}`);
    details.fileCheck = { status: "ERROR", message: `AI-VEP 파일 누락: ${missingVepFiles.join(', ')}` };
  }

  if (runHeavyTests && vepStatus !== "ERROR") {
    try {
      await execPromise('node aisEvaluation.test.js', { cwd: path.join(__dirname, '..'), windowsHide: true });
      vepDetails = "AI-VEP 이상 변이 연산 및 평가 모델 무결성 검증 완료";
    } catch (e) {
      vepStatus = "ERROR";
      vepDetails = `AI-VEP 평가 테스트 실패: ${e.message.split('\n')[0]}`;
      errors.push(`AI-VEP 평가 테스트 실패: ${e.message.split('\n')[0]}`);
    }
  }


  let featuresStatus = "OK";
  let featuresDetails = "RSI 및 이평선 등 기술 지표 정규화 연산기 준비완료";
  const requiredFeatureFiles = ['ais_features.py', 'test_ais_features.py'];
  const missingFeatureFiles = requiredFeatureFiles.filter(f => !fs.existsSync(path.join(__dirname, '..', f)));
  if (missingFeatureFiles.length > 0) {
    featuresStatus = "ERROR";
    featuresDetails = `피처 연산 파일 누락: ${missingFeatureFiles.join(', ')}`;
    errors.push(`피처 가공기 파일 누락: ${missingFeatureFiles.join(', ')}`);
    details.fileCheck = { status: "ERROR", message: `피처 스크립트 누락: ${missingFeatureFiles.join(', ')}` };
  }

  if (runHeavyTests && featuresStatus !== "ERROR") {
    try {
      await execPromise('py test_ais_features.py', { cwd: path.join(__dirname, '..'), windowsHide: true });
      featuresDetails = "10개 핵심 보조지표 정규화 가공 유닛 테스트 통과 완료";
    } catch (e) {
      featuresStatus = "ERROR";
      featuresDetails = `피처 가공 테스트 실패: ${e.message.split('\n')[0]}`;
      errors.push(`보조지표 피처 가공 테스트 실패: ${e.message.split('\n')[0]}`);
    }
  }


  let councilStatus = "OK";
  let councilDetails = "의회 다양성 및 연산 여유 마진율 모니터링 중";
  const requiredCouncilFiles = ['councilHealthReport.js', 'councilBriefing.js', 'councilBriefingHistory.js'];
  const missingCouncilFiles = requiredCouncilFiles.filter(f => !fs.existsSync(path.join(__dirname, '..', f)));
  if (missingCouncilFiles.length > 0) {
    councilStatus = "ERROR";
    councilDetails = `의회 분석 모듈 파일 누락: ${missingCouncilFiles.join(', ')}`;
    errors.push(`의회 분석 모듈 파일 누락: ${missingCouncilFiles.join(', ')}`);
    details.fileCheck = { status: "ERROR", message: `의회 파일 누락: ${missingCouncilFiles.join(', ')}` };
  } else {
    try {
      const allMembers = await queries.all(`
        SELECT member_id, faction, phenotype_json, weights_json 
        FROM ais_council_members
      `);
      
      const latestRun = await queries.get(`
        SELECT run_key, status, error_message, completed_at, created_at
        FROM ais_model_runs
        ORDER BY id DESC
        LIMIT 1
      `);
      
      const { buildCouncilHealthReport } = require('../councilHealthReport');
      const report = buildCouncilHealthReport({
        totalCount: allMembers.length,
        allMembers,
        latestRun
      });
      
      const margin = report.computationMargin;
      const diversity = report.diversityScore;
      
      if (report.diagnosticClass === 'danger') {
        councilStatus = "ERROR";
        councilDetails = `의회 위기: 다양성 ${diversity}%, 연산 마진 ${margin}%`;
        errors.push(`의회 건강 심각: 다양성 지수 임계값 미달`);
        details.councilCheck = { status: "ERROR", message: `위기: 다양성 ${diversity}%, 연산 마진 ${margin}%` };
      } else if (report.diagnosticClass === 'warning') {
        councilStatus = "WARNING";
        councilDetails = `의회 주의: 다양성 ${diversity}%, 연산 마진 ${margin}%`;
        warnings.push(`의회 건강 주의: ${report.recommendationText.split('\n')[0]}`);
        details.councilCheck = { status: "WARNING", message: `주의: 다양성 ${diversity}%, 연산 마진 ${margin}%` };
      } else {
        councilDetails = `정상: 틱 연산 여유 마진 ${margin}%, 다양성 지수 ${diversity}%`;
      }
    } catch (e) {
      councilStatus = "WARNING";
      councilDetails = `의회 데이터 분석 중 연산 실패: ${e.message}`;
      warnings.push(`의회 건강 상태 연산 및 분석 실패: ${e.message}`);
      details.councilCheck = { status: "WARNING", message: `연산 오류: ${e.message}` };
    }
  }


  let frontendStatus = "OK";
  let frontendDetails = "React UI 대시보드 컴파일 및 static 리소스 서빙 준비완료";
  const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html');
  const frontendPackagePath = path.join(__dirname, '..', '..', 'frontend', 'package.json');
  if (!fs.existsSync(frontendPackagePath)) {
    frontendStatus = "ERROR";
    frontendDetails = "프론트엔드 프로젝트 폴더 또는 package.json 없음";
    errors.push("Frontend package.json 파일 누락");
    details.frontendCheck = { status: "ERROR", message: "프로젝트 package.json 파일 없음" };
  } else if (!fs.existsSync(frontendDistPath)) {
    frontendStatus = "WARNING";
    frontendDetails = "정적 웹 리소스 빌드 폴더(frontend/dist) 없음. npm run build 필요";
    warnings.push("React 빌드 결과물(frontend/dist)이 존재하지 않음");
    details.frontendCheck = { status: "WARNING", message: "빌드 아티팩트 dist 폴더 미검출" };
  }


  let dbStatus = "OK";
  let dbDetails = "platform.db 파일 I/O 및 테이블 스키마 무결성 정상";
  const dbPath = path.join(__dirname, '..', 'platform.db');
  if (!fs.existsSync(dbPath)) {
    dbStatus = "ERROR";
    dbDetails = "SQLite3 platform.db 데이터베이스 파일이 존재하지 않습니다.";
    errors.push("platform.db 파일 누락");
    details.dbCheck = { status: "ERROR", message: "SQLite db 파일 누락" };
  } else {
    const stats = fs.statSync(dbPath);
    if (stats.size === 0) {
      dbStatus = "ERROR";
      dbDetails = "데이터베이스 파일 크기가 0바이트(공백)입니다.";
      errors.push("platform.db 파일 크기가 0바이트임");
      details.dbCheck = { status: "ERROR", message: "0바이트 파일임" };
    } else {
      try {
        await queries.get("SELECT 1");
        
        const pragmaResult = await queries.get("PRAGMA integrity_check");
        if (pragmaResult && pragmaResult.integrity_check !== 'ok') {
          dbStatus = "ERROR";
          dbDetails = `SQLite 손상 감지: ${pragmaResult.integrity_check}`;
          errors.push(`SQLite PRAGMA 무결성 체크 실패: ${pragmaResult.integrity_check}`);
          details.dbCheck = { status: "ERROR", message: `SQLite PRAGMA 손상: ${pragmaResult.integrity_check}` };
        } else {
          const tables = ['ais_model_runs', 'ais_council_members', 'manager_ai_settings', 'manager_trade_executions'];
          const missingTables = [];
          for (const table of tables) {
            const tableCheck = await queries.get(`
              SELECT name FROM sqlite_master WHERE type='table' AND name=?
            `, [table]);
            if (!tableCheck) {
              missingTables.push(table);
            }
          }
          if (missingTables.length > 0) {
            dbStatus = "ERROR";
            dbDetails = `데이터베이스 필수 테이블 누락: ${missingTables.join(', ')}`;
            errors.push(`DB 필수 테이블 누락: ${missingTables.join(', ')}`);
            details.dbCheck = { status: "ERROR", message: `누락 테이블: ${missingTables.join(', ')}` };
          } else {
            dbDetails = `SQLite DB 연결 완료 (${(stats.size / 1024 / 1024).toFixed(2)} MB), 테이블 스키마 정상`;
          }
        }
      } catch (e) {
        dbStatus = "ERROR";
        dbDetails = `DB 연결 및 PRAGMA 쿼리 실패: ${e.message}`;
        errors.push(`DB 쿼리 에러: ${e.message}`);
        details.dbCheck = { status: "ERROR", message: `커넥션 실패: ${e.message}` };
      }
    }
  }

  let gateioApiStatus = "OK";
  let gateioApiMsg = "Gate.io 거래소 API 키 로딩 전";
  try {
    const cred = await queries.get(`
      SELECT encrypted_api_key, encrypted_api_secret 
      FROM manager_gateio_credentials 
      LIMIT 1
    `);
    if (cred) {
      const { decryptText } = require('../secureCredentials');
      const decryptedKey = decryptText(cred.encrypted_api_key);
      const decryptedSecret = decryptText(cred.encrypted_api_secret);
      
      const start = Date.now();
      const { getGateIoBalances } = require('../gateioHelper');
      const apiRes = await getGateIoBalances(decryptedKey, decryptedSecret);
      const latency = Date.now() - start;
      
      if (apiRes.success) {
        gateioApiMsg = `연결 완료 (지연: ${latency}ms, SUT: ${apiRes.balances.SUT.toFixed(2)}, USDT: ${apiRes.balances.USDT.toFixed(2)})`;
      } else {
        gateioApiStatus = "WARNING";
        gateioApiMsg = `거래소 통신 실패: ${apiRes.message}`;
        warnings.push(`Gate.io API 실시간 호출 실패: ${apiRes.message}`);
      }
    } else {
      gateioApiStatus = "WARNING";
      gateioApiMsg = "등록된 매니저 Gate.io API Credentials가 존재하지 않습니다 (모의 모드)";
    }
  } catch (e) {
    gateioApiStatus = "WARNING";
    gateioApiMsg = `복호화 또는 API 통신 중 실패: ${e.message}`;
    warnings.push(`Gate.io 크레덴셜 연결성 진단 실패: ${e.message}`);
  }
  details.gateioApiCheck = { status: gateioApiStatus, message: gateioApiMsg };


  let web3Status = "OK";
  let web3Msg = "RPC 노드 연결 상태 대기 중";
  try {
    const defaultRpc = process.env.RPC_URL || 'https://polygon-rpc.com';
    const privateKey = process.env.PRIVATE_KEY;
    
    if (privateKey) {
      const { ethers } = require('ethers');
      const rpcUrls = [
        defaultRpc,
        'https://polygon-bor-rpc.publicnode.com',
        'https://polygon.llamarpc.com'
      ];
      
      let provider = null;
      let blockNum = 0;
      let latency = 0;
      let connectedRpc = "";
      
      for (const url of rpcUrls) {
        try {
          const tempProvider = new ethers.JsonRpcProvider(url);
          const start = Date.now();
          blockNum = await tempProvider.getBlockNumber();
          latency = Date.now() - start;
          provider = tempProvider;
          connectedRpc = url;
          break;
        } catch (err) {
        }
      }
      
      if (!provider) {
        throw new Error("모든 Polygon RPC 노드 응답 없음");
      }
      
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      const polBalance = parseFloat(ethers.formatEther(balance));
      
      if (polBalance === 0) {
        web3Status = "ERROR";
        web3Msg = `지갑 주소: ${wallet.address} (POL 가스비 완전 고갈: 0.0 POL)`;
        errors.push("Web3 가스비(POL) 고갈 에러");
      } else if (polBalance < 0.5) {
        web3Status = "WARNING";
        web3Msg = `가스비 부족 주의: ${polBalance.toFixed(4)} POL (블록: ${blockNum}, 지연: ${latency}ms, 노드: ${connectedRpc.split('/')[2]})`;
        warnings.push("POL 가스비 잔액 부족 경고 (< 0.5 POL)");
      } else {
        web3Msg = `연결 정상 (블록: ${blockNum}, 지연: ${latency}ms, 가스비: ${polBalance.toFixed(4)} POL, 노드: ${connectedRpc.split('/')[2]})`;
      }
    } else {
      web3Status = "WARNING";
      web3Msg = "개인키(PRIVATE_KEY) 설정 누락으로 트랜잭션 전송 불가능";
      warnings.push("Web3 지갑 개인키(PRIVATE_KEY) 미설정");
    }
  } catch (e) {
    web3Status = "WARNING";
    web3Msg = `RPC 노드 통신 실패: ${e.message}`;
    warnings.push(`Polygon RPC 노드 연결 실패: ${e.message}`);
  }
  details.web3Check = { status: web3Status, message: web3Msg };


  let systemStatus = "OK";
  let systemMsg = "서버 물리 자원 진단 대기 중";
  try {
    const os = require('os');
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memPct = parseFloat(((freeMem / totalMem) * 100).toFixed(1));
    const cpuCores = os.cpus().length;
    

    let diskMsg = "";
    if (os.platform() === 'win32') {
      const diskInfo = await getWindowsDiskSpace();
      if (diskInfo) {
        if (diskInfo.freeGb < 1.0) {
          systemStatus = "ERROR";
          errors.push("실서버 디스크 공간 고갈 에러 (< 1GB)");
        } else if (diskInfo.freeGb < 5.0) {
          systemStatus = "WARNING";
          warnings.push("실서버 디스크 공간 부족 경고 (< 5GB)");
        }
        diskMsg = `, 디스크: ${diskInfo.freeGb}GB 여유 (${diskInfo.freePct}%)`;
      }
    }
    systemMsg = `CPU: ${cpuCores}코어, RAM 가용율: ${memPct}% 여유${diskMsg}`;
  } catch (e) {
    systemStatus = "WARNING";
    systemMsg = `서버 자원 진단 실패: ${e.message}`;
  }
  details.systemResourceCheck = { status: systemStatus, message: systemMsg };


  let pipelineStatus = "OK";
  let pipelineMsg = "데이터 수집 파이프라인 정상 가동 중";
  try {
    const dataCount = await queries.get("SELECT COUNT(*) as cnt FROM ais_training_data");
    const latestData = await queries.get("SELECT timestamp FROM ais_training_data ORDER BY id DESC LIMIT 1");
    
    if (!latestData) {
      pipelineStatus = "WARNING";
      pipelineMsg = "수집된 학습 데이터셋이 존재하지 않습니다.";
      warnings.push("학습 데이터셋이 완전히 비어있음");
    } else {
      const lastInserted = new Date(latestData.timestamp).getTime();
      const elapsedHours = (Date.now() - lastInserted) / (1000 * 60 * 60);
      
      if (elapsedHours > 24) {
        pipelineStatus = "WARNING";
        pipelineMsg = `주의: 최근 24시간 동안 신규 수집 데이터 없음 (최종 수집: ${elapsedHours.toFixed(1)}시간 전)`;
        warnings.push("학습 데이터 파이프라인 유입 중단 의심 (24시간 초과)");
      } else {
        pipelineMsg = `정상: 총 데이터셋 ${dataCount.cnt}개 적재 중 (최종 수집: ${elapsedHours.toFixed(1)}시간 전)`;
      }
    }
  } catch (e) {
    pipelineStatus = "WARNING";
    pipelineMsg = `파이프라인 테이블 조회 실패: ${e.message}`;
    warnings.push("DB 내 학습 데이터셋 테이블(ais_training_data) 조회 오류");
  }
  details.dataPipelineCheck = { status: pipelineStatus, message: pipelineMsg };


  let geminiStatus = "OK";
  let geminiMsg = "Gemini API 연결 상태 대기 중";
  try {
    const geminiKeySetting = await queries.get(`
      SELECT value FROM platform_settings WHERE key = 'global_gemini_api_key'
      UNION
      SELECT value FROM platform_settings WHERE key = 'gemini_api_key'
    `);
    
    const apiKey = geminiKeySetting ? geminiKeySetting.value : (process.env.GEMINI_API_KEY || '');
    
    if (apiKey) {
      const modelId = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      const start = Date.now();
      
      const testResponse = await axios.post(url, {
        contents: [{ parts: [{ text: '1' }] }]
      }, { timeout: 8000 });
      
      const latency = Date.now() - start;
      if (testResponse.data && testResponse.data.candidates) {
        geminiMsg = `연결 완료 (지연: ${latency}ms, 모델: ${modelId})`;
      } else {
        geminiStatus = "WARNING";
        geminiMsg = "구글 API 응답 포맷 비정상";
        warnings.push("Gemini API 호출 응답 규격 불일치");
      }
    } else {
      geminiStatus = "WARNING";
      geminiMsg = "Gemini API Key가 등록되어 있지 않습니다.";
      warnings.push("의회 브리핑 생성을 위한 Gemini API Key 누락");
    }
  } catch (e) {
    geminiStatus = "WARNING";
    geminiMsg = `구글 Gemini API 통신 실패: ${e.response ? JSON.stringify(e.response.data) : e.message}`;
    warnings.push(`Gemini API 통신 실패: ${e.message}`);
  }
  details.geminiCheck = { status: geminiStatus, message: geminiMsg };

  let pm2Status = "OK";
  let pm2Msg = "PM2 환경 정상 작동 중";
  try {
    const { stdout } = await execPromise('pm2 jlist', { windowsHide: true });
    const apps = JSON.parse(stdout);
    const aisApp = apps.find(app => app.name === 'ai-s');
    if (aisApp) {
      const status = aisApp.pm2_env.status;
      const restarts = aisApp.pm2_env.restart_time;
      const uptime = Math.round((Date.now() - aisApp.pm2_env.pm_uptime) / (1000 * 60 * 60));
      if (status !== 'online') {
        pm2Status = "ERROR";
        pm2Msg = `오프라인 상태 (상태: ${status}, 누적 재시작: ${restarts}회)`;
        errors.push(`ai-s PM2 프로세스 비정상 상태: ${status}`);
      } else {
        pm2Msg = `정상 가동 중 (상태: online, 누적 재시작: ${restarts}회, Uptime: ${uptime}시간)`;
        if (restarts > 100) {
          pm2Status = "WARNING";
          pm2Msg += " - 누적 재시작 빈도 과다";
          warnings.push("ai-s PM2 누적 재시작 횟수 100회 초과 경고");
        }
      }
    } else {
      pm2Status = "WARNING";
      pm2Msg = "PM2에서 ai-s 프로세스 감지 실패 (모의 모드)";
      warnings.push("PM2 내 ai-s 프로세스 미검출");
    }
  } catch (e) {
    pm2Status = "WARNING";
    pm2Msg = `PM2 연동 불가: ${e.message}`;
    warnings.push(`PM2 CLI jlist 쿼리 실패: ${e.message}`);
  }
  details.pm2Check = { status: pm2Status, message: pm2Msg };


  let networkStatus = "OK";
  let networkMsg = "네트워크 망 상태 대기 중";
  try {
    const targets = [
      { name: "Gate.io API", url: "https://api.gateio.ws/api/v4/spot/currencies" },
      { name: "Polygon RPC", url: process.env.RPC_URL || "https://polygon-rpc.com" },
      { name: "CoinGecko", url: "https://api.coingecko.com/api/v3/ping" }
    ];
    
    const latencies = {};
    let totalLatency = 0;
    let successCount = 0;
    
    for (const target of targets) {
      try {
        const start = Date.now();
        const axios = require('axios');
        await axios.get(target.url, { timeout: 3000 });
        const latency = Date.now() - start;
        latencies[target.name] = latency;
        totalLatency += latency;
        successCount++;
      } catch (err) {
        latencies[target.name] = -1;
      }
    }
    
    if (successCount === 0) {
      networkStatus = "ERROR";
      networkMsg = "외부 망 완전 단절 (Gate.io, RPC, CoinGecko 응답 없음)";
      errors.push("외부 망 통신 완전 단절 에러");
    } else {
      const avgLatency = Math.round(totalLatency / successCount);
      const parts = Object.entries(latencies).map(([name, lat]) => `${name}: ${lat === -1 ? '실패' : lat + 'ms'}`);
      networkMsg = `평균 지연: ${avgLatency}ms (${parts.join(', ')})`;
      if (avgLatency > 1500 || successCount < targets.length) {
        networkStatus = "WARNING";
        networkMsg += " - 일부 노드 레이턴시 과도함";
        warnings.push("외부 네트워크 지연 과도 또는 일부 연동 유실");
      }
    }
  } catch (e) {
    networkStatus = "WARNING";
    networkMsg = `네트워크 지연 진단 실패: ${e.message}`;
  }
  details.networkBenchmarkCheck = { status: networkStatus, message: networkMsg };


  let dbPerfStatus = "OK";
  let dbPerfMsg = "데이터베이스 I/O 벤치마크 대기 중";
  try {
    const start = Date.now();
    await queries.run("CREATE TABLE IF NOT EXISTS diagnostics_benchmark (id INTEGER PRIMARY KEY, val TEXT)");
    for (let i = 0; i < 50; i++) {
      await queries.run("INSERT INTO diagnostics_benchmark (val) VALUES (?)", [`test_value_${i}`]);
    }
    const countRes = await queries.get("SELECT COUNT(*) as cnt FROM diagnostics_benchmark");
    await queries.run("DROP TABLE IF EXISTS diagnostics_benchmark");
    const duration = Date.now() - start;
    
    if (countRes && countRes.cnt === 50) {
      dbPerfMsg = `50회 Write/Read 속도: ${duration}ms (안전 대역)`;
      if (duration > 600) {
        dbPerfStatus = "WARNING";
        dbPerfMsg += " - I/O 지연 감지 (디스크 부하 발생)";
        warnings.push("SQLite3 DB I/O 응답 지연 경고 (> 600ms)");
      }
    } else {
      dbPerfStatus = "ERROR";
      dbPerfMsg = "DB I/O 벤치마크 무결성 오류 (데이터 유실 감지)";
      errors.push("SQLite3 I/O 테스트 데이터 무결성 실패");
    }
  } catch (e) {
    dbPerfStatus = "ERROR";
    dbPerfMsg = `DB I/O 벤치마크 연산 실패: ${e.message}`;
    errors.push(`SQLite3 I/O 성능 측정 오류: ${e.message}`);
    try {
      await queries.run("DROP TABLE IF EXISTS diagnostics_benchmark");
    } catch (_) {}
  }
  details.dbPerformanceCheck = { status: dbPerfStatus, message: dbPerfMsg };


  let hhiStatus = "OK";
  let hhiMsg = "유전자 다양성 HHI 진단 대기 중";
  try {
    const factionCounts = await queries.all(`
      SELECT COALESCE(faction, 'MUTANT_ROOKIE') as faction, COUNT(*) as cnt 
      FROM ais_council_members 
      GROUP BY COALESCE(faction, 'MUTANT_ROOKIE')
    `);
    
    const totalMembers = factionCounts.reduce((acc, cur) => acc + cur.cnt, 0);
    if (totalMembers === 0) {
      hhiStatus = "WARNING";
      hhiMsg = "의회 구성원이 존재하지 않아 Faction HHI를 계산할 수 없습니다.";
      warnings.push("의회 멤버 수 0명으로 HHI 계산 불가능");
    } else {
      let hhi = 0;
      const distributions = [];
      factionCounts.forEach(f => {
        const pct = (f.cnt / totalMembers) * 100;
        hhi += pct * pct;
        distributions.push(`${f.faction}: ${Math.round(pct)}%`);
      });
      
      hhi = Math.round(hhi);
      hhiMsg = `HHI 지수: ${hhi} (분포: ${distributions.join(', ')})`;
      
      if (hhi > 9000) {
        hhiStatus = "WARNING";
        hhiMsg += " - 유전자 팩션 편중 심각 (다양성 훼손 우려)";
        warnings.push(`의회 유전자 팩션 편중 경고 (HHI 지수: ${hhi} > 9000)`);
      } else {
        hhiMsg += " [다양성 무결성 통과]";
      }
    }
  } catch (e) {
    hhiStatus = "WARNING";
    hhiMsg = `Faction HHI 분석 에러: ${e.message}`;
    warnings.push(`의회 팩션 HHI 지수 연산 실패: ${e.message}`);
  }
  details.geneDiversityHhiCheck = { status: hhiStatus, message: hhiMsg };


  let schedulerStatus = "OK";
  let schedulerMsg = "의회 스케줄러 정상 작동 중";
  try {
    const intervalRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_interval'");
    const intervalMinutes = intervalRow && !isNaN(parseInt(intervalRow.value)) ? parseInt(intervalRow.value) : 5;

    const latestRun = await queries.get(`
      SELECT completed_at, created_at
      FROM ais_model_runs
      ORDER BY id DESC
      LIMIT 1
    `);

    const latestTraining = await queries.get(`
      SELECT timestamp
      FROM ais_training_data
      ORDER BY id DESC
      LIMIT 1
    `);

    const lastEvolutionRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'last_evolution_time'");
    const lastEvoTime = lastEvolutionRow && lastEvolutionRow.value ? parseInt(lastEvolutionRow.value, 10) : 0;

    const now = Date.now();

    let modelRunTime = 0;
    if (latestRun) {
      modelRunTime = new Date(latestRun.completed_at || latestRun.created_at).getTime();
    }

    let trainingTime = 0;
    if (latestTraining && latestTraining.timestamp) {
      trainingTime = new Date(latestTraining.timestamp).getTime();
    }

    const lastActivityTime = Math.max(modelRunTime, trainingTime);
    const runDelayMinutes = lastActivityTime > 0 ? Math.round((now - lastActivityTime) / (1000 * 60)) : 9999;

    let evoDelayHours = 9999;
    if (lastEvoTime > 0) {
      evoDelayHours = Math.round((now - lastEvoTime) / (1000 * 60 * 60));
    }

    const schedLogs = [];
    schedLogs.push(`최근 스케줄러 활동: ${runDelayMinutes === 9999 ? '기록 없음' : runDelayMinutes + '분 전'} (설정: ${intervalMinutes}분 주기)`);
    schedLogs.push(`최근 진화: ${lastEvoTime === 0 ? '기록 없음' : evoDelayHours + '시간 전'}`);

    const runThresholdWarning = Math.max(30, intervalMinutes * 3);
    const runThresholdError = 120;

    if (runDelayMinutes > runThresholdError) {
      schedulerStatus = "ERROR";
      schedulerMsg = `의회 스케줄러 중단 의심: ${schedLogs.join(' / ')}`;
      errors.push(`의회 스케줄러 기동 지연 (최근 활동: ${runDelayMinutes}분 전)`);
    } else if (runDelayMinutes > runThresholdWarning) {
      schedulerStatus = "WARNING";
      schedulerMsg = `의회 스케줄러 작동 지연 주의: ${schedLogs.join(' / ')}`;
      warnings.push(`의회 스케줄러 작동 지연 (최근 활동: ${runDelayMinutes}분 전)`);
    } else if (lastEvoTime > 0 && evoDelayHours > 26) {
      schedulerStatus = "WARNING";
      schedulerMsg = `유전자 진화 스케줄 누락 주의: ${schedLogs.join(' / ')}`;
      warnings.push(`유전자 진화 스케줄 지연 (최근 진화: ${evoDelayHours}시간 전)`);
    } else {
      schedulerMsg = `스케줄러 정상: ${schedLogs.join(' / ')}`;
    }
  } catch (e) {
    schedulerStatus = "WARNING";
    schedulerMsg = `스케줄러 무결성 분석 에러: ${e.message}`;
    warnings.push(`의회 스케줄러 무결성 분석 실패: ${e.message}`);
  }
  details.councilSchedulerCheck = { status: schedulerStatus, message: schedulerMsg };


  let sslStatus = "OK";
  let sslMsg = "SSL 보안 진단 대기 중";
  try {
    const tls = require('tls');
    const host = "edenai.alonics.com";
    
    const sslPromise = () => new Promise((resolve, reject) => {
      const socket = tls.connect({
        host: host,
        port: 443,
        servername: host,
        rejectUnauthorized: false
      }, () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        if (cert && cert.valid_to) {
          resolve(cert);
        } else {
          reject(new Error("인증서 파싱 실패"));
        }
      });
      socket.on('error', (err) => reject(err));
      socket.setTimeout(3000, () => {
        socket.destroy();
        reject(new Error("SSL 연결 타임아웃 (3초)"));
      });
    });
    
    const certInfo = await sslPromise();
    const validTo = new Date(certInfo.valid_to);
    const daysRemaining = Math.ceil((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining < 0) {
      sslStatus = "ERROR";
      sslMsg = `SSL 인증서 만료됨! (만료일: ${validTo.toISOString().split('T')[0]}, 경과: ${Math.abs(daysRemaining)}일)`;
      errors.push("실서버 SSL 인증서 만료 에러");
    } else if (daysRemaining < 14) {
      sslStatus = "WARNING";
      sslMsg = `SSL 인증서 만료 임박! (만료일: ${validTo.toISOString().split('T')[0]}, 남은 일수: ${daysRemaining}일)`;
      warnings.push(`실서버 SSL 인증서 만료 임박 (${daysRemaining}일 남음)`);
    } else {
      sslMsg = `보안 양호 (인증서 만료일: ${validTo.toISOString().split('T')[0]}, 남은 일수: ${daysRemaining}일)`;
    }
  } catch (e) {
    sslStatus = "WARNING";
    sslMsg = `SSL 검증 불가 (${e.message})`;
    warnings.push(`실서버 SSL 인증서 무결성 조사 실패: ${e.message}`);
  }
  details.sslCertificateCheck = { status: sslStatus, message: sslMsg };


  let votingStatus = "OK";
  let votingMsg = "AI 의회 투표 정상";
  try {
    const engineMode = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
    const mode = engineMode ? engineMode.value : 'GEMINI';
    const latestVote = await queries.get("SELECT timestamp FROM ais_council_voting_history ORDER BY id DESC LIMIT 1");
    const voteCount = await queries.get("SELECT COUNT(*) as cnt FROM ais_council_voting_history");
    const total = voteCount ? voteCount.cnt : 0;

    if (mode === 'AIS_ONLY' || mode === 'HYBRID_COOP') {
      if (!latestVote) {
        votingStatus = "WARNING";
        votingMsg = `투표 모드 활성(${mode})이나 투표 기록 없음`;
        warnings.push(`AI 의회 투표 기록 없음 (모드: ${mode})`);
      } else {
        const agoMin = Math.round((Date.now() - new Date(latestVote.timestamp).getTime()) / 60000);
        if (agoMin > 120) {
          votingStatus = "WARNING";
          votingMsg = `투표 지연: 최근 ${agoMin}분 전 (모드: ${mode}, 총 ${total}건)`;
          warnings.push(`AI 의회 투표 지연 (${agoMin}분 전)`);
        } else {
          votingMsg = `정상 투표 중: 최근 ${agoMin}분 전 (모드: ${mode}, 총 ${total}건)`;
        }
      }
    } else {
      votingMsg = `투표 비활성 (엔진: ${mode}) - 총 ${total}건 누적`;
    }
  } catch (e) {
    votingStatus = "WARNING";
    votingMsg = `투표 활성 분석 에러: ${e.message}`;
  }
  details.councilVotingCheck = { status: votingStatus, message: votingMsg };


  let electionStatus = "OK";
  let electionMsg = "총선 사이클 정상";
  try {
    const latestRun = await queries.get("SELECT completed_at, status FROM ais_model_runs ORDER BY id DESC LIMIT 1");
    if (!latestRun) {
      electionStatus = "WARNING";
      electionMsg = "AiS 총선 기록 없음 (ais_model_runs 비어있음)";
      warnings.push("AiS 총선 기록 없음");
    } else {
      const agoHrs = Math.round((Date.now() - new Date(latestRun.completed_at).getTime()) / (1000 * 60 * 60));
      if (agoHrs > 48) {
        electionStatus = "ERROR";
        electionMsg = `총선 장기 미실행: ${agoHrs}시간 전 (${latestRun.status})`;
        errors.push(`AiS 총선 48시간 초과 미실행 (${agoHrs}h)`);
      } else if (agoHrs > 26) {
        electionStatus = "WARNING";
        electionMsg = `총선 지연: ${agoHrs}시간 전 (${latestRun.status}) - 24h 주기 초과`;
        warnings.push(`AiS 총선 26시간 초과 (${agoHrs}h)`);
      } else {
        electionMsg = `정상: 최근 총선 ${agoHrs}시간 전 (${latestRun.status})`;
      }
    }
  } catch (e) {
    electionStatus = "WARNING";
    electionMsg = `총선 분석 에러: ${e.message}`;
  }
  details.councilElectionCheck = { status: electionStatus, message: electionMsg };


  let poolStatus = "OK";
  let poolMsg = "500인 후보군 풀 정상";
  try {
    const poolCount = await queries.get("SELECT COUNT(*) as cnt FROM ais_council_members");
    const total = poolCount ? poolCount.cnt : 0;
    if (total < 490) {
      poolStatus = "ERROR";
      poolMsg = `후보군 풀 부족: ${total}/500명 (10명 이상 결원)`;
      errors.push(`AI 의회 후보군 풀 심각 결원 (${total}/500)`);
    } else if (total < 500) {
      poolStatus = "WARNING";
      poolMsg = `후보군 풀 소폭 결원: ${total}/500명`;
      warnings.push(`AI 의회 후보군 풀 결원 (${total}/500)`);
    } else {
      poolMsg = `후보군 풀 정원 충족: ${total}/500명`;
    }
  } catch (e) {
    poolStatus = "WARNING";
    poolMsg = `후보군 풀 조회 에러: ${e.message}`;
  }
  details.councilPoolCheck = { status: poolStatus, message: poolMsg };


  let quorumStatus = "OK";
  let quorumMsg = "11인 의원 정족수 충족";
  try {
    const activeCount = await queries.get("SELECT COUNT(*) as cnt FROM ais_council_members WHERE status = 'ACTIVE'");
    const active = activeCount ? activeCount.cnt : 0;
    if (active < 7) {
      quorumStatus = "ERROR";
      quorumMsg = `의원 정족수 미달: ${active}/11명 활성 (의결 불능)`;
      errors.push(`AI 의회 의원 정족수 심각 미달 (${active}/11)`);
    } else if (active < 11) {
      quorumStatus = "WARNING";
      quorumMsg = `의원 소폭 결원: ${active}/11명 활성`;
      warnings.push(`AI 의회 의원 결원 (${active}/11)`);
    } else {
      quorumMsg = `의원 정족수 충족: ${active}/11명 활성`;
    }
  } catch (e) {
    quorumStatus = "WARNING";
    quorumMsg = `의원 정족수 조회 에러: ${e.message}`;
  }
  details.councilQuorumCheck = { status: quorumStatus, message: quorumMsg };


  let cycleStatus = "OK";
  let cycleMsg = "도태·생성 사이클 정상";
  try {
    const archiveCount = await queries.get("SELECT COUNT(*) as cnt FROM ais_genome_archive");
    const latestArchive = await queries.get("SELECT archived_at, archive_reason FROM ais_genome_archive ORDER BY id DESC LIMIT 1");
    const totalArchives = archiveCount ? archiveCount.cnt : 0;

    if (totalArchives === 0) {
      cycleStatus = "WARNING";
      cycleMsg = "도태 기록 없음 (진화 사이클 미작동 가능성)";
      warnings.push("게놈 아카이브 0건 - 도태 사이클 미작동");
    } else {
      const agoHrs = latestArchive ? Math.round((Date.now() - new Date(latestArchive.archived_at).getTime()) / (1000*60*60)) : 9999;
      if (agoHrs > 48) {
        cycleStatus = "WARNING";
        cycleMsg = `도태 지연: 최근 ${agoHrs}시간 전 (총 ${totalArchives}건, 사유: ${latestArchive.archive_reason})`;
        warnings.push(`도태 사이클 48시간 초과 (${agoHrs}h)`);
      } else {
        cycleMsg = `정상: 최근 도태 ${agoHrs}시간 전 (총 ${totalArchives}건, 사유: ${latestArchive.archive_reason})`;
      }
    }
  } catch (e) {
    cycleStatus = "WARNING";
    cycleMsg = `도태·생성 분석 에러: ${e.message}`;
  }
  details.councilCycleCheck = { status: cycleStatus, message: cycleMsg };


  let nullFactionStatus = "OK";
  let nullFactionMsg = "Faction 할당 무결성 정상";
  try {
    const nullFactionRow = await queries.get(
      "SELECT COUNT(*) as cnt FROM ais_council_members WHERE faction IS NULL"
    );
    const nullCount = nullFactionRow ? nullFactionRow.cnt : 0;
    if (nullCount > 0) {
      nullFactionStatus = "ERROR";
      nullFactionMsg = `Faction 미할당 의원 ${nullCount}명 감지 (데이터 오염)`;
      errors.push(`AI 의회 Faction NULL 의원 ${nullCount}명 발견`);
    } else {
      nullFactionMsg = "전 의원 Faction 정상 할당 완료";
    }
  } catch (e) {
    nullFactionStatus = "WARNING";
    nullFactionMsg = `Faction 무결성 조회 에러: ${e.message}`;
    warnings.push(`Faction NULL 검사 실패: ${e.message}`);
  }
  details.councilNullFactionCheck = { status: nullFactionStatus, message: nullFactionMsg };


  let dnaIntegrityStatus = "OK";
  let dnaIntegrityMsg = "DNA/Phenotype 무결성 정상";
  try {
    const nullDna = await queries.get(
      "SELECT COUNT(*) as cnt FROM ais_council_members WHERE dna_json IS NULL OR dna_json = ''"
    );
    const nullPheno = await queries.get(
      "SELECT COUNT(*) as cnt FROM ais_council_members WHERE phenotype_json IS NULL OR phenotype_json = ''"
    );
    const dnaCnt = nullDna ? nullDna.cnt : 0;
    const phenoCnt = nullPheno ? nullPheno.cnt : 0;
    if (dnaCnt > 0 || phenoCnt > 0) {
      dnaIntegrityStatus = "ERROR";
      dnaIntegrityMsg = `DNA 누락 ${dnaCnt}건, Phenotype 누락 ${phenoCnt}건 (투표 연산 불능 위험)`;
      errors.push(`AI 의회 DNA/Phenotype NULL 발견 (DNA: ${dnaCnt}, Phenotype: ${phenoCnt})`);
    } else {
      dnaIntegrityMsg = "전 의원 DNA 및 표현형 데이터 정상";
    }
  } catch (e) {
    dnaIntegrityStatus = "WARNING";
    dnaIntegrityMsg = `DNA 무결성 조회 에러: ${e.message}`;
    warnings.push(`DNA 무결성 검사 실패: ${e.message}`);
  }
  details.councilDnaIntegrityCheck = { status: dnaIntegrityStatus, message: dnaIntegrityMsg };


  let weightsShapeStatus = "OK";
  let weightsShapeMsg = "가중치 벡터 형태 정상";
  try {
    const allWeights = await queries.all(
      "SELECT member_id, weights_json FROM ais_council_members WHERE weights_json IS NOT NULL LIMIT 500"
    );
    let malformed = 0;
    const malformedIds = [];
    for (const row of allWeights) {
      try {
        const w = JSON.parse(row.weights_json);
        const validBuy = Array.isArray(w.BUY) && w.BUY.length === 5;
        const validSell = Array.isArray(w.SELL) && w.SELL.length === 5;
        const validHold = Array.isArray(w.HOLD) && w.HOLD.length === 5;
        if (!validBuy || !validSell || !validHold) {
          malformed++;
          if (malformedIds.length < 3) malformedIds.push(row.member_id);
        }
      } catch (_) {
        malformed++;
        if (malformedIds.length < 3) malformedIds.push(row.member_id);
      }
    }
    if (malformed > 0) {
      weightsShapeStatus = "ERROR";
      weightsShapeMsg = `비정상 가중치 ${malformed}건 (예: ${malformedIds.join(', ')})`;
      errors.push(`AI 의회 weights_json 형태 오류 ${malformed}건`);
    } else {
      weightsShapeMsg = `전 의원 BUY/SELL/HOLD 5-vector 형태 정상 (${allWeights.length}명 검증)`;
    }
  } catch (e) {
    weightsShapeStatus = "WARNING";
    weightsShapeMsg = `가중치 형태 조회 에러: ${e.message}`;
    warnings.push(`Weights 형태 검사 실패: ${e.message}`);
  }
  details.councilWeightsShapeCheck = { status: weightsShapeStatus, message: weightsShapeMsg };


  let apiKeyCheckStatus = "OK";
  let apiKeyCheckMsg = "Gemini API Key 정상 설정";
  try {
    const keyRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_gemini_api_key'");
    if (!keyRow || !keyRow.value || keyRow.value.trim() === '') {
      apiKeyCheckStatus = "ERROR";
      apiKeyCheckMsg = "Gemini API Key 미설정 (AI 분석 전체 불능)";
      errors.push("Gemini API Key 미설정 — AI 매매 분석 불가");
    } else {
      apiKeyCheckMsg = `API Key 설정 완료 (${keyRow.value.slice(0, 6)}...)`;
    }
  } catch (e) {
    apiKeyCheckStatus = "WARNING";
    apiKeyCheckMsg = `API Key 조회 에러: ${e.message}`;
    warnings.push(`Gemini API Key 조회 실패: ${e.message}`);
  }
  details.geminiApiKeyCheck = { status: apiKeyCheckStatus, message: apiKeyCheckMsg };


  let enginePromoStatus = "OK";
  let enginePromoMsg = "엔진 모드 ↔ 자동 승격 정합성 정상";
  try {
    const engineRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
    const promoRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'automatic_promotion_enabled'");
    const engine = engineRow ? engineRow.value : 'GEMINI';
    const promo = promoRow ? promoRow.value : 'OFF';
    if (engine === 'GEMINI' && promo === 'ON') {
      enginePromoStatus = "WARNING";
      enginePromoMsg = `GEMINI 모드인데 자동 승격 ON (논리적 불일치)`;
      warnings.push("GEMINI 모드 + 자동승격 ON 데이터 불일치");
    } else {
      enginePromoMsg = `엔진: ${engine}, 자동승격: ${promo} (정합성 통과)`;
    }
  } catch (e) {
    enginePromoStatus = "WARNING";
    enginePromoMsg = `엔진/승격 정합성 조회 에러: ${e.message}`;
    warnings.push(`엔진-승격 정합성 검사 실패: ${e.message}`);
  }
  details.enginePromoConsistencyCheck = { status: enginePromoStatus, message: enginePromoMsg };


  let labelStatus = "OK";
  let labelMsg = "라벨링 큐 정상";
  try {
    const pending = await queries.get("SELECT COUNT(*) as cnt FROM ais_training_data WHERE evaluation_status = 'PENDING'");
    const labeled = await queries.get("SELECT COUNT(*) as cnt FROM ais_training_data WHERE evaluation_status = 'LABELED'");
    const invalid = await queries.get("SELECT COUNT(*) as cnt FROM ais_training_data WHERE evaluation_status = 'INVALID'");
    const pCnt = pending ? pending.cnt : 0;
    const lCnt = labeled ? labeled.cnt : 0;
    const iCnt = invalid ? invalid.cnt : 0;
    const total = pCnt + lCnt + iCnt;

    if (pCnt > 50) {
      labelStatus = "WARNING";
      labelMsg = `라벨링 적체 주의: PENDING ${pCnt}건 (LABELED: ${lCnt}, INVALID: ${iCnt}, 총 ${total}건)`;
      warnings.push(`학습 데이터 라벨링 적체 (PENDING: ${pCnt}건)`);
    } else {
      labelMsg = `정상: PENDING ${pCnt}건, LABELED ${lCnt}건, INVALID ${iCnt}건 (총 ${total}건)`;
    }
  } catch (e) {
    labelStatus = "WARNING";
    labelMsg = `라벨링 분석 에러: ${e.message}`;
  }
  details.labelingBacklogCheck = { status: labelStatus, message: labelMsg };


  let overallStatus = "EXCELLENT";
  if (errors.length > 0) {
    overallStatus = "ERROR";
  } else if (
    warnings.length > 0 || 
    apiStatus === "WARNING" || 
    traderStatus === "WARNING" || 
    evolutionStatus === "WARNING" || 
    frontendStatus === "WARNING" || 
    gateioApiStatus === "WARNING" || 
    web3Status === "WARNING" || 
    systemStatus === "WARNING" || 
    pipelineStatus === "WARNING" || 
    geminiStatus === "WARNING" ||
    pm2Status === "WARNING" ||
    networkStatus === "WARNING" ||
    dbPerfStatus === "WARNING" ||
    hhiStatus === "WARNING" ||
    schedulerStatus === "WARNING" ||
    sslStatus === "WARNING" ||
    votingStatus === "WARNING" ||
    electionStatus === "WARNING" ||
    poolStatus === "WARNING" ||
    quorumStatus === "WARNING" ||
    cycleStatus === "WARNING" ||
    labelStatus === "WARNING" ||
    nullFactionStatus === "WARNING" ||
    dnaIntegrityStatus === "WARNING" ||
    weightsShapeStatus === "WARNING" ||
    apiKeyCheckStatus === "WARNING" ||
    enginePromoStatus === "WARNING"
  ) {
    overallStatus = "WARNING";
  }


  let srGeminiStatus = 'OK', srGeminiMsg = 'Gemini 분석 데이터 정상 유입 중';
  let srAisStatus = 'OK', srAisMsg = 'AiS 분석 데이터 정상 유입 중';
  let srHybridStatus = 'OK', srHybridMsg = 'Hybrid 분석 데이터 정상 유입 중';
  let srDataStatus = 'OK', srDataMsg = '모든 모드 데이터 충분';
  let srTrainStatus = 'OK', srTrainMsg = 'AiS 진화 학습 정상 실행 중';

  try {
    const modeChecks = ['GEMINI', 'AIS_ONLY', 'HYBRID_COOP'];
    for (const modeKey of modeChecks) {
      const latest = await queries.get(
        "SELECT timestamp FROM ais_training_data WHERE engine_mode = ? ORDER BY id DESC LIMIT 1",
        [modeKey]
      );
      let st = 'OK', msg = `${modeKey} 최근 데이터 정상`;
      if (!latest) {
        st = 'WARNING'; msg = `${modeKey} 데이터 없음 (Shadow Racing 미시작)`;
      } else {
        const agoMin = Math.round((Date.now() - new Date(latest.timestamp).getTime()) / 60000);
        if (agoMin > 360) { st = 'ERROR'; msg = `${modeKey} 최종 기록 ${agoMin}분 전 (6시간+ 중단)`; errors.push(msg); }
        else if (agoMin > 120) { st = 'WARNING'; msg = `${modeKey} 최종 기록 ${agoMin}분 전 (2시간+ 지연)`; warnings.push(msg); }
        else { msg = `${modeKey} 최종 기록 ${agoMin}분 전`; }
      }
      if (modeKey === 'GEMINI') { srGeminiStatus = st; srGeminiMsg = msg; }
      else if (modeKey === 'AIS_ONLY') { srAisStatus = st; srAisMsg = msg; }
      else { srHybridStatus = st; srHybridMsg = msg; }
    }

    const modeCounts = await queries.all(
      "SELECT engine_mode, COUNT(*) as cnt FROM ais_training_data WHERE evaluation_status = 'LABELED' GROUP BY engine_mode"
    );
    const countMap = {};
    for (const r of modeCounts) countMap[r.engine_mode] = r.cnt;
    const insufficientModes = modeChecks.filter(m => (countMap[m] || 0) < 50);
    if (insufficientModes.length >= 2) {
      srDataStatus = 'ERROR'; srDataMsg = `${insufficientModes.join(', ')} 모드 데이터 50건 미달`; errors.push(srDataMsg);
    } else if (insufficientModes.length === 1) {
      srDataStatus = 'WARNING'; srDataMsg = `${insufficientModes[0]} 모드 데이터 50건 미달`; warnings.push(srDataMsg);
    } else {
      srDataMsg = `모든 모드 LABELED 데이터 50건+ 확보 (GEMINI: ${countMap['GEMINI']||0}, AIS: ${countMap['AIS_ONLY']||0}, HYBRID: ${countMap['HYBRID_COOP']||0})`;
    }

    const lastTrain = await queries.get("SELECT value FROM platform_settings WHERE key = 'ais_last_trained_at'");
    if (lastTrain && lastTrain.value) {
      const hoursAgo = (Date.now() - new Date(lastTrain.value).getTime()) / (1000 * 60 * 60);
      if (hoursAgo > 48) { srTrainStatus = 'ERROR'; srTrainMsg = `마지막 학습 ${Math.round(hoursAgo)}시간 전 (48시간+ 중단)`; errors.push(srTrainMsg); }
      else if (hoursAgo > 36) { srTrainStatus = 'WARNING'; srTrainMsg = `마지막 학습 ${Math.round(hoursAgo)}시간 전 (36시간+ 지연)`; warnings.push(srTrainMsg); }
      else { srTrainMsg = `마지막 학습 ${Math.round(hoursAgo)}시간 전`; }
    } else {
      srTrainStatus = 'WARNING'; srTrainMsg = '학습 이력 없음'; warnings.push(srTrainMsg);
    }
  } catch (srErr) {
    console.error('Shadow Racing 진단 오류:', srErr.message);
  }


  const diagnostics = [
    { name: "API 관문 및 어드민 코어", status: apiStatus, percentage: apiStatus === "OK" ? 100 : (apiStatus === "WARNING" ? 50 : 0), details: apiDetails },
    { name: "AI 실거래 매매 집행기", status: traderStatus, percentage: traderStatus === "OK" ? 100 : (traderStatus === "WARNING" ? 50 : 0), details: traderDetails },
    { name: "AI 유전자 진화 엔진", status: evolutionStatus, percentage: evolutionStatus === "OK" ? 100 : (evolutionStatus === "WARNING" ? 50 : 0), details: evolutionDetails },
    { name: "AI 이상 변이 사전 필터 (AI-VEP)", status: vepStatus, percentage: vepStatus === "OK" ? 100 : 0, details: vepDetails },
    { name: "보조지표 수학 가공기", status: featuresStatus, percentage: featuresStatus === "OK" ? 100 : 0, details: featuresDetails },
    { name: "의회 진단 및 건강 분석기", status: councilStatus, percentage: councilStatus === "OK" ? 100 : (councilStatus === "WARNING" ? 50 : 0), details: councilDetails },
    { name: "프론트엔드 UI 대시보드", status: frontendStatus, percentage: frontendStatus === "OK" ? 100 : (frontendStatus === "WARNING" ? 50 : 0), details: frontendDetails },
    { name: "영구 데이터베이스", status: dbStatus, percentage: dbStatus === "OK" ? 100 : 0, details: dbDetails },
    { name: "의회 스케줄러 동작 무결성", status: schedulerStatus, percentage: schedulerStatus === "OK" ? 100 : (schedulerStatus === "WARNING" ? 50 : 0), details: schedulerMsg },
    

    { name: "Gate.io API 실시간 잔고", status: gateioApiStatus, percentage: gateioApiStatus === "OK" ? 100 : (gateioApiStatus === "WARNING" ? 50 : 0), details: gateioApiMsg },
    { name: "Web3 가스비 잔액 (POL)", status: web3Status, percentage: web3Status === "OK" ? 100 : (web3Status === "WARNING" ? 50 : 0), details: web3Msg },
    { name: "서버 물리 자원 & 디스크", status: systemStatus, percentage: systemStatus === "OK" ? 100 : (systemStatus === "WARNING" ? 50 : 0), details: systemMsg },
    { name: "학습 데이터 유입 속도", status: pipelineStatus, percentage: pipelineStatus === "OK" ? 100 : (pipelineStatus === "WARNING" ? 50 : 0), details: pipelineMsg },
    { name: "Gemini API 호출 속도", status: geminiStatus, percentage: geminiStatus === "OK" ? 100 : (geminiStatus === "WARNING" ? 50 : 0), details: geminiMsg },
    

    { name: "PM2 프로세스 생존성", status: pm2Status, percentage: pm2Status === "OK" ? 100 : (pm2Status === "WARNING" ? 50 : 0), details: pm2Msg },
    { name: "외부 망 레이턴시 벤치마크", status: networkStatus, percentage: networkStatus === "OK" ? 100 : (networkStatus === "WARNING" ? 50 : 0), details: networkMsg },
    { name: "SQLite3 DB I/O 속도", status: dbPerfStatus, percentage: dbPerfStatus === "OK" ? 100 : (dbPerfStatus === "WARNING" ? 50 : 0), details: dbPerfMsg },
    { name: "의회 Faction 쏠림 (HHI)", status: hhiStatus, percentage: hhiStatus === "OK" ? 100 : (hhiStatus === "WARNING" ? 50 : 0), details: hhiMsg },
    { name: "SSL 인증서 보안 검증", status: sslStatus, percentage: sslStatus === "OK" ? 100 : (sslStatus === "WARNING" ? 50 : 0), details: sslMsg },
    

    { name: "AI 의회 투표 활성도", status: votingStatus, percentage: votingStatus === "OK" ? 100 : (votingStatus === "WARNING" ? 50 : 0), details: votingMsg },
    { name: "AiS 총선 정기 실행", status: electionStatus, percentage: electionStatus === "OK" ? 100 : (electionStatus === "WARNING" ? 50 : 0), details: electionMsg },
    { name: "500인 후보군 풀 정족수", status: poolStatus, percentage: poolStatus === "OK" ? 100 : (poolStatus === "WARNING" ? 50 : 0), details: poolMsg },
    { name: "11인 의원 정족수", status: quorumStatus, percentage: quorumStatus === "OK" ? 100 : (quorumStatus === "WARNING" ? 50 : 0), details: quorumMsg },
    { name: "도태·생성 사이클 건전성", status: cycleStatus, percentage: cycleStatus === "OK" ? 100 : (cycleStatus === "WARNING" ? 50 : 0), details: cycleMsg },
    { name: "Faction 미할당(NULL) 오염", status: nullFactionStatus, percentage: nullFactionStatus === "OK" ? 100 : 0, details: nullFactionMsg },
    { name: "DNA/Phenotype 누락 검사", status: dnaIntegrityStatus, percentage: dnaIntegrityStatus === "OK" ? 100 : 0, details: dnaIntegrityMsg },
    { name: "가중치 벡터 형태 검증", status: weightsShapeStatus, percentage: weightsShapeStatus === "OK" ? 100 : 0, details: weightsShapeMsg },
    { name: "Gemini API Key 설정 상태", status: apiKeyCheckStatus, percentage: apiKeyCheckStatus === "OK" ? 100 : 0, details: apiKeyCheckMsg },
    { name: "엔진↔승격 정합성 검증", status: enginePromoStatus, percentage: enginePromoStatus === "OK" ? 100 : (enginePromoStatus === "WARNING" ? 50 : 0), details: enginePromoMsg },
    { name: "학습 데이터 라벨링 적체", status: labelStatus, percentage: labelStatus === "OK" ? 100 : (labelStatus === "WARNING" ? 50 : 0), details: labelMsg },


    { name: "Gemini 매매 분석 정상 가동", status: srGeminiStatus, percentage: srGeminiStatus === "OK" ? 100 : (srGeminiStatus === "WARNING" ? 50 : 0), details: srGeminiMsg },
    { name: "AiS 의회 매매 분석 정상 가동", status: srAisStatus, percentage: srAisStatus === "OK" ? 100 : (srAisStatus === "WARNING" ? 50 : 0), details: srAisMsg },
    { name: "Hybrid 합의 분석 정상 가동", status: srHybridStatus, percentage: srHybridStatus === "OK" ? 100 : (srHybridStatus === "WARNING" ? 50 : 0), details: srHybridMsg },
    { name: "모드별 적중률 데이터 충분성", status: srDataStatus, percentage: srDataStatus === "OK" ? 100 : (srDataStatus === "WARNING" ? 50 : 0), details: srDataMsg },
    { name: "AiS 진화 학습 정기 실행", status: srTrainStatus, percentage: srTrainStatus === "OK" ? 100 : (srTrainStatus === "WARNING" ? 50 : 0), details: srTrainMsg }
  ];

  return {
    success: true,
    diagnostics,
    details,
    overallStatus,
    errors,
    warnings,
    timestamp: new Date().toISOString()
  };
}



router.get('/diagnostics', async (req, res) => {
  try {
    const result = await performSystemDiagnostics(false);
    res.json(result);
  } catch (err) {
    console.error("Fetch diagnostics error:", err);
    res.status(500).json({ error: "Failed to fetch system diagnostics" });
  }
});


router.post('/run-diagnostics', async (req, res) => {
  try {
    const result = await performSystemDiagnostics(true);
    res.json(result);
  } catch (err) {
    console.error("Run diagnostics error:", err);
    res.status(500).json({ error: "Failed to run system diagnostics" });
  }
});

module.exports = router;
module.exports.__private__ = {
  DEFAULT_AIDL_POLICY_CONFIG,
  DEFAULT_GEMINI_TIMEOUT_MS,
  normalizeAidlPolicyValue,
  normalizeAidlPolicyConfig,
  normalizeGeminiTimeoutMs,
  buildAidlPolicyConfig,
  buildGeminiTimeoutConfig,
  buildPhenotypeFromDnaForAdmin,
  applyAidlGeneStateOverride,
  applyAidlGeneContextOverride,
  performSystemDiagnostics,
};
