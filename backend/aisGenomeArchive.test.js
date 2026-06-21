const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const tempDbPath = path.join(os.tmpdir(), `ais-genome-archive-${process.pid}-${Date.now()}.db`);
  process.env.AIS_DB_PATH = tempDbPath;

  const database = require('./database');
  const { archiveGenome, appendFitnessHistory } = require('./aisGenomeArchive');

  try {
    await database.initializeDatabase();

    const baseGenome = {
      genome_id: 'AISG-G3-test0001',
      generation: 3,
      lineage: {
        parent_ids: ['AISG-G2-parent01'],
        ancestor_ids: ['seed'],
        innovation_ids: [1, 2, 3],
      },
      regulatory_profile: {
        expression_budget: 12,
        dominance_bias: 1,
        decay_resistance: 0.3,
        reactivation_bias: 0.1,
      },
      strategy_genes: [],
      mutation_log: [],
    };

    const archivedGenome = appendFitnessHistory(baseGenome, {
      validationScore: 54.2,
      holdoutScore: 52.1,
      runKey: 'run-1',
    });

    await archiveGenome(database.queries, {
      memberId: 'member-1',
      archiveReason: 'CULLED_LOW_PERFORMANCE',
      dna: archivedGenome,
    });

    const archiveRow = await database.queries.get(`
      SELECT member_id, genome_id, generation, archive_reason, dna_json
      FROM ais_genome_archive
      WHERE member_id = 'member-1'
    `);

    assert.equal(archiveRow.member_id, 'member-1');
    assert.equal(archiveRow.genome_id, 'AISG-G3-test0001');
    assert.equal(archiveRow.generation, 3);
    assert.equal(archiveRow.archive_reason, 'CULLED_LOW_PERFORMANCE');

    const storedGenome = JSON.parse(archiveRow.dna_json);
    assert.deepEqual(
      storedGenome.fitness_history.at(-1),
      { validationScore: 54.2, holdoutScore: 52.1, runKey: 'run-1' }
    );
  } finally {
    await new Promise((resolve) => database.db.close(resolve));
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    delete process.env.AIS_DB_PATH;
  }

  console.log('aisGenomeArchive tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
