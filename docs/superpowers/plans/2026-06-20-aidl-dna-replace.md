# AIDL DNA Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AiS council's `weights_json`-first genome with an `dna_json`-first genome and deterministic phenotype expression pipeline without breaking the current evaluation safety contract.

**Architecture:** Introduce a small DNA domain layer in Python and Node that separates genome storage, expression planning, phenotype assembly, and selection. Migrate the database to store canonical `dna_json` plus derived `phenotype_json`, bootstrap existing candidates into DNA, then move training and read paths to DNA-first behavior while preserving temporary compatibility mirrors during the cutover.

**Tech Stack:** Node.js, Python 3, sqlite3, existing AiS evaluation pipeline, plain Node assertion tests, Python `unittest`

---

## File Structure

- Create: `backend/ais_dna.py`
  - Canonical DNA helpers for Python: schema constants, bootstrap from legacy centroids, validation, state helpers, expression planning, phenotype assembly.
- Create: `backend/ais_dna.test.py`
  - Unit tests for DNA validation, bootstrap, transcriber, ribosome, and state gating.
- Create: `backend/aisDnaSummary.js`
  - Node helper for extracting admin-readable DNA metadata from stored `dna_json`.
- Create: `backend/aisDnaSummary.test.js`
  - Unit tests for Node DNA summary helpers.
- Modify: `backend/train_ais.py`
  - Replace direct centroid-first reproduction with DNA-first reproduction and phenotype assembly.
- Modify: `backend/test_ais_features.py`
  - Extend tests to cover DNA-generated phenotype centroids remaining schema-compatible.
- Modify: `backend/ais_inference.py`
  - Load phenotype from `phenotype_json`, with temporary fallback behavior during migration.
- Modify: `backend/database.js`
  - Add `dna_json` and `phenotype_json` schema migration, bootstrap existing rows, and update repair logic.
- Modify: `backend/aisAdminStats.js`
  - Expose DNA metadata in latest run summaries if available.
- Modify: `backend/aisAdminStats.test.js`
  - Verify DNA-aware stats contract remains stable.
- Modify: `backend/councilHealthReport.js`
  - Prefer `phenotype_json` when computing diversity, falling back only if needed during cutover.
- Modify: `backend/councilHealthReport.test.js`
  - Add phenotype-first diversity coverage.
- Modify: `backend/routes/admin.js`
  - Read DNA-aware council member fields for admin reporting.
- Modify: `backend/routes/investment.js`
  - Mirror DNA-aware council member reads for admin-only investment council stats.
- Modify: `frontend/src/lib/aisTrainingView.js`
  - Accept DNA summary fields from admin stats.
- Modify: `frontend/src/lib/aisTrainingView.test.mjs`
  - Preserve parsing contract for new DNA metadata.
- Modify: `frontend/src/components/AisTrainingEvidence.jsx`
  - Render DNA-related evidence if exposed by the backend.
- Documentation only: `docs/superpowers/specs/2026-06-20-aidl-dna-replace-design.md`
  - Reference only; no edits expected unless implementation reveals a contradiction.

### Task 1: Add the Canonical DNA Domain Layer

**Files:**
- Create: `backend/ais_dna.py`
- Test: `backend/ais_dna.test.py`
- Modify: `backend/test_ais_features.py`

- [ ] **Step 1: Write the failing DNA validation and bootstrap tests**

