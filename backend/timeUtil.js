function parseDbTimestamp(val) {
  if (val == null) return 0;
  const n = Number(val);
  if (!isNaN(n) && n > 1e9) {
    return n < 1e12 ? n * 1000 : n;
  }
  const s = String(val);
  if (!s) return 0;
  const normalized = s.endsWith('Z') || s.includes('+') ? s : s.replace(' ', 'T') + 'Z';
  const ms = new Date(normalized).getTime();
  return isNaN(ms) ? 0 : ms;
}

function toKstDisplayString(val) {
  const ms = parseDbTimestamp(val);
  if (!ms) return '';
  return new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function toKstDateString() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(' ')[0];
}

module.exports = { parseDbTimestamp, toKstDisplayString, toKstDateString };
