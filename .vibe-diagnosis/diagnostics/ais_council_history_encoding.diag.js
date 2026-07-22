const fs = require('fs');
const path = require('path');

const gridBotPath = path.resolve(__dirname, '../../backend/gridBot.js');
const formatterPath = path.resolve(__dirname, '../../frontend/src/lib/aiDecisionReason.js');
const managerHistoryPath = path.resolve(__dirname, '../../frontend/src/components/ManagerAiDecisionHistory.jsx');
const adminHistoryPath = path.resolve(__dirname, '../../frontend/src/pages/admin/AdminSettingsTab.jsx');

module.exports = {
  id: 'ais-council-history-encoding',
  name: 'AiS AI 의회 이력 한글 인코딩',
  layer: 'TASK',
  linkedTask: 'TASK-AIS-COUNCIL-HISTORY-ENCODING',

  async run() {
    const gridBotSource = fs.readFileSync(gridBotPath, 'utf8');
    const formatterSource = fs.readFileSync(formatterPath, 'utf8');
    const managerHistorySource = fs.readFileSync(managerHistoryPath, 'utf8');
    const adminHistorySource = fs.readFileSync(adminHistoryPath, 'utf8');
    const missing = ['formatCouncilDecisionReason', 'AI 의회 최종 의결', '의원별 투표 현황'].filter((entry) => !gridBotSource.includes(entry));
    if (missing.length) return { status: 'ERROR', details: `AI 의회 신규 기록 형식 누락: ${missing.join(', ')}` };
    if (!formatterSource.includes('formatAiDecisionReason') || !formatterSource.includes("'[관망]'")) return { status: 'ERROR', details: '기존 이력 한글 복원 형식이 누락되었습니다.' };
    if (!managerHistorySource.includes('formatAiDecisionReason') || !adminHistorySource.includes('formatAiDecisionReason')) return { status: 'ERROR', details: '관리자 또는 매니저 이력 화면에 한글 복원이 연결되지 않았습니다.' };
    return { status: 'OK', details: 'AI 의회 신규·기존 이력이 관리자와 매니저 화면에서 정상 한글로 표시됩니다.' };
  },
};