```python
import unittest

from ais_dna import (
    bootstrap_dna_from_legacy,
    build_expression_plan,
    build_phenotype_from_dna,
    validate_dna,
)
from ais_features import validate_centroids


class AiSDnaTests(unittest.TestCase):
    def test_bootstrap_from_legacy_centroids_builds_valid_dna(self):
        legacy = {
            "BUY": [-0.5, -0.4, 0.1, 0.0, 0.05],
            "SELL": [0.4, 0.3, -0.1, -0.05, 0.02],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }
        dna = bootstrap_dna_from_legacy(
            legacy,
            member_id="legacy_member_01",
            faction="VALUE_SEEKER",
            generation=2,
        )
        self.assertTrue(validate_dna(dna))
        self.assertEqual(dna["generation"], 2)
        self.assertGreaterEqual(len(dna["strategy_genes"]), 1)

    def test_expression_plan_excludes_inactive_and_lethal_genes(self):
        dna = {
            "genome_id": "g1",
            "generation": 1,
            "lineage": {"parent_ids": [], "ancestor_ids": ["seed"], "innovation_ids": [1, 2, 3]},
            "regulatory_profile": {"expression_budget": 12, "dominance_bias": 1.0, "decay_resistance": 0.3, "reactivation_bias": 0.1},
            "strategy_genes": [
                {
                    "gene_id": "sg1",
                    "innovation_id": 1,
                    "state": "A",
                    "dominance": 1.0,
                    "copy_number": 1,
                    "length": 3,
                    "subgenes": [
                        {"gene_id": "buy_active", "innovation_id": 2, "state": "A", "feature": "rsi_scaled", "action": "BUY", "weight": -0.6, "threshold": -0.4, "priority": 1.0},
                        {"gene_id": "buy_inactive", "innovation_id": 3, "state": "I", "feature": "price_change_pct", "action": "BUY", "weight": 0.5, "threshold": 0.0, "priority": 1.0},
                        {"gene_id": "buy_lethal", "innovation_id": 4, "state": "L", "feature": "sma5_distance_pct", "action": "BUY", "weight": 0.9, "threshold": 0.0, "priority": 1.0},
                    ],
                }
            ],
            "mutation_log": [],
        }
        plan = build_expression_plan(dna)
        gene_ids = [gene["gene_id"] for gene in plan["expressed_subgenes"]]
        self.assertIn("buy_active", gene_ids)
        self.assertNotIn("buy_inactive", gene_ids)
        self.assertNotIn("buy_lethal", gene_ids)

    def test_ribosome_output_stays_centroid_compatible(self):
        legacy = {
            "BUY": [-0.5, -0.4, 0.1, 0.0, 0.05],
            "SELL": [0.4, 0.3, -0.1, -0.05, 0.02],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }
        dna = bootstrap_dna_from_legacy(
            legacy,
            member_id="legacy_member_02",
            faction="VALUE_SEEKER",
            generation=1,
        )
        phenotype = build_phenotype_from_dna(dna)
        self.assertTrue(validate_centroids(phenotype))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the failing Python DNA test**

Run: `python backend/ais_dna.test.py`
Expected: FAIL with `ModuleNotFoundError` or `cannot import name 'bootstrap_dna_from_legacy'`

- [ ] **Step 3: Implement the minimal DNA domain module**

```python
import copy
import uuid

FEATURE_ORDER = [
    "price_change_pct",
    "rsi_scaled",
    "sma5_distance_pct",
    "sma20_distance_pct",
    "sma5_to_sma20_spread_pct",
]

AIDL_STATES = {"A", "I", "D", "L"}


def _new_genome_id():
    return f"gen_{uuid.uuid4().hex}"


def _base_profile():
    return {
        "expression_budget": 12,
        "dominance_bias": 1.0,
        "decay_resistance": 0.3,
        "reactivation_bias": 0.1,
    }


def validate_dna(dna):
    if not isinstance(dna, dict):
        return False
    if not isinstance(dna.get("strategy_genes"), list) or not dna["strategy_genes"]:
        return False
    for strategy in dna["strategy_genes"]:
        if strategy.get("state") not in AIDL_STATES:
            return False
        if not isinstance(strategy.get("subgenes"), list):
            return False
        for subgene in strategy["subgenes"]:
            if subgene.get("state") not in AIDL_STATES:
                return False
            if subgene.get("feature") not in FEATURE_ORDER:
                return False
            if subgene.get("action") not in ("BUY", "SELL", "HOLD"):
                return False
    return True


