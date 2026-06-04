const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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
          referrer_address TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('PENDING_KYC', 'APPROVED', 'REJECTED')),
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          approved_at DATETIME,
          trial_ends_at DATETIME,
          tier TEXT NOT NULL CHECK (tier IN ('TRIAL', 'ACTIVE', 'EXPIRED')),
          selected_coins TEXT DEFAULT '{"POL":50,"USDT":50}'
        )
      `, (err) => { if (err) return reject(err); });

      // 2. referrals 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS referrals (
          user_address TEXT PRIMARY KEY,
          parent_address TEXT,
          grandparent_address TEXT,
          FOREIGN KEY (user_address) REFERENCES users (wallet_address)
        )
      `, (err) => { if (err) return reject(err); });

      // 3. payments 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet_address TEXT NOT NULL,
          amount REAL NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('MEMBERSHIP_FEE', 'MONTHLY_SUBSCRIPTION')),
          status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
          tx_hash TEXT,
          distributed_amount REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (wallet_address) REFERENCES users (wallet_address)
        )
      `, (err) => { if (err) return reject(err); });

      // 4. 최초 가입 활성화를 위한 마스터 추천인(Root Referrer) 데이터 삽입
      // Rejard님의 진짜 지갑 주소와 이메일, 성명을 마스터 관리자로 영구 등록!
      const rootReferrerAddress = '0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818'; 
      const secondReferrerAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'.toLowerCase(); // Hardhat 두 번째 테스트 계정
      
      db.run(`
        INSERT OR IGNORE INTO users (
          wallet_address, email, name, phone, country, referrer_address, status, tier, joined_at, approved_at
        ) VALUES (
          ?, 'lemaiiisk@gmail.com', '이명학', '+82-10-1234-5678', 'Korea', 'none', 'APPROVED', 'ACTIVE', datetime('now'), datetime('now')
        )
      `, [rootReferrerAddress]);

      // 이미 생성된 기존 DB 파일이 있을 경우에도 강제로 이메일 컬럼과 이름을 이명학 마스터 정보로 무결성 보정 교정
      db.run(`
        UPDATE users 
        SET email = 'lemaiiisk@gmail.com',
            name = '이명학',
            status = 'APPROVED',
            tier = 'ACTIVE'
        WHERE wallet_address = ?
      `, [rootReferrerAddress]);

      db.run(`
        INSERT OR IGNORE INTO referrals (user_address, parent_address, grandparent_address)
        VALUES (?, 'none', 'none')
      `, [rootReferrerAddress]);

      // 🌟 마스터 관리자 이명학 지갑 계정 전용 가상 시뮬레이션용 최초 웰컴 시드 1,000 USDT 예치 기록 삽입
      db.run(`
        INSERT OR IGNORE INTO payments (wallet_address, amount, type, status, tx_hash)
        VALUES (?, 1000.0, 'MONTHLY_SUBSCRIPTION', 'SUCCESS', '0xSimulatedMasterWelcomeSeed')
      `, [rootReferrerAddress]);

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
