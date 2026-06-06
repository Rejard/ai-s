const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { queries } = require('../database');

const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'kyc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('신분증 이미지는 JPG, JPEG, PNG, PDF 형식만 업로드 가능합니다.'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.get('/check-limit', async (req, res) => {
  try {
    const countRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status IN ('APPROVED', 'PENDING_KYC') AND wallet_address != '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'");
    const totalCount = countRow ? countRow.total : 0;

    res.json({
      success: true,
      totalCount,
      limit: 500,
      available: totalCount < 500
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/verify-manager/:walletAddress', async (req, res) => {
  const cleanWallet = req.params.walletAddress.toLowerCase().trim();
  try {
    const user = await queries.get(
      "SELECT name, status FROM users WHERE LOWER(wallet_address) = ?",
      [cleanWallet]
    );

    if (!user) {
      return res.json({ success: false, message: '등록되지 않은 지갑 주소입니다.' });
    }

    if (user.status !== 'APPROVED') {
      return res.json({ success: false, message: '아직 시스템 사용 승인이 완료되지 않은 매니저 계정입니다.' });
    }

    res.json({ success: true, name: user.name });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/register', upload.single('idCard'), async (req, res) => {
  try {
    const { walletAddress, email, name, phone, country, managerAddress } = req.body;

    if (!walletAddress || !email || !name || !phone || !country) {
      return res.status(400).json({ success: false, message: '모든 필수 입력 필드를 기입해 주세요.' });
    }

    const cleanWallet = walletAddress.trim();
    const cleanEmail = email.toLowerCase().trim();

    const countRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status IN ('APPROVED', 'PENDING_KYC') AND wallet_address != '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'");
    const totalCount = countRow ? countRow.total : 0;
    if (totalCount >= 500) {
      return res.status(400).json({ success: false, message: '1차 한정 모집 인원 500명이 마감되었습니다.' });
    }

    const existingUser = await queries.get(
      "SELECT wallet_address, email FROM users WHERE LOWER(wallet_address) = LOWER(?) OR email = ?",
      [cleanWallet, cleanEmail]
    );
    if (existingUser) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }

      const duplicateWallet = existingUser.wallet_address.toLowerCase() === cleanWallet.toLowerCase();
      return res.status(409).json({
        success: false,
        code: duplicateWallet ? 'WALLET_ALREADY_REGISTERED' : 'EMAIL_ALREADY_REGISTERED',
        message: duplicateWallet
          ? '이미 다른 Google 계정으로 가입된 지갑입니다. 기존 가입 Google 계정으로 로그인하거나 다른 지갑을 연결해 주세요.'
          : '이미 가입된 Google 계정입니다. 기존 계정으로 로그인해 주세요.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'KYC 진행을 위해 신분증 사진을 업로드해 주세요.' });
    }
    const idCardPath = `/uploads/${req.file.filename}`;

    const assignedManager = managerAddress ? managerAddress.trim().toLowerCase() : 'none';

    await queries.run(`
      INSERT INTO users (
        wallet_address, email, name, phone, country, id_card_path, status, tier, manager_address, referrer_address
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING_KYC', 'TRIAL', ?, 'none')
    `, [cleanWallet, cleanEmail, name, phone, country, idCardPath, assignedManager]);

    res.json({
      success: true,
      message: '회원가입 및 KYC 서류 접수가 완료되었습니다. 본사 승인 대기 중입니다.',
      status: 'PENDING_KYC'
    });

  } catch (err) {
    console.error('❌ 회원가입 오류:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/status/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress.trim();
  try {
    const user = await queries.get(`
      SELECT wallet_address, email, name, status, tier, joined_at, approved_at, trial_ends_at, selected_coins, manager_address
      FROM users WHERE wallet_address = ?
    `, [walletAddress]);

    if (!user) {
      return res.json({ success: true, registered: false });
    }

    let managerEmail = 'lemaiiisk@gmail.com';
    let managerPhone = '010-2020-6447';

    if (user.manager_address && user.manager_address !== 'none') {
      const manager = await queries.get(`SELECT email, phone FROM users WHERE wallet_address = ?`, [user.manager_address]);
      if (manager) {
        managerEmail = manager.email;
        managerPhone = manager.phone;
      }
    }

    res.json({
      success: true,
      registered: true,
      user: {
        walletAddress: user.wallet_address,
        email: user.email,
        name: user.name,
        status: user.status,
        tier: user.tier,
        joinedAt: user.joined_at,
        approvedAt: user.approved_at,
        trialEndsAt: user.trial_ends_at,
        selectedCoins: JSON.parse(user.selected_coins),
        managerEmail,
        managerPhone
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/status-by-email/:email', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    const user = await queries.get(`
      SELECT wallet_address, email, name, status, tier, joined_at, approved_at, trial_ends_at, selected_coins, manager_address
      FROM users WHERE email = ?
    `, [email]);

    if (!user) {
      return res.json({ success: true, registered: false });
    }

    let managerEmail = 'lemaiiisk@gmail.com';
    let managerPhone = '010-2020-6447';

    if (user.manager_address && user.manager_address !== 'none') {
      const manager = await queries.get(`SELECT email, phone FROM users WHERE wallet_address = ?`, [user.manager_address]);
      if (manager) {
        managerEmail = manager.email;
        managerPhone = manager.phone;
      }
    }

    res.json({
      success: true,
      registered: true,
      user: {
        walletAddress: user.wallet_address,
        email: user.email,
        name: user.name,
        status: user.status,
        tier: user.tier,
        joinedAt: user.joined_at,
        approvedAt: user.approved_at,
        trialEndsAt: user.trial_ends_at,
        selectedCoins: user.selected_coins ? JSON.parse(user.selected_coins) : { POL: 50, USDT: 50 },
        managerEmail,
        managerPhone
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/payments/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress.trim();
  try {
    const payments = await queries.all(`
      SELECT amount, type, status, tx_hash, created_at FROM payments
      WHERE wallet_address = ? ORDER BY created_at DESC
    `, [walletAddress]);

    res.json({
      success: true,
      payments: payments || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
