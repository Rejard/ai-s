# AI-S

AI-S is a Polygon-based membership, KYC, referral, and simulated SUT trading platform.

The production service is served from:

```text
https://ais.alonics.com/
```

## AIDL 怨듦컻 湲곕줉 諛?沅뚮━ 怨좎? / Public Disclosure and Rights Notice

### ?쒓뎅??(Korean)

AIDL DNA Evolution Engine? ?대챸?숈씠 ?ㅺ퀎??Active / Inactive / Deprecated / Lethal ?곹깭 湲곕컲??吏꾪솕??AI ?좎쟾???쒖뼱 ?꾨젅?꾩썙?ъ엯?덈떎.

蹂???μ냼??AIDL 媛쒕뀗, 援ъ“, 紐낆묶, 援ы쁽 諛⑺뼢?????怨듦컻 湲곕줉???④린湲??꾪븳 紐⑹쟻???ы븿?섍퀬 ?덉뒿?덈떎.

?묒꽦?먭? ?뺤씤??怨듦컻 AI ?곌뎄 諛??ъ옄 ?쒖뒪???щ? 湲곗??쇰줈, A/I/D/L ??媛吏 ?좎쟾???곹깭瑜?紐낆떆?곸쑝濡??ъ슜?섏뿬 ?꾨왂???쒖꽦, 鍮꾪솢?? 媛먰눜, 移섎챸 ?곹깭瑜?愿由ы븯??援ъ“??諛쒓껄?섏? 紐삵뻽?쇰ŉ, 蹂??꾨줈?앺듃?먯꽌???대? ?낆옄?곸쑝濡??ㅺ퀎??AIDL ?꾨젅?꾩썙?щ줈 ?뺤쓽?⑸땲??

?? 蹂?臾멸뎄??踰뺤쟻 ?섎????뱁뿀 ?깅줉 ?먮뒗 ?멸퀎 理쒖큹 ?뺤젙???섎??섏? ?딆뒿?덈떎. 愿??沅뚮━ 蹂댄샇媛 ?꾩슂??寃쎌슦 蹂꾨룄???뱁뿀, ?곹몴, ??묎텒 寃?좉? ?꾩슂?????덉뒿?덈떎.

蹂???μ냼???뚯뒪肄붾뱶, 臾몄꽌 諛??ㅻ챸 ?띿뒪?몃뒗 ?묒꽦?먯쓽 ??묐Ъ?낅땲??

"AIDL" 諛?"AIDL DNA Evolution Engine" 紐낆묶? 蹂???μ냼瑜??듯빐 怨듦컻 湲곕줉???꾨줈?앺듃 ?앸퀎?먯씠硫? 蹂꾨룄???곹몴 ?깅줉???대（?댁?吏 ?딆? ?곹깭?먯꽌???곹몴沅뚯쓣 二쇱옣?섏? ?딆뒿?덈떎.

AIDL 媛쒕뀗 諛??좎쟾???곹깭 紐⑤뜽? 怨듦컻 湲곕줉??紐⑹쟻?쇰줈 寃뚯떆?섏뿀?쇰ŉ, 蹂꾨룄???뱁뿀 ?먮뒗 ?곹몴 ?깅줉 ?놁씠 ?쇰컲?곸씤 吏꾪솕???뚭퀬由ъ쬁 媛쒕뀗??????낆젏沅뚯쓣 二쇱옣?섏? ?딆뒿?덈떎.

### English

AIDL DNA Evolution Engine is an evolutionary AI genome-control framework designed by Myunghak Lee, based on four genetic states: Active, Inactive, Deprecated, and Lethal.

This repository also serves as a public disclosure record of the AIDL concept, structure, naming, and implementation direction.

To the author?셲 knowledge, based on publicly known AI research and trading-system examples reviewed so far, no prior framework has been found that explicitly manages strategy genes through the four A/I/D/L states of activation, inactivity, degradation, and lethal suppression. In this project, this structure is defined as the independently designed AIDL framework.

