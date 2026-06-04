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

  // 2. 추천인 관계 트리 전격 삭제 (Root 제외 후순위 정리 또는 전원 삭제)
  db.run('DELETE FROM referrals', (err) => {
    if (err) console.error('❌ referrals 삭제 실패:', err.message);
    else console.log('✔ referrals 테이블 초기화 성공');
  });

  // 3. 마스터 Root 추천인 주소를 제외한 모든 일반 가입 회원 데이터 완전 삭제
  const rootAddress = '0x015B8fA9aE51Dbebe7301a0A3F725Bf8811E5818';
  
  db.run('DELETE FROM users WHERE wallet_address != ?', [rootAddress], (err) => {
    if (err) console.error('❌ 일반 users 삭제 실패:', err.message);
    else console.log('✔ 일반 users 테이블 초기화 성공');
  });

  // 4. 최초 신규 가입자들을 유입시키기 위해 Root 추천인 데이터만 클린 시드로 보정 및 복구
  db.run(`
    INSERT OR IGNORE INTO users (
      wallet_address, email, name, phone, country, referrer_address, status, tier, joined_at, approved_at
    ) VALUES (
      ?, 'lemaiiisk@gmail.com', 'Root Master', '+82-10-1234-5678', 'Korea', 'none', 'APPROVED', 'ACTIVE', datetime('now'), datetime('now')
    )
  `, [rootAddress], (err) => {
    if (err) console.error('❌ Root user 생성 실패:', err.message);
    else console.log('✔ Root Master 클린 시드 생성 성공');
  });

  db.run(`
    INSERT OR IGNORE INTO referrals (user_address, parent_address, grandparent_address)
    VALUES (?, 'none', 'none')
  `, [rootAddress], (err) => {
    if (err) console.error('❌ Root referrals 생성 실패:', err.message);
    else {
      console.log('✔ Root referrals 클린 시드 구축 성공');
      console.log('🎉 데이터베이스 전 가입 회원 초기화 작업 완료!');
      db.close();
    }
  });
});
