const { queries } = require('./database.js');

function classifyCouncilMember(member) {
  const total = Number(member.total_count || 0);
  if (total < 10) return 'INSUFFICIENT_DATA';
  const accuracy = Number(member.correct_count || 0) / total;
  if (accuracy >= 0.55) return 'ELITE';
  if (accuracy >= 0.40) return 'MAINTAINED';
  if (accuracy >= 0.25) return 'WATCH';
  return 'UNDERPERFORMING';
}

async function runDailyEvolution(store = queries) {
  console.log('[AI EVOLUTION] Running Shadow council observation report.');
  const members = await store.all(`
    SELECT member_id, name, voting_power, correct_count, total_count, faction, generation
    FROM ais_council_members
    WHERE status = 'ACTIVE'
  `);

  const stats = {
    elite: 0,
    maintained: 0,
    watch: 0,
    underperforming: 0,
    insufficientData: 0,
    shadowOnly: true,
  };

  for (const member of members) {
    const classification = classifyCouncilMember(member);
    if (classification === 'ELITE') stats.elite += 1;
    else if (classification === 'MAINTAINED') stats.maintained += 1;
    else if (classification === 'WATCH') stats.watch += 1;
    else if (classification === 'UNDERPERFORMING') stats.underperforming += 1;
    else stats.insufficientData += 1;
  }

  console.log(
    `[AI EVOLUTION] Shadow-only report completed. ` +
    `Elite=${stats.elite}, maintained=${stats.maintained}, ` +
    `watch=${stats.watch}, underperforming=${stats.underperforming}.`
  );
  return stats;
}

module.exports = {
  classifyCouncilMember,
  runDailyEvolution,
};
