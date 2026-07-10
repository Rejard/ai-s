const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { queries } = require('../database');
const {
  issueAuthToken,
  requireAuthenticatedSession,
} = require('../authSession');

const GOOGLE_CLIENT_ID = '327843712323-1se9k7pkfftu0d4r19mdf355ptj5j75u.apps.googleusercontent.com';
const MASTER_MANAGER_WALLET = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';

const findApprovedManager = (walletAddress) => queries.get(
  `SELECT name, wallet_address, status
   FROM users
   WHERE LOWER(wallet_address) = LOWER(?)
     AND status = 'APPROVED'
     AND is_manager = 1`,
  [walletAddress]
);

const countManagerMembers = (walletAddress) => queries.get(
  `SELECT COUNT(*) as total
   FROM users
   WHERE status IN ('APPROVED', 'PENDING_KYC')
     AND LOWER(manager_address) = LOWER(?)
     AND COALESCE(is_manager, 0) = 0`,
  [walletAddress]
);

router.post('/google-session', async (req, res) => {
  const { credential, accessToken } = req.body || {};
  if (!credential && !accessToken) {
    return res.status(400).json({ success: false, message: 'Google login proof is required.' });
  }

  try {
    let profile;
    if (credential) {
      const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
        params: { id_token: credential },
        timeout: 10000,
      });
      if (response.data.aud !== GOOGLE_CLIENT_ID || String(response.data.email_verified) !== 'true') {
        return res.status(401).json({ success: false, message: 'Google identity verification failed.' });
      }
      profile = response.data;
    } else {
      const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      if (!response.data.email || response.data.email_verified === false) {
        return res.status(401).json({ success: false, message: 'Google identity verification failed.' });
      }
      profile = response.data;
    }

    const email = profile.email.toLowerCase().trim();
    const name = profile.name || profile.given_name || email;
    res.json({
      success: true,
      token: issueAuthToken(email, name),
      profile: { email, name },
    });
  } catch (error) {
    const status = [400, 401].includes(error.response?.status) ? 401 : 502;
    res.status(status).json({ success: false, message: 'Google identity verification failed.' });
  }
});

router.get('/session', requireAuthenticatedSession, (req, res) => {
  res.json({
    success: true,
    profile: {
      email: req.authSession.email,
      name: req.authSession.name || req.authSession.email,
    },
  });
});

