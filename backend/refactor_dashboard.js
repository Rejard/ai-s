const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\{\/\* Slider Area \*\/\}[\s\S]*?\{\/\* Handwritten-level Disclaimer Agreement Terms \*\/\}/g, '{/* Handwritten-level Disclaimer Agreement Terms */}');

content = content.replace(/\{\/\* 1\) Asset Distribution Donut Chart \(Donut Chart\) \*\/\}[\s\S]*?\{\/\* 2\) Real-time Profit Rate Line Bezier Chart \(Line Bezier Chart\) \*\/\}/g, '{/* 2) Real-time Profit Rate Line Bezier Chart (Line Bezier Chart) */}');

content = content.replace(/<span style=\{\{ fontSize: '10px', color: 'var\(--text-muted\)', display: 'block' \}\}>Current operating portfolio weight<\/span>[\s\S]*?<\/span>\s*<\/div>/g, '<div><span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Currently operating automated investment assets</span><span style={{ fontSize: "14px", fontWeight: "700", color: "#FFF", marginTop: "2px", display: "block" }}>🟢 SUT Single Pool (100%)</span></div>');

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

content = content.replace(/USDT/g, 'SUT');
content = content.replace(/ratioUsdt/g, 'ratioSut');

content = content.replace(/🟣 POL \/ 🟢 SUT slider to adjust to the desired ratio\./g, 'SUT-based automated investing is running in real time.');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Dashboard refactored successfully.');
