const fs = require('fs');

function extractInfo(file) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Extract Headings
  const headings = [...content.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/g)]
    .map(m => m[1].replace(/<[^>]*>/g, '').trim())
    .filter(x => x);

  // Extract common English UI terms
  const englishTerms = [...content.matchAll(/([A-Z][a-zA-Z\s]+)/g)]
    .map(m => m[1].trim())
    .filter(x => x.length > 2 && !['div', 'span', 'style', 'const', 'import', 'return', 'function', 'className'].includes(x));
    
  return { headings, englishTerms: [...new Set(englishTerms)] };
}

console.log("== PC Dashboard ==");
const pcInfo = extractInfo('frontend/src/pages/PcManagerDashboard.jsx');
console.log(pcInfo.headings);

console.log("\n== Mobile Dashboard ==");
const mobileInfo = extractInfo('frontend/src/pages/ManagerDashboard.jsx');
console.log(mobileInfo.headings);
