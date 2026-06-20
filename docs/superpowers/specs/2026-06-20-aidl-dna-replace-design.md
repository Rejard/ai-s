# AIDL DNA Replace Design

## Objective

Replace the current `weights_json`-first AiS council genome model with an `dna_json`-first model that preserves lineage, latent traits, deprecated traits, and lethal fossil traits while still producing a deterministic phenotype for evaluation.

This is a large-structure refactor. The goal is not to make the current AiS council biologically accurate. The goal is to give the council a durable genotype/phenotype split so that future evolution is explainable, replayable, and extensible.

## Scope

This design covers:

- replacing candidate storage so `dna_json` becomes the canonical genome;
- treating `weights_json` as a derived phenotype artifact rather than the source genome;
- introducing five conceptual institutions:
  - `Genome`
  - `Transcriber`
  - `Ribosome`
  - `Evaluator`
  - `Selector`
- defining `A`, `I`, `D`, `L` gene states;
- defining mixed hierarchical genes:
  - strategy genes
  - feature subgenes;
- defining how phenotype weights are rebuilt from DNA;
- defining migration and compatibility rules for the existing 500-candidate council.

This design does not cover:

- frontend visualization of DNA lineage;
- investment/admin UI feature work beyond keeping existing council outputs alive;
- changing the delayed-label safety contract;
- changing the current validation/holdout separation;
- making the live engine self-promote without administrator control.

## First-In-This-Conversation Ideas

These ideas are treated as original to this design conversation within this repo context:

- `A/I/D/L` as an AiS-specific four-state DNA alphabet analogue;
- modeling degeneration as preserved but non-expressed history rather than deletion;
- separating strategy genes from feature subgenes in a mixed hierarchy;
- introducing a ribosome-like phenotype assembler between DNA and evaluation;
- allowing genome length to grow while capping expressed phenotype length.

This is not a claim of academic novelty. It is a marker for what is newly introduced in this workspace design discussion.

## Current Problem

The current AiS evolution loop stores only a narrow evolutionary state:

- `weights_json`
- `generation`
- `faction`
- score-derived election metadata

That is enough to rank and elect candidates, but it is not enough to answer the harder questions:

- Which older traits still exist but are dormant?
- Which failures were deleted versus retained as fossilized genetic baggage?
- Why did a candidate's phenotype become what it is?
- Which parent contributed which subtrait?
- How can a previously dormant trait reappear without inventing a new weight vector from scratch?

The current model is therefore good at selection but weak at heritable explanation.

## Design Summary

The canonical candidate becomes:

- `dna_json`: source of truth
- `phenotype_json`: derived expression product

The council evolution loop becomes:

`Genome -> Transcriber -> Ribosome -> Evaluator -> Selector -> next Genome`

The current evaluation math and validation discipline stay intact as much as possible. The major change is upstream: the thing being evolved is no longer a raw weight centroid blob. It is a structured genome that can express a centroid phenotype.

## Data Model

### Candidate Record

Each council member continues to live in `ais_council_members`, but its canonical payload changes:

- `dna_json` becomes required canonical genome state.
- `phenotype_json` stores the last ribosome-built phenotype used for evaluation.
- `weights_json` becomes a short-term compatibility mirror during migration and is eventually removed after downstream readers are converted.

Recommended logical record shape:

```json
{
  "genome_id": "gen_20260620_abc123",
  "generation": 4,
  "lineage": {
    "parent_ids": ["gen_parent_a", "gen_parent_b"],
    "ancestor_ids": ["seed_02", "seed_07"],
    "innovation_ids": [101, 102, 118, 204]
  },
  "regulatory_profile": {
    "expression_budget": 12,
    "dominance_bias": 1.0,
    "decay_resistance": 0.35,
    "reactivation_bias": 0.18
  },
  "strategy_genes": [
    {
      "gene_id": "sg_value_reversion_core",
      "innovation_id": 101,
      "state": "A",
      "dominance": 0.82,
      "copy_number": 2,
      "length": 5,
      "subgenes": [
        {
          "gene_id": "fg_buy_rsi_trigger",
          "innovation_id": 102,
          "state": "A",
          "feature": "rsi_scaled",
          "action": "BUY",
          "weight": -0.62,
          "threshold": -0.45,
          "priority": 0.91
        }
      ]
    }
  ],
  "mutation_log": [
    {
      "generation": 4,
      "event": "state_flip",
      "gene_id": "fg_buy_sma_spread",
      "from": "A",
      "to": "I"
    }
  ],
  "phenotype": {
    "BUY": [-0.62, -0.48, 0.12, 0.00, 0.07],
    "SELL": [0.44, 0.31, -0.10, -0.06, 0.02],
    "HOLD": [0.02, 0.01, 0.00, 0.00, 0.00]
  }
}
```

