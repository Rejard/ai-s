const fs = require('fs');

const adminFiles = ['frontend/src/pages/AdminDashboard.jsx', 'frontend/src/pages/PcAdminDashboard.jsx'];

const replacements = [
  { from: 'Top-level Admin Control Center', to: '👑 최고 관리자(Admin) 제어 센터' },
  { from: '👑 어드민 센터', to: '👑 최고 관리자(Admin) 제어 센터' },
  { from: 'Lee Myung-hak General Manager', to: '이명학 총괄 관리자 (Platform Owner)' },
  { from: 'Platform Owner', to: '이명학 총괄 관리자 (Platform Owner)' },
  { from: '이명학 총괄 관리자 (이명학 총괄 관리자 (Platform Owner))', to: '이명학 총괄 관리자 (Platform Owner)' },
  { from: 'Access Permission Security Restriction', to: '접근 권한 보안 제한 (보안 통제 구역)' }
];

function applyReplacements(content) {
  let newContent = content;
  for (const rep of replacements) {
    newContent = newContent.split(rep.from).join(rep.to);
  }
  return newContent;
}

adminFiles.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = applyReplacements(content);
  fs.writeFileSync(f, content, 'utf8');
  console.log('Updated:', f);
});
