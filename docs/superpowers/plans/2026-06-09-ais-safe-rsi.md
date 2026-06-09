# AiS Safe RSI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trustworthy Shadow-only AiS self-improvement loop with delayed labels, normalized features, chronological validation, compatible evolution, and administrator-visible Challenger evidence.

**Architecture:** Extract deterministic labeling and promotion rules into a Node module, and extract the canonical feature and candidate-scoring contract into a Python module shared by training and inference. Keep `gridBot.js` as the scheduler/orchestrator, persist every training run, and never switch the live engine automatically.

**Tech Stack:** Node.js, SQLite, Python standard library, Express, React/Vite

---

## File Map

- Create `backend/aisEvaluation.js`: delayed-label and promotion-eligibility rules.
- Create `backend/aisEvaluation.test.js`: deterministic Node tests.
- Create `backend/aisEvaluation.integration.test.js`: temporary SQLite ordering test.
- Create `backend/ais_features.py`: canonical features, schema validation, split and scoring helpers.
- Create `backend/test_ais_features.py`: Python unit tests.
- Modify `backend/database.js`: additive label and model-run migrations.
- Modify `backend/gridBot.js`: label-before-insert ordering and Shadow run trigger.
- Modify `backend/train_ais.py`: shared features, chronological partitions, run records, Shadow-only election.
- Modify `backend/ais_inference.py`: shared normalized features and strict schema handling.
- Modify `backend/evolution.js`: canonical replacement weights and valid statuses.
- Modify `backend/routes/admin.js`: trustworthy training and Challenger metrics.
- Modify `frontend/src/hooks/useAdminLogic.js`: consume extended statistics.
- Modify `frontend/src/pages/AdminDashboard.jsx`: show label integrity and Shadow status.
- Modify `frontend/src/pages/PcAdminDashboard.jsx`: mirror the admin indicators.

### Task 1: Delayed Label Contract

- [ ] Write `backend/aisEvaluation.test.js` with failing cases proving:
  - a row is not due before `evaluation_due_at`;
  - BUY, SELL, and HOLD use the same `0.2%` threshold;
  - an equal-price legacy row is classified as contaminated only when created by label version 1;
  - promotion eligibility is false below 300 samples or below a 3-point benchmark margin.
- [ ] Run `node backend/aisEvaluation.test.js` and confirm it fails because the module does not exist.
- [ ] Implement `backend/aisEvaluation.js` with:

```js
const LABEL_VERSION = 2;
const MOVEMENT_THRESHOLD_PERCENT = 0.2;

function evaluateDecision({ decision, currentPrice, futurePrice }) {
  const realizedChange = ((futurePrice - currentPrice) / currentPrice) * 100;
  const normalizedDecision = String(decision).toUpperCase();
  const correct = normalizedDecision === 'BUY'
    ? realizedChange > MOVEMENT_THRESHOLD_PERCENT
    : normalizedDecision === 'SELL'
      ? realizedChange < -MOVEMENT_THRESHOLD_PERCENT
      : Math.abs(realizedChange) <= MOVEMENT_THRESHOLD_PERCENT;
  return { realizedChange, correct: correct ? 1 : 0 };
}
```

- [ ] Run the test and confirm all cases pass.
- [ ] Commit `test: define trustworthy AiS evaluation rules`.

### Task 2: Database Integrity Migration

- [ ] Extend the Node tests to assert the legacy invalidation SQL affects only version-1 equal-price rows.
- [ ] Add idempotent columns to `ais_training_data`:
  - `evaluation_due_at TEXT`
  - `evaluation_status TEXT DEFAULT 'PENDING'`
  - `label_version INTEGER DEFAULT 2`
- [ ] Create `ais_model_runs` with run status, partition counts, validation score, holdout score, benchmark score, generation, promotion eligibility, error, and timestamps.
- [ ] Migrate historical rows:

```sql
UPDATE ais_training_data
SET evaluation_status = 'INVALID',
    label_version = 1
WHERE next_price_5m > 0
  AND ABS(next_price_5m - current_price) < 0.0000000001;
```

- [ ] Backfill any other labeled historical rows as `LABELED`.
- [ ] Run initialization twice against a temporary database and confirm migrations are idempotent.
- [ ] Commit `feat: add AiS label integrity metadata`.

### Task 3: Label-Before-Insert Scheduler

- [ ] Write `backend/aisEvaluation.integration.test.js` with a temporary SQLite table containing one due row and one new row.
- [ ] Verify the test fails against the current insert-before-label behavior.
- [ ] Add `labelDueTrainingRows(store, observedAt, observedPrice)` to `aisEvaluation.js`.
- [ ] In `gridBot.js`, call the labeler before inserting the current decision.
- [ ] Insert the new row with `evaluation_due_at = current tick + configured interval`, `evaluation_status = 'PENDING'`, and label version 2.
- [ ] Remove the `WHERE next_price_5m = 0.0 ORDER BY id DESC LIMIT 1` immediate-label block.
- [ ] Run both evaluation tests and confirm a new row remains pending until a later tick.
- [ ] Commit `fix: label AiS decisions only after their horizon`.

