const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { ethers } = require('ethers');

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
  const adminEmail = req.headers['x-admin-email'] || req.headers['x-manager-email'];
  if (!adminEmail || adminEmail.toLowerCase().trim() !== 'lemaiiisk@gmail.com'.toLowerCase()) {
    return res.status(403).json({
      success: false,
      message: '보안 경보: 관리자 권한이 존재하지 않습니다. 어드민 이메일(lemaiiisk@gmail.com)로 연동해 주십시오.'
    });
  }
  next();
};

// Mount security middleware on all Admin-specific API routes
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

    const user = await queries.get("SELECT id, status, is_manager FROM users WHERE wallet_address = ?", [cleanWallet]);
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
          manager_address = 'none'
      WHERE wallet_address = ?
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

    // 3. The Manager's ledger payment (payments) history is also deleted for data integrity
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
  const { model, apiKey, interval } = req.body;
  try {
    if (model) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_model', ?)`, [model.trim()]);
    if (apiKey) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_gemini_api_key', ?)`, [apiKey.trim()]);
    if (interval) await queries.run(`INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_ai_interval', ?)`, [interval.toString()]);

    res.json({ success: true, message: '글로벌 AI 두뇌 및 API Key 설정이 서버 DB에 안전하게 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ai-config', async (req, res) => {
  try {
    const settings = await queries.all("SELECT key, value FROM platform_settings WHERE key IN ('global_ai_model', 'global_gemini_api_key', 'global_ai_interval')");
    const config = {
      model: 'Gemini 3.5 Flash',
      hasApiKey: false,
      apiKey: '',
      interval: '5'
    };

    settings.forEach(s => {
      if (s.key === 'global_ai_model') config.model = s.value;
      if (s.key === 'global_gemini_api_key' && s.value) {
        config.hasApiKey = true;
        config.apiKey = s.value;
      }
      if (s.key === 'global_ai_interval') config.interval = s.value;
    });

    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/admin/ai-engine
 * @desc Get global AI engine switching mode
 */
router.get('/ai-engine', async (req, res) => {
  try {
    const row = await queries.get("SELECT value FROM platform_settings WHERE key = 'global_ai_engine'");
    const engineMode = row ? row.value : 'GEMINI_ONLY';
    res.json({ success: true, engineMode });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/admin/save-ai-engine
 * @desc Save global AI engine switching mode
 */
router.post('/save-ai-engine', async (req, res) => {
  const { engineMode } = req.body;
  const validModes = ['GEMINI_ONLY', 'GEMINI_AIS_SHADOW', 'AIS_ONLY', 'HYBRID_COOP'];
  if (!engineMode || !validModes.includes(engineMode)) {
    return res.status(400).json({ success: false, message: '올바르지 않은 AI 구동 모드 선택입니다.' });
  }
  try {
    await queries.run(`
      INSERT INTO platform_settings (key, value)
      VALUES ('global_ai_engine', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `, [engineMode]);
    res.json({ success: true, message: `🎉 글로벌 AI 작동 엔진이 성공적으로 [${engineMode}] 모드로 저장되었습니다.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/admin/training-stats
 * @desc Retrieve total count of records in ais_training_data
 */
router.get('/training-stats', async (req, res) => {
  try {
    const row = await queries.get("SELECT COUNT(*) as total FROM ais_training_data");
    const count = row ? row.total : 0;

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
      count,
      lastTrainedAt,
      modelAccuracy
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/admin/export-training-csv
 * @desc Export SQLite ais_training_data to fully compliant RFC 4180 CSV file
 */
router.get('/export-training-csv', async (req, res) => {
  try {
    const rows = await queries.all(`
      SELECT timestamp, current_price, price_change_ratio, rsi_14, sma_5, sma_20,
             gemini_decision, gemini_proposed_price, gemini_amount_ratio, gemini_reason,
             next_price_5m, realized_price_change, is_correct_decision
      FROM ais_training_data
      ORDER BY id ASC
    `);

    // Build CSV compliant header and body rows
    const header = 'timestamp,current_price,price_change_ratio,rsi_14,sma_5,sma_20,gemini_decision,gemini_proposed_price,gemini_amount_ratio,gemini_reason,next_price_5m,realized_price_change,is_correct_decision\n';
    
    let csvContent = header;
    rows.forEach(r => {
      // Escape reasons containing quotes or newlines to prevent parsing crashes in ML packages
      const escapedReason = String(r.gemini_reason || '')
        .replace(/"/g, '""')
        .replace(/\r?\n|\r/g, ' ');
      
      const line = `"${r.timestamp}",${r.current_price},${r.price_change_ratio},${r.rsi_14},${r.sma_5},${r.sma_20},"${r.gemini_decision}",${r.gemini_proposed_price},${r.gemini_amount_ratio},"${escapedReason}",${r.next_price_5m},${r.realized_price_change},${r.is_correct_decision}\n`;
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

module.exports = router;
