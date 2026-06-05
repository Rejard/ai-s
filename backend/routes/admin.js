const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { ethers } = require('ethers');

// Fix platform's first Master Manager wallet
const MASTER_MANAGER_WALLET = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

// Configure Polygon RPC and SUT token information
const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
const sutAddress = '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
const sutAbi = ["function balanceOf(address account) external view returns (uint256)"];
const sutContract = new ethers.Contract(sutAddress, sutAbi, provider);

// 🌟 Multicall3 contract setup (To query large amounts of SUT on-chain balances for 500+ people in a single communication within 0.1 seconds)
const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const multicallAbi = [
  "function aggregate(tuple(address target, bytes callData)[] calls) external view returns (uint256 blockNumber, bytes[] returnData)"
];
const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, provider);
const sutInterface = new ethers.Interface([
  "function balanceOf(address account) external view returns (uint256)"
]);

// Admin permission verification strict middleware
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

/**
 * @route GET /api/admin/managers
 * @desc Retrieve list of all Managers and their performance status (Includes on-chain real-time balance lookup)
 */
router.get('/managers', async (req, res) => {
  try {
    // 1. Retrieve all Managers where is_manager = 1 from the users table
    const managers = await queries.all(`
      SELECT id, wallet_address, email, name, phone, country, joined_at
      FROM users
      WHERE is_manager = 1
      ORDER BY joined_at ASC
    `);

    // 2. Parallel computation of performance and on-chain balance for each Manager
    const enrichedManagers = await Promise.all(managers.map(async (m) => {
      // 2-1. Count the number of affiliated Approved Users (only members with status APPROVED)
      const subUsersRow = await queries.get(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE LOWER(manager_address) = LOWER(?) AND status = 'APPROVED'
      `, [m.wallet_address]);
      const userCount = subUsersRow ? subUsersRow.count : 0;

      // 2-2. Compute the total actual on-chain SUT balance of affiliated members (0.1-second single block batch query technique using Multicall3)
      const subUsers = await queries.all(`
        SELECT wallet_address 
        FROM users 
        WHERE LOWER(manager_address) = LOWER(?) AND status = 'APPROVED'
      `, [m.wallet_address]);

      let performance = 0;
      if (subUsers && subUsers.length > 0) {
        try {
          // Build Multicall3 Call Data struct
          const calls = subUsers.map(u => ({
            target: sutAddress,
            callData: sutInterface.encodeFunctionData("balanceOf", [u.wallet_address])
          }));

          // Query SUT token balances of 500 wallets at once in a single JSON-RPC call (0.1 second)
          const [blockNumber, returnData] = await multicallContract.aggregate(calls);
          
          // Parse and sum result byte data
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

      // 2-3. Query actual SUT on-chain wallet balance (Polygon Network)
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

/**
 * @route POST /api/admin/promote-manager
 * @desc Promote an existing member to Manager
 */
router.post('/promote-manager', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '지갑 주소가 누락되었습니다.' });
  }

  const cleanWallet = walletAddress.trim();

  try {
    // 1. Verify if the target member exists and is in Approved User (APPROVED) status
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

    // 2. Promote to Manager and remove existing referrer Manager wallet mapping (establish independent system)
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

/**
 * @route POST /api/admin/delete-manager
 * @desc Permanently delete Manager account and forcibly transfer subordinate affiliated members to Master Manager
 */
router.post('/delete-manager', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, message: '삭제할 매니저의 지갑 주소가 누락되었습니다.' });
  }

  const cleanWallet = walletAddress.trim();

  // The initial Master Manager is the Admin and top-level wallet, so it can never be deleted
  if (cleanWallet.toLowerCase() === MASTER_MANAGER_WALLET.toLowerCase()) {
    return res.status(400).json({ success: false, message: '경고: 최초 마스터 매니저 지갑 계정은 관리 목적상 삭제가 불가능합니다.' });
  }

  try {
    // 1. Verify if the Manager exists
    const user = await queries.get("SELECT id, is_manager FROM users WHERE wallet_address = ?", [cleanWallet]);
    if (!user || user.is_manager !== 1) {
      return res.status(404).json({ success: false, message: '해당 매니저 계정을 찾을 수 없거나 이미 강등/삭제되었습니다.' });
    }

    // 2. Forcibly transfer the manager_address of all members affiliated under that Manager to the Master Manager wallet address
    const migrateRes = await queries.run(`
      UPDATE users
      SET manager_address = ?
      WHERE manager_address = ?
    `, [MASTER_MANAGER_WALLET, cleanWallet]);

    console.log(`[Admin Account Cleanup] Migrated ${migrateRes.changes} users under ${cleanWallet} to Master Manager ${MASTER_MANAGER_WALLET}.`);

    // 3. The Manager's ledger payment (payments) history is also deleted for data integrity
    await queries.run("DELETE FROM payments WHERE wallet_address = ?", [cleanWallet]);

    // 4. Permanently delete the Manager account from the users table (demotion is not supported)
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

/**
 * @route POST /api/admin/save-ai-config
 * @desc Permanently save Global AI model information and Gemini API Key to server DB
 */
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

/**
 * @route GET /api/admin/ai-config
 * @desc Query Global AI model name and API Key registration status
 */
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

module.exports = router;