def bootstrap_dna_from_legacy(legacy_centroids, member_id, faction, generation):
    strategy_gene = {
        "gene_id": f"sg_{member_id}",
        "innovation_id": 1,
        "state": "A",
        "dominance": 1.0,
        "copy_number": 1,
        "length": len(FEATURE_ORDER),
        "subgenes": [],
    }
    innovation_id = 2
    for action in ("BUY", "SELL", "HOLD"):
        vector = legacy_centroids[action]
        for feature, weight in zip(FEATURE_ORDER, vector):
            strategy_gene["subgenes"].append({
                "gene_id": f"{member_id}_{action}_{feature}",
                "innovation_id": innovation_id,
                "state": "A",
                "feature": feature,
                "action": action,
                "weight": float(weight),
                "threshold": 0.0,
                "priority": 1.0,
            })
            innovation_id += 1
    dna = {
        "genome_id": _new_genome_id(),
        "generation": int(generation or 1),
        "faction_hint": faction,
        "lineage": {
            "parent_ids": [],
            "ancestor_ids": [member_id],
            "innovation_ids": list(range(1, innovation_id)),
        },
        "regulatory_profile": _base_profile(),
        "strategy_genes": [strategy_gene],
        "mutation_log": [],
    }
    return dna


def build_expression_plan(dna):
    expressed = []
    for strategy in dna.get("strategy_genes", []):
        if strategy.get("state") == "L":
            continue
        for subgene in strategy.get("subgenes", []):
            if subgene.get("state") == "A":
                expressed.append(copy.deepcopy(subgene))
            elif subgene.get("state") == "D":
                weakened = copy.deepcopy(subgene)
                weakened["weight"] = float(weakened["weight"]) * 0.5
                expressed.append(weakened)
    return {"genome_id": dna.get("genome_id"), "expressed_subgenes": expressed}


def build_phenotype_from_dna(dna):
    plan = build_expression_plan(dna)
    phenotype = {"BUY": [0.0] * 5, "SELL": [0.0] * 5, "HOLD": [0.0] * 5}
    counts = {"BUY": [0] * 5, "SELL": [0] * 5, "HOLD": [0] * 5}
    for subgene in plan["expressed_subgenes"]:
        action = subgene["action"]
        index = FEATURE_ORDER.index(subgene["feature"])
        phenotype[action][index] += float(subgene["weight"])
        counts[action][index] += 1
    for action in phenotype:
        phenotype[action] = [
            phenotype[action][idx] / counts[action][idx] if counts[action][idx] else phenotype[action][idx]
            for idx in range(5)
        ]
    return phenotype
```

- [ ] **Step 4: Extend the existing feature test to cover DNA-generated phenotypes**

```python
from ais_dna import bootstrap_dna_from_legacy, build_phenotype_from_dna

    def test_dna_bootstrap_and_expression_produce_valid_centroids(self):
        legacy = {
            "BUY": [-0.4, -0.3, 0.1, 0.0, 0.02],
            "SELL": [0.3, 0.2, -0.1, -0.02, 0.01],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }
        dna = bootstrap_dna_from_legacy(legacy, "legacy_member_x", "VALUE_SEEKER", 1)
        phenotype = build_phenotype_from_dna(dna)
        self.assertTrue(validate_centroids(phenotype))
```

- [ ] **Step 5: Run the Python DNA and feature tests**

Run: `python backend/ais_dna.test.py && python backend/test_ais_features.py`
Expected: PASS with both suites green

- [ ] **Step 6: Commit the DNA domain foundation**

```bash
git add backend/ais_dna.py backend/ais_dna.test.py backend/test_ais_features.py
git commit -m "feat: add AIDL DNA domain foundation"
```

### Task 2: Migrate SQLite Schema to DNA-First Storage

**Files:**
- Modify: `backend/database.js`
- Test: `backend/aisAdminStats.test.js`

- [ ] **Step 1: Add a failing Node test that expects DNA columns in the training stats fixture**

```js
  await store.run(`
    CREATE TABLE ais_council_members (
      member_id TEXT PRIMARY KEY,
      dna_json TEXT,
      phenotype_json TEXT,
      generation INTEGER,
      status TEXT
    )
  `);
  await store.run(`
    INSERT INTO ais_council_members (member_id, dna_json, phenotype_json, generation, status)
    VALUES (
      'm1',
      '{"genome_id":"g1","strategy_genes":[{"gene_id":"sg1","state":"A","subgenes":[]}],"lineage":{"parent_ids":[],"ancestor_ids":["seed"],"innovation_ids":[1]},"regulatory_profile":{"expression_budget":12,"dominance_bias":1,"decay_resistance":0.3,"reactivation_bias":0.1},"mutation_log":[],"generation":1}',
      '{"BUY":[0,0,0,0,0],"SELL":[0,0,0,0,0],"HOLD":[0,0,0,0,0]}',
      1,
      'ACTIVE'
    )
  `);