## AIDL States

### `A` Active

- Expressed by default.
- Eligible for direct evaluation influence.
- Eligible for crossover as a strong parent trait.

### `I` Inactive

- Not expressed in the current phenotype.
- Retained in the genome.
- Eligible for inheritance.
- Eligible for reactivation by mutation or regulation.

### `D` Deprecated

- Weakly expressed or partially suppressed.
- Intended to represent degraded but not fully dead function.
- Can be retained because it still complements another subtrait or acts as a weak fallback.

### `L` Lethal

- Never expressed directly.
- Preserved only as a historical or constrained fossil trait.
- Cannot reactivate directly to `A`.
- May only pass to offspring as preserved latent baggage, typically normalized down to `I` under strict rules if the lineage policy allows it.

This aligns with the user's preferred interpretation: lethal traits are not erased, but they are barred from immediate live expression.

## Gene Hierarchy

### Strategy Genes

A strategy gene is a high-level behavior family:

- value reversion
- trend continuation
- volatility defense
- breakout aggression

Each strategy gene owns feature subgenes and a structural profile.

### Feature Subgenes

A feature subgene binds one decision dimension to one feature:

- `rsi_scaled`
- `price_change_pct`
- `sma5_distance_pct`
- `sma20_distance_pct`
- `sma5_to_sma20_spread_pct`

Each subgene carries:

- action target: `BUY`, `SELL`, or `HOLD`
- numeric weight
- optional threshold or gate
- state `A/I/D/L`
- priority
- innovation id

This preserves compatibility with the current five-dimensional phenotype while making heredity interpretable.

## Physical Trait Layer

To capture the user's idea that organisms differ not only in letters but in structural specifications, genes also carry physical-style metadata:

- `length`
- `copy_number`
- `dominance`
- `priority`
- `linkage_group`
- `decay_resistance`

These are not cosmetic. They influence expression and inheritance.

Examples:

- higher `copy_number` increases odds a subtrait survives crossover;
- higher `dominance` increases expression strength;
- higher `decay_resistance` makes `A -> D` and `D -> I` transitions less likely;
- longer genes are more expensive under an expression budget and therefore harder to fully express.

## Institutions

### Genome

The genome is the canonical storage layer.

Responsibilities:

- hold `dna_json`;
- maintain lineage;
- maintain historical state transitions;
- maintain non-expressed fossil traits.

The genome does not perform evaluation.

### Transcriber

The transcriber decides what part of the genome will be read this generation.

Responsibilities:

- read regulatory profile;
- select all mandatory `A` genes;
- optionally include some `D` genes in reduced mode;
- optionally queue some `I` genes for reactivation trials;
- exclude `L` genes from expression;
- produce an `expression_plan`.

The transcriber introduces expression gating without changing the stored genome.

### Ribosome

The ribosome converts an `expression_plan` into a phenotype.

Responsibilities:

- combine strategy genes and feature subgenes;
- resolve conflicts by priority, dominance, and action target;
- attenuate deprecated genes;
- normalize output into the current five-dimensional centroid format;
- emit deterministic `phenotype_json`.

The ribosome is the phenotype assembler. In the new model, this is the practical replacement for directly reading `weights_json`.

### Evaluator

The evaluator remains close to the current `train_ais.py` scoring pipeline.

Responsibilities:

- score phenotype on chronological validation data;
- report holdout after election freeze;
- produce utility score, balanced accuracy, action collapse penalty, and election fitness.

The evaluator should remain genotype-agnostic. It only sees phenotype.

### Selector

The selector governs survival and reproduction.

Responsibilities:

- cull the lowest-fitness candidates;
- choose parent pool from top survivors;
- decide gene inheritance and state transition outcomes;
- create offspring genomes;
- preserve dormant and fossil traits instead of deleting everything that is not expressed.

## Phenotype Construction Rule

Phenotype should be defined as:

`Phenotype = f(State, Weight, Structure, Regulation)`

Interpretation:

