const { queries } = require('./database.js');
async function checkMaxGen() {
  try {
    const row = await queries.get("SELECT MAX(generation) as max_gen FROM ais_council_members");
    console.log('Max Generation:', row.max_gen);
    
    const countRow = await queries.get("SELECT COUNT(*) as count FROM ais_council_members WHERE generation = ?", [row.max_gen]);
    console.log('Count in Max Gen:', countRow.count);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
checkMaxGen();
