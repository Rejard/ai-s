# AiS Safe RSI Design

## Objective

Turn the existing AiS evolutionary council into a measurable, bounded self-improvement loop without allowing generated strategies to modify production code or promote themselves into live trading.

## Scope

This phase implements:

- delayed outcome labeling using prices observed after the configured horizon;
- preservation and invalidation of contaminated historical labels;
- normalized market features shared by training and inference;
- chronological train, validation, and holdout evaluation;
- one canonical council weight schema;
- deterministic candidate evaluation and election;
- Shadow Champion-Challenger metadata and admin observability;
- explicit prevention of automatic live-model promotion.

This phase does not implement:

- AI-authored source-code changes;
- automatic activation of `AIS_ONLY` or `HYBRID_COOP`;
- autonomous live-capital allocation;
- prompt-generated trading strategies or a general strategy DSL.

## Safety Invariants

1. A decision cannot be labeled before its evaluation horizon has elapsed.
2. A label uses the first market observation at or after `evaluation_due_at`.
3. Historical rows where `current_price = next_price_5m` from the immediate-label bug are retained but marked `INVALID`.
4. Candidate selection uses chronological partitions. Holdout results cannot affect mutation, crossover, or election.
5. A Challenger remains Shadow-only. Only the administrator can change the production engine mode.
6. Training and inference use the same feature transformation and council-weight schema.
7. Every training run records dataset size, partition sizes, score, benchmark score, generation, and status.

## Architecture

### Outcome Labeling

`backend/aisEvaluation.js` owns decision-label semantics. `gridBot.js` first labels all due rows using the current observed price, then records the new decision with a future due time. This ordering makes immediate self-labeling impossible.

Each training row gains:

- `evaluation_due_at`
- `evaluation_status`: `PENDING`, `LABELED`, or `INVALID`
- `label_version`

The evaluator uses one consistent movement threshold:

- `BUY`: correct when return is greater than `+0.2%`
- `SELL`: correct when return is less than `-0.2%`
- `HOLD`: correct when absolute return is at most `0.2%`

### Feature Contract

`backend/ais_features.py` defines the canonical five-dimensional feature vector:

1. price change percentage;
2. RSI scaled to `[-1, 1]`;
3. SMA5 distance from current price in percent;
4. SMA20 distance from current price in percent;
5. SMA5-to-SMA20 spread in percent.

Council weights remain decision centroids with keys `BUY`, `SELL`, and `HOLD`. Both training and inference call the same feature helper.

### Candidate Evaluation

Gate.io candles are split chronologically:

- 60% training;
- 20% validation;
- 20% holdout.

Candidates are ranked by validation utility after being generated from training data. Election uses validation results. Holdout is reported only after the top 11 are frozen.

The score combines:

- directional macro accuracy;
- balanced accuracy across BUY, SELL, and HOLD;
- a penalty for collapsing to one action.

### Champion-Challenger State

Every training run is recorded in `ais_model_runs`. The newly elected council is recorded as `SHADOW_CHALLENGER`. The current production engine is not changed.

Admin statistics expose:

- valid and pending label counts;
- invalidated legacy count;
- latest Challenger validation and holdout scores;
- benchmark score;
- promotion eligibility;
- explicit `SHADOW_ONLY` status.

Promotion eligibility is informational and requires all of:

- at least 300 labeled observations;
- Challenger holdout score greater than benchmark by at least 3 percentage points;
- no label-integrity failure;
- minimum class coverage.

No route in this phase promotes the Challenger automatically.

## Failure Handling

- Missing market prices leave labels pending.
- Invalid or non-finite feature values produce `HOLD`, are logged, and do not crash the scheduler.
- Training failures retain the existing active council.
- A failed run is recorded with `FAILED` status and its error message.
- Database migrations are additive and idempotent.

## Verification

- Node unit tests cover due-time labeling, invalidation, thresholds, and promotion gating.
- Python unit tests cover feature normalization, chronological splits, score behavior, and schema compatibility.
- An integration test uses a temporary SQLite database to prove a newly inserted tick cannot label itself.
- Existing backend and frontend tests and the production build remain green.
- Production verification confirms the scheduler runs, current labels remain pending until due, council remains 11/500, and engine mode remains `GEMINI_AIS_SHADOW`.

