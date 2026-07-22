export function decisionLabel(decision) {
  return decision === 'BUY' ? '매수' : decision === 'SELL' ? '매도' : '관망';
}

export function formatAiDecisionReason(reason) {
  return String(reason || '판단 근거가 기록되지 않았습니다.')
    .replace(/\[AI .*? - (BUY|SELL|HOLD) \(([\d.]+)\?\?\/ ([\d.]+)\?\?\]/g, (_, decision, winningVotes, totalVotes) => `[AI 의회 최종 의결 - ${decisionLabel(decision)} (${winningVotes}표 / ${totalVotes}표)]`)
    .replace(/\n\?.*?:\n(?=- )/g, '\n의원별 투표 현황:\n')
    .replace(/\(([\d.]+)\?\?(?=\n|$)/g, '($1표)')
    .replace(/\[AI 의회 최종 의결 - (BUY|SELL|HOLD)/g, (_, decision) => `[AI 의회 최종 의결 - ${decisionLabel(decision)}`)
    .replace(/\[BUY\]/g, '[매수]')
    .replace(/\[SELL\]/g, '[매도]')
    .replace(/\[HOLD\]/g, '[관망]');
}