```

- [ ] **Step 2: Run the Node stats test to confirm current code ignores DNA metadata**

Run: `node backend/aisAdminStats.test.js`
Expected: FAIL after adding an assertion for missing DNA summary fields

- [ ] **Step 3: Add the schema migration and bootstrap hooks in `backend/database.js`**

```js
      db.run("ALTER TABLE ais_council_members ADD COLUMN dna_json TEXT", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("❌ ais_council_members 테이블 dna_json 컬럼 마이그레이션 실패:", err.message);
        }
      });

      db.run("ALTER TABLE ais_council_members ADD COLUMN phenotype_json TEXT", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.error("❌ ais_council_members 테이블 phenotype_json 컬럼 마이그레이션 실패:", err.message);
        }
      });
```

```js
async function bootstrapLegacyCouncilDna() {
  const rows = await queries.all(`
    SELECT member_id, weights_json, faction, generation
    FROM ais_council_members
    WHERE (dna_json IS NULL OR dna_json = '')
      AND weights_json IS NOT NULL
      AND weights_json != ''
  `);

  for (const row of rows) {
    try {
      const legacy = JSON.parse(row.weights_json);
      const python = require('child_process').spawnSync(
        process.platform === 'win32' ? 'py' : 'python',
        ['-c', `
import json
from ais_dna import bootstrap_dna_from_legacy, build_phenotype_from_dna
legacy = json.loads("""${JSON.stringify(JSON.stringify(legacy)).slice(1, -1)}""")
dna = bootstrap_dna_from_legacy(legacy, ${JSON.stringify(row.member_id)}, ${JSON.stringify(row.faction || 'MUTANT_ROOKIE')}, ${Number(row.generation || 1)})
phenotype = build_phenotype_from_dna(dna)
print(json.dumps({"dna": dna, "phenotype": phenotype}))
        `],
        { cwd: __dirname, encoding: 'utf8' }
      );
      if (python.status !== 0) throw new Error(python.stderr || 'DNA bootstrap failed');
      const payload = JSON.parse(python.stdout.trim());
      await queries.run(`
        UPDATE ais_council_members
        SET dna_json = ?, phenotype_json = ?
        WHERE member_id = ?
      `, [JSON.stringify(payload.dna), JSON.stringify(payload.phenotype), row.member_id]);
    } catch (error) {
      console.error(`[DNA BOOTSTRAP] ${row.member_id} bootstrap failed:`, error.message);
    }
  }
}
```

```js
          await ensureCouncilBriefingHistorySchema(queries);
          await migrateAisEvaluationSchema(db);
          await bootstrapLegacyCouncilDna();
```

- [ ] **Step 4: Run a syntax check on `backend/database.js`**

Run: `node --check backend/database.js`
Expected: PASS

- [ ] **Step 5: Re-run the admin stats test after schema-aware setup**

Run: `node backend/aisAdminStats.test.js`
Expected: PASS

- [ ] **Step 6: Commit the schema migration layer**

```bash
git add backend/database.js backend/aisAdminStats.test.js
git commit -m "feat: migrate council storage to DNA-first schema"
```

### Task 3: Add Node DNA Summaries for Admin and Reporting Readers

**Files:**
- Create: `backend/aisDnaSummary.js`
- Create: `backend/aisDnaSummary.test.js`
- Modify: `backend/aisAdminStats.js`

- [ ] **Step 1: Write the failing Node DNA summary tests**

```js
const assert = require('assert');
const { summarizeDnaStates, extractPhenotype } = require('./aisDnaSummary');

