const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'platform.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 [DB RESET] 데이터베이스 완전 초기화 작업을 개시합니다...');

db.serialize(() => {
  // 1. 기존 결제 및 배분 히스토리 전격 삭제
  db.run('DELETE FROM payments', (err) => {
    if (err) console.error('❌ payments 삭제 실패:', err.message);
    else console.log('✔ payments 테이블 초기화 성공');
  });



  // 3. 마스터 Root 추천인 주소를 제외한 모든 일반 가입 회원 데이터 완전 삭제
  const rootAddress = '0x7660Bf401Af0D13645F0cfED3e72b8E8B6Fd7987';
  
  db.run('DELETE FROM users WHERE wallet_address != ?', [rootAddress], (err) => {
    if (err) console.error('❌ 일반 users 삭제 실패:', err.message);
    else console.log('✔ 일반 users 테이블 초기화 성공');
  });

  // 4. 최초 신규 가입자들을 유입시키기 위해 Root 추천인 데이터만 클린 시드로 보정 및 복구
  db.run(`
    INSERT OR REPLACE INTO users (
      id, wallet_address, email, name, phone, country, referrer_address, status, tier, joined_at, approved_at
    ) VALUES (
      (SELECT id FROM users WHERE wallet_address = ?), ?, 'lemaiiisk@gmail.com', 'System Admin', '+82-10-1234-5678', 'Korea', 'none', 'APPROVED', 'ACTIVE', datetime('now'), datetime('now')
    )
  `, [rootAddress, rootAddress], (err) => {
    if (err) console.error('❌ Root user 생성 실패:', err.message);
    else {
      console.log('✔ Root Master 클린 시드 생성 성공');
      console.log('🎉 데이터베이스 전 가입 회원 초기화 작업 완료!');
      db.close();
    }
  });
});
