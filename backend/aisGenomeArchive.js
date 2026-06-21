function appendFitnessHistory(dna, fitnessEntry) {
  const nextGenome = {
    ...dna,
    fitness_history: Array.isArray(dna.fitness_history) ? [...dna.fitness_history] : [],
  };
  nextGenome.fitness_history.push({
    validationScore: Number(fitnessEntry.validationScore),
    holdoutScore: fitnessEntry.holdoutScore == null ? null : Number(fitnessEntry.holdoutScore),
    runKey: String(fitnessEntry.runKey),
  });
  return nextGenome;
}

async function archiveGenome(store, { memberId, archiveReason, dna }) {
  await store.run(`
    INSERT INTO ais_genome_archive (
      member_id,
      genome_id,
      generation,
      archive_reason,
      dna_json
    ) VALUES (?, ?, ?, ?, ?)
  `, [
    memberId,
    dna.genome_id,
    Number(dna.generation || 1),
    archiveReason,
    JSON.stringify(dna),
  ]);
}

module.exports = {
  appendFitnessHistory,
  archiveGenome,
};