const { tempUploadDir: uploadDir } = require('../idCardHelper');

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
    const managerAddress = String(req.query.managerAddress || MASTER_MANAGER_WALLET).trim();
    const manager = await findApprovedManager(managerAddress);
    if (!manager) {
      return res.status(400).json({ success: false, message: '승인된 매니저 지갑이 아닙니다.' });
    }
    const countRow = await countManagerMembers(manager.wallet_address);
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
    const user = await findApprovedManager(cleanWallet);

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
    const { email, name, phone, country, managerAddress } = req.body;

    if (!email || !name || !phone || !country || !managerAddress) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ success: false, message: '모든 필수 입력 필드와 담당 매니저 주소를 기입해 주세요.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanManager = String(managerAddress).toLowerCase().trim();

    // DB 내에 승인된 매니저인지 실시간 쿼리 검증 수행
    const validManager = await findApprovedManager(cleanManager);
    if (!validManager) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ success: false, message: '승인된 담당 매니저 지갑 주소가 아닙니다. 주소를 확인하고 다시 입력해 주세요.' });
    }

    const cleanWallet = null;

    const existingUser = await queries.get(
      "SELECT id, email, status, id_card_path FROM users WHERE email = ?",
      [cleanEmail]
    );
    if (existingUser) {
      if (existingUser.status === 'REJECTED') {
        if (existingUser.id_card_path) {
          const oldFilePath = path.resolve(__dirname, '..', existingUser.id_card_path.replace(/^\//, ''));
          fs.unlink(oldFilePath, () => {});
        }
        await queries.run("DELETE FROM users WHERE id = ?", [existingUser.id]);
      } else {
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_REGISTERED',
          message: '이미 가입된 Google 계정입니다. 기존 계정으로 로그인해 주세요.'
        });
      }
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'KYC 진행을 위해 신분증 사진을 업로드해 주세요.' });
    }

    const idCardPath = `/uploads/${req.file.filename}`;

    await queries.run(`
      INSERT INTO users (
        wallet_address, email, name, phone, country, id_card_path, status, manager_address, referrer_address
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING_KYC', ?, 'none')
    `, [cleanWallet, cleanEmail, name, phone, country, idCardPath, cleanManager]);

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
      SELECT wallet_address, email, name, status, joined_at, approved_at, selected_coins, manager_address, is_manager
      FROM users WHERE wallet_address = ?
    `, [walletAddress]);
    if (!user) {
      return res.json({ success: true, registered: false });
    }

    let managerName = '관리자';
    let managerEmail = 'lemaiiisk@gmail.com';
    let managerPhone = '010-2020-6447';

    if (user.manager_address && user.manager_address !== 'none') {
      const manager = await queries.get(`SELECT name, email, phone FROM users WHERE LOWER(wallet_address) = LOWER(?)`, [user.manager_address]);
      if (manager) {
        managerName = manager.name;
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
        joinedAt: user.joined_at,
        approvedAt: user.approved_at,
        selectedCoins: JSON.parse(user.selected_coins),
        isManager: user.is_manager === 1,
        managerName,
        managerEmail,
        managerPhone,
        managerAddress: user.manager_address
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
      SELECT wallet_address, email, name, status, joined_at, approved_at, selected_coins, manager_address, is_manager
      FROM users WHERE email = ?
    `, [email]);

    if (!user) {
      return res.json({ success: true, registered: false });
    }

    let managerName = '관리자';
    let managerEmail = 'lemaiiisk@gmail.com';
    let managerPhone = '010-2020-6447';

    if (user.manager_address && user.manager_address !== 'none') {
      const manager = await queries.get(`SELECT name, email, phone FROM users WHERE LOWER(wallet_address) = LOWER(?)`, [user.manager_address]);
      if (manager) {
        managerName = manager.name;
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
        joinedAt: user.joined_at,
        approvedAt: user.approved_at,
        selectedCoins: user.selected_coins ? JSON.parse(user.selected_coins) : { POL: 50, USDT: 50 },
        isManager: user.is_manager === 1,
        managerName,
        managerEmail,
        managerPhone,
        managerAddress: user.manager_address
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/payments/:walletAddress', requireAuthenticatedSession, async (req, res) => {
  const walletAddress = req.params.walletAddress.trim();
  try {
    const isMaster = req.authEmail === 'lemaiiisk@gmail.com';
    let isOwner = false;
    
    if (!isMaster) {
      const sessionUser = await queries.get(
        "SELECT wallet_address, is_manager FROM users WHERE LOWER(email) = LOWER(?)",
        [req.authEmail]
      );
      
      if (sessionUser) {
        if (sessionUser.wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
          isOwner = true;
        } else if (sessionUser.is_manager === 1) {
          const managedUser = await queries.get(
            "SELECT id FROM users WHERE LOWER(wallet_address) = LOWER(?) AND LOWER(manager_address) = LOWER(?)",
            [walletAddress.toLowerCase(), sessionUser.wallet_address]
          );
          if (managedUser) {
            isOwner = true;
          }
        }
      }
    }
    
    if (!isMaster && !isOwner) {
      return res.status(403).json({ success: false, message: '권한 경보: 본인 혹은 소속 하위 회원의 이력만 조회 가능합니다.' });
    }

    const ledgerEntries = await queries.all(`
      SELECT amount, type, tx_hash, created_at FROM ledger
      WHERE LOWER(wallet_address) = LOWER(?) ORDER BY created_at DESC
    `, [walletAddress]);

    const withdrawals = await queries.all(`
      SELECT amount, 'WITHDRAW_REQUEST' as type, status, created_at FROM withdrawal_requests
      WHERE LOWER(wallet_address) = LOWER(?) ORDER BY created_at DESC
    `, [walletAddress]);

    const payments = [...ledgerEntries, ...withdrawals]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      payments: payments || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