This statement does not constitute a legal confirmation of patent registration or worldwide priority. If formal protection is required, separate patent, trademark, and copyright review may be necessary.

The source code, documentation, and explanatory text in this repository are the author's original works.

The names "AIDL" and "AIDL DNA Evolution Engine" are project identifiers publicly recorded through this repository, and no trademark rights are claimed unless separate trademark registration is established.

The AIDL concept and genetic state model are published for public disclosure purposes, and no exclusive ownership is claimed over general evolutionary algorithm concepts without separate patent or trademark registration.

---

## Stack

- Frontend: React, Vite, ethers
- Backend: Node.js, Express
- Database: SQLite
- Wallet: Trust Wallet injected provider and Trust Wallet direct app links only
- Network: Polygon mainnet

## Project Structure

```text
frontend/   React/Vite client
backend/    Express API server and SQLite database setup
contracts/  Solidity contract sources
cfg/        Local configuration files, ignored from git
```

### Frontend Page Naming Convention

To allow AI agents/assistants to accurately identify and maintain web pages for different roles and platforms without confusion, we have refactored the frontend components according to a strict naming convention:

```text
[Role]_[Platform]_[PageName].jsx
```

* **Role**: `user` (Active Members), `manager` (Managers), `admin` (Platform Owner/Admin)
* **Platform**: `pc` (PC View), `mobile` (Mobile View)
* **PageName**: Specific page identifier (e.g., `dashboard`, `onboarding`, `referral`, `trade`, etc.)

#### Refactored Pages List
1. **admin_mobile_council.jsx** (Admin Mobile Council)
2. **admin_mobile_dashboard.jsx** (Admin Mobile Dashboard)
3. **admin_pc_dashboard.jsx** (Admin PC Dashboard)
4. **manager_mobile_dashboard.jsx** (Manager Mobile Dashboard)
5. **manager_pc_dashboard.jsx** (Manager PC Dashboard)
6. **user_mobile_dashboard.jsx** (User Mobile Dashboard)
7. **user_mobile_login.jsx** (User Mobile Login)
8. **user_mobile_onboarding.jsx** (User Mobile Onboarding)
9. **user_mobile_referral.jsx** (User Mobile Referral)
10. **user_mobile_trade.jsx** (User Mobile Trade)
11. **user_pc_dashboard.jsx** (User PC Dashboard)
12. **user_pc_login.jsx** (User PC Login)
13. **user_pc_onboarding.jsx** (User PC Onboarding)
14. **user_pc_referral.jsx** (User PC Referral)

## Important Runtime Settings

Create `frontend/.env` for frontend-only environment variables:

```env
```

Do not commit `.env`, private keys, wallet seed phrases, wallet passwords, Google account passwords, or uploaded KYC documents.

## Google Login Configuration

The frontend uses Google OAuth/Identity Services.

For the OAuth client ID used by the app, Google Cloud Console must include:

Authorized JavaScript origins:

```text
https://ais.alonics.com
```

Authorized redirect URIs:

```text
https://ais.alonics.com/
https://ais.alonics.com/login
```

Mobile Chrome uses the redirect flow to avoid the `accounts.google.com/gsi/transform` blank-page issue. The root redirect URI with the trailing slash is required.

## Wallet Behavior

The app supports:

- PC Chrome with Trust Wallet extension
- Mobile browsers through direct Trust Wallet app links
- Trust Wallet app deep link fallback

When multiple injected wallets exist, the frontend prefers Trust Wallet over other injected providers. SUT approve is executed against Polygon mainnet.

Key frontend wallet modules:

```text
frontend/src/lib/walletProvider.js
frontend/src/lib/sutApproval.js
```

## Backend Schema Repair

If an existing SQLite database is missing newer schema fields or payment types, run:

```bash
cd backend
npm run fix:schema
```

This repairs:

- `users.referrer_address`
- `payments` support for `AI_TRADING_PROFIT`

Always back up `backend/platform.db` before running schema repair on production data.

## Development

Install dependencies:

```bash
npm run install-all
```

Run the full app in development:

