const { queries } = require('./database.js');
async function check() {
  try {
    const row = await queries.get("SELECT * FROM ais_council_members WHERE status = 'ACTIVE' ORDER BY voting_power DESC LIMIT 1");
    console.log('Top Chairman:', row);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
check();