const dna = {
  strategy_genes: [
    {
      state: 'A',
      subgenes: [
        { state: 'A' },
        { state: 'I' },
        { state: 'D' },
        { state: 'L' },
      ],
    },
  ],
};

assert.deepStrictEqual(summarizeDnaStates(dna), {
  active: 2,
  inactive: 1,
  deprecated: 1,
  lethal: 1,
});

assert.deepStrictEqual(
  extractPhenotype('{"BUY":[1,0,0,0,0],"SELL":[0,1,0,0,0],"HOLD":[0,0,1,0,0]}').BUY,
  [1, 0, 0, 0, 0]
);

console.log('aisDnaSummary tests passed');
```

- [ ] **Step 2: Run the summary test to verify it fails**

Run: `node backend/aisDnaSummary.test.js`
Expected: FAIL with `Cannot find module './aisDnaSummary'`

- [ ] **Step 3: Implement the DNA summary helper**

```js
function safeParseJson(value, fallback) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value || fallback);
  } catch {
    return fallback;
  }
}

function summarizeDnaStates(dnaInput) {
  const dna = safeParseJson(dnaInput, {});
  const summary = { active: 0, inactive: 0, deprecated: 0, lethal: 0 };
  const bump = (state) => {
    if (state === 'A') summary.active += 1;
    else if (state === 'I') summary.inactive += 1;
    else if (state === 'D') summary.deprecated += 1;
    else if (state === 'L') summary.lethal += 1;
  };

  for (const strategy of dna.strategy_genes || []) {
    bump(strategy.state);
    for (const subgene of strategy.subgenes || []) bump(subgene.state);
  }
  return summary;
}

function extractPhenotype(phenotypeInput) {
  return safeParseJson(phenotypeInput, { BUY: [0, 0, 0, 0, 0], SELL: [0, 0, 0, 0, 0], HOLD: [0, 0, 0, 0, 0] });
}

module.exports = {
  summarizeDnaStates,
  extractPhenotype,
};
```

- [ ] **Step 4: Add DNA summary fields to `getAisTrainingStats(...)`**

```js
const { summarizeDnaStates } = require('./aisDnaSummary');
```

```js
  const activeCouncil = await store.all(`
    SELECT dna_json
    FROM ais_council_members
    WHERE status = 'ACTIVE'
      AND dna_json IS NOT NULL
      AND dna_json != ''
  `).catch(() => []);

  const dnaStateTotals = activeCouncil.reduce((acc, row) => {
    const summary = summarizeDnaStates(row.dna_json);
    acc.active += summary.active;
    acc.inactive += summary.inactive;
    acc.deprecated += summary.deprecated;
    acc.lethal += summary.lethal;
    return acc;
  }, { active: 0, inactive: 0, deprecated: 0, lethal: 0 });
```

```js
    dnaStateTotals,
```

- [ ] **Step 5: Run the Node summary and stats tests**

Run: `node backend/aisDnaSummary.test.js && node backend/aisAdminStats.test.js`
Expected: PASS

- [ ] **Step 6: Commit the Node DNA summaries**

```bash
git add backend/aisDnaSummary.js backend/aisDnaSummary.test.js backend/aisAdminStats.js backend/aisAdminStats.test.js
git commit -m "feat: add DNA summaries for admin reporting"
```

### Task 4: Switch Training to DNA-First Reproduction

**Files:**
- Modify: `backend/train_ais.py`
- Modify: `backend/ais_inference.py`
- Modify: `backend/test_ais_features.py`

- [ ] **Step 1: Write a failing test that evolves DNA then produces a valid phenotype**

```python
    def test_dna_offspring_expression_stays_schema_compatible(self):
        first = bootstrap_dna_from_legacy({
            "BUY": [-0.4, -0.2, 0.1, 0.0, 0.02],
            "SELL": [0.4, 0.2, -0.1, 0.0, -0.02],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }, "a", "VALUE_SEEKER", 1)
        second = bootstrap_dna_from_legacy({
            "BUY": [-0.5, -0.3, 0.2, 0.0, 0.03],
            "SELL": [0.5, 0.3, -0.2, 0.0, -0.03],
            "HOLD": [0.0, 0.0, 0.0, 0.0, 0.0],
        }, "b", "VALUE_SEEKER", 2)
        child = crossover_dna(first, second)
        phenotype = build_phenotype_from_dna(child)
        self.assertTrue(validate_centroids(phenotype))
