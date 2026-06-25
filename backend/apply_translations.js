const fs = require('fs');

const pcFile = 'frontend/src/pages/PcManagerDashboard.jsx';
const mFile = 'frontend/src/pages/ManagerDashboard.jsx';

const warningBlockStr = `
          <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger-color)', fontWeight: '700', marginBottom: '6px', fontSize: '13px' }}>
              <ShieldAlert size={16} />
              컴플라이언스 가이드 (FDS 및 거래소 API 주의)
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
              일일 고빈도 매매(HFT) 체결 횟수를 과도하게 상향 조정할 경우, 연동된 거래소(Gate.io 등)의 API 호가 요청 한도(Rate Limit) 초과 정책에 위반되어 <strong style={{ color: '#F87171' }}>자전 거래(Wash Trading) 및 시세 조종 의심으로 봇 연동이 강제 차단되거나 계정이 동결</strong>될 위험이 있습니다. 안정적인 위탁 자산 운용 및 거래소 컴플라이언스 준수를 위해 시스템 권장 기본 설정값(일일 5~15회 내외)을 유지하는 것을 강력히 권고합니다.
            </p>
          </div>
`;

const warningBlockOldRegex = /<div style=\{\{ marginTop: '16px', padding: '14px', background: 'rgba\(239, 68, 68, 0\.1\)'[\s\S]*?<\/div>/;

const replacements = [
  { from: '🤖 자동화 AI 그리드 트레이딩 봇', to: '🤖 퀀트 알고리즘 트레이딩 (Grid) 운용 제어' },
  { from: 'AI 그리드 트레이딩 봇 설정', to: '🤖 퀀트 알고리즘 트레이딩 (Grid) 운용 제어' },
  { from: '상/하한가 범위를 설정하면 매일 봇이 수익을 발생시킵니다.', to: '구간 분할(Grid) 매매 밴드(Band)를 설정하여 자동 운용을 제어합니다.' },
  { from: '지급 요청 심사 (대기:', to: '자산 인출 및 정산 심사 (승인 대기:' },
  { from: '지급 요청 심사 ({withdrawals.length}건)', to: '자산 인출 및 정산 심사 (승인 대기: {withdrawals.length}건)' },
  { from: '지급 요청 심사', to: '자산 인출 및 정산 심사' },
  { from: 'user.status === \'APPROVED\' ? \'정회원\'', to: 'user.status === \'APPROVED\' ? \'운용 승인 완료 (정회원)\'' },
  { from: 'user.status === \'PENDING_KYC\' ? \'대기\'', to: 'user.status === \'PENDING_KYC\' ? \'고객확인(KYC) 심사 대기\'' },
  { from: 'user.status === \'PENDING_KYC\' ? \'승인대기\'', to: 'user.status === \'PENDING_KYC\' ? \'고객확인(KYC) 심사 대기\'' },
  { from: '>Master<', to: '>운용 총괄 책임자(CIO)<' },
  { from: '● LIVE', to: '● 알고리즘 운용 가동 중 (Active)' },
  { from: '일일 매매 빈도', to: '일일 고빈도 매매(HFT) 체결 목표 횟수' },
  { from: 'SUT 자산 통합 관리 현황', to: 'AUM(총 운용 자산) 통합 관리 현황' },
  { from: '매니저 SUT 총 보유 (지갑 + 거래소)', to: '총 운용 자산(AUM) 통합 잔고' },
  { from: '회원 누적 예치금 (누적 입금액)', to: '고객 위탁 자산 누적 예치액' },
  { from: '회원 누적 배분액 (출금 완료)', to: '고객 위탁 자산 누적 정산(출금) 완료액' },
  { from: '신규 가입 심사', to: '신규 위탁자 계좌 개설 및 KYC 심사' },
  { from: '전체 회원 명부', to: '전체 위탁 고객 원장 (Client Ledger)' }
];

function applyReplacements(content) {
  let newContent = content;
  for (const rep of replacements) {
    newContent = newContent.split(rep.from).join(rep.to);
  }
  return newContent;
}

let mContent = fs.readFileSync(mFile, 'utf8');
mContent = applyReplacements(mContent);
mContent = mContent.replace(warningBlockOldRegex, warningBlockStr.trim());
fs.writeFileSync(mFile, mContent, 'utf8');
console.log('Mobile Dashboard updated.');

let pcContent = fs.readFileSync(pcFile, 'utf8');
pcContent = applyReplacements(pcContent);

const saveBtnRegex = /(<button[^>]*onClick=\{handleSaveGridSettings\}[^>]*>[\s\S]*?<\/button>\s*<\/div>\s*)(<\/div>\s*<\/div>\s*<\/div>)/;
if (pcContent.match(saveBtnRegex)) {
  if (!pcContent.includes('컴플라이언스 가이드')) {
    pcContent = pcContent.replace(saveBtnRegex, `$1${warningBlockStr}$2`);
    console.log('Added warning block to PC Dashboard.');
  }
} else {
  console.log('Could not find where to insert warning block in PC Dashboard.');
}
fs.writeFileSync(pcFile, pcContent, 'utf8');
console.log('PC Dashboard updated.');
