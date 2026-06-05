const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./database');
const { autoDeployContracts } = require('./contractHelper');

// .env 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS 설정 (프론트엔드 포트 등 모든 오리진 허용으로 로컬 테스트 편의 보장)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-manager-email', 'x-admin-email', 'x-gateio-api-key', 'x-gateio-api-secret']
}));

app.use(express.json());

// 업로드된 신분증 이미지 서빙용 정적 폴더 매핑
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 프론트엔드 빌드 정적 파일 매핑 (Single Server 배포)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// 라우터 마운트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/manager', require('./routes/manager'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/investment', require('./routes/investment'));
const cronRouter = require('./routes/cron');
app.use('/api/cron', cronRouter);

// API 이외의 모든 루트 요청은 리액트 SPA 빌드 인덱스 파일로 폴백 서빙
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// 에러 핸들러 미들웨어
app.use((err, req, res, next) => {
  console.error('❌ Server Error Middleware Catch:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || '서버 내부에서 예상치 못한 오류가 발생했습니다.'
  });
});

// 데이터베이스 초기화 및 서버 구동
async function bootstrap() {
  try {
    // 1. SQLite 데이터베이스 및 마스터 추천인 초기화
    await initializeDatabase();
    
    // 2. 스마트 컨트랙트 배포 오토메이션 (네트워크 잔액에 맞춘 자동 Mock 모드 전환 포함)
    await autoDeployContracts();
    
    // 3. 서버 리스닝 시작
    app.listen(PORT, () => {
      console.log(`==================================================================`);
      console.log(`🔥 SERVER STARTED SUCCESSFULLY AT http://localhost:${PORT}`);
      console.log(`⚙  Mode: Web3 On-Chain Billing & Custom Simulation Enabled`);
      console.log(`📁 KYC Upload Path: ${path.join(__dirname, 'uploads')}`);
      console.log(`==================================================================`);
    });
  } catch (err) {
    console.error('❌ Failed to bootstrap the backend server:', err);
    process.exit(1);
  }
}

bootstrap();