```

- [ ] **Step 2: Run the Python feature test to verify DNA crossover is missing**

Run: `python backend/test_ais_features.py`
Expected: FAIL with `NameError` or missing `crossover_dna`

- [ ] **Step 3: Add DNA crossover and mutation helpers to `backend/ais_dna.py`**

```python
def mutate_dna(dna):
    mutated = copy.deepcopy(dna)
    for strategy in mutated.get("strategy_genes", []):
        for subgene in strategy.get("subgenes", []):
            if subgene["state"] == "A":
                subgene["weight"] = round(float(subgene["weight"]) + 0.02, 4)
                break
        break
    mutated.setdefault("mutation_log", []).append({
        "generation": mutated.get("generation", 1),
        "event": "weight_nudge",
    })
    return mutated


def crossover_dna(first, second):
    parent_a = copy.deepcopy(first)
    parent_b = copy.deepcopy(second)
    child = copy.deepcopy(parent_a)
    child["genome_id"] = _new_genome_id()
    child["generation"] = max(int(parent_a.get("generation", 1)), int(parent_b.get("generation", 1))) + 1
    child["lineage"] = {
      "parent_ids": [parent_a.get("genome_id"), parent_b.get("genome_id")],
      "ancestor_ids": list(dict.fromkeys((parent_a.get("lineage", {}).get("ancestor_ids", []) + parent_b.get("lineage", {}).get("ancestor_ids", [])))),
      "innovation_ids": list(dict.fromkeys((parent_a.get("lineage", {}).get("innovation_ids", []) + parent_b.get("lineage", {}).get("innovation_ids", [])))),
    }
    for strategy_index, strategy in enumerate(child.get("strategy_genes", [])):
        sibling = parent_b.get("strategy_genes", [])[strategy_index] if strategy_index < len(parent_b.get("strategy_genes", [])) else None
        if not sibling:
            continue
        for sub_index, subgene in enumerate(strategy.get("subgenes", [])):
            if sub_index >= len(sibling.get("subgenes", [])):
                continue
            sibling_subgene = sibling["subgenes"][sub_index]
            subgene["weight"] = round((float(subgene["weight"]) + float(sibling_subgene["weight"])) / 2, 4)
    child["mutation_log"] = []
    return child
```

- [ ] **Step 4: Refactor `backend/train_ais.py` to evolve DNA instead of raw centroids**

```python
from ais_dna import (
    bootstrap_dna_from_legacy,
    build_phenotype_from_dna,
    crossover_dna,
    mutate_dna,
    validate_dna,
)
```

```python
            cursor.execute("SELECT member_id, dna_json, phenotype_json, generation, faction FROM ais_council_members")
            seed_rows = cursor.fetchall()
            seed_dna = []
            for member_id, dna_json, phenotype_json, generation, faction in seed_rows:
                if dna_json:
                    try:
                        parsed = json.loads(dna_json)
                        if validate_dna(parsed):
                            seed_dna.append(parsed)
                            continue
                    except Exception:
                        pass
                if phenotype_json:
                    try:
                        phenotype = json.loads(phenotype_json)
                        seed_dna.append(bootstrap_dna_from_legacy(phenotype, member_id, faction, generation or 1))
                    except Exception:
                        pass
