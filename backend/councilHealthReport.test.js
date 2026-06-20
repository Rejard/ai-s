const assert = require('assert');
const { buildCouncilHealthReport } = require('./councilHealthReport');

function makeWeights(value) {
  return JSON.stringify({
    BUY: [value, value + 0.1],
    SELL: [value + 0.2, value + 0.3],
    HOLD: [value + 0.4, value + 0.5],
  });
}

function buildMembers() {
  return [
    { phenotype_json: makeWeights(0.1) },
    { phenotype_json: makeWeights(0.8) },
  ];
}

function run() {
  const report = buildCouncilHealthReport({
    totalCount: 500,
    allMembers: buildMembers(),
    latestRun: {
      run_key: 'ais_run_20260614021901_9eda6aba',
      created_at: '2026-06-13 17:19:01',
      completed_at: '2026-06-14 02:19:06',
    },
  });

  assert.equal(report.elapsedSeconds, 5);
  assert.equal(report.computationMargin, 98.3);
  assert.equal(report.rawStdDev, 0.495);
  assert.equal(report.diagnosticClass, 'success');
}

run();
console.log('councilHealthReport tests passed');