### Task 4: Canonical Normalized Features

- [ ] Write failing `backend/test_ais_features.py` tests for:
  - RSI 50 maps to 0;
  - relative SMA features are scale-invariant;
  - malformed weights are rejected;
  - valid weights contain BUY, SELL, and HOLD vectors of length 5.
- [ ] Run `python backend/test_ais_features.py` and confirm failure because `ais_features.py` is absent.
- [ ] Implement `backend/ais_features.py`:

```python
def build_features(price, change_percent, rsi, sma5, sma20):
    safe_price = max(float(price), 1e-12)
    return [
        float(change_percent),
        (float(rsi) - 50.0) / 50.0,
        ((float(sma5) - safe_price) / safe_price) * 100.0,
        ((float(sma20) - safe_price) / safe_price) * 100.0,
        ((float(sma5) - float(sma20)) / safe_price) * 100.0,
    ]
```

- [ ] Update `ais_inference.py` and `train_ais.py` to use this helper.
- [ ] Convert random, mutation, and crossover centroids to normalized feature ranges.
- [ ] Run Python tests and an inference fixture with 11 valid members.
- [ ] Commit `feat: normalize AiS training and inference features`.

### Task 5: Chronological Evaluation

- [ ] Add failing tests for a 10-row chronological split and for a constant-HOLD candidate receiving a collapse penalty.
- [ ] Implement `chronological_split(rows, train_ratio=0.6, validation_ratio=0.2)`.
- [ ] Implement per-class recall, balanced accuracy, action-distribution penalty, and final utility score.
- [ ] Fit or generate candidates only from the training partition.
- [ ] Rank and elect on validation utility.
- [ ] Freeze the elected 11, then calculate holdout and benchmark scores without feeding them back into selection.
- [ ] Record `SHADOW_CHALLENGER` in `ais_model_runs`; never update `global_ai_engine`.
- [ ] Run Python tests with fixed random seeds and confirm deterministic results.
- [ ] Commit `feat: add chronological AiS challenger evaluation`.

### Task 6: Safe Evolution Compatibility

- [ ] Add a Python fixture proving every generated and evolved candidate passes the canonical schema validator.
- [ ] Replace the incompatible `smaWeight/rsiWeight/bbWeight/macdWeight` replacement in `evolution.js` with a canonical centroid generator exported by a small Node helper or a fixed valid centroid object.
- [ ] Replace invalid `DEAD` status writes with `RETIRED`.
- [ ] Prevent daily evolution from changing council membership; it may update observational performance metadata only. General election remains owned by `train_ais.py`.
- [ ] Run schema tests and a temporary-database evolution test.
- [ ] Commit `fix: keep AiS evolution schema and statuses compatible`.

### Task 7: Administrator Evidence

- [ ] Add backend API tests for `/admin/training-stats` response fields.
- [ ] Return:
  - total, labeled, pending, invalid;
  - BUY/SELL/HOLD sample counts and accuracies;
  - latest model run;
  - `shadowOnly: true`;
  - promotion eligibility and blocking reasons.
- [ ] Update mobile and PC admin pages to show:
  - label integrity warning;
  - latest validation, holdout, and benchmark scores;
  - Shadow-only badge;
  - “automatic live promotion disabled”.
- [ ] Add frontend helper tests for rendering defaults when no run exists.
- [ ] Run targeted backend and frontend tests.
- [ ] Commit `feat: expose AiS challenger evidence to admin`.

### Task 8: Full Verification and Release

- [ ] Run backend tests:

```powershell
node backend/authSession.test.js
node backend/managerOrganization.test.js
node backend/aisEvaluation.test.js
node backend/aisEvaluation.integration.test.js
node backend/autoTradeMath.test.mjs
node backend/councilBriefing.test.mjs
python backend/test_ais_features.py
```

- [ ] Run `npm run test` and `npm run build` from `frontend`.
- [ ] Run `git diff --check`.
- [ ] Back up `backend/platform.db` before applying the production migration.
- [ ] Restart only `pm2 ai-s`.
- [ ] Verify:
  - `GEMINI_AIS_SHADOW` is unchanged;
  - old equal-price rows are `INVALID`;
  - a new row is `PENDING`;
  - no new row has `next_price_5m = current_price`;
  - council remains exactly 500 candidates and 11 active members;
  - admin statistics report `shadowOnly: true`;
  - PM2 remains online without new scheduler errors.
- [ ] Stage only intended source, tests, and documentation. Do not stage runtime DB, backups, generated CSV, or logs.
- [ ] Commit `feat: add safe AiS recursive improvement loop`.
- [ ] Push to `origin/main`.

