const { runMassEvolution, getSimulationStatus } = require('./massEvolution');

const scale = process.argv[2] || 'small';
console.log(`[RUN] Starting ${scale} evolution...`);
console.log(`[RUN] Time: ${new Date().toISOString()}`);

runMassEvolution({ scale })
  .then(() => {
    const status = getSimulationStatus();
    console.log(`[RUN] Evolution completed!`);
    console.log(`[RUN] Final status:`, JSON.stringify(status, null, 2));
    console.log(`[RUN] Time: ${new Date().toISOString()}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`[RUN] Evolution failed:`, err.message, err.stack);
    process.exit(1);
  });