- `State`: whether a gene is allowed to express;
- `Weight`: numeric influence if expressed;
- `Structure`: dominance, copy number, gene length, linkage;
- `Regulation`: transcriber decisions and expression budget.

This allows two candidates with similar visible faction labels to have very different internal genomes and latent potential.

## Replace Strategy

The user explicitly chose a replacement strategy rather than an overlay strategy. That means the system should converge toward this final contract:

- canonical storage: `dna_json`
- canonical expression artifact: `phenotype_json`
- legacy compatibility field: temporary `weights_json`

Replacement cannot be done as a single blind flip. It should still be staged.

### Stage A: Dual Materialization

- `dna_json` becomes canonical.
- ribosome also writes `weights_json` mirror so old readers do not break immediately.
- all new offspring are created from DNA, not raw weights.

### Stage B: Consumer Migration

- evaluators, loaders, and council stats readers stop trusting `weights_json`.
- they use ribosome output or `phenotype_json`.

### Stage C: Legacy Removal

- remove or ignore `weights_json` once no production path depends on it.

This is still a replace design because the source of truth changes immediately, even if a temporary compatibility mirror exists for safety.

## Migration Rules for Existing 500 Candidates

The current 500-candidate pool must be lifted into DNA form.

Recommended bootstrap:

1. Parse existing `weights_json`.
2. Create one inferred strategy gene based on current faction and centroid geometry.
3. Create feature subgenes from the current five-dimensional vectors.
4. Mark all inferred live subgenes as `A`.
5. Initialize lineage as synthetic origin:
   - `parent_ids = []`
   - `ancestor_ids = [existing member id]`
   - `innovation_ids` freshly assigned.
6. Set `copy_number = 1`, conservative defaults for `dominance`, `length`, `priority`.

This bootstrap is necessarily inferential. It should be clearly documented as generation-zero DNA synthesis, not historical biological truth.

## State Transition Principles

Full transition matrices belong in the implementation plan, but the design-level rules are:

- `A -> D`: repeated weak contribution, conflict loss, or redundancy pressure.
- `D -> I`: prolonged non-use or stronger sibling dominance.
- `I -> A`: successful reactivation trial under mutation and selection.
- `A -> L`: catastrophic expression outcome or invariant violation.
- `L -> A`: forbidden.
- `L -> I`: allowed only if lineage policy explicitly downgrades lethal fossil baggage into non-expressed inherited baggage during reproduction.

The important invariant is that lethal direct revival is not allowed.

## Fitness and Selection Invariants

The new DNA system must not break current AiS safety properties:

- election still uses validation, not holdout;
- holdout remains report-only until election freezes;
- delayed labeling stays intact;
- live engine auto-promotion rules stay unchanged;
- failed training must retain the last good active council.

This keeps the AIDL refactor focused on representation, not on weakening the safety contract.

## Error Handling

- If DNA cannot be expressed, candidate gets a failed phenotype and near-zero fitness.
- If a candidate has no valid active expression path, the ribosome must emit a valid fallback phenotype instead of crashing the run.
- If legacy migration produces malformed DNA, the bootstrap step should quarantine the member and regenerate a valid baseline genome.
- If a crossover cannot align some genes, unmatched genes should remain inert rather than producing invalid phenotype output.

## Verification Strategy

The implementation should prove:

- DNA bootstrap produces valid genomes from current candidates.
- Ribosome output is deterministic.
- `A/I/D/L` gating changes phenotype as intended.
- selector can preserve latent and lethal traits without evaluating them directly.
- current admin observability still reports generation and run-level evidence.

## Feasibility Assessment

This design is ambitious but implementable.

- concept feasibility: high
- codebase fit: high
- migration risk: medium-high
- rollback risk if attempted in one step: high

Estimated implementation viability:

- data-model replacement viability: `85%`
- deterministic ribosome viability: `88%`
- safe migration without losing current council behavior: `72%`
- total project viability if staged carefully: `81%`

Main risk:

The most fragile part is not the evaluator. It is the genotype-to-phenotype replacement boundary. If that boundary is not deterministic and testable, the entire evolution loop becomes opaque and unstable.

## Recommendation

Proceed with replacement, but stage it carefully:

1. define DNA schema and migration bootstrap;
2. add transcriber and ribosome;
3. switch training to DNA-first reproduction;
4. migrate readers;
5. retire legacy `weights_json`.

This preserves the user's desired boldness while still treating the dangerous boundary with discipline.
