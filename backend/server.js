const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initializeDatabase, repairAiCouncilState } = require('./database');
const { autoDeployContracts } = require('./contractHelper');
const { initGridBotScheduler } = require('./gridBot');
const { initIdCardCleanupScheduler } = require('./idCardHelper');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const CORS_WHITELIST = [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];
if (process.env.NODE_ENV === 'development') {
  CORS_WHITELIST.push('http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173');
}
if (process.env.CORS_ORIGINS) {
  CORS_WHITELIST.push(...process.env.CORS_ORIGINS.split(',').map((o) => o.trim()));
}

app.use(cors({
  origin(origin, cb) {
    if (!origin || CORS_WHITELIST.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-manager-email', 'x-admin-email', 'x-gateio-api-key', 'x-gateio-api-secret']
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/manager', require('./routes/manager'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/investment', require('./routes/investment'));


app.get('/aidl_dna_presentation.html', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../aidl_dna_presentation.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.use((err, req, res, next) => {
  console.error('❌ Server Error Middleware Catch:', err.stack);
  res.status(500).json({
    success: false,
    message: '서버 내부에서 일시적인 통신 장애가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  });
});

async function bootstrap() {
  if (!process.env.AUTH_SESSION_SECRET) {
    console.error('❌ CRITICAL ERROR: AUTH_SESSION_SECRET is not set in environment variables. Server startup aborted.');
    process.exit(1);
  }

  try {

    await initializeDatabase();
    const councilState = await repairAiCouncilState();
    console.log(`[AI COUNCIL] Pool verified: ${councilState.total}/500, active voters: ${councilState.active}/11`);


    app.listen(PORT, () => {
      console.log(`==================================================================`);
      console.log(`🔥 SERVER STARTED SUCCESSFULLY AT http://localhost:${PORT}`);
      console.log(`⚙  Mode: Web3 On-Chain Billing & Custom Simulation Enabled`);
      console.log(`📁 KYC Upload Path: ${path.join(__dirname, 'uploads')}`);
      console.log(`==================================================================`);
    });

    initGridBotScheduler();
    initIdCardCleanupScheduler();
  } catch (err) {
    console.error('❌ Failed to bootstrap the backend server:', err);
    process.exit(1);
  }
}

bootstrap();
