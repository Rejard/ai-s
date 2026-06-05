const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove slider UI completely
content = content.replace(/\{\/\* 슬라이더 영역 \*\/\}[\s\S]*?\{\/\* 자필 수준 면책 동의 약관 \*\/\}/g, '{/* 자필 수준 면책 동의 약관 */}');

// 2. Remove Donut Chart completely
content = content.replace(/\{\/\* 1\) 자산 배분 도넛 차트 \(Donut Chart\) \*\/\}[\s\S]*?\{\/\* 2\) 실시간 수익률 꺾은선 곡선 그래프 \(Line Bezier Chart\) \*\/\}/g, '{/* 2) 실시간 수익률 꺾은선 곡선 그래프 (Line Bezier Chart) */}');

// 3. Remove "현재 가동 중인 포트폴리오 비중"
content = content.replace(/<span style=\{\{ fontSize: '10px', color: 'var\(--text-muted\)', display: 'block' \}\}>현재 가동 중인 포트폴리오 비중<\/span>[\s\S]*?<\/span>\s*<\/div>/g, '<div><span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>현재 가동 중인 자동 투자 자산</span><span style={{ fontSize: "14px", fontWeight: "700", color: "#FFF", marginTop: "2px", display: "block" }}>🟢 SUT 단일 풀 (100%)</span></div>');

// 4. Change POL/USDT individual assets to just SUT
const individualAssetsRegex = /\{\/\* 개별 자산 정보 \*\/\}[\s\S]*?\{\/\* 📊 \[Rejard님 특급 승인\] 실시간 포트폴리오 & 수익률 시각화 차트 패널 \*\/\}/g;
const sutAssetUI = `{/* 개별 자산 정보 */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SUT 투자 풀 운용 가치</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#F3F4F6', margin: '4px 0' }}>
                  {portfolio.totalValuation.toFixed(2)} SUT
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dark)' }}>
                  현재 AI가 100% SUT 풀로 자동 복리 운용 중입니다.
                </div>
              </div>
            </div>

            {/* 📊 [Rejard님 특급 승인] 실시간 포트폴리오 & 수익률 시각화 차트 패널 */}`;
content = content.replace(individualAssetsRegex, sutAssetUI);

// 5. Replace references to USDT with SUT across the file, except where inappropriate
// Be careful not to break API calls, but the UI should show SUT instead of USDT
content = content.replace(/USDT/g, 'SUT');
content = content.replace(/ratioUsdt/g, 'ratioSut');

// Remove the AI Active and Dashboard title POL text
content = content.replace(/🟣 POL \/ 🟢 SUT 슬라이더를 밀어 원하시는 비율로 조절합니다\./g, 'SUT 기반 자동 투자가 실시간으로 가동되고 있습니다.');

// 6. Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('Dashboard refactored successfully.');
