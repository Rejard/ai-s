const assert = require('assert');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { bootstrapCouncilDnaPayload } = require('./database');

const VALID_WEIGHTS = '{"BUY":[0.1,0.2,0.3,0.4,0.5],"SELL":[0.5,0.4,0.3,0.2,0.1],"HOLD":[0.3,0.3,0.3,0.3,0.3]}';

const CREATE_TABLE_SQL = `
  CREATE TABLE ais_council_members (
    member_id TEXT PRIMARY KEY,
    name TEXT,
    weights_json TEXT,
    dna_json TEXT,
    phenotype_json TEXT,
    voting_power REAL DEFAULT 1.0,
    status TEXT DEFAULT 'ACTIVE',
    faction TEXT,
    generation INTEGER DEFAULT 1,
    correct_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0
  )
`;

function createStore() {
  const db = new sqlite3.Database(':memory:');
  const store = {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function onDone(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    },
    close() { db.close(); },
  };
  return store;
}

async function repairAiCouncilStateImpl(store) {
  const totalRow = await store.get("SELECT COUNT(*) AS count FROM ais_council_members");
  let total = totalRow ? totalRow.count : 0;
  if (total <= 11) return { total, active: total, repaired: false };

  const initialIds = Array.from(
    { length: 11 },
    (_, index) => `ais_member_${String(index + 1).padStart(2, '0')}`
  );
  const placeholders = initialIds.map(() => '?').join(',');
  await store.run(
    `UPDATE ais_council_members
     SET status = 'CANDIDATE'
     WHERE status = 'ACTIVE'
       AND total_count = 0
       AND member_id IN (${placeholders})`,
    initialIds
  );

  while (total < 500) {
    const seed = await store.get(`
      SELECT weights_json, faction, generation
      FROM ais_council_members
      ORDER BY RANDOM()
      LIMIT 1
    `);
    const memberId = `mutant_refill_${crypto.randomUUID().replace(/-/g, '')}`;
    const weights = JSON.parse(seed.weights_json);
    const dnaPayload = bootstrapCouncilDnaPayload(
      weights,
      memberId,
      seed.faction || 'MUTANT_ROOKIE',
      seed.generation || 1
    );
    await store.run(`
      INSERT INTO ais_council_members
        (member_id, name, weights_json, dna_json, phenotype_json, voting_power, status, faction, generation)
      VALUES (?, ?, ?, ?, ?, 1.0, 'CANDIDATE', ?, ?)
    `, [
      memberId,
      `Mutant Pool Refill ${total + 1}`,
      seed.weights_json,
      dnaPayload.dna_json,
      dnaPayload.phenotype_json,
      seed.faction || 'MUTANT_ROOKIE',
      seed.generation || 1,
    ]);
    total += 1;
  }

  const activeRow = await store.get(
    "SELECT COUNT(*) AS count FROM ais_council_members WHERE status = 'ACTIVE'"
  );
  return { total, active: activeRow.count, repaired: true };
}

