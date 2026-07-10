const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { queries } = require('../database');
const { toKstDateString } = require('../timeUtil');
const { getGateIoBalances, createGateIoOrder, getGateIoMyTrades, getGateIoOpenOrders, cancelGateIoOrder, getGateIoDeposits, getGateIoWithdrawals } = require('../gateioHelper');
const { decryptText, encryptText } = require('../secureCredentials');
const { generateLedgerPdf } = require('../pdfGenerator');
const { requireAuthenticatedSession } = require('../authSession');
const { tempUploadDir } = require('../idCardHelper');
const {
  getManagerAccount,
  getManagedUser,
  getManagedWithdrawal,
} = require('../managerOrganization');



router.use((req, res, next) => {
  if (req.path.includes('/download-id-card')) {
    console.log(`[MANAGER ROUTER] Request received: ${req.method} ${req.path}`);
  }
  next();
});

const getRequestManagerEmail = (req) => req.authEmail || '';

const managerAuthMiddleware = async (req, res, next) => {
  const managerEmail = getRequestManagerEmail(req);
  console.log(`[MANAGER AUTH] Path: ${req.path}, Email extracted: ${managerEmail}`);
  if (!managerEmail) {
    console.log(`[MANAGER AUTH] Blocked: No email`);
    return res.status(403).json({
      success: false,
      message: '매니저 이메일 인증 정보가 없습니다.'
    });
  }

  try {
    const manager = await getManagerAccount(queries, managerEmail);
    if (!manager) {
      console.log(`[MANAGER AUTH] Blocked: No manager account for ${managerEmail}`);
      return res.status(403).json({
        success: false,
        message: '매니저 권한이 존재하지 않습니다.'
      });
    }
    req.managerEmail = manager.email.toLowerCase().trim();
    req.managerWallet = manager.wallet_address;
    console.log(`[MANAGER AUTH] Success for ${managerEmail}, Wallet: ${req.managerWallet}`);
    next();
  } catch (err) {
    console.log(`[MANAGER AUTH] Error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};


router.use(requireAuthenticatedSession);
router.use(managerAuthMiddleware);

const isMaskedCredential = (value) => {
  return typeof value === 'string' && value.includes('******');
};

const resolveGateIoCredentials = async (req, store = queries) => {
  let apiKey = req.headers['x-gateio-api-key'];
  let apiSecret = req.headers['x-gateio-api-secret'];
  const managerEmail = req.managerEmail || getRequestManagerEmail(req);

  if (!apiKey || !apiSecret || isMaskedCredential(apiKey) || isMaskedCredential(apiSecret)) {
    const row = await store.get(
      "SELECT encrypted_api_key, encrypted_api_secret FROM manager_gateio_credentials WHERE LOWER(manager_email) = LOWER(?)",
      [managerEmail]
    );
    if (row) {
      apiKey = decryptText(row.encrypted_api_key);
      apiSecret = decryptText(row.encrypted_api_secret);
    }
  }

  return { apiKey, apiSecret };
};

router.get('/gateio-balance', async (req, res) => {
  try {
    const { apiKey, apiSecret } = await resolveGateIoCredentials(req);
    const balanceRes = await getGateIoBalances(apiKey, apiSecret);
    res.json(balanceRes);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/download-id-card/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await queries.get(
      "SELECT id, wallet_address, name, id_card_path, manager_address FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      console.log(`[KYC DOWNLOAD-ONCE] User ${userId} not found`);
      return res.status(404).json({ success: false, message: '해당 가입 신청 회원을 찾을 수 없습니다.' });
    }

    const isMaster = req.managerWallet.toLowerCase() === '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'.toLowerCase();
    

    if (!user.manager_address) {
       console.log(`[KYC DOWNLOAD-ONCE] User ${userId} has no manager_address in DB`);
       return res.status(403).json({ success: false, message: '권한 경보: 본인 하위 지참 회원의 신분증 파일만 조회 가능합니다.' });
    }

    const isAssigned = user.manager_address.toLowerCase() === req.managerWallet.toLowerCase();

    if (!isMaster && !isAssigned) {
      console.log(`[KYC DOWNLOAD-ONCE] Auth failed: Master? ${isMaster}, Assigned? ${isAssigned}. User manager: ${user.manager_address}, Req manager: ${req.managerWallet}`);
      return res.status(403).json({ success: false, message: '권한 경보: 본인 하위 지참 회원의 신분증 파일만 조회 가능합니다.' });
    }

    if (!user.id_card_path) {
      console.log(`[KYC DOWNLOAD-ONCE] No id_card_path found for user ${userId}`);
      return res.status(404).json({ success: false, message: '이미 이관 및 삭제가 완료된 신분증 파일입니다.' });
    }

    const fileName = path.basename(user.id_card_path);
    const fullPath = path.join(tempUploadDir, fileName);

    console.log(`[KYC DOWNLOAD-ONCE] Request to download: ${fullPath}, exists: ${fs.existsSync(fullPath)}`);

    if (!fs.existsSync(fullPath)) {
      console.log(`[KYC DOWNLOAD-ONCE] File missing from disk!`);
      await queries.run("UPDATE users SET id_card_path = NULL WHERE id = ?", [userId]);
      return res.status(404).json({ success: false, message: '해당 신분증 파일이 서버에 존재하지 않습니다. 이미 정리되었을 수 있습니다.' });
    }

    const fileBuffer = fs.readFileSync(fullPath);
    try {
      fs.unlinkSync(fullPath);
    } catch (unlinkErr) {
      console.error(`[KYC DOWNLOAD-ONCE] Disk unlink failed for ${fullPath}:`, unlinkErr.message);
    }

    await queries.run("UPDATE users SET id_card_path = NULL WHERE id = ?", [userId]);

    const auditLogPath = path.resolve(__dirname, '../kyc_audit.log');
    const auditMsg = `[${new Date().toISOString()}] Manager: ${req.managerEmail} (${req.managerWallet}) downloaded and unlinked ID card for User ID: ${userId} (${user.wallet_address}, ${user.name})\n`;
    fs.appendFileSync(auditLogPath, auditMsg, 'utf8');

    console.log(`[KYC DOWNLOAD-ONCE] Read, unlinked from disk, and logged download audit: ${fullPath}`);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(fileBuffer);

  } catch (err) {
    console.error(`[KYC DOWNLOAD-ONCE] Exception!`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/pending-users', async (req, res) => {
  try {
    const pendingUsers = await queries.all(`
      SELECT id, wallet_address, email, name, phone, country, id_card_path, joined_at
      FROM users
      WHERE status = 'PENDING_KYC'
        AND LOWER(manager_address) = LOWER(?)
        AND COALESCE(is_manager, 0) = 0
      ORDER BY joined_at DESC
    `, [req.managerWallet]);
    res.json({ success: true, users: pendingUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const allUsers = await queries.all(`
      SELECT id, wallet_address, email, name, phone, country, status, joined_at, approved_at
      FROM users
      WHERE LOWER(manager_address) = LOWER(?)
        AND COALESCE(is_manager, 0) = 0
        AND status = 'APPROVED'
      ORDER BY joined_at DESC
    `, [req.managerWallet]);
    res.json({ success: true, users: allUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/approve-user', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: '이메일 주소가 누락되었습니다.' });
  }
  const cleanEmail = email.toLowerCase().trim();

  try {
    const user = await queries.get(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
      [cleanEmail, req.managerWallet]
    );
    if (!user) {
      return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
    }
    if (user.status === 'APPROVED') {
      return res.status(400).json({ success: false, message: '이미 승인된 회원입니다.' });
    }

    const countRow = await queries.get(
      "SELECT COUNT(*) as total FROM users WHERE status = 'APPROVED' AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
      [req.managerWallet]
    );
    const totalCount = countRow ? countRow.total : 0;
    if (totalCount >= 500) {
      return res.status(400).json({ success: false, message: '해당 매니저 하위의 1차 승인 제한 인원 500명이 이미 가득 찼습니다.' });
    }

    await queries.run(`
      UPDATE users
      SET status = 'APPROVED',
          approved_at = datetime('now')
      WHERE LOWER(email) = LOWER(?)
        AND LOWER(manager_address) = LOWER(?)
        AND COALESCE(is_manager, 0) = 0
    `, [cleanEmail, req.managerWallet]);

    res.json({
      success: true,
      message: '회원 KYC 및 가입이 정식으로 승인되었습니다. 지금부터 즉시 정회원으로 활동이 시작됩니다.'
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reject-user', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: '이메일 주소가 누락되었습니다.' });
  }
  const cleanEmail = email.toLowerCase().trim();

  try {
    const user = await queries.get(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
      [cleanEmail, req.managerWallet]
    );
    if (!user) {
      return res.status(404).json({ success: false, message: '회원을 찾을 수 없습니다.' });
    }

    await queries.run(
      "UPDATE users SET status = 'REJECTED' WHERE LOWER(email) = LOWER(?) AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
      [cleanEmail, req.managerWallet]
    );
    res.json({ success: true, message: '회원의 가입 신청이 성공적으로 반려되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {

    const approvedCountRow = await queries.get(
      "SELECT COUNT(*) as total FROM users WHERE status = 'APPROVED' AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
      [req.managerWallet]
    );
    const pendingCountRow = await queries.get(
      "SELECT COUNT(*) as total FROM users WHERE status = 'PENDING_KYC' AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
      [req.managerWallet]
    );

    const paymentStats = await queries.get(`
      SELECT
        COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'AI_PROFIT') THEN amount ELSE 0 END), 0) as totalRevenue,
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0) as totalDeposited,
        COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0) as totalDistributed
      FROM ledger l
      JOIN users u ON LOWER(l.wallet_address) = LOWER(u.wallet_address)
      WHERE l.manager_address = ? AND u.is_manager = 0
    `, [req.managerWallet]);

    const managerSelfPaymentStats = await queries.get(`
      SELECT COALESCE(SUM(amount), 0) as totalDeposited
      FROM ledger
      WHERE LOWER(wallet_address) = LOWER(?) AND type = 'DEPOSIT'
    `, [req.managerWallet]);

    const totalRevenue = paymentStats.totalRevenue || 0;
    const totalDeposited = paymentStats.totalDeposited || 0;
    const totalDistributed = paymentStats.totalDistributed || 0;
    const managerSelfDeposited = managerSelfPaymentStats.totalDeposited || 0;
    const companyRevenue = totalRevenue - totalDistributed;

    const recentPayments = await queries.all(`
      SELECT l.id, l.wallet_address, u.name, l.amount, l.type, l.tx_hash, l.created_at
      FROM ledger l
      JOIN users u ON LOWER(l.wallet_address) = LOWER(u.wallet_address)
      WHERE l.manager_address = ?
        AND u.is_manager = 0
      ORDER BY l.created_at DESC
      LIMIT 10
    `, [req.managerWallet]);

    const managerRecentPayments = await queries.all(`
      SELECT l.id, l.wallet_address, u.name, l.amount, l.type, l.tx_hash, l.created_at
      FROM ledger l
      JOIN users u ON LOWER(l.wallet_address) = LOWER(u.wallet_address)
      WHERE LOWER(l.wallet_address) = LOWER(?)
        AND l.type = 'DEPOSIT'
        AND COALESCE(u.is_manager, 0) = 1
      ORDER BY l.created_at DESC
      LIMIT 10
    `, [req.managerWallet]);

    res.json({
      success: true,
      stats: {
        totalApproved: approvedCountRow ? approvedCountRow.total : 0,
        totalPending: pendingCountRow ? pendingCountRow.total : 0,
        limit: 500,
        totalRevenue,
        totalDeposited,
        totalDistributed,
        managerSelfDeposited,
        companyRevenue
      },
      recentPayments,
      managerRecentPayments
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/update-user', async (req, res) => {
  const {
    targetEmail,
    targetWalletAddress,
    walletAddress,
    email,
    name,
    phone,
    country,
    status
  } = req.body;

  if (!email || !name || !phone || !country || !status) {
    return res.status(400).json({ success: false, message: '모든 필수 수정 필드를 올바르게 기입해 주십시오.' });
  }

  const cleanTargetEmail = String(targetEmail || email).trim().toLowerCase();
  const cleanTargetWallet = targetWalletAddress ? targetWalletAddress.trim() : '';
  const cleanNewWallet = walletAddress ? walletAddress.trim() : '';

  try {
    let user = null;
    if (cleanTargetEmail) {
      user = await queries.get(
        "SELECT * FROM users WHERE LOWER(email) = ? AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
        [cleanTargetEmail, req.managerWallet]
      );
    }
    if (!user && cleanTargetWallet) {
      user = await queries.get(
        "SELECT * FROM users WHERE LOWER(wallet_address) = LOWER(?) AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
        [cleanTargetWallet, req.managerWallet]
      );
    }

    if (!user) {
      return res.status(404).json({ success: false, message: '수정할 회원을 찾을 수 없습니다.' });
    }

    if (cleanNewWallet && cleanNewWallet.toLowerCase() !== 'none' && cleanNewWallet !== user.wallet_address) {
      const duplicateUser = await queries.get(
        "SELECT id FROM users WHERE LOWER(wallet_address) = LOWER(?) AND id != ?",
        [cleanNewWallet, user.id]
      );
      if (duplicateUser) {
        return res.status(400).json({ success: false, message: '변경하려는 지갑 주소는 이미 등록된 타 회원의 지갑 주소입니다.' });
      }
    }

    if (user.wallet_address && cleanNewWallet && user.wallet_address !== cleanNewWallet) {
      await queries.run(
        "UPDATE ledger SET wallet_address = ? WHERE LOWER(wallet_address) = LOWER(?)",
        [cleanNewWallet, user.wallet_address]
      );
    }

    await queries.run(`
      UPDATE users
      SET wallet_address = ?,
          email = ?,
          name = ?,
          phone = ?,
          country = ?,
          status = ?
      WHERE id = ?
    `, [
      cleanNewWallet || null,
      email.toLowerCase().trim(),
      name,
      phone,
      country,
      status,
      user.id
    ]);

    res.json({ success: true, message: '회원 상세 정보가 완벽하게 수정 반영되었습니다!' });

  } catch (err) {
    console.error('❌ 회원 정보 수정 API 오류:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/withdrawals', async (req, res) => {
  try {
    const withdrawals = await queries.all(`
      SELECT wr.id, wr.wallet_address, wr.amount as requested_amount, wr.status, wr.created_at, u.name
      FROM withdrawal_requests wr
      JOIN users u ON LOWER(wr.wallet_address) = LOWER(u.wallet_address)
      WHERE wr.status = 'PENDING'
        AND LOWER(wr.manager_address) = LOWER(?)
        AND COALESCE(u.is_manager, 0) = 0
      ORDER BY wr.created_at DESC
    `, [req.managerWallet]);
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/withdrawals/:id/approve', async (req, res) => {
  const { id } = req.params;
  try {
    const request = await queries.get(
      "SELECT * FROM withdrawal_requests WHERE id = ? AND status = 'PENDING'",
      [id]
    );
    if (!request) return res.status(404).json({ success: false, message: '유효한 출금 요청을 찾을 수 없습니다.' });

    await queries.run(
      "UPDATE withdrawal_requests SET status = 'APPROVED', processed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );

    const ledgerResult = await queries.run(`
      INSERT INTO ledger (manager_address, wallet_address, type, amount, tx_hash, description, verified)
      VALUES (?, ?, 'WITHDRAWAL', ?, ?, 'Manager approved withdrawal', 0)
    `, [request.manager_address, request.wallet_address, request.amount, '0xPendingPayout_' + id]);

    if (ledgerResult && ledgerResult.lastID) {
      await queries.run(
        "UPDATE withdrawal_requests SET ledger_id = ? WHERE id = ?",
        [ledgerResult.lastID, id]
      );
    }

    res.json({
      success: true,
      message: `지급 완료! 장부에서 회원이 신청한 ${request.amount} SUT가 정상적으로 차감(소멸)되었습니다.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/withdrawals/:id/reject', async (req, res) => {
  const { id } = req.params;
  try {
    const request = await queries.get(
      "SELECT * FROM withdrawal_requests WHERE id = ? AND status = 'PENDING' AND LOWER(manager_address) = LOWER(?)",
      [id, req.managerWallet]
    );
    if (!request) return res.status(404).json({ success: false, message: '유효한 출금 요청을 찾을 수 없습니다.' });

    await queries.run(
      "UPDATE withdrawal_requests SET status = 'REJECTED', processed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: '출금(지급) 요청이 정상적으로 반려(거부) 처리되었습니다.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/manual-adjustment', async (req, res) => {
  const { targetWallet, amount, description } = req.body;

  if (!targetWallet || amount === undefined) {
    return res.status(400).json({ success: false, message: '지갑 주소와 금액을 정확히 입력해주세요.' });
  }

  try {
    const cleanWallet = targetWallet.toLowerCase().trim();
    const user = await getManagedUser(queries, req.managerWallet, cleanWallet);
    if (!user) {
      return res.status(403).json({ success: false, message: '해당 회원은 이 매니저의 조직에 속하지 않습니다.' });
    }

    await queries.run(`
      INSERT INTO ledger (manager_address, wallet_address, type, amount, description, verified)
      VALUES (?, ?, 'ADJUSTMENT', ?, 'Manual adjustment by manager', 0)
    `, [req.managerWallet, cleanWallet, parseFloat(amount)]);

    res.json({ success: true, message: `해당 회원의 장부에 ${amount} SUT 변동이 성공적으로 기록되었습니다.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


router.post('/trigger-ai-profit', async (req, res) => {
  const { profitPercentage } = req.body;

  if (!profitPercentage || isNaN(parseFloat(profitPercentage))) {
    return res.status(400).json({ success: false, message: '올바른 수익률(%) 값을 입력해 주세요.' });
  }

  const percent = parseFloat(profitPercentage) / 100;

  try {

    const activeUsers = await queries.all(
      "SELECT wallet_address FROM users WHERE status = 'APPROVED' AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
      [req.managerWallet]
    );

    if (activeUsers.length === 0) {
      return res.json({ success: true, message: '현재 수익을 배분할 정회원이 없습니다.' });
    }

    let totalDistributedSut = 0;

    for (const user of activeUsers) {

      const balanceRow = await queries.get(`
        SELECT
          COALESCE(SUM(CASE WHEN type IN ('DEPOSIT', 'AI_PROFIT') THEN amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN type = 'ADJUSTMENT' THEN amount ELSE 0 END), 0)
        as currentBalance
        FROM ledger
        WHERE LOWER(wallet_address) = LOWER(?)
      `, [user.wallet_address]);

      const currentBalance = balanceRow && balanceRow.currentBalance ? balanceRow.currentBalance : 0;

      const baseInvested = currentBalance > 0 ? currentBalance : 1000.0;
      const profitSut = baseInvested * percent;

      if (profitSut > 0) {

        await queries.run(`
          INSERT INTO ledger (manager_address, wallet_address, type, amount, tx_hash, description, verified)
          VALUES (?, ?, 'AI_PROFIT', ?, ?, 'AI trading profit distribution', 0)
        `, [req.managerWallet, user.wallet_address, profitSut, `0xAIProfit_${Date.now()}`]);
        totalDistributedSut += profitSut;
      }
    }

    let orderResultMsg = '';
    try {
      const { apiKey, apiSecret } = await resolveGateIoCredentials(req);
      const balanceCheck = await getGateIoBalances(apiKey, apiSecret);
      if (balanceCheck.success && balanceCheck.balances.SUT >= 0.1) {
        const mockPrice = 0.19;
        console.log(`[CEX REAL ORDER] Placing real sell order on Gate.io. SUT Price: $${mockPrice}`);

        const orderRes = await createGateIoOrder(apiKey, apiSecret, 'sell', '0.1', mockPrice);
        if (orderRes.success) {
          orderResultMsg = `\n[Gate.io 실거래 연동] 실제 0.1 SUT 매도 주문이 거래소에 접수되었습니다. (주문 ID: ${orderRes.data.id})`;
          console.log("Gate.io 주문 생성 성공:", orderRes.data);
        } else {
          orderResultMsg = `\n[Gate.io 실거래 에러] 주문 전송 실패: ${orderRes.message}`;
        }
      } else if (balanceCheck.code === 'KEY_NOT_CONFIGURED') {
        orderResultMsg = `\n[Gate.io 실거래 미가동] API Key가 설정되지 않아 가상 장부 정산만 수행되었습니다.`;
      } else {
        orderResultMsg = `\n[Gate.io 실거래 미가동] 거래소 SUT 가용 잔고 부족 (0.1 SUT 미만)`;
      }
    } catch (orderErr) {
      console.error("Gate.io 주문 연동 오류:", orderErr.message);
      orderResultMsg = `\n[Gate.io 연동 오류] ${orderErr.message}`;
    }

    res.json({
      success: true,
      message: `성공! 전체 ${activeUsers.length}명의 정회원에게 총 ${totalDistributedSut.toFixed(2)} SUT의 AI 트레이딩 수익이 분배되었습니다.${orderResultMsg}`
    });
  } catch (err) {
    console.error("AI Profit 분배 오류:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ai-settings', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const managerEmail = req.managerEmail;
    const row = await queries.get(
      "SELECT * FROM manager_ai_settings WHERE LOWER(manager_email) = LOWER(?)",
      [managerEmail]
    );
    const credentials = await queries.get(
      "SELECT deposit_address FROM manager_gateio_credentials WHERE LOWER(manager_email) = LOWER(?)",
      [managerEmail]
    );
    const config = {
      ai_grid_status: 'OFF',
      ai_grid_lower: '0.15',
      ai_grid_upper: '0.30',
      ai_grid_auto_range: 'OFF',
      ai_grid_count: '5',
      ai_grid_frequency: '5',
      hasApiKey: !!credentials,
      hasApiSecret: !!credentials,
      hasDepositAddress: !!(credentials && credentials.deposit_address)
    };

    if (row) {
      config.ai_grid_status = row.ai_grid_status;
      config.ai_grid_lower = row.ai_grid_lower;
      config.ai_grid_upper = row.ai_grid_upper;
      config.ai_grid_auto_range = row.ai_grid_auto_range || 'OFF';
      config.ai_grid_count = row.ai_grid_count;
      config.ai_grid_frequency = row.ai_grid_frequency;
    }

    res.json({ success: true, settings: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ai-settings', async (req, res) => {
  console.log('[DEBUG /ai-settings POST] req.body:', req.body);
  const { status, lower, upper, count, frequency, autoRange } = req.body;
  try {
    const managerEmail = req.managerEmail;
    const current = await queries.get(
      "SELECT * FROM manager_ai_settings WHERE LOWER(manager_email) = LOWER(?)",
      [managerEmail]
    );
    const isValid = (val) => val !== undefined && val !== null && String(val).trim() !== '';
    const next = {
      status: isValid(status) ? status : (current ? current.ai_grid_status : 'OFF'),
      lower: isValid(lower) ? lower : (current ? current.ai_grid_lower : '0.15'),
      upper: isValid(upper) ? upper : (current ? current.ai_grid_upper : '0.30'),
      autoRange: isValid(autoRange) ? autoRange : (current ? (current.ai_grid_auto_range || 'OFF') : 'OFF'),
      count: isValid(count) ? count : (current ? current.ai_grid_count : '5'),
      frequency: isValid(frequency) ? frequency : (current ? current.ai_grid_frequency : '5')
    };

    await queries.run(`
      INSERT INTO manager_ai_settings
        (manager_email, ai_grid_status, ai_grid_lower, ai_grid_upper, ai_grid_auto_range, ai_grid_count, ai_grid_frequency, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(manager_email) DO UPDATE SET
        ai_grid_status = excluded.ai_grid_status,
        ai_grid_lower = excluded.ai_grid_lower,
        ai_grid_upper = excluded.ai_grid_upper,
        ai_grid_auto_range = excluded.ai_grid_auto_range,
        ai_grid_count = excluded.ai_grid_count,
        ai_grid_frequency = excluded.ai_grid_frequency,
        updated_at = datetime('now')
    `, [managerEmail, next.status, next.lower, next.upper, next.autoRange, next.count, next.frequency]);

    if (next.status !== 'ON') {
      await queries.run("DELETE FROM manager_gateio_credentials WHERE LOWER(manager_email) = LOWER(?)", [managerEmail]);
    }

    res.json({ success: true, message: 'AI 그리드 봇 설정이 성공적으로 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/save-gateio-keys', async (req, res) => {
  const { apiKey, apiSecret, depositAddress } = req.body;
  try {
    if (isMaskedCredential(apiKey) || isMaskedCredential(apiSecret)) {
      return res.status(400).json({
        success: false,
        message: '마스킹된 Gate.io 키는 저장할 수 없습니다. 실제 API Key와 Secret 전체를 다시 입력해 주세요.'
      });
    }
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ success: false, message: 'Gate.io API Key와 Secret은 필수입니다.' });
    }

    await queries.run(`
      INSERT INTO manager_gateio_credentials
        (manager_email, encrypted_api_key, encrypted_api_secret, deposit_address, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(manager_email) DO UPDATE SET
        encrypted_api_key = excluded.encrypted_api_key,
        encrypted_api_secret = excluded.encrypted_api_secret,
        deposit_address = excluded.deposit_address,
        updated_at = datetime('now')
    `, [
      req.managerEmail,
      encryptText(apiKey.trim()),
      encryptText(apiSecret.trim()),
      depositAddress ? depositAddress.trim() : ''
    ]);

    res.json({ success: true, message: 'Gate.io API 키 및 주소가 서버 DB에 안전하게 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/clear-gateio-keys', async (req, res) => {
  try {
    await queries.run("DELETE FROM manager_gateio_credentials WHERE LOWER(manager_email) = LOWER(?)", [req.managerEmail]);
    res.json({ success: true, message: '서버 DB에서 Gate.io API 키가 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/server-transfer-sut', async (req, res) => {
  const { amount } = req.body;
  const managerEmail = req.managerEmail;
  const managerWallet = req.managerWallet;

  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ success: false, message: '유효한 송금 수량을 입력해 주세요.' });
  }

  if (!managerWallet || !/^0x[a-fA-F0-9]{40}$/.test(managerWallet)) {
    return res.status(400).json({ success: false, message: '매니저 지갑 주소를 찾을 수 없습니다.' });
  }

  try {
    const credRow = await queries.get(
      "SELECT deposit_address FROM manager_gateio_credentials WHERE LOWER(manager_email) = LOWER(?)",
      [managerEmail]
    );
    const depositAddress = credRow?.deposit_address?.trim() || '';
    if (!depositAddress || !/^0x[a-fA-F0-9]{40}$/.test(depositAddress)) {
      return res.status(400).json({ success: false, message: 'Gate.io SUT 입금 주소가 서버에 저장되어 있지 않습니다. PC에서 먼저 설정해 주세요.' });
    }

    const { serverTransferSutFrom } = require('../contractHelper');
    const result = await serverTransferSutFrom(managerWallet, depositAddress, String(parsedAmount));

    console.log(`[SERVER TRANSFER] ${managerEmail}: ${parsedAmount} SUT -> Gate.io (${depositAddress}), TxHash: ${result.txHash}`);
    res.json({ success: true, txHash: result.txHash, message: `${parsedAmount} SUT가 Gate.io로 전송되었습니다.` });
  } catch (err) {
    console.error(`[SERVER TRANSFER ERROR] ${managerEmail}:`, err.message);

    if (err.code === 'INSUFFICIENT_ALLOWANCE') {
      return res.status(400).json({
        success: false,
        message: `Operator 지갑에 대한 SUT 승인(approve)이 부족합니다. PC에서 "서버 대행 송금 활성화" 버튼을 먼저 눌러 주세요. (현재 승인량: ${err.currentAllowance} SUT)`
      });
    }

    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/operator-address', async (req, res) => {
  const { getOperatorAddress } = require('../contractHelper');
  const address = getOperatorAddress();
  res.json({ success: true, operatorAddress: address || '' });
});

router.post('/gateio-order', async (req, res) => {
  const { side, amount, price } = req.body;

  if (!side || !amount || !price) {
    return res.status(400).json({ success: false, message: '주문 방향(side), 수량(amount), 가격(price)은 필수 입력 사항입니다.' });
  }

  try {
    const { apiKey, apiSecret } = await resolveGateIoCredentials(req);
    const orderRes = await createGateIoOrder(apiKey, apiSecret, side, amount, price);
    if (orderRes.success) {
      res.json({
        success: true,
        message: `Gate.io 거래소에 SUT ${side === 'buy' ? '매수' : '매도'} 지정가 주문이 안전하게 등록되었습니다.`,
        order: orderRes.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Gate.io 주문 전송 실패: ${orderRes.message}`
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function syncGateIoTradesToDb(managerEmail, apiKey, apiSecret) {
  try {
    const tradesRes = await getGateIoMyTrades(apiKey, apiSecret);
    if (tradesRes.success && Array.isArray(tradesRes.data)) {
      const ignoredTradeIds = ['1658098'];
      console.log("=== syncGateIoTradesToDb total trades ===", tradesRes.data.length);
      for (const t of tradesRes.data) {
        console.log(`Trade checking: id=${t.id} (${typeof t.id}), ignore?=${ignoredTradeIds.includes(String(t.id))}`);
        if (ignoredTradeIds.includes(String(t.id))) {
          console.log(`Skipping ignored trade ID: ${t.id}`);
          continue;
        }
        const deal = t.deal ? parseFloat(t.deal) : (parseFloat(t.price) * parseFloat(t.amount));
        await queries.run(`
          INSERT OR IGNORE INTO manager_gateio_trades
            (manager_email, trade_id, order_id, side, price, amount, deal, fee, fee_currency, create_time, create_time_ms)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          managerEmail,
          String(t.id),
          String(t.order_id || ''),
          t.side,
          parseFloat(t.price),
          parseFloat(t.amount),
          deal,
          t.fee || '0',
          t.fee_currency || 'USDT',
          String(t.create_time || ''),
          String(t.create_time_ms || '')
        ]);
      }
    }
  } catch (err) {
    console.error("❌ [Gate.io Trades Sync Error]:", err.message);
  }
}

async function syncGateIoTransfersToDb(managerEmail, apiKey, apiSecret) {
  try {
    let sutPriceAtSync = 0;
    try {
      const tickerRes = await axios.get('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SUT_USDT', { timeout: 3000 });
      if (tickerRes.data && tickerRes.data.length > 0) {
        sutPriceAtSync = parseFloat(tickerRes.data[0].last);
      }
    } catch (e) {}

    const depositsRes = await getGateIoDeposits(apiKey, apiSecret);
    if (depositsRes.success && Array.isArray(depositsRes.data)) {
      for (const d of depositsRes.data) {
        const transferId = String(d.id || d.txid || d.create_time || d.timestamp || '');
        if (!transferId) continue;
        
        await queries.run(`
          INSERT OR IGNORE INTO manager_gateio_transfers
            (manager_email, transfer_id, type, currency, amount, txid, status, create_time, price_at_time)
          VALUES (?, ?, 'DEPOSIT', ?, ?, ?, ?, ?, ?)
        `, [
          managerEmail,
          transferId,
          d.currency || 'USDT',
          parseFloat(d.amount || 0),
          d.txid || '',
          d.status || '',
          String(d.create_time || d.timestamp || ''),
          (d.currency || 'USDT') === 'SUT' ? sutPriceAtSync : null
        ]);
      }
    }


    const withdrawalsRes = await getGateIoWithdrawals(apiKey, apiSecret);
    if (withdrawalsRes.success && Array.isArray(withdrawalsRes.data)) {
      for (const w of withdrawalsRes.data) {
        const transferId = String(w.id || w.withdrawal_id || w.txid || w.create_time || '');
        if (!transferId) continue;

        await queries.run(`
          INSERT OR IGNORE INTO manager_gateio_transfers
            (manager_email, transfer_id, type, currency, amount, txid, status, create_time, price_at_time)
          VALUES (?, ?, 'WITHDRAW', ?, ?, ?, ?, ?, ?)
        `, [
          managerEmail,
          transferId,
          w.currency || 'USDT',
          parseFloat(w.amount || 0),
          w.txid || '',
          w.status || '',
          String(w.create_time || ''),
          (w.currency || 'USDT') === 'SUT' ? sutPriceAtSync : null
        ]);
      }
    }

    await backfillPriceAtTime(managerEmail);
  } catch (err) {
    console.error("❌ [Gate.io Transfers Sync Error]:", err.message);
  }
}

async function backfillPriceAtTime(managerEmail) {
  try {
    const nullRows = await queries.all(`
      SELECT id, create_time FROM manager_gateio_transfers
      WHERE LOWER(manager_email) = LOWER(?)
        AND currency = 'SUT'
        AND price_at_time IS NULL
    `, [managerEmail]);

    if (!nullRows || nullRows.length === 0) return;

    for (const row of nullRows) {
      try {
        const ts = parseInt(row.create_time);
        if (!ts || isNaN(ts)) continue;

        const from = ts - 1800;
        const to = ts + 1800;
        const url = `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=SUT_USDT&interval=1h&from=${from}&to=${to}&limit=1`;
        const candleRes = await axios.get(url, { timeout: 5000 });

        if (Array.isArray(candleRes.data) && candleRes.data.length > 0) {
          const closePrice = parseFloat(candleRes.data[0][2]);
          if (closePrice > 0) {
            await queries.run(
              `UPDATE manager_gateio_transfers SET price_at_time = ? WHERE id = ?`,
              [closePrice, row.id]
            );
          }
        }
      } catch (e) {}
    }
  } catch (err) {
    console.error("❌ [Backfill price_at_time Error]:", err.message);
  }
}

router.get('/gateio-performance', async (req, res) => {
  try {
    const { apiKey, apiSecret } = await resolveGateIoCredentials(req);

    if (!apiKey || !apiSecret) {
      return res.json({
        success: true,
        isConfigured: false,
        message: 'API 키가 설정되어 있지 않아 데모 모드로 작동합니다.'
      });
    }

    const managerEmail = req.managerEmail;


    await syncGateIoTradesToDb(managerEmail, apiKey, apiSecret);
    await syncGateIoTransfersToDb(managerEmail, apiKey, apiSecret);


    const balanceRes = await getGateIoBalances(apiKey, apiSecret);
    if (!balanceRes.success) {
      return res.json({ success: false, error: balanceRes.message || '잔고 조회 실패' });
    }
    const sutBalance = balanceRes.balances.SUT || 0;
    const usdtBalance = balanceRes.balances.USDT || 0;


    const dbTrades = await queries.all(`
      SELECT * FROM manager_gateio_trades
      WHERE LOWER(manager_email) = LOWER(?)
      ORDER BY CAST(create_time AS REAL) DESC
    `, [managerEmail]);


    const trades = (dbTrades || []).map(t => ({
      id: t.trade_id,
      order_id: t.order_id,
      side: t.side,
      price: String(t.price),
      amount: String(t.amount),
      deal: String(t.deal),
      fee: t.fee,
      fee_currency: t.fee_currency,
      create_time: parseFloat(t.create_time || 0),
      create_time_ms: parseFloat(t.create_time_ms || 0)
    }));

    let sutPrice = 0.19;
    let sutHigh24h = 0.19;
    let sutLow24h = 0.19;
    try {
      const tickerRes = await axios.get('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SUT_USDT', { timeout: 3000 });
      if (tickerRes.data && tickerRes.data.length > 0) {
        sutPrice = parseFloat(tickerRes.data[0].last);
        sutHigh24h = parseFloat(tickerRes.data[0].high_24h || tickerRes.data[0].last);
        sutLow24h = parseFloat(tickerRes.data[0].low_24h || tickerRes.data[0].last);
      }
    } catch (tickErr) {
      console.error("[Performance API] SUT 가격 조회 에러:", tickErr.message);
    }

    let sutPriceHistory24h = [];
    try {
      const candleRes = await axios.get('https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=SUT_USDT&interval=30m&limit=48', { timeout: 3000 });
      if (Array.isArray(candleRes.data)) {
        sutPriceHistory24h = candleRes.data.map(c => parseFloat(c[2]));
      }
    } catch (candleErr) {
      console.error("[Performance API] SUT 캔들스틱 조회 에러:", candleErr.message);
      sutPriceHistory24h = new Array(48).fill(sutPrice);
    }


    

    const transfers = await queries.all(`
      SELECT * FROM manager_gateio_transfers
      WHERE LOWER(manager_email) = LOWER(?)
    `, [managerEmail]);

    let totalDepositUsdt = 0;
    let totalWithdrawUsdt = 0;

    (transfers || []).forEach(tr => {
      const amt = tr.amount;
      let val = 0;
      if (tr.currency === 'USDT') {
        val = amt;
      } else if (tr.currency === 'SUT') {
        const priceToUse = (tr.price_at_time && tr.price_at_time > 0) ? tr.price_at_time : sutPrice;
        val = amt * priceToUse;
      } else {
        val = 0;
      }

      if (tr.type === 'DEPOSIT') {
        totalDepositUsdt += val;
      } else if (tr.type === 'WITHDRAW') {
        totalWithdrawUsdt += val;
      }
    });


    let netInvested = totalDepositUsdt - totalWithdrawUsdt;


    const currentValue = (sutBalance * sutPrice) + usdtBalance;


    if (netInvested <= 0) {
      let holdingQty = 0;
      let avgPrice = 0;
      let totalCost = 0;
      const chronTrades = [...trades].sort((a, b) => parseFloat(a.create_time || 0) - parseFloat(b.create_time || 0));
      
      chronTrades.forEach(t => {
        const price = parseFloat(t.price);
        const amount = parseFloat(t.amount);
        if (t.side === 'buy') {
          totalCost += (price * amount);
          holdingQty += amount;
          if (holdingQty > 0) {
            avgPrice = totalCost / holdingQty;
          }
        } else if (t.side === 'sell') {
          holdingQty = Math.max(0, holdingQty - amount);
          totalCost = holdingQty * avgPrice;
          if (holdingQty === 0) {
            avgPrice = 0;
          }
        }
      });
      netInvested = totalCost > 0 ? totalCost : 100;
    }

    const totalBuyUsdt = netInvested;


    let yieldPercent = 0;
    const isDustBalance = sutBalance < 1.0 && usdtBalance < 1.0;

    if (isDustBalance) {
      if (netInvested > 0) {
        yieldPercent = ((currentValue - netInvested) / netInvested) * 100;
      } else {
        yieldPercent = 0;
      }
    } else {
      if (netInvested > 0) {
        yieldPercent = ((currentValue - netInvested) / netInvested) * 100;
      } else {
        yieldPercent = 0;
      }
    }

    if (isNaN(yieldPercent) || !isFinite(yieldPercent)) {
      yieldPercent = 0;
    }

    let depositAddress = '';
    const depositRow = await queries.get("SELECT value FROM platform_settings WHERE key = 'gateio_deposit_address'");
    if (depositRow) {
      depositAddress = depositRow.value;
    }

    let yieldHistory = [];
    try {
      const historyRows = await queries.all(`
        SELECT yield_percent
        FROM manager_yield_history
        ORDER BY recorded_at DESC
        LIMIT 30
      `);

      yieldHistory = historyRows.map(h => h.yield_percent).reverse();
    } catch (histErr) {
      console.error("[Performance API] 히스토리 조회 실패:", histErr.message);
    }

    if (yieldHistory.length === 0) {
      yieldHistory = [yieldPercent];
    }

    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = parseFloat(a.create_time_ms || a.create_time || 0);
      const timeB = parseFloat(b.create_time_ms || b.create_time || 0);
      return timeB - timeA;
    });

    res.json({
      success: true,
      isConfigured: true,
      totalBuyUsdt,
      sutBalance,
      sutPrice,
      sutHigh24h,
      sutLow24h,
      sutPriceHistory24h,
      currentValue,
      yieldPercent,
      tradesCount: trades.length,
      trades: sortedTrades.slice(0, 20),

      maskedApiKey: apiKey ? `${apiKey.substring(0, 6)}******` : '',
      maskedApiSecret: apiSecret ? `${apiSecret.substring(0, 6)}******` : '',
      depositAddress: depositAddress,
      yieldHistory: yieldHistory
    });
  } catch (err) {
    console.error("[Performance API Error]:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/gateio-open-orders', async (req, res) => {
  try {
    const { apiKey, apiSecret } = await resolveGateIoCredentials(req);

    if (!apiKey || !apiSecret) {
      return res.json({
        success: true,
        isConfigured: false,
        orders: []
      });
    }

    const ordersRes = await getGateIoOpenOrders(apiKey, apiSecret);
    if (!ordersRes.success) {
      return res.json({ success: false, error: ordersRes.message || '대기 주문 조회 실패' });
    }

    return res.json({
      success: true,
      isConfigured: true,
      orders: ordersRes.data || []
    });
  } catch (err) {
    console.error("❌ Gate.io open orders API 에러:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/gateio-cancel-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: '주문 ID가 제공되지 않았습니다.' });
    }
    const { apiKey, apiSecret } = await resolveGateIoCredentials(req);
    if (!apiKey || !apiSecret) {
      return res.json({ success: false, error: '거래소 API 키가 설정되어 있지 않습니다.' });
    }
    const cancelRes = await cancelGateIoOrder(apiKey, apiSecret, orderId);
    if (!cancelRes.success) {
      return res.json({ success: false, error: cancelRes.message || '주문 취소 실패' });
    }
    return res.json({
      success: true,
      message: '주문이 성공적으로 취소되었습니다.',
      data: cancelRes.data
    });
  } catch (err) {
    console.error("❌ Gate.io cancel order API 에러:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ai-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await queries.all(`
      SELECT id, decision, reason, proposed_price, proposed_amount, proposed_lower, proposed_upper, created_at
      FROM manager_ai_logs
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/trade-executions', async (req, res) => {
  try {
    const managerEmail = req.managerEmail;
    const limit = parseInt(req.query.limit) || 50;
    const executions = await queries.all(`
      SELECT id, manager_email, ai_log_id, side, amount, price, status, gateio_order_id, message, created_at
      FROM manager_trade_executions
      WHERE LOWER(manager_email) = LOWER(?)
      ORDER BY created_at DESC
      LIMIT ?
    `, [managerEmail, limit]);
    res.json({ success: true, executions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/sync-transactions', async (req, res) => {
  try {
    const { ethers } = require('ethers');
    const rpcUrl = process.env.RPC_URL || 'https://polygon-bor-rpc.publicnode.com';
    const sutAddress = process.env.SUT_CONTRACT_ADDRESS || '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55';
    const vaultAddress = process.env.VAULT_CONTRACT_ADDRESS || '0x855c880D538892fD899eECb72D4b1Ac5B46089eA';
    const managerAddress = req.managerWallet;


    const approvedUsers = await queries.all(
      "SELECT LOWER(wallet_address) as wallet FROM users WHERE status = 'APPROVED' AND LOWER(manager_address) = LOWER(?) AND COALESCE(is_manager, 0) = 0",
      [managerAddress]
    );
    const userWallets = new Set(approvedUsers.map(u => u.wallet));

    if (userWallets.size === 0) {
      return res.json({
        success: true,
        addedDepositCount: 0,
        addedDepositAmount: 0,
        addedWithdrawCount: 0,
        addedWithdrawAmount: 0,
        message: '동기화할 회원이 없습니다.'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const sutAbi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
    const sutContract = new ethers.Contract(sutAddress, sutAbi, provider);

    const latestBlock = await provider.getBlockNumber();
    

    const syncStatusRow = await queries.get("SELECT last_synced_block FROM manager_sync_status WHERE wallet_address = ?", [managerAddress]);
    
    let startBlock;
    if (syncStatusRow && syncStatusRow.last_synced_block) {
      startBlock = syncStatusRow.last_synced_block + 1;
    } else {

      startBlock = latestBlock - 80000;
    }

    if (startBlock > latestBlock) {
      return res.json({
        success: true,
        addedDepositCount: 0,
        addedDepositAmount: 0,
        addedWithdrawCount: 0,
        addedWithdrawAmount: 0,
        message: '이미 최신 상태입니다. 새로운 거래 내역이 없습니다.'
      });
    }

    const step = 10000;
    const targetAddresses = new Set([
      vaultAddress.toLowerCase(),
      managerAddress.toLowerCase()
    ]);

    const promises = [];


    for (const addr of targetAddresses) {
      const filter = sutContract.filters.Transfer(null, addr);
      for (let currentStart = startBlock; currentStart <= latestBlock; currentStart += step) {
        const currentEnd = Math.min(currentStart + step - 1, latestBlock);
        promises.push(
          sutContract.queryFilter(filter, currentStart, currentEnd)
            .then(batch => batch.map(log => ({ log, isIncoming: true })))
            .catch(e => {
              console.error(`[Sync Transactions] Error querying incoming batch ${currentStart}-${currentEnd} for ${addr}:`, e.message);
              return [];
            })
        );
      }
    }


    for (const addr of targetAddresses) {
      const filter = sutContract.filters.Transfer(addr, null);
      for (let currentStart = startBlock; currentStart <= latestBlock; currentStart += step) {
        const currentEnd = Math.min(currentStart + step - 1, latestBlock);
        promises.push(
          sutContract.queryFilter(filter, currentStart, currentEnd)
            .then(batch => batch.map(log => ({ log, isIncoming: false })))
            .catch(e => {
              console.error(`[Sync Transactions] Error querying outgoing batch ${currentStart}-${currentEnd} for ${addr}:`, e.message);
              return [];
            })
        );
      }
    }


    const results = await Promise.all(promises);
    let allTransfers = [];
    for (const batch of results) {
      allTransfers = allTransfers.concat(batch);
    }

    let addedDepositCount = 0;
    let addedDepositAmount = 0;
    let addedWithdrawCount = 0;
    let addedWithdrawAmount = 0;

    for (const item of allTransfers) {
      const { log, isIncoming } = item;
      const txHash = log.transactionHash;
      const amount = parseFloat(ethers.formatUnits(log.args.value, 18));

      if (isIncoming) {
        const fromAddr = log.args.from.toLowerCase();
        if (userWallets.has(fromAddr)) {
          const existing = await queries.get(
            "SELECT id FROM ledger WHERE tx_hash = ? AND type = 'DEPOSIT'",
            [txHash]
          );
          if (!existing) {
            await queries.run(`
              INSERT INTO ledger (manager_address, wallet_address, type, amount, tx_hash, description, verified)
              VALUES (?, ?, 'DEPOSIT', ?, ?, 'Synced from on-chain', 1)
            `, [managerAddress, fromAddr, amount, txHash]);

            addedDepositCount++;
            addedDepositAmount += amount;
          }
        }
      } else {
        const toAddr = log.args.to.toLowerCase();
        if (userWallets.has(toAddr)) {
          const existing = await queries.get(
            "SELECT id FROM ledger WHERE tx_hash = ?",
            [txHash]
          );
          if (!existing) {
            await queries.run(`
              INSERT INTO ledger (manager_address, wallet_address, type, amount, tx_hash, description, verified)
              VALUES (?, ?, 'WITHDRAWAL', ?, ?, 'Synced from on-chain', 1)
            `, [managerAddress, toAddr, amount, txHash]);

            addedWithdrawCount++;
            addedWithdrawAmount += amount;
          }
        }
      }
    }


    await queries.run(`
      INSERT INTO manager_sync_status (wallet_address, last_synced_block, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(wallet_address) DO UPDATE SET last_synced_block = excluded.last_synced_block, updated_at = CURRENT_TIMESTAMP
    `, [managerAddress, latestBlock]);

    res.json({
      success: true,
      addedDepositCount,
      addedDepositAmount: parseFloat(addedDepositAmount.toFixed(2)),
      addedWithdrawCount,
      addedWithdrawAmount: parseFloat(addedWithdrawAmount.toFixed(2)),
      message: `온체인 거래 동기화 완료: 예치 ${addedDepositCount}건 (${addedDepositAmount.toFixed(2)} SUT) / 정산 ${addedWithdrawCount}건 (${addedWithdrawAmount.toFixed(2)} SUT) 추가 복구되었습니다.`
    });

  } catch (err) {
    console.error('[Sync Transactions Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:managerAddress/ledger', async (req, res) => {
  const managerAddress = req.params.managerAddress.toLowerCase().trim();
  try {
    const summary = await queries.get(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0) as totalDeposited,
        COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0) as totalWithdrawn,
        COALESCE(SUM(CASE WHEN type = 'AI_PROFIT' THEN amount ELSE 0 END), 0) as totalAiProfit,
        COALESCE(SUM(CASE WHEN type = 'ADJUSTMENT' THEN amount ELSE 0 END), 0) as totalAdjustment,
        COUNT(*) as totalEntries
      FROM ledger
      WHERE LOWER(manager_address) = LOWER(?)
    `, [managerAddress]);

    const balance = (summary.totalDeposited || 0) - (summary.totalWithdrawn || 0)
                  + (summary.totalAiProfit || 0) + (summary.totalAdjustment || 0);

    const memberSummaries = await queries.all(`
      SELECT
        u.wallet_address as walletAddress,
        u.name as memberName,
        COALESCE(SUM(CASE WHEN l.type = 'DEPOSIT' THEN l.amount ELSE 0 END), 0) as deposited,
        COALESCE(SUM(CASE WHEN l.type = 'WITHDRAWAL' THEN l.amount ELSE 0 END), 0) as withdrawn,
        COALESCE(SUM(CASE WHEN l.type = 'AI_PROFIT' THEN l.amount ELSE 0 END), 0) as aiProfit,
        COALESCE(SUM(CASE WHEN l.type = 'ADJUSTMENT' THEN l.amount ELSE 0 END), 0) as adjustment,
        MAX(l.created_at) as lastActivity
      FROM users u
      LEFT JOIN ledger l ON LOWER(l.wallet_address) = LOWER(u.wallet_address)
        AND LOWER(l.manager_address) = LOWER(?)
      WHERE u.status = 'APPROVED'
        AND LOWER(u.manager_address) = LOWER(?)
      GROUP BY u.wallet_address
      ORDER BY lastActivity DESC, u.name ASC
    `, [managerAddress, managerAddress]);

    res.json({
      success: true,
      summary: { ...summary, balance },
      members: memberSummaries.map(m => ({
        ...m,
        balance: (m.deposited || 0) - (m.withdrawn || 0) + (m.aiProfit || 0) + (m.adjustment || 0)
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:managerAddress/ledger/:memberWallet', async (req, res) => {
  const managerAddress = req.params.managerAddress.toLowerCase().trim();
  const memberWallet = req.params.memberWallet.toLowerCase().trim();
  const { startDate, endDate } = req.query;

  try {
    const memberCheck = await queries.get(
      'SELECT id FROM users WHERE LOWER(wallet_address) = LOWER(?) AND LOWER(manager_address) = LOWER(?)',
      [memberWallet, managerAddress]
    );
    if (!memberCheck) {
      return res.status(403).json({ success: false, error: 'Access denied: not your member' });
    }

    let dateFilter = '';
    const params = [managerAddress, memberWallet];

    if (startDate) {
      dateFilter += ' AND l.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND l.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    const entries = await queries.all(`
      SELECT l.*, u.name as memberName
      FROM ledger l
      LEFT JOIN users u ON LOWER(l.wallet_address) = LOWER(u.wallet_address)
      WHERE LOWER(l.manager_address) = LOWER(?)
        AND LOWER(l.wallet_address) = LOWER(?)
        ${dateFilter}
      ORDER BY l.created_at DESC
    `, params);

    const summary = await queries.get(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0) as totalDeposited,
        COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0) as totalWithdrawn,
        COALESCE(SUM(CASE WHEN type = 'AI_PROFIT' THEN amount ELSE 0 END), 0) as totalAiProfit,
        COALESCE(SUM(CASE WHEN type = 'ADJUSTMENT' THEN amount ELSE 0 END), 0) as totalAdjustment
      FROM ledger
      WHERE LOWER(manager_address) = LOWER(?)
        AND LOWER(wallet_address) = LOWER(?)
    `, [managerAddress, memberWallet]);

    const balance = (summary.totalDeposited || 0) - (summary.totalWithdrawn || 0)
                  + (summary.totalAiProfit || 0) + (summary.totalAdjustment || 0);

    res.json({
      success: true,
      entries,
      summary: { ...summary, balance },
      memberName: entries.length > 0 ? entries[0].memberName : ''
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:managerAddress/ledger/:memberWallet/csv', async (req, res) => {
  const managerAddress = req.params.managerAddress.toLowerCase().trim();
  const memberWallet = req.params.memberWallet.toLowerCase().trim();

  try {
    const memberCheck = await queries.get(
      'SELECT id FROM users WHERE LOWER(wallet_address) = LOWER(?) AND LOWER(manager_address) = LOWER(?)',
      [memberWallet, managerAddress]
    );
    if (!memberCheck) {
      return res.status(403).json({ success: false, error: 'Access denied: not your member' });
    }

    const entries = await queries.all(`
      SELECT l.created_at, l.type, l.amount, l.tx_hash, l.verified, l.description
      FROM ledger l
      WHERE LOWER(l.manager_address) = LOWER(?)
        AND LOWER(l.wallet_address) = LOWER(?)
      ORDER BY l.created_at DESC
    `, [managerAddress, memberWallet]);

    const member = await queries.get('SELECT name FROM users WHERE LOWER(wallet_address) = LOWER(?)', [memberWallet]);
    const csvName = encodeURIComponent(member?.name || memberWallet.slice(0, 8));
    const today = toKstDateString();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${csvName}_${today}.csv`);

    const BOM = '\uFEFF';
    let csv = BOM + '\uC77C\uC2DC,\uAD6C\uBD84,\uAE08\uC561(SUT),TX Hash,\uAC80\uC99D,\uC124\uBA85\n';

    const typeLabels = { DEPOSIT: '\uC785\uAE08', WITHDRAWAL: '\uCD9C\uAE08', AI_PROFIT: 'AI\uC218\uC775', ADJUSTMENT: '\uC870\uC815' };

    for (const e of entries) {
      const type = typeLabels[e.type] || e.type;
      const amount = e.type === 'WITHDRAWAL' ? `-${e.amount}` : `+${e.amount}`;
      const txHash = e.tx_hash || '-';
      const verified = e.verified ? 'Y' : 'N';
      const desc = (e.description || '').replace(/,/g, ' ');
      csv += `${e.created_at},${type},${amount},${txHash},${verified},${desc}\n`;
    }

    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:managerAddress/ledger/:memberWallet/pdf', async (req, res) => {
  const managerAddress = req.params.managerAddress.toLowerCase().trim();
  const memberWallet = req.params.memberWallet.toLowerCase().trim();
  const { startDate, endDate } = req.query;

  try {
    const memberCheck = await queries.get(
      'SELECT id FROM users WHERE LOWER(wallet_address) = LOWER(?) AND LOWER(manager_address) = LOWER(?)',
      [memberWallet, managerAddress]
    );
    if (!memberCheck) {
      return res.status(403).json({ success: false, error: 'Access denied: not your member' });
    }

    const manager = await queries.get(
      'SELECT name, email, phone FROM users WHERE LOWER(wallet_address) = LOWER(?)',
      [managerAddress]
    );

    let dateFilter = '';
    const params = [managerAddress, memberWallet];
    if (startDate) { dateFilter += ' AND created_at >= ?'; params.push(startDate); }
    if (endDate) { dateFilter += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59'); }

    const entries = await queries.all(`
      SELECT * FROM ledger
      WHERE LOWER(manager_address) = LOWER(?)
        AND LOWER(wallet_address) = LOWER(?)
        ${dateFilter}
      ORDER BY created_at ASC
    `, params);

    const member = await queries.get(
      'SELECT name FROM users WHERE LOWER(wallet_address) = LOWER(?)',
      [memberWallet]
    );

    const summary = await queries.get(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0) as totalDeposited,
        COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0) as totalWithdrawn,
        COALESCE(SUM(CASE WHEN type = 'AI_PROFIT' THEN amount ELSE 0 END), 0) as totalAiProfit,
        COALESCE(SUM(CASE WHEN type = 'ADJUSTMENT' THEN amount ELSE 0 END), 0) as totalAdjustment
      FROM ledger
      WHERE LOWER(manager_address) = LOWER(?)
        AND LOWER(wallet_address) = LOWER(?)
    `, [managerAddress, memberWallet]);

    const balance = (summary.totalDeposited || 0) - (summary.totalWithdrawn || 0)
                  + (summary.totalAiProfit || 0) + (summary.totalAdjustment || 0);

    generateLedgerPdf(res, {
      managerName: manager?.name || 'Manager',
      managerEmail: manager?.email || '',
      managerPhone: manager?.phone || '',
      memberName: member?.name || memberWallet.slice(0, 10),
      memberWallet,
      periodStart: startDate || 'All',
      periodEnd: endDate || toKstDateString(),
      entries,
      summary: { ...summary, balance }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.__private = {
  isMaskedCredential,
  resolveGateIoCredentials
};

module.exports = router;

