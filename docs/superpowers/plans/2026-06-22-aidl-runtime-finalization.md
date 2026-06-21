# AIDL Runtime Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining AIDL work that is materially useful for AiS operations by strengthening AI-VEP, hardening legacy DNA self-healing, and exposing the resulting DNA operating evidence to admin readers.

**Architecture:** Keep the current DNA-first runtime intact and extend only the parts that already exist in production: `backend/ais_dna.py` for mutation and safety rules, `backend/train_ais.py` for runtime recovery of legacy candidates, and the admin stats/UI path for evidence visibility. Do not expand the climate model yet; defer `BLACK_SWAN` until the 4-context runtime and repair loop are proven stable.

**Tech Stack:** Python (`backend/ais_dna.py`, `backend/train_ais.py`, `backend/test_ais_dna.py`), Node.js/SQLite (`backend/aisAdminStats.js`, `backend/aisAdminStats.test.js`), React/Vite (`frontend/src/lib/aisTrainingView.js`, `frontend/src/lib/aisTrainingView.test.mjs`, `frontend/src/components/AisTrainingEvidence.jsx`)

---

## Scope Decisions

- Include:
  - AI-VEP rule hardening using the DNA payload we already persist
  - Runtime self-healing for missing `context_mask` and incomplete `regulatory_profile`
  - Admin-visible DNA repair and archive evidence
- Exclude for this plan:
  - `BLACK_SWAN` 5th climate
  - Full runtime use of `expression_budget`, `dominance_bias`, `copy_number`
  - Presentation/README copy cleanup beyond preserving current docs

## File Responsibilities

- `backend/ais_dna.py`
  - keep canonical DNA validation, phenotype assembly, VEP screening, mutation, and crossover rules
- `backend/test_ais_dna.py`
  - Python unit coverage for VEP, healing helpers, and mutation policy behavior
- `backend/train_ais.py`
  - legacy DNA load path, candidate recovery, and training/election persistence
- `backend/aisAdminStats.js`
  - aggregate admin-facing DNA evidence from active genomes, archive table, and settings
- `backend/aisAdminStats.test.js`
  - verify stats payload shape and default handling
- `frontend/src/lib/aisTrainingView.js`
  - normalize backend DNA evidence into stable frontend defaults
- `frontend/src/lib/aisTrainingView.test.mjs`
  - frontend normalization tests
- `frontend/src/components/AisTrainingEvidence.jsx`
  - compact evidence rendering for admin viewers

### Task 1: Strengthen AI-VEP With Recent Fitness Collapse Guards

**Files:**
- Modify: `backend/ais_dna.py`
- Modify: `backend/test_ais_dna.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_predict_variant_effect_flags_bear_buy_bias_after_three_generation_collapse(self):
    from ais_dna import predict_variant_effect

    dna = self._valid_dna()
    dna["fitness_history"] = [
        {"validationScore": 54.0, "holdoutScore": 51.0, "runKey": "run-1"},
        {"validationScore": 49.0, "holdoutScore": 45.0, "runKey": "run-2"},
        {"validationScore": 43.0, "holdoutScore": 39.0, "runKey": "run-3"},
    ]
    for sub in dna["strategy_genes"][0]["subgenes"]:
        if sub["action"] == "BUY" and sub["feature"] in ("price_change_pct", "rsi_scaled"):
            sub["weight"] = 1.5 if sub["feature"] == "rsi_scaled" else 14.5

    self.assertEqual(predict_variant_effect(dna), "LETHAL")

def test_predict_variant_effect_keeps_without_collapse_history(self):
    from ais_dna import predict_variant_effect

    dna = self._valid_dna()
    dna["fitness_history"] = [
        {"validationScore": 54.0, "holdoutScore": 53.0, "runKey": "run-1"},
        {"validationScore": 55.0, "holdoutScore": 54.0, "runKey": "run-2"},
        {"validationScore": 56.0, "holdoutScore": 55.0, "runKey": "run-3"},
    ]

    self.assertEqual(predict_variant_effect(dna), "BENIGN")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `py -3 backend/test_ais_dna.py`  
Expected: `FAIL` because `predict_variant_effect()` currently ignores `fitness_history`.

- [ ] **Step 3: Write minimal implementation**

```python
def _has_recent_fitness_collapse(dna):
    history = dna.get("fitness_history", [])
    if len(history) < 3:
        return False
    recent = history[-3:]
    holdouts = [entry.get("holdoutScore") for entry in recent]
    if any(score is None for score in holdouts):
        return False
    return holdouts[0] > holdouts[1] > holdouts[2] and holdouts[2] <= 40.0
