const { queries } = require('./database.js');
async function checkGen1() {
  try {
    const row = await queries.get("SELECT COUNT(*) as count FROM ais_council_members WHERE generation = 1");
    console.log('Total 1st Gen Alive:', row.count);
    
    const topGen1 = await queries.get("SELECT * FROM ais_council_members WHERE generation = 1 ORDER BY voting_power DESC LIMIT 1");
    if (topGen1) {
        console.log('Top 1st Gen Alive:', topGen1.name, 'Status:', topGen1.status, 'Voting Power:', topGen1.voting_power, 'Score:', topGen1.correct_count);
    } else {
        console.log('No 1st Gen members alive.');
    }
    
    const activeGen1 = await queries.get("SELECT COUNT(*) as count FROM ais_council_members WHERE generation = 1 AND status = 'ACTIVE'");
    console.log('Active 1st Gen Members (Top 11):', activeGen1.count);

  } catch(e) {
    console.error(e);
  }
  process.exit();
}
checkGen1();
