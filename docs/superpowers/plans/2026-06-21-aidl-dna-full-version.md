# AIDL DNA Full Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining AIDL DNA operating model so the runtime moves beyond the current core skeleton into a fuller evolutionary control system with adaptive state policy, persistent lineage evidence, archive support, and admin-visible telemetry.

**Architecture:** Keep `backend/ais_dna.py` as the authoritative genome operator, extend `backend/train_ais.py` to persist and consume the new metadata, and expose only normalized summaries to admin surfaces through `backend/aisAdminStats.js` plus `frontend/src/components/AisTrainingEvidence.jsx`. Avoid rewriting the existing DNA-first pipeline; layer the missing capabilities onto the current lineage/mutation/context framework with TDD.

**Tech Stack:** Python (`backend/ais_dna.py`, `backend/train_ais.py`), Node.js/SQLite (`backend/database.js`, `backend/aisAdminStats.js`), React/Vite (`frontend/src/components/AisTrainingEvidence.jsx`, `frontend/src/lib/aisTrainingView.js`)

---

### Task 1: Adaptive State Policy

**Files:**
- Modify: `backend/ais_dna.py`
- Modify: `backend/test_ais_dna.py`

- [x] **Step 1: Write the failing tests**

```python
def test_state_mutation_prefers_reactivation_when_reactivation_bias_is_high(self):
    dna = self._valid_dna()
    dna["regulatory_profile"]["reactivation_bias"] = 1.0
    dna["strategy_genes"][0]["subgenes"][0]["state"] = "I"
    with patch("random.random", side_effect=[0.99, 0.05, 0.01]), patch(
        "random.choice",
        side_effect=lambda seq: next(item for item in seq if item.get("state") == "I"),
    ):
        mutated = mutate_dna(dna)
    self.assertEqual(mutated["strategy_genes"][0]["subgenes"][0]["state"], "A")

def test_state_mutation_can_skip_lethal_promotion_when_decay_resistance_is_high(self):
    dna = self._valid_dna()
    dna["regulatory_profile"]["decay_resistance"] = 1.0
    dna["strategy_genes"][0]["subgenes"][0]["state"] = "D"
    with patch("random.random", side_effect=[0.99, 0.05, 0.99]), patch(
        "random.choice",
        side_effect=lambda seq: next(item for item in seq if item.get("state") == "D"),
    ):
        mutated = mutate_dna(dna)
    self.assertNotEqual(mutated["strategy_genes"][0]["subgenes"][0]["state"], "L")
```

- [x] **Step 2: Run tests to verify they fail**

Run: `py -3 backend/test_ais_dna.py`  
Expected: `FAIL` because `mutate_dna()` currently uses a fixed transition cycle and ignores `regulatory_profile` for transition choice.

- [x] **Step 3: Write minimal implementation**

```python
def _choose_state_transition(current_state, profile, random_value):
    if current_state == "I":
        return "A" if random_value <= float(profile.get("reactivation_bias", 0.1)) else "D"
    if current_state == "A":
        return "D"
    if current_state == "D":
        return "I" if random_value <= float(profile.get("decay_resistance", 0.3)) else "L"
    if current_state == "L":
        return "I"
    return current_state
```

Use this helper inside `mutate_dna()` so `state_mutation` still logs `from_state` and `to_state`, but transition choice reflects `regulatory_profile`.

- [x] **Step 4: Run tests to verify they pass**

