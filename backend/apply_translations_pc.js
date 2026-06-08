const fs = require('fs');
const pcFile = 'frontend/src/pages/PcManagerDashboard.jsx';

const warningBlockStr = `
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '10px', display: 'flex', gap: '8px' }}>
              <ShieldAlert size={16} color="var(--danger-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'left' }}>
                <strong style={{ color: 'var(--danger-color)' }}>컴플라이언스 가이드 (FDS 및 거래소 API 주의)</strong><br />
                일일 고빈도 매매(HFT) 체결 횟수를 과도하게 상향 조정할 경우, 연동된 거래소(Gate.io 등)의 API 호가 요청 한도(Rate Limit) 초과 정책에 위반되어 <strong style={{ color: '#F87171' }}>자전 거래(Wash Trading) 및 시세 조종 의심으로 봇 연동이 강제 차단되거나 계정이 동결</strong>될 위험이 있습니다. 안정적인 위탁 자산 운용 및 거래소 컴플라이언스 준수를 위해 시스템 권장 기본 설정값(일일 5~15회 내외)을 유지하는 것을 강력히 권고합니다.
              </div>
            </div>
`;

let pcContent = fs.readFileSync(pcFile, 'utf8');

// The original PC has this warning block:
// <strong style={{ color: 'var(--danger-color)' }}>거래소 API 밴 주의</strong><br />
// 과도한 요청(하루 20회 초과)은 거래소 보안 정책 위반으로 차단될 수 있습니다. 기본 빈도를 유지해 주십시오.

const oldWarningRegex = /<strong style=\{\{ color: 'var\(--danger-color\)' \}\}>거래소 API 밴 주의<\/strong><br \/>\s*과도한 요청\(하루 20회 초과\)은 거래소 보안 정책 위반으로 차단될 수 있습니다\. 기본 빈도를 유지해 주십시오\./;

if (pcContent.match(oldWarningRegex)) {
  pcContent = pcContent.replace(oldWarningRegex, `<strong style={{ color: 'var(--danger-color)' }}>컴플라이언스 가이드 (FDS 및 거래소 API 주의)</strong><br />
                일일 고빈도 매매(HFT) 체결 횟수를 과도하게 상향 조정할 경우, 연동된 거래소(Gate.io 등)의 API 호가 요청 한도(Rate Limit) 초과 정책에 위반되어 <strong style={{ color: '#F87171' }}>자전 거래(Wash Trading) 및 시세 조종 의심으로 봇 연동이 강제 차단되거나 계정이 동결</strong>될 위험이 있습니다. 안정적인 위탁 자산 운용 및 거래소 컴플라이언스 준수를 위해 시스템 권장 기본 설정값(일일 5~15회 내외)을 유지하는 것을 강력히 권고합니다.`);
  fs.writeFileSync(pcFile, pcContent, 'utf8');
  console.log('Successfully updated the warning block in PC Dashboard.');
} else {
  console.log('Could not find the old warning block in PC Dashboard.');
}