async function insertMember(store, memberId, overrides = {}) {
  const defaults = {
    name: memberId,
    weights_json: VALID_WEIGHTS,
    dna_json: '{"genome_id":"g1"}',
    phenotype_json: VALID_WEIGHTS,
    voting_power: 1.0,
    status: 'ACTIVE',
    faction: 'VALUE_SEEKER',
    generation: 1,
    correct_count: 0,
    total_count: 0,
  };
  const m = { ...defaults, ...overrides };
  await store.run(`
    INSERT INTO ais_council_members
      (member_id, name, weights_json, dna_json, phenotype_json, voting_power, status, faction, generation, correct_count, total_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [memberId, m.name, m.weights_json, m.dna_json, m.phenotype_json, m.voting_power, m.status, m.faction, m.generation, m.correct_count, m.total_count]);
}

async function main() {
  {
    const store = createStore();
    await store.run(CREATE_TABLE_SQL);
    for (let i = 1; i <= 11; i++) {
      await insertMember(store, `ais_member_${String(i).padStart(2, '0')}`);
    }
    const result = await repairAiCouncilStateImpl(store);
    assert.strictEqual(result.repaired, false, 'T1: no repair when total <= 11');
    assert.strictEqual(result.total, 11, 'T1: total is 11');
    store.close();
  }

  {
    const store = createStore();
    await store.run(CREATE_TABLE_SQL);
    for (let i = 1; i <= 11; i++) {
      await insertMember(store, `ais_member_${String(i).padStart(2, '0')}`, { total_count: 0 });
    }
    await insertMember(store, 'extra_member_12', { status: 'CANDIDATE' });
    const result = await repairAiCouncilStateImpl(store);
    assert.strictEqual(result.repaired, true, 'T2: repair triggered');
    const demoted = await store.all(
      "SELECT member_id, status FROM ais_council_members WHERE member_id LIKE 'ais_member_%' AND status = 'CANDIDATE'"
    );
    assert.strictEqual(demoted.length, 11, 'T2: all 11 initial members demoted to CANDIDATE');
    store.close();
  }

  {
    const store = createStore();
    await store.run(CREATE_TABLE_SQL);
    await insertMember(store, 'ais_member_01', { total_count: 5 });
    await insertMember(store, 'ais_member_02', { total_count: 0 });
    for (let i = 3; i <= 11; i++) {
      await insertMember(store, `ais_member_${String(i).padStart(2, '0')}`, { total_count: 0 });
    }
    await insertMember(store, 'extra_member_12', { status: 'CANDIDATE' });
    await repairAiCouncilStateImpl(store);
    const member01 = await store.get("SELECT status FROM ais_council_members WHERE member_id = 'ais_member_01'");
    assert.strictEqual(member01.status, 'ACTIVE', 'T3: member with total_count>0 NOT demoted');
    const member02 = await store.get("SELECT status FROM ais_council_members WHERE member_id = 'ais_member_02'");
    assert.strictEqual(member02.status, 'CANDIDATE', 'T3: member with total_count=0 IS demoted');
    store.close();
  }

  {
    const store = createStore();
    await store.run(CREATE_TABLE_SQL);
    for (let i = 1; i <= 12; i++) {
      await insertMember(store, `member_${i}`, { status: i <= 11 ? 'ACTIVE' : 'CANDIDATE' });
    }
    const result = await repairAiCouncilStateImpl(store);
    assert.strictEqual(result.total, 500, 'T4: pool filled to exactly 500');
    const countRow = await store.get("SELECT COUNT(*) AS cnt FROM ais_council_members");
    assert.strictEqual(countRow.cnt, 500, 'T4: DB has 500 rows');
    store.close();
  }

  {
    const store = createStore();
    await store.run(CREATE_TABLE_SQL);
    for (let i = 1; i <= 12; i++) {
      await insertMember(store, `member_${i}`, { status: i <= 11 ? 'ACTIVE' : 'CANDIDATE' });
    }
    await repairAiCouncilStateImpl(store);
    const nullFactions = await store.get("SELECT COUNT(*) AS cnt FROM ais_council_members WHERE faction IS NULL");
    assert.strictEqual(nullFactions.cnt, 0, 'T5: no null factions after refill');
    store.close();
  }

  {
    const store = createStore();
    await store.run(CREATE_TABLE_SQL);
    for (let i = 1; i <= 12; i++) {
      await insertMember(store, `member_${i}`, { status: i <= 11 ? 'ACTIVE' : 'CANDIDATE' });
    }
    await repairAiCouncilStateImpl(store);
    const nullDna = await store.get("SELECT COUNT(*) AS cnt FROM ais_council_members WHERE dna_json IS NULL OR dna_json = ''");
    assert.strictEqual(nullDna.cnt, 0, 'T6: no null dna_json after refill');
    store.close();
  }

  {
    const store = createStore();
    await store.run(CREATE_TABLE_SQL);
    for (let i = 1; i <= 12; i++) {
      await insertMember(store, `member_${i}`, {
        status: i <= 11 ? 'ACTIVE' : 'CANDIDATE',
        faction: null,
      });
    }
    await repairAiCouncilStateImpl(store);
    const refilled = await store.all(
      "SELECT faction FROM ais_council_members WHERE member_id LIKE 'mutant_refill_%'"
    );
    assert.ok(refilled.length > 0, 'T7: refilled members exist');
    const allMutantRookie = refilled.every(r => r.faction === 'MUTANT_ROOKIE');
    assert.ok(allMutantRookie, 'T7: null seed faction falls back to MUTANT_ROOKIE');
    store.close();
  }

  {
    const store = createStore();
    await store.run(CREATE_TABLE_SQL);
    for (let i = 1; i <= 12; i++) {
      await insertMember(store, `member_${i}`, {
        status: i <= 11 ? 'ACTIVE' : 'CANDIDATE',
        generation: null,
      });
    }
    await repairAiCouncilStateImpl(store);
    const refilled = await store.all(
      "SELECT generation FROM ais_council_members WHERE member_id LIKE 'mutant_refill_%'"
    );
    assert.ok(refilled.length > 0, 'T8: refilled members exist');
    const allGen1 = refilled.every(r => r.generation === 1);
    assert.ok(allGen1, 'T8: null seed generation falls back to 1');
    store.close();
  }

  console.log('repairAiCouncilState tests passed');
}

main().catch(e => { console.error(e); process.exit(1); });