Run: `py -3 backend/test_ais_dna.py`  
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/ais_dna.py backend/test_ais_dna.py
git commit -m "feat: add adaptive aidl state transitions"
```

### Task 2: Persistent Fitness History and Genome Archive

**Files:**
- Modify: `backend/database.js`
- Modify: `backend/train_ais.py`
- Create: `backend/aisGenomeArchive.js`
- Create: `backend/aisGenomeArchive.test.js`

- [x] **Step 1: Write the failing tests**

```javascript
assert.deepEqual(
  archivedGenome.fitness_history.at(-1),
  { validationScore: 54.2, holdoutScore: 52.1, runKey: "run-1" }
);
assert.equal(archiveRow.archive_reason, "CULLED_LOW_PERFORMANCE");
```

The test should seed one council member row, invoke the archive helper with fitness payload, and assert that both `fitness_history` and archive table persistence exist.

- [x] **Step 2: Run tests to verify they fail**

Run: `node backend/aisGenomeArchive.test.js`  
Expected: `FAIL` because there is no archive table/helper and `fitness_history` is not persisted.

- [x] **Step 3: Write minimal implementation**

```javascript
CREATE TABLE IF NOT EXISTS ais_genome_archive (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  genome_id TEXT NOT NULL,
  generation INTEGER NOT NULL,
  archive_reason TEXT NOT NULL,
  dna_json TEXT NOT NULL,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

```python
fitness_entry = {
    "validationScore": round(validation_metrics["utility_score"], 4),
    "holdoutScore": round(holdout_metrics["utility_score"], 4),
    "runKey": run_key,
}
dna.setdefault("fitness_history", []).append(fitness_entry)
```

When culling candidates in `backend/train_ais.py`, persist the final DNA payload into `ais_genome_archive` with `archive_reason = 'CULLED_LOW_PERFORMANCE'`.

- [x] **Step 4: Run tests to verify they pass**

Run:
- `node backend/aisGenomeArchive.test.js`
- `py -3 backend/test_ais_dna.py`

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add backend/database.js backend/train_ais.py backend/aisGenomeArchive.js backend/aisGenomeArchive.test.js
git commit -m "feat: persist aidl fitness history and genome archive"
```

### Task 3: Selection Pressure and Mutation Telemetry

**Files:**
- Modify: `backend/train_ais.py`
- Modify: `backend/aisAdminStats.js`
- Modify: `backend/aisAdminStats.test.js`
- Modify: `frontend/src/lib/aisTrainingView.js`
- Modify: `frontend/src/lib/aisTrainingView.test.mjs`
- Modify: `frontend/src/components/AisTrainingEvidence.jsx`

- [x] **Step 1: Write the failing tests**

```javascript
assert.deepEqual(result.selectionTelemetry, {
  culledCount: 120,
  offspringCount: 60,
  mutantCount: 60,
  archiveCount: 120,
});
```

```javascript
assert.deepEqual(populated.selectionTelemetry, {
  culledCount: 12,
  offspringCount: 6,
  mutantCount: 6,
  archiveCount: 12,
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:
- `node backend/aisAdminStats.test.js`
- `node frontend/src/lib/aisTrainingView.test.mjs`

Expected: `FAIL` because neither backend stats nor frontend normalization exposes selection telemetry yet.

- [x] **Step 3: Write minimal implementation**

```python
cursor.execute(
    "INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('ais_selection_telemetry', ?)",
    (json.dumps({
        "culledCount": cull_count,
        "offspringCount": offspring_count,
        "mutantCount": mutant_count,
        "archiveCount": len(culled_targets),
    }),)
)
```

```javascript
const selectionTelemetryRow = await store.get(
  "SELECT value FROM platform_settings WHERE key = 'ais_selection_telemetry'"
);
```

Render one extra metric line in `AisTrainingEvidence.jsx` for `Cull / Offspring / Mutant / Archive`.

- [x] **Step 4: Run tests to verify they pass**

Run:
- `node backend/aisAdminStats.test.js`
- `node frontend/src/lib/aisTrainingView.test.mjs`
- `npm run build` from `frontend`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/train_ais.py backend/aisAdminStats.js backend/aisAdminStats.test.js frontend/src/lib/aisTrainingView.js frontend/src/lib/aisTrainingView.test.mjs frontend/src/components/AisTrainingEvidence.jsx
git commit -m "feat: expose aidl selection telemetry"
```

### Task 4: Admin Policy Controls for AIDL Mutation Runtime

**Files:**
- Modify: `backend/database.js`
- Modify: `backend/routes/admin.js`
- Modify: `backend/ais_dna.py`
- Modify: `backend/train_ais.py`
- Modify: `frontend/src/components/AisTrainingEvidence.jsx`
- Modify: `frontend/src/pages/admin_pc_dashboard.jsx`
- Modify: `frontend/src/pages/admin_mobile_dashboard.jsx`

- [x] **Step 1: Write the failing tests**

```python
def test_mutate_dna_uses_runtime_configured_state_mutation_rate(self):
    dna = self._valid_dna()
    mutated = mutate_dna(dna, runtime_policy={"state_mutation_rate": 0.0})
    self.assertNotIn("state_mutation", [entry["event"] for entry in mutated["mutation_log"]])
```

```javascript
assert.equal(response.body.policy.stateMutationRate, 0.1);
```

- [x] **Step 2: Run tests to verify they fail**

Run:
- `py -3 backend/test_ais_dna.py`
- the new admin route test command you add, for example `node backend/adminAidlPolicy.test.js`

Expected: `FAIL` because no runtime policy object exists yet.

- [x] **Step 3: Write minimal implementation**

```python
def mutate_dna(dna, preserve_parent_ids=False, runtime_policy=None):
    policy = {
        "context_mutation_rate": 0.10,
        "state_mutation_rate": 0.10,
        "weight_nudge_size": 0.02,
        **(runtime_policy or {}),
    }
```

Expose admin policy read/write via `platform_settings`, then pass that policy from `train_ais.py` into `mutate_dna()`. Add lightweight admin UI controls for the three runtime parameters.

- [x] **Step 4: Run tests to verify they pass**

Run:
- `py -3 backend/test_ais_dna.py`
- `node backend/adminAidlPolicy.test.js`
- `npm run build` from `frontend`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/database.js backend/routes/admin.js backend/ais_dna.py backend/train_ais.py frontend/src/components/AisTrainingEvidence.jsx frontend/src/pages/admin_pc_dashboard.jsx frontend/src/pages/admin_mobile_dashboard.jsx
git commit -m "feat: add admin aidl runtime policy controls"
```