```

Inside `predict_variant_effect()` add one extra rule:

```python
if _has_recent_fitness_collapse(dna) and context == "BEAR_EXPANSION" and action == "BUY":
    if feature_name in ("price_change_pct", "rsi_scaled") and w > limit * 0.65:
        return "LETHAL"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `py -3 backend/test_ais_dna.py`  
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/ais_dna.py backend/test_ais_dna.py
git commit -m "feat: harden aidl vep with collapse guards"
```

### Task 2: Harden Legacy DNA Self-Healing Around Regulatory Profile

**Files:**
- Modify: `backend/train_ais.py`
- Modify: `backend/test_ais_dna.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_load_candidate_dna_self_heals_missing_context_mask_and_profile_fields(self):
    broken = self._valid_dna()
    del broken["strategy_genes"][0]["context_mask"]
    broken["regulatory_profile"] = {"expression_budget": 12}

    healed = load_candidate_dna(
        member_id="member-1",
        dna_json=json.dumps(broken),
        phenotype_json=None,
        weights_json=None,
        faction="MUTANT_ROOKIE",
        generation=1,
        fallback_weights=self._legacy_centroids(),
    )

    self.assertEqual(
        healed["strategy_genes"][0]["context_mask"],
        ["BULL_EXPANSION", "BULL_SQUEEZE", "BEAR_EXPANSION", "BEAR_SQUEEZE"],
    )
    self.assertEqual(healed["regulatory_profile"]["dominance_bias"], 1.0)
    self.assertEqual(healed["regulatory_profile"]["decay_resistance"], 0.3)
    self.assertEqual(healed["regulatory_profile"]["reactivation_bias"], 0.1)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `py -3 backend/test_ais_dna.py`  
Expected: `FAIL` because `load_candidate_dna()` only heals `context_mask` and accession format.

- [ ] **Step 3: Write minimal implementation**

Add a local helper in `backend/train_ais.py`:

```python
def _heal_runtime_dna(parsed):
    default_contexts = ["BULL_EXPANSION", "BULL_SQUEEZE", "BEAR_EXPANSION", "BEAR_SQUEEZE"]
    for strategy in parsed.get("strategy_genes", []):
        if "context_mask" not in strategy or not isinstance(strategy["context_mask"], list):
            strategy["context_mask"] = list(default_contexts)

    profile = parsed.get("regulatory_profile")
    if not isinstance(profile, dict):
        profile = {}
        parsed["regulatory_profile"] = profile
    profile.setdefault("expression_budget", 12)
    profile.setdefault("dominance_bias", 1.0)
    profile.setdefault("decay_resistance", 0.3)
    profile.setdefault("reactivation_bias", 0.1)
    return parsed
```

Call `_heal_runtime_dna(parsed)` inside `load_candidate_dna()` before `validate_dna(parsed)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `py -3 backend/test_ais_dna.py`  
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/train_ais.py backend/test_ais_dna.py
git commit -m "feat: harden aidl legacy dna self-healing"
```

### Task 3: Expose DNA Repair and Archive Evidence to Admin Readers

**Files:**
- Modify: `backend/aisAdminStats.js`
- Modify: `backend/aisAdminStats.test.js`
- Modify: `frontend/src/lib/aisTrainingView.js`
- Modify: `frontend/src/lib/aisTrainingView.test.mjs`
- Modify: `frontend/src/components/AisTrainingEvidence.jsx`

- [ ] **Step 1: Write the failing tests**

```javascript
assert.deepEqual(result.dnaOperations, {
  archiveCount: 2,
  averageFitnessHistoryDepth: 1.5,
  latestArchivedAt: '2026-06-22 10:00:00',
});
```

```javascript
assert.deepEqual(populated.dnaOperations, {
  archiveCount: 2,
  averageFitnessHistoryDepth: 1.5,
  latestArchivedAt: '2026-06-22 10:00:00',
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
- `node backend/aisAdminStats.test.js`
- `node frontend/src/lib/aisTrainingView.test.mjs`

Expected: `FAIL` because DNA operation evidence is not yet included in the stats payload.

- [ ] **Step 3: Write minimal implementation**

In `backend/aisAdminStats.js` add:

```javascript
const archiveSummary = await store.get(`
  SELECT COUNT(*) AS archive_count, MAX(archived_at) AS latest_archived_at
  FROM ais_genome_archive
`);
const averageFitnessHistoryDepth = activeCouncil.length
  ? Number((
      activeCouncil.reduce((sum, row) => {
        try {
          const dna = JSON.parse(row.dna_json || '{}');
          return sum + (Array.isArray(dna.fitness_history) ? dna.fitness_history.length : 0);
        } catch {
          return sum;
        }
      }, 0) / activeCouncil.length
    ).toFixed(2))
  : 0;
```

Return:

```javascript
dnaOperations: {
  archiveCount: Number(archiveSummary?.archive_count || 0),
  averageFitnessHistoryDepth,
  latestArchivedAt: archiveSummary?.latest_archived_at || '',
},
```

In `frontend/src/lib/aisTrainingView.js` add default normalization:

```javascript
const emptyDnaOperations = () => ({ archiveCount: 0, averageFitnessHistoryDepth: 0, latestArchivedAt: '' });
```

In `frontend/src/components/AisTrainingEvidence.jsx` render one extra line:

```jsx
<Metric
  label="DNA Ops"
  value={`Archive ${dnaOperations.archiveCount || 0} / History ${dnaOperations.averageFitnessHistoryDepth || 0} / Latest ${dnaOperations.latestArchivedAt || '-'}`}
  color="#FDE68A"
/>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
- `node backend/aisAdminStats.test.js`
- `node frontend/src/lib/aisTrainingView.test.mjs`
- `npm run build` from `frontend`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/aisAdminStats.js backend/aisAdminStats.test.js frontend/src/lib/aisTrainingView.js frontend/src/lib/aisTrainingView.test.mjs frontend/src/components/AisTrainingEvidence.jsx
git commit -m "feat: expose aidl dna operations evidence"
```

## Deferred Work

- `BLACK_SWAN` context expansion is intentionally deferred.
- `expression_budget`, `dominance_bias`, and `copy_number` stay schema-level until the three tasks above are stable and verified in production-like runs.
