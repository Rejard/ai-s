const sqlite3 = require('sqlite3').verbose(); 
const db = new sqlite3.Database('platform.db'); 
db.run("DELETE FROM payments WHERE tx_hash = '0xSimulatedMasterWelcomeSeed'", (err) => { 
  if(err) console.error(err); 
  else console.log('Deleted fake deposits.'); 
  db.close(); 
});
