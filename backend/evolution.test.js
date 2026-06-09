const assert = require('assert');
const {
  classifyCouncilMember,
  runDailyEvolution,
} = require('./evolution');

assert.strictEqual(classifyCouncilMember({ correct_count: 6, total_count: 10 }), 'ELITE');
assert.strictEqual(classifyCouncilMember({ correct_count: 5, total_count: 10 }), 'MAINTAINED');
assert.strictEqual(classifyCouncilMember({ correct_count: 3, total_count: 10 }), 'WATCH');
assert.strictEqual(classifyCouncilMember({ correct_count: 1, total_count: 10 }), 'UNDERPERFORMING');
assert.strictEqual(classifyCouncilMember({ correct_count: 0, total_count: 0 }), 'INSUFFICIENT_DATA');

const writes = [];
const fakeStore = {
  async all() {
    return [
      { member_id: 'a', correct_count: 6, total_count: 10 },
      { member_id: 'b', correct_count: 1, total_count: 10 },
    ];
  },
  async run(sql, params) {
    writes.push({ sql, params });
  },
};

runDailyEvolution(fakeStore).then((result) => {
  assert.deepStrictEqual(result, {
    elite: 1,
    maintained: 0,
    watch: 0,
    underperforming: 1,
    insufficientData: 0,
    shadowOnly: true,
  });
  assert.strictEqual(writes.length, 0);
  console.log('evolution tests passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
