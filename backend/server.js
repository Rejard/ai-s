const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./database');
const { autoDeployContracts } = require('./contractHelper');
const { initGridBotScheduler } = require('./gridBot');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-manager-email', 'x-admin-email', 'x-gateio-api-key', 'x-gateio-api-secret']
}));

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/manager', require('./routes/manager'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/investment', require('./routes/investment'));


// All root requests except for API fallback serving to React SPA build index file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.use((err, req, res, next) => {
  console.error('❌ Server Error Middleware Catch:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || '서버 내부에서 예상치 못한 오류가 발생했습니다.'
  });
});

async function bootstrap() {
  try {

    await initializeDatabase();

    // 2. Smart contract deployment automation (includes automatic Mock mode switching based on network balance)
    await autoDeployContracts();

    app.listen(PORT, () => {
      console.log(`==================================================================`);
      console.log(`🔥 SERVER STARTED SUCCESSFULLY AT http://localhost:${PORT}`);
      console.log(`⚙  Mode: Web3 On-Chain Billing & Custom Simulation Enabled`);
      console.log(`📁 KYC Upload Path: ${path.join(__dirname, 'uploads')}`);
      console.log(`==================================================================`);
    });

    initGridBotScheduler();
  } catch (err) {
    console.error('❌ Failed to bootstrap the backend server:', err);
    process.exit(1);
  }
}

bootstrap();