```

```python
                if seed_dna and random.random() > 0.3:
                    parent = random.choice(seed_dna)
                    dna = mutate_dna(parent)
                else:
                    dna = bootstrap_dna_from_legacy(training_seed, new_id, "MUTANT_ROOKIE", 1)
                phenotype = build_phenotype_from_dna(dna)
                gen = dna.get("generation", 1)
                new_inserts.append((new_id, name, json.dumps(dna), json.dumps(phenotype), json.dumps(phenotype), 1.0, 'CANDIDATE', faction, gen))
```

```python
        cursor.execute("SELECT member_id, name, dna_json, phenotype_json, generation FROM ais_council_members")
```

```python
            try:
                dna = json.loads(dna_str) if dna_str else None
                if dna and validate_dna(dna):
                    weights = build_phenotype_from_dna(dna)
                else:
                    weights = json.loads(phenotype_str) if phenotype_str else mutate_weights(training_seed)
                    dna = bootstrap_dna_from_legacy(weights, m_id, "MUTANT_ROOKIE", gen if gen else 1)
            except Exception:
                weights = mutate_weights(training_seed)
                dna = bootstrap_dna_from_legacy(weights, m_id, "MUTANT_ROOKIE", gen if gen else 1)
```

```python
                "dna": dna,
```

```python
            offspring_dna = crossover_dna(p1["dna"], p2["dna"])
            if random.random() > 0.5:
                offspring_dna = mutate_dna(offspring_dna)
            offspring_weights = build_phenotype_from_dna(offspring_dna)
            offspring_gen = offspring_dna["generation"]
            new_offspring_inserts.append((new_id, name, json.dumps(offspring_dna), json.dumps(offspring_weights), json.dumps(offspring_weights), 1.0, 'CANDIDATE', faction, offspring_gen))
```

- [ ] **Step 5: Update inference to prefer `phenotype_json`**

```python
            phenotype_str = member.get('phenotype_json', '')
            if phenotype_str:
                try:
                    parsed = json.loads(phenotype_str)
                    if validate_centroids(parsed):
                        return parsed
                except Exception:
                    pass
            weights_str = member.get('weights_json', '{}')
```

- [ ] **Step 6: Run Python validation for the DNA-first training boundary**

Run: `python backend/test_ais_features.py`
Expected: PASS

- [ ] **Step 7: Commit the DNA-first training refactor**

```bash
git add backend/ais_dna.py backend/train_ais.py backend/ais_inference.py backend/test_ais_features.py
git commit -m "feat: switch AiS training to DNA-first evolution"
```

### Task 5: Migrate Diversity, Council Stats, and Admin Evidence Readers

**Files:**
- Modify: `backend/councilHealthReport.js`
- Modify: `backend/councilHealthReport.test.js`
- Modify: `backend/routes/admin.js`
- Modify: `backend/routes/investment.js`
- Modify: `frontend/src/lib/aisTrainingView.js`
- Modify: `frontend/src/lib/aisTrainingView.test.mjs`
- Modify: `frontend/src/components/AisTrainingEvidence.jsx`

- [ ] **Step 1: Write a failing health-report test for phenotype-first diversity**

```js
  const members = [
    { phenotype_json: JSON.stringify({ BUY: [0.1,0.1,0.1,0.1,0.1], SELL: [0,0,0,0,0], HOLD: [0,0,0,0,0] }) },
    { phenotype_json: JSON.stringify({ BUY: [0.8,0.8,0.8,0.8,0.8], SELL: [0,0,0,0,0], HOLD: [0,0,0,0,0] }) },
  ];
