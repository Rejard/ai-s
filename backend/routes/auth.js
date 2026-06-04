const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { queries } = require('../database');

// KYC 신분증 업로드를 위한 multer 설정
const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 고유 파일명 생성
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB 제한
});

/**
 * @route POST /api/auth/check-limit
 * @desc 현재 가입자 수가 500명 이하인지 사전 체크
 */
router.get('/check-limit', async (req, res) => {
  try {
    const countRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status IN ('APPROVED', 'PENDING_KYC') AND wallet_address != '0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818'");
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

/**
 * @route GET /api/auth/verify-referrer/:address
 * @desc 추천인 지갑 주소가 유효한(APPROVED) 상태인지 실시간 검증
 */
router.get('/verify-referrer/:address', async (req, res) => {
  const address = req.params.address.trim();
  try {
    const referrer = await queries.get("SELECT name, wallet_address FROM users WHERE wallet_address = ? AND status = 'APPROVED'", [address]);
    if (referrer) {
      res.json({ success: true, name: referrer.name });
    } else {
      res.json({ success: false, message: '유효한 추천인 지갑 주소가 아닙니다. 승인된 회원만 추천이 가능합니다.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/auth/register
 * @desc 회원가입 신청 및 KYC 서류 제출
 */
router.post('/register', upload.single('idCard'), async (req, res) => {
  try {
    const { walletAddress, email, name, phone, country, referrerAddress } = req.body;
    
    if (!walletAddress || !email || !name || !phone || !country || !referrerAddress) {
      return res.status(400).json({ success: false, message: '모든 필수 입력 필드를 기입해 주세요.' });
    }

    const cleanWallet = walletAddress.trim();
    const cleanEmail = email.toLowerCase().trim();
    const cleanReferrer = referrerAddress.trim();

    // 시연용 모의 가입자 지갑(0x3c44...로 시작) 또는 구글 이메일로 가입 신청이 들어온 경우,
    // 매번 완벽하고 원활한 신규 가입 시연을 위해 기존에 등록되어 있던 해당 유저의 정보 및 추천 트리, 결제 이력을 깨끗이 삭제하고 
    // 언제나 100% 새로운 가입 신청이 성공할 수 있도록 자동 초기화(Reset) 처리합니다!
    const isDemoWallet = cleanWallet.startsWith('0x3c44');
    const DEMO_USER_EMAIL = 'rejard.member@gmail.com'.toLowerCase();

    if (isDemoWallet || cleanEmail === DEMO_USER_EMAIL) {
      console.log(`[DEMO AUTO-RESET] Resetting existing data for demo user (${cleanWallet} / ${cleanEmail}) to ensure 100% successful new registration.`);
      // 기존에 동일 지갑이나 동일 이메일을 쓰고 있던 유저 조회 및 완벽 청소
      const duplicateUser = await queries.get("SELECT wallet_address FROM users WHERE wallet_address = ? OR email = ?", [cleanWallet, cleanEmail]);
      if (duplicateUser) {
        const dupWallet = duplicateUser.wallet_address;
        await queries.run("DELETE FROM users WHERE wallet_address = ?", [dupWallet]);
        await queries.run("DELETE FROM referrals WHERE user_address = ?", [dupWallet]);
        await queries.run("DELETE FROM payments WHERE wallet_address = ?", [dupWallet]);
      }
    }

    // 1. 500명 정원 초과 여부 검증 (마스터 계정 제외)
    const countRow = await queries.get("SELECT COUNT(*) as total FROM users WHERE status IN ('APPROVED', 'PENDING_KYC') AND wallet_address != '0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818'");
    const totalCount = countRow ? countRow.total : 0;
    if (totalCount >= 500) {
      return res.status(400).json({ success: false, message: '1차 한정 모집 인원 500명이 마감되었습니다.' });
    }

    // 2. 이미 존재하는 회원인지 검증
    const existingUser = await queries.get("SELECT id FROM users WHERE wallet_address = ? OR email = ?", [cleanWallet, cleanEmail]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: '이미 가입 신청 또는 승인된 지갑 주소이거나 구글 계정입니다.' });
    }

    // 3. 초대인 유효성 검증
    const referrer = await queries.get("SELECT wallet_address FROM users WHERE wallet_address = ? AND status = 'APPROVED'", [cleanReferrer]);
    if (!referrer) {
      return res.status(400).json({ success: false, message: '입력하신 추천인 주소가 승인된 회원이 아니거나 유효하지 않습니다.' });
    }

    // 4. 업로드된 신분증 서류 확인
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'KYC 진행을 위해 신분증 사진을 업로드해 주세요.' });
    }
    const idCardPath = `/uploads/${req.file.filename}`;

    // 5. 회원 가입 처리 (PENDING_KYC 상태로 등록)
    await queries.run(`
      INSERT INTO users (
        wallet_address, email, name, phone, country, id_card_path, referrer_address, status, tier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_KYC', 'TRIAL')
    `, [cleanWallet, cleanEmail, name, phone, country, idCardPath, cleanReferrer]);

    // 6. 추천 관계 트리 구축 (2단계)
    // 1차 추천인 (parent): cleanReferrer
    // 2차 추천인 (grandparent): cleanReferrer의 parent_address
    const parentReferrer = await queries.get("SELECT parent_address FROM referrals WHERE user_address = ?", [cleanReferrer]);
    const grandparentAddress = parentReferrer ? parentReferrer.parent_address : 'none';

    await queries.run(`
      INSERT INTO referrals (user_address, parent_address, grandparent_address)
      VALUES (?, ?, ?)
    `, [cleanWallet, cleanReferrer, grandparentAddress]);

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

/**
 * @route GET /api/auth/status/:walletAddress
 * @desc 지갑 주소 기반 현재 회원의 가입 및 심사 상태 반환
 */
router.get('/status/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress.trim();
  try {
    const user = await queries.get(`
      SELECT wallet_address, email, name, status, tier, joined_at, approved_at, trial_ends_at, selected_coins
      FROM users WHERE wallet_address = ?
    `, [walletAddress]);

    if (!user) {
      return res.json({ success: true, registered: false });
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
        selectedCoins: JSON.parse(user.selected_coins)
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/auth/status-by-email/:email
 * @desc 구글 로그인 이메일 기반 현재 회원의 가입 및 심사 상태 반환 (이메일 세션 자동 로그인용)
 */
router.get('/status-by-email/:email', async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    const user = await queries.get(`
      SELECT wallet_address, email, name, status, tier, joined_at, approved_at, trial_ends_at, selected_coins
      FROM users WHERE email = ?
    `, [email]);

    if (!user) {
      return res.json({ success: true, registered: false });
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
        selectedCoins: user.selected_coins ? JSON.parse(user.selected_coins) : { POL: 50, USDT: 50 }
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/auth/referral-stats/:walletAddress
 * @desc 일반 회원의 추천 파이프라인 통계 조회 (1차, 2차 회원 수 및 누적 보상금)
 */
router.get('/referral-stats/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress.trim();
  try {
    // 1차 추천 회원 전체 (가입 대기/완료 상관없이 수집)
    const ref1Row = await queries.get(`
      SELECT COUNT(*) as count FROM referrals WHERE parent_address = ?
    `, [walletAddress]);
    const totalReferrals1 = ref1Row ? ref1Row.count : 0;

    // 2차 추천 회원 전체
    const ref2Row = await queries.get(`
      SELECT COUNT(*) as count FROM referrals WHERE grandparent_address = ?
    `, [walletAddress]);
    const totalReferrals2 = ref2Row ? ref2Row.count : 0;

    // 1차 추천 중 정식 가입 승인(APPROVED)을 완료한 액티브 회원 수
    const activeRef1Row = await queries.get(`
      SELECT COUNT(*) as count FROM referrals r
      JOIN users u ON r.user_address = u.wallet_address
      WHERE r.parent_address = ? AND u.status = 'APPROVED'
    `, [walletAddress]);
    const activeReferrals1 = activeRef1Row ? activeRef1Row.count : 0;

    // 2차 추천 중 정식 가입 승인(APPROVED)을 완료한 액티브 회원 수
    const activeRef2Row = await queries.get(`
      SELECT COUNT(*) as count FROM referrals r
      JOIN users u ON r.user_address = u.wallet_address
      WHERE r.grandparent_address = ? AND u.status = 'APPROVED'
    `, [walletAddress]);
    const activeReferrals2 = activeRef2Row ? activeRef2Row.count : 0;

    // 총 누적 획득 보상금 계산 (실제 승인된 1차/2차 액티브 인원수 * 25 USDT)
    const totalRewards = (activeReferrals1 * 25) + (activeReferrals2 * 25);

    res.json({
      success: true,
      referralCount1: totalReferrals1,
      referralCount2: totalReferrals2,
      activeReferralCount1: activeReferrals1,
      activeReferralCount2: activeReferrals2,
      totalRewards
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route GET /api/auth/payments/:walletAddress
 * @desc 해당 회원의 실시간 결제 및 가입 수납 이력 조회 (일반 대시보드 시그널용)
 */
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