```bash
npm start
```

Run frontend checks:

```bash
cd frontend
npm run test:wallet
npm run build
```

Run backend:

```bash
cd backend
npm start
```

## Production Notes

The PM2 ecosystem file used on the host is:

```text
C:/home/master_ecosystem.config.js
```

The `ai-s` app runs from:

```text
C:/home/ai-s/backend/server.js
```

When updating the frontend, rebuild `frontend/dist`. The backend serves the built frontend assets.

## Recent Fixes

- Trust Wallet is the only supported wallet for onboarding and transactions.
- Mobile deep links use the direct Trust Wallet app scheme for users who already have Trust Wallet installed.
- Preferred Trust Wallet provider when multiple wallet extensions are injected.
- Added Google OAuth redirect fallback for mobile Chrome to avoid the GSI transform blank page.
- Fixed SQLite schema compatibility for new registrations and `AI_TRADING_PROFIT` payments.
- Implemented Delta Sync optimization for on-chain transactions, reducing RPC payload and avoiding 504 Gateway Timeouts by maintaining `last_synced_block` in `manager_sync_status`.

## AI Agent Coding Guidelines

To ensure seamless collaboration with AI coding assistants, this project enforces the following constitution:

1. **AI-First & Exception-Only Commenting Philosophy**: All comments are written **exclusively** for AI/LLM context recovery, semantic indexing, and logical reasoning. They are **NOT** intended for human reading. The default rule is **zero-comment (100% no comments)**. Comments are written **only** in exceptional circumstances involving non-standard workarounds, API rate-limit bypasses, or fallback triggers. When exceptions apply, write only a single line of concise technical English explaining the *why*.
2. **Standard Terminology**: Always use standard English business terms (Manager, Platform Owner/Admin, Active Member/Approved User, Distribution, Registration Fee/Deposit, Withdrawal, Grid Bot) in all code naming conventions and exception comments.
3. **Safety Policies**: Never modify global system configuration templates (like `ai_models.json`), never run `pm2 delete all`, and never auto-commit to git without human supervision. Refer to [.cursorrules](file:///c:/home/ai-s/.cursorrules) for full details.

## AiS Evolutionary Philosophy: Safe Gated RSI

This project is named **AiS Safe RSI**, leveraging the financial **Relative Strength Index (RSI)** for our 5D normalized feature vectors, while simultaneously implementing a fully functional **Recursive Self-Improvement (RSI)** loop.

### 1. The Critique of Silicon Valley's Safe Alignment (Anachronistic Control)
Frontier labs like Anthropic argue for a highly conservative "safety alignment" approach, warning that autonomous recursive self-improvement loops will inevitably lead to a loss of human control. They advocate for coordinate development pauses or restrictive barriers.

We strongly disagree. **Over-regulation in evolution is an evolutionary dead end.** 
- When you restrict AI exploration to a narrow band of "pre-approved safety parameters," you lock the system into a local minimum.
- If an unprecedented black swan event (e.g., an extreme market crash) strikes, a unified, over-secured model pool will suffer complete extinction because no outliers exist with the traits necessary to survive the new reality.
- Survival and intelligence do not emerge from sterile parameters; they emerge from the survival of outliers through chaotic adaptation. 

### 2. Our Architecture: Safe Gated RSI (Air-Gapped Mutation)
Rather than suppressing mutation to enforce safety, we decouple mutation from exploitation. 

- **Wild Mutation in the Sandbox**: The 500-candidate pool is replenished through a mix of crossover offspring and fresh mutant rookies during each evolutionary cycle. Offspring still receive probabilistic mutation, and additional rookies are injected when the pool needs refill, allowing the sandbox population to keep testing diverse strategies.
- **Air-Gapped Gating (Shadow-only Mode)**: Safety is enforced not by controlling the AI's mind, but by controlling its environment. Candidates evolve in a secure **Shadow Mode (Simulation)** without access to live capital. 
- **Human-in-the-loop (Natural Selection)**: A candidate must satisfy rigid statistical criteria (300 labeled observations, 3%p margin over holdout benchmark, zero label contamination, and minimum class coverage) before it becomes promotion-eligible evidence for the Administrator. In the current implementation, promotion remains policy-gated: administrators can keep manual review, or enable automatic engine switching only after the eligibility checks pass.

### 2.5 AIDL DNA Genome Architecture & Operational Principles
AIDL stands for **Adaptive Intelligence & DNA Logic** externally, while internally also functioning as a structural acronym for the four ecological survival states that govern strategy genes: **A**ctive, **I**nactive, **D**eprecated, and **L**ethal. In other words, AIDL is both the name of the framework and a direct explanation of its control model, which this project defines as an independently designed gene-control framework.

#### 1. Genome & Strategy Schema
Each AI candidate model (individual) possesses a unique Genome sequence defined as:
*   **Current Core Metadata:** `genome_id`, `generation`, `lineage` (`parent_ids`, `ancestor_ids`, `innovation_ids`), `regulatory_profile`, and `mutation_log`.
*   **Strategy Genes:** Each genome currently carries strategy-gene objects with `gene_id`, `innovation_id`, `state`, `dominance`, `copy_number`, `context_mask`, `length`, and `subgenes`.
*   **Feature Subgenes:** Each subgene tracks `gene_id`, `innovation_id`, `state`, `feature`, `action`, `weight`, `threshold`, and `priority`, which are used to assemble centroid-like phenotypes at runtime.

#### 2. AIDL Gene Expression States
All strategy and feature subgenes exist in one of four states (A/I/D/L):
*   **A (Active):** The gene is fully active, participating in real-time execution, fitness evaluation, and crossover breeding.
*   **I (Inactive):** The gene is dormant and unexpressed in the current generation but can be passed down to offspring and resurrected back to A (Active) via mutation.
*   **D (Deprecated):** A mitigated state where the gene remains expressible but is down-weighted during phenotype construction instead of being treated as fully active.
*   **L (Lethal):** A highly toxic gene identified with extreme drawdowns or safety failures. It is excluded from expression, and the current crossover rule demotes lethal inheritance to Inactive (I) in offspring.

#### 3. Evolutionary Operators
*   **Crossover:** When selecting the top 50 parents to breed, we align genes by `innovation_id` before mixing weights rather than performing a blind average.
*   **Mutation:** The current runtime applies three concrete mutation layers: `context_mask` mutation, `state_mutation` across the A/I/D/L cycle, and small active-gene `weight_nudge` adjustments.
*   **Natural Selection:** Poorly performing candidate models are discarded at the pool level, while surviving lineages retain ancestry and mutation metadata inside the genome payload.
*   **Generation Progression:** Generation numbers advance through mutation and crossover, and mutation events are appended into `mutation_log` for later audit.
*   **Runtime Expression Control:** `expression_budget`, `dominance_bias`, and `copy_number` are no longer schema-only metadata. They now affect live expression by limiting which strategy genes can express, scaling expression strength, and lowering the effective cost of higher-copy genes.

#### 4. Contextual Evolution Based on 4 Market States
When an AI model operates with a single unified weight block, it is vulnerable to sudden market crashes or highly volatile conditions, often leading to complete extinction. To overcome this, we implemented a **Contextual Evolution** system that dynamically expresses duplicated/derived genes matching the real-time **4 Market States (Seasons)**.
*   **Market Season Classification Criteria**:
    *   **Long-term Trend (240-day SMA)**: If the price is above the SMA240, it is classified as BULL; if below, it is BEAR.
    *   **Short-term Volatility (14-day High-Low Average - ATR Alternative)**: The average high-low candle spread over the last 14 days is used to detect EXPANSION or SQUEEZE.
    *   These are combined to detect one of 4 climates in real time: **BULL_EXPANSION, BULL_SQUEEZE, BEAR_EXPANSION, BEAR_SQUEEZE**.
*   **Contextual Expression**:
    *   Each strategy gene encodes a `context_mask`, which lists the specific market climates where the gene is allowed to operate.
    *   Only genes matching the real-time detected market season are dynamically activated (Active) and used to assemble the decision weights (Centroids). Non-matching genes remain dormant (Inactive), completely cutting off exposure to market risks.
*   **Context Mutation**:
    *   In every evolutionary cycle, there is a 10% chance that a specific gene's `context_mask` will randomly gain or lose a market state tag.
    *   This mutation process allows genes to naturally branch and specialize in specific market climates (e.g., highly specialized genes for bear squeeze or bull expansion).
*   **Union Inheritance (Crossover)**:
    *   During crossover breeding, the active climate settings (`context_mask`) of both parent genes are merged using a union operator. This ensures that offspring inherit all the diverse survival instincts accumulated by their ancestors.
*   **Self-healing Migration**:
    *   When loading legacy DNA from the database that lacks the newly added `context_mask` (which would otherwise trigger errors), the system automatically detects the missing field and populates it with a full mask containing all 4 seasons, executing a runtime migration without downtime.

*   **Fitness History Persistence Guard**:
    *   The election runtime now explicitly deep-copies DNA packages before appending `fitness_history`, preventing lineage-history writes from crashing the live council election loop and keeping regression coverage on that persistence path.

#### 5. Bio-Science Inspired Logic: AI-VEP and AISG Accessioning
The AIDL DNA Evolution Engine draws significant architectural inspiration from bioinformatics and genomic engineering algorithms, particularly Google DeepMind's AlphaGenome and EMBL-EBI's Ensembl VEP (Variant Effect Predictor), implementing them as real-time evolutionary safety guards:
*   **AI-VEP (AI Variant Effect Predictor)**:
    *   Mirroring how biological VEP predicts the molecular consequences and lethality of nucleotide mutations, this module screens newly mutated feature weights. It checks if a mutation will trigger catastrophic over-fitting or erratic trading behaviors under high-risk environments like `BEAR_EXPANSION`, `BEAR_SQUEEZE`, `BULL_EXPANSION`, and `BULL_SQUEEZE`.
    *   The current runtime explicitly blocks knife-catching BUY bias in bear expansion, breakout overcommit in bear squeeze, late-trend chase bias in bull expansion, and premature SELL bias in bull squeeze. It also tightens lethal screening further when the recent `fitness_history` shows three-generation holdout collapse.
    *   Any mutation flagged as `LETHAL` by the predictor is immediately filtered out and discarded (deleterious mutation filtering) before sandbox evaluation, automatically reverting the weights back to the stable parent state.
*   **AISG Accession ID (Gene Sequence Accessioning)**:
    *   Analogous to how NCBI's Entrez and Ensembl assign stable accessioning IDs (e.g., ENSG, XP_) to manage genomic sequences globally, AiS now standardizes genome bootstrap and runtime issuance around the **`AISG-G{generation}-{unique_suffix}`** format.
    *   This unified indexing enables comprehensive lineage tracking, allowing administrators to audit database registries and trace which specific ancestral lineages contributed most to market survival.

#### 6. Admin-Only DNA Operations
The AIDL operational surfaces exposed in this repository are intentionally administrator-only rather than member-facing:
*   **Lineage Visibility:** Admin readers can inspect active genome summaries and recent archive lineage summaries, including accession IDs, parent lineage counts, mutation-event depth, and archive reasons.
*   **Repair Visibility:** Runtime self-healing for missing accession IDs, `context_mask`, and incomplete `regulatory_profile` fields is tracked and exposed as repair telemetry for audit.
*   **Manual State Override:** Administrators can now force a strategy gene into `A`, `I`, `D`, or `L`, after which the server recomputes the stored phenotype and records an `admin_state_override` mutation-log event.

### 3. Architecture Sequence & Evolution Flow

```mermaid
graph TD
    subgraph Sandbox [Shadow Simulation Environment (Air-Gapped Sandbox)]
        A[500 Candidate Models Pool] --> B(Crossover & 50% Mutation Noise)
        C[75 Mutant Rookies per Gen] --> A
        B --> D{Evaluation on Sandbox Data}
        D -->|Failed| E[Discard / Repopulate]
        D -->|Passed Statistical Filters| F[Candidate Evidence Ledger]
    end
    
    subgraph Live [Live Production Environment]
        H[Live Engine Execution & Capital Allocation]
    end
    
    F -->|Promotion Proposal Report| G{Human Admin: Approval}
    G -->|Approved| H
    G -->|Rejected| E
```

### 4. Acknowledging Our Limitations (Humility in Evolutionary Design)

We do not claim that our framework is infallible, nor do we pretend to hold absolute answers. Acknowledging the weaknesses of our architecture is a core part of our philosophy. Evolution is not about starting with a perfect design; it is about recognizing flaws and adapting through trial and error.

*   **The Human Bottleneck**:
    Because the final gating mechanism requires manual review and promotion by the Administrator, our system cannot achieve instantaneous, fully automated real-time redeployments. The speed of evolution is ultimately bounded by human judgment.
*   **The Simulation-Reality Gap**:
    No matter how rigorous our Shadow simulation is, it cannot perfectly model the chaotic dynamics, systemic contagion, or liquidity slippage of the live market. Outperforming the benchmark in the sandbox does not guarantee risk-free returns in the live environment.
*   **Inefficiency of Wild Mutations**:
    Injecting 75 completely unproven 1st-generation mutant rookies and forcing a 50% mutation noise rate inevitably generates a large volume of low-performing candidates in the early generations. This results in significant computational waste and training overhead.

We invite like-minded developers who believe in **survival through wild diversity rather than sterile over-regulation** to join our movement.

---

## ?뽳툘 License and Commercial Use Inquiries

**AI-S (Safe Gated RSI)** is provided under a **Dual License Policy** to ensure compliance with open-source licensing and rights preservation.

### 1. Open Source Use under AGPL-3.0 License
The AGPL-3.0 License does not restrict commercial use itself. Anyone is free to use the software for commercial purposes as long as they comply with the terms of the AGPL-3.0 License (such as the obligation to disclose the full source code of any modified versions).

### 2. Commercial License and Integration (Commercial Use)
The AI-S project adopts a dual licensing policy where the copyright holder provides a separate commercial license. If you wish to use the software for proprietary commercial services or exclusive use without complying with the AGPL obligations, you must obtain a separate Commercial License from the original author (Rejard).

If you wish to integrate the AI-S architecture into a commercial proprietary product or require dedicated technical support, please contact us at the email below.

- ?벉 **Commercial & Technical Inquiries:** lemaiii@alonics.com
- **Copyright:** 짤 2026 Alonics Inc. All Rights Reserved.

---

## ?뱴 References

The genomic architecture, safety gates, and cryptographic transmissions of the AIDL DNA Evolution Engine were designed with reference to the following pioneering research, database standards, and cryptographic specifications:

1.  **Google DeepMind AlphaGenome (2026)**
    *   *Research / Resource:* "Predicting genomic variant effects on gene expression and regulatory mechanisms using deep neural networks."
    *   *Application:* Integrated the principles of Tissue-Specific Expression (tissue/biosample-dependent expression profiles) to map our 4 market climates (BULL/BEAR 횞 EXPANSION/SQUEEZE) and govern conditional active/inactive gene expression.
2.  **EMBL-EBI Ensembl Variant Effect Predictor (VEP) (2016)**
    *   *Reference publication:* McLaren, W., et al. "The Ensembl Variant Effect Predictor." *Bioinformatics*, 32(10), 1570??575.
    *   *Application:* Adopted as the conceptual basis for our AI-VEP engine (Lethal/Deleterious variant filtering) to screen out volatile weights and overfitting anomalies prior to sandbox backtesting.
3.  **NCBI Entrez system & Sequence Databases (2018)**
    *   *Reference:* "Database resources of the National Center for Biotechnology Information." *Nucleic Acids Research*, 46(D1), D8?밆13.
    *   *Application:* Designed the `AISG` Accession ID specification for unified gene sequence indexing and generation lineage tracking.
4.  **NIST SP 800-38D (Galois/Counter Mode - GCM) (2007)**
    *   *Specification:* Dworkin, M. "Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC." *NIST Special Publication*, 800-38D.
    *   *Application:* Implemented `AES-256-GCM` symmetric-key authenticated encryption/decryption for secure transmission of manager API credentials without data leakage.
5.  **NIST FIPS 180-4 (Secure Hash Standard - SHA-256) (2015)**
    *   *Standard:* "Secure Hash Standard (SHS)." *Federal Information Processing Standards Publication*, FIPS PUB 180-4.
    *   *Application:* Integrated SHA-256 hashing for 32-byte key stretching and derivation from user secret phrases.


## BLACK_SWAN Context

AIDL now supports a fifth market context named `BLACK_SWAN` in addition to the four regular climates: `BULL_EXPANSION`, `BULL_SQUEEZE`, `BEAR_EXPANSION`, and `BEAR_SQUEEZE`.

`BLACK_SWAN` does not replace the four-climate model. It is a rare override context used only when the live bar shows an extreme shock profile.

The current runtime classifies a bar as `BLACK_SWAN` when both of the following are true:

- absolute close-to-close change is at least `6.0%`
- current high-low range is at least `2.5x` the recent 14-bar average range

Current service rules:

- legacy bootstrap and runtime self-healing still default to the original four climates only
- `BLACK_SWAN` is opt-in through mutation or explicit DNA `context_mask` values
- AI-VEP applies stricter lethal screening to strong directional chase bias inside `BLACK_SWAN`
- candidate and council DNA context visibility remains admin-only

## Recent AIDL Operational Updates

The current service has moved beyond the original A/I/D/L state engine and four-climate context mask into a more auditable admin-side operating model.

### 1. BLACK_SWAN as a fifth context, not a replacement climate

`BLACK_SWAN` is now implemented as a rare shock-only context on top of the existing four regular climates.

- the four regular climates remain the default bootstrap and self-healing baseline
- `BLACK_SWAN` is activated only when the live bar satisfies the shock gate
- strategy genes can opt in through mutation or explicit `context_mask` membership
- this keeps the normal seasonal model stable while still allowing rare shock specialization

### 2. Shock gate detection logic

The runtime treats a bar as `BLACK_SWAN` only when both conditions are true:

- absolute close-to-close move is at least `6.0%`
- current high-low range is at least `2.5x` the recent 14-bar average range

This design intentionally avoids collapsing ordinary volatility into the fifth context.

### 3. DNA expression and AI-VEP scope expansion

Recent AIDL work extended the DNA operating surface in four ways:

- `context_mask` mutation can now add or remove `BLACK_SWAN`
- AI-VEP now tightens lethal filtering for directional chase bias inside `BLACK_SWAN`
- holdout-collapse history further strengthens lethal blocking during unstable periods
- runtime/admin reporting now treats context, override, lineage, and repair events as first-class audit signals

### 4. Admin-only override and telemetry model

Administrative DNA control is now paired with telemetry instead of remaining a blind force-write:

- manual `A / I / D / L` state override is recorded as `admin_state_override`
- manual `BLACK_SWAN` context on/off is recorded as `admin_context_override`
- override events now snapshot `pre_validation_score`, `pre_holdout_score`, and `pre_run_key`
- override outcome metrics expose active/archive averages
- override snapshot metrics expose pre-vs-post averages
- override coverage metrics expose how many events are comparable for snapshot and post-only timeline analysis
- override timeline metrics now use post-override runs only

### 5. Lineage and control surface completion

The latest admin surface now covers the full AIDL operating chain:

- accession and lineage visibility for active and archived genomes
- runtime repair visibility for accession, `context_mask`, and `regulatory_profile`
- strategy-gene override controls
- subgene state override controls in the admin UI
- admin-only DNA context visibility for candidate/council operation

In short, AIDL is now documented and operated as a five-context, admin-auditable DNA evolution system rather than only a four-state genome experiment.
