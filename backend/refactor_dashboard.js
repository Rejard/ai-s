const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove slider UI completely
content = content.replace(/\{\/\* Slider Area \*\/\}[\s\S]*?\{\/\* Handwritten-level Disclaimer Agreement Terms \*\/\}/g, '{/* Handwritten-level Disclaimer Agreement Terms */}');

// 2. Remove Donut Chart completely
content = content.replace(/\{\/\* 1\) Asset Distribution Donut Chart \(Donut Chart\) \*\/\}[\s\S]*?\{\/\* 2\) Real-time Profit Rate Line Bezier Chart \(Line Bezier Chart\) \*\/\}/g, '{/* 2) Real-time Profit Rate Line Bezier Chart (Line Bezier Chart) */}');

// 3. Remove "Current operating portfolio weight"
content = content.replace(/<span style=\{\{ fontSize: '10px', color: 'var\(--text-muted\)', display: 'block' \}\}>Current operating portfolio weight<\/span>[\s\S]*?<\/span>\s*<\/div>/g, '<div><span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Currently operating automated investment assets</span><span style={{ fontSize: "14px", fontWeight: "700", color: "#FFF", marginTop: "2px", display: "block" }}>🟢 SUT Single Pool (100%)</span></div>');

// 4. Change POL/USDT individual assets to just SUT
const individualAssetsRegex = /\{\/\* Individual Asset Information \*\/\}[\s\S]*?\{\/\* 📊 \[Rejard Special Approval\] Real-time Portfolio & Yield Visualization Chart Panel \*\/\}/g;
const sutAssetUI = `{/* Individual Asset Information */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SUT Investment Pool Operating Value</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#F3F4F6', margin: '4px 0' }}>
                  {portfolio.totalValuation.toFixed(2)} SUT
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dark)' }}>
                  Currently, AI is automatically compounding 100% in the SUT pool.
                </div>
              </div>
            </div>

            {/* 📊 [Rejard Special Approval] Real-time Portfolio & Yield Visualization Chart Panel */}`;
content = content.replace(individualAssetsRegex, sutAssetUI);

// 5. Replace references to USDT with SUT across the file, except where inappropriate
// Be careful not to break API calls, but the UI should show SUT instead of USDT
content = content.replace(/USDT/g, 'SUT');
content = content.replace(/ratioUsdt/g, 'ratioSut');

// Remove the AI Active and Dashboard title POL text
content = content.replace(/🟣 POL \/ 🟢 SUT slider to adjust to the desired ratio\./g, 'SUT-based automated investing is running in real time.');

// 6. Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('Dashboard refactored successfully.');
