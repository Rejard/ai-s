const { queries } = require('./database.js');

async function runDailyEvolution() {
  console.log("[🧬 AI EVOLUTION] Starting Daily Council Evolution...");

  try {
    // Find dominant faction for Tier 3 adaptation
    const dominantRow = await queries.get(`
      SELECT faction, COUNT(*) as count 
      FROM ais_council_members 
      WHERE status = 'ACTIVE' 
      GROUP BY faction 
      ORDER BY count DESC 
      LIMIT 1
    `);
    const dominantFaction = dominantRow ? dominantRow.faction : 'TREND_FOLLOWER';

    // Get all active members with at least 10 votes
    const members = await queries.all(`
      SELECT member_id, name, voting_power, correct_count, total_count, faction, generation
      FROM ais_council_members
      WHERE status = 'ACTIVE' AND total_count >= 10
    `);

    let stats = { elite: 0, maintained: 0, adapted: 0, dead: 0 };

    for (const m of members) {
      const accuracy = m.correct_count / m.total_count;

      if (accuracy >= 0.55) {
        // Tier 1: Elite
        let newPower = Math.min(m.voting_power + 0.1, 2.0);
        await queries.run(
          "UPDATE ais_council_members SET voting_power = ? WHERE member_id = ?",
          [newPower, m.member_id]
        );
        stats.elite++;
      } else if (accuracy >= 0.40) {
        // Tier 2: Maintained
        stats.maintained++;
      } else if (accuracy >= 0.25) {
        // Tier 3: Adapted
        let newPower = Math.max(m.voting_power - 0.2, 0.5);
        let newGeneration = m.generation + 1;
        await queries.run(`
          UPDATE ais_council_members 
          SET faction = ?, generation = ?, voting_power = ?, correct_count = 0, total_count = 0 
          WHERE member_id = ?
        `, [dominantFaction, newGeneration, newPower, m.member_id]);
        stats.adapted++;
      } else {
        // Tier 4: Dead
        await queries.run("UPDATE ais_council_members SET status = 'DEAD' WHERE member_id = ?", [m.member_id]);
        
        // Spawn Replacement
        const randomNum = Math.floor(Math.random() * 9000) + 1000;
        const newMemberId = 'ais_member_spawn_' + randomNum + '_' + Date.now().toString().slice(-4);
        const newName = 'Evolved Rookie ' + randomNum;
        
        // Default weights for mutant
        const weights = {
          smaWeight: 0.25,
          rsiWeight: 0.25,
          bbWeight: 0.25,
          macdWeight: 0.25
        };

        await queries.run(`
          INSERT INTO ais_council_members 
          (member_id, name, weights_json, voting_power, correct_count, total_count, status, faction, generation)
          VALUES (?, ?, ?, 0.5, 0, 0, 'ACTIVE', 'MUTANT_ROOKIE', 1)
        `, [newMemberId, newName, JSON.stringify(weights)]);
        
        stats.dead++;
      }
    }

    console.log(`[🧬 AI EVOLUTION] Completed. Elites: ${stats.elite}, Maintained: ${stats.maintained}, Adapted: ${stats.adapted}, Replaced(Dead): ${stats.dead}`);
    return stats;

  } catch (error) {
    console.error("[❌ AI EVOLUTION] Failed to run evolution:", error.message);
    throw error;
  }
}

module.exports = {
  runDailyEvolution
};
