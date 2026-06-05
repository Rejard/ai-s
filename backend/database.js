const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { encryptText } = require('./secureCredentials');

const dbPath = path.resolve(__dirname, 'platform.db');
const db = new sqlite3.Database(dbPath);

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. users 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet_address TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          country TEXT NOT NULL,
          id_card_path TEXT,
          referrer_address TEXT NOT NULL DEFAULT 'none',
          status TEXT NOT NULL CHECK (status IN ('PENDING_KYC', 'APPROVED', 'REJECTED')),
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          approved_at DATETIME,
          trial_ends_at DATETIME,
          tier TEXT NOT NULL CHECK (tier IN ('TRIAL', 'ACTIVE', 'EXPIRED')),
          selected_coins TEXT DEFAULT '{"POL":50,"USDT":50}',
          manager_address TEXT DEFAULT 'none'
        )
      `, (err) => { if (err) return reject(err); });



      // 3. payments 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet_address TEXT NOT NULL,
          amount REAL NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('MEMBERSHIP_FEE', 'MONTHLY_SUBSCRIPTION', 'WITHDRAW_REQUEST', 'AI_TRADING_PROFIT')),
          status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
          tx_hash TEXT,
          distributed_amount REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (wallet_address) REFERENCES users (wallet_address)
        )
      `, (err) => { if (err) return reject(err); });

      // 3.5 platform_settings 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS platform_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `, (err) => { 
        if (err) return reject(err); 
        // 기본 모의 수익률 삽입 (초기값 0.0)
        db.run(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('global_mock_profit_percent', '0.0')`);
      });

      // 3.8 manager_yield_history 테이블 생성 (수익률 시계열 차트 데이터 보존용)
      db.run(`
        CREATE TABLE IF NOT EXISTS manager_yield_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          yield_percent REAL NOT NULL,
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) return reject(err); });

      // 3.9 manager_ai_logs 테이블 생성 (AI 의사결정 브리핑 보존용)
      db.run(`
        CREATE TABLE IF NOT EXISTS manager_ai_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          decision TEXT NOT NULL,
          reason TEXT NOT NULL,
          proposed_price REAL NOT NULL,
          proposed_amount REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_gateio_credentials (
          manager_email TEXT PRIMARY KEY,
          encrypted_api_key TEXT NOT NULL,
          encrypted_api_secret TEXT NOT NULL,
          deposit_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_ai_settings (
          manager_email TEXT PRIMARY KEY,
          ai_grid_status TEXT NOT NULL DEFAULT 'OFF',
          ai_grid_lower TEXT NOT NULL DEFAULT '0.15',
          ai_grid_upper TEXT NOT NULL DEFAULT '0.30',
          ai_grid_count TEXT NOT NULL DEFAULT '10',
          ai_grid_frequency TEXT NOT NULL DEFAULT '5',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_trade_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          manager_email TEXT NOT NULL,
          ai_log_id INTEGER NOT NULL,
          side TEXT NOT NULL,
          amount REAL NOT NULL,
          price REAL NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'SKIPPED')),
          gateio_order_id TEXT,
          message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(manager_email, ai_log_id)
        )
      `, (err) => { if (err) return reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS manager_one_time_trade_tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          manager_email TEXT NOT NULL,
          side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
          spend_usdt REAL NOT NULL,
          dry_run INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL CHECK (status IN ('PENDING', 'USED', 'CANCELLED')) DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          used_at DATETIME,
          used_ai_log_id INTEGER
        )
      `, (err) => { if (err) return reject(err); });

      db.get("SELECT value FROM platform_settings WHERE key = 'gateio_api_key'", (keyErr, keyRow) => {
        if (keyErr || !keyRow || !keyRow.value) return;
        db.get("SELECT value FROM platform_settings WHERE key = 'gateio_api_secret'", (secretErr, secretRow) => {
          if (secretErr || !secretRow || !secretRow.value) return;
          db.get("SELECT value FROM platform_settings WHERE key = 'gateio_deposit_address'", (depositErr, depositRow) => {
            if (depositErr) return;
            try {
              db.run(`
                INSERT OR IGNORE INTO manager_gateio_credentials
                  (manager_email, encrypted_api_key, encrypted_api_secret, deposit_address, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'))
              `, [
                'lemaiiisk@gmail.com',
                encryptText(keyRow.value),
                encryptText(secretRow.value),
                depositRow ? depositRow.value : ''
              ]);
            } catch (migrationErr) {
              console.error("Gate.io credential encryption migration failed:", migrationErr.message);
            }
          });
        });
      });

      // 4. 최초 가입 활성화를 위한 마스터 추천인(Root Referrer) 데이터 삽입
      // Rejard님의 진짜 지갑 주소와 이메일, 성명을 마스터 매니저로 영구 등록!
      const rootReferrerAddress = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987'; 
      
      db.run(`
        INSERT OR IGNORE INTO users (
          wallet_address, email, name, phone, country, status, tier, joined_at, approved_at
        ) VALUES (
          ?, 'lemaiiisk@gmail.com', '이명학', '+82-10-1234-5678', 'Korea', 'APPROVED', 'ACTIVE', datetime('now'), datetime('now')
        )
      `, [rootReferrerAddress]);

      // 이미 생성된 기존 DB 파일이 있을 경우에도 강제로 이메일 컬럼과 이름을 이명학 마스터 정보로 무결성 보정 교정
      db.run("ALTER TABLE users ADD COLUMN is_manager INTEGER DEFAULT 0", (err) => {
        // duplicate column name 에러 발생 시 이미 존재하므로 패스
        if (err && !err.message.includes("duplicate column name")) {
          console.error("❌ users 테이블 is_manager 컬럼 마이그레이션 실패:", err.message);
        }
      });

      db.run(`
        UPDATE users 
        SET email = 'lemaiiisk@gmail.com',
            name = '이명학',
            status = 'APPROVED',
            tier = 'ACTIVE',
            is_manager = 1
        WHERE wallet_address = ?
      `, [rootReferrerAddress]);



      // 🌟 마스터 매니저 이명학 지갑 계정 등록 처리 완료
      console.log('✔ SQLite Database initialized successfully with Root Referrers.');
      resolve();
    });
  });
}

// 헬퍼 쿼리 함수 제공
const queries = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
};

module.exports = {
  db,
  initializeDatabase,
  queries
};