```

- [ ] **Step 2: Run the health-report test to confirm it still expects `weights_json`**

Run: `node backend/councilHealthReport.test.js`
Expected: FAIL after switching the fixture to `phenotype_json`

- [ ] **Step 3: Update health report to read `phenotype_json` first**

```js
function parseMemberPhenotype(member) {
  const raw = member.phenotype_json || member.weights_json;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
```

```js
      const w = parseMemberPhenotype(member);
      if (!w) continue;
```

- [ ] **Step 4: Update admin and investment routes to fetch DNA-first council rows**

```js
      SELECT member_id, name, voting_power, correct_count, total_count, faction, generation, dna_json, phenotype_json
      FROM ais_council_members
      WHERE status = 'ACTIVE'
      ORDER BY voting_power DESC, member_id ASC
```

```js
      SELECT weights_json, phenotype_json FROM ais_council_members
```

- [ ] **Step 5: Extend the admin training view contract with DNA summaries**

```js
  dnaStateTotals: stats.dnaStateTotals || { active: 0, inactive: 0, deprecated: 0, lethal: 0 },
```

```js
assert.deepStrictEqual(
  normalizeAisTrainingView({
    dnaStateTotals: { active: 1, inactive: 2, deprecated: 3, lethal: 4 }
  }).dnaStateTotals,
  { active: 1, inactive: 2, deprecated: 3, lethal: 4 }
);
```

- [ ] **Step 6: Render DNA evidence in the admin component**

```jsx
      <Metric
        label="DNA 상태"
        value={`A ${view.dnaStateTotals.active} / I ${view.dnaStateTotals.inactive} / D ${view.dnaStateTotals.deprecated} / L ${view.dnaStateTotals.lethal}`}
      />
```

- [ ] **Step 7: Run the Node and frontend reader tests**

Run: `node backend/councilHealthReport.test.js && node backend/aisAdminStats.test.js && node frontend/src/lib/aisTrainingView.test.mjs`
Expected: PASS

- [ ] **Step 8: Commit the DNA-aware reader migration**

```bash
git add backend/councilHealthReport.js backend/councilHealthReport.test.js backend/routes/admin.js backend/routes/investment.js frontend/src/lib/aisTrainingView.js frontend/src/lib/aisTrainingView.test.mjs frontend/src/components/AisTrainingEvidence.jsx
git commit -m "feat: migrate council reporting to DNA-aware readers"
```

### Task 6: End-to-End Verification and Legacy Cutover Check

**Files:**
- Modify: none
- Test: repo verification commands only

- [ ] **Step 1: Run Python DNA tests**

Run: `python backend/ais_dna.test.py && python backend/test_ais_features.py`
Expected: PASS

- [ ] **Step 2: Run Node backend tests**

Run: `node backend/aisDnaSummary.test.js && node backend/aisAdminStats.test.js && node backend/councilHealthReport.test.js && node backend/evolution.test.js`
Expected: PASS

- [ ] **Step 3: Run syntax checks on the route and database files**

Run: `node --check backend/database.js && node --check backend/routes/admin.js && node --check backend/routes/investment.js`
Expected: PASS

- [ ] **Step 4: Run the frontend library tests and production build**

Run: `node frontend/src/lib/aisTrainingView.test.mjs && npm run build`
Workdir: `C:\home\ai-s\frontend`
Expected: PASS with Vite build output

- [ ] **Step 5: Run a live DNA bootstrap sanity check against the local DB**

Run: `@'\nconst { queries } = require('./backend/database');\n(async () => {\n  const row = await queries.get(\"SELECT member_id, dna_json, phenotype_json FROM ais_council_members WHERE dna_json IS NOT NULL LIMIT 1\");\n  console.log(Boolean(row && row.dna_json && row.phenotype_json));\n  process.exit(0);\n})().catch((error) => { console.error(error); process.exit(1); });\n'@ | node -`
Expected: `true`

- [ ] **Step 6: Commit final integration fixes**

```bash
git add backend frontend
git commit -m "feat: replace council weights with AIDL DNA genomes"
```

## Self-Review

- Spec coverage: The plan covers canonical DNA schema, AIDL states, transcriber/ribosome/evaluator/selector boundaries, storage replacement, migration bootstrap, phenotype rebuilding, reader migration, and verification. It intentionally does not add new frontend lineage browsers or live-engine autonomy because the spec excluded them.
- Placeholder scan: No `TODO`, `TBD`, or “similar to above” placeholders remain. Each task includes concrete files, code snippets, commands, and expected outcomes.
- Type consistency: The plan consistently uses `dna_json` as canonical storage, `phenotype_json` as the derived expression artifact, `weights_json` as a temporary compatibility mirror, and `A/I/D/L` as state symbols throughout.
