# AI-S

AI-S is a Polygon-based membership, KYC, referral, and simulated SUT trading platform.

The production service is served from:

```text
https://edenai.alonics.com/
```

## AIDL 공개 기록 및 권리 고지 / Public Disclosure and Rights Notice

### 한국어 (Korean)

AIDL DNA Evolution Engine은 이명학이 설계한 Active / Inactive / Deprecated / Lethal 상태 기반의 진화형 AI 유전자 제어 프레임워크입니다.

본 저장소는 AIDL 개념, 구조, 명칭, 구현 방향에 대한 공개 기록을 남기기 위한 목적도 포함하고 있습니다.

작성자가 확인한 공개 AI 연구 및 투자 시스템 사례 기준으로, A/I/D/L 네 가지 유전자 상태를 명시적으로 사용하여 전략의 활성, 비활성, 감퇴, 치명 상태를 관리하는 구조는 발견하지 못했으며, 본 프로젝트에서는 이를 독자적으로 설계한 AIDL 프레임워크로 정의합니다.

단, 본 문구는 법적 의미의 특허 등록 또는 세계 최초 확정을 의미하지 않습니다. 관련 권리 보호가 필요한 경우 별도의 특허, 상표, 저작권 검토가 필요할 수 있습니다.

본 저장소의 소스코드, 문서 및 설명 텍스트는 작성자의 저작물입니다.

"AIDL" 및 "AIDL DNA Evolution Engine" 명칭은 본 저장소를 통해 공개 기록된 프로젝트 식별자이며, 별도의 상표 등록이 이루어지지 않은 상태에서는 상표권을 주장하지 않습니다.

AIDL 개념 및 유전자 상태 모델은 공개 기록의 목적으로 게시되었으며, 별도의 특허 또는 상표 등록 없이 일반적인 진화형 알고리즘 개념에 대한 독점권을 주장하지 않습니다.

### English

AIDL DNA Evolution Engine is an evolutionary AI genome-control framework designed by Myunghak Lee, based on four genetic states: Active, Inactive, Deprecated, and Lethal.

This repository also serves as a public disclosure record of the AIDL concept, structure, naming, and implementation direction.

To the author’s knowledge, based on publicly known AI research and trading-system examples reviewed so far, no prior framework has been found that explicitly manages strategy genes through the four A/I/D/L states of activation, inactivity, degradation, and lethal suppression. In this project, this structure is defined as the independently designed AIDL framework.

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
https://edenai.alonics.com
```

Authorized redirect URIs:

```text
https://edenai.alonics.com/
https://edenai.alonics.com/login
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

- **Wild Mutation in the Sandbox**: We force 75 raw, randomized 1st-generation mutant rookies into the 500-candidate pool during every evolutionary cycle. Crossover offspring have a 50% chance of mutation with random feature noise. AI candidates are allowed to mutate wildly and test radical strategies.
- **Air-Gapped Gating (Shadow-only Mode)**: Safety is enforced not by controlling the AI's mind, but by controlling its environment. Candidates evolve in a secure **Shadow Mode (Simulation)** without access to live capital. 
- **Human-in-the-loop (Natural Selection)**: Only when a candidate satisfies rigid statistical criteria (300 labeled observations, 3%p margin over holdout benchmark, zero label contamination) does it present promotion eligibility evidence to the Administrator. The AI never promotes itself; the human remains the final arbiter of selection.

### 2.5 AIDL DNA Genome Architecture & Operational Principles
AIDL stands for **Adaptive Intelligence & DNA Logic** externally, while internally defining the core mechanism that controls the four ecological survival states of genes: **A**ctive, **I**nactive, **D**eprecated, and **L**ethal.

#### 1. Genome & Strategy Schema
Each AI candidate model (individual) possesses a unique Genome sequence defined as:
*   **Core Metadata:** `genome_id`, `generation`, `ancestor_ids` (ancestry tracking), `expressed_strategy_ids` (currently active strategy genes), `latent_strategy_ids` (inactive/dormant strategy genes), `fitness_history` (historical fitness metrics).
*   **Strategy Genes:** Defines the primary trading logic (e.g., `mean_reversion_core`, `trend_breakout_core`, `volatility_guard_core`).
*   **Feature Subgenes:** Defines fine-grained indicators and thresholds (e.g., `rsi_oversold_trigger`, `sma5_distance_bias`, `sma20_spread_gate`, `price_change_sensitivity`). Each subgene carries its own weight and threshold.

#### 2. AIDL Gene Expression States
All strategy and feature subgenes exist in one of four states (A/I/D/L):
*   **A (Active):** The gene is fully active, participating in real-time execution, fitness evaluation, and crossover breeding.
*   **I (Inactive):** The gene is dormant and unexpressed in the current generation but can be passed down to offspring and resurrected back to A (Active) via mutation.
*   **D (Deprecated):** A mitigated state where the gene's weight is scaled down and its thresholds are tightened instead of full deactivation, rendering a highly cautious operation under risk conditions.
*   **L (Lethal):** A highly toxic gene identified with extreme drawdowns or errors. Expression is permanently forbidden; only a vestigial trace remains in the genome, and it can only be inherited as Inactive (I) by offspring (Preservation-based Lethal Gene Control).

#### 3. Evolutionary Operators
*   **Crossover:** When selecting the top 50 parents to breed, we align genes by `innovation_id` before mixing weights rather than performing a blind average.
*   **Mutation:** In addition to numerical weight/threshold mutations, we introduce state mutations (e.g., I -> A, A -> D, D -> L) to govern gene reactivation and degradation.
*   **Natural Selection:** Poorly performing candidate models are discarded, but their structural sequences are logged into the `DNA archive` to avoid repeating identical evolutionary failures.
*   **Generation Progression:** Generation numbers are advanced in conjunction with logging which active genes survived and which latent genes reappeared.

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

## ⚖️ License and Commercial Use Inquiries

**AI-S (Safe Gated RSI)** is provided under a **Dual License Policy** to ensure compliance with open-source licensing and rights preservation.

### 1. Open Source Use under AGPL-3.0 License
The AGPL-3.0 License does not restrict commercial use itself. Anyone is free to use the software for commercial purposes as long as they comply with the terms of the AGPL-3.0 License (such as the obligation to disclose the full source code of any modified versions).

### 2. Commercial License and Integration (Commercial Use)
The AI-S project adopts a dual licensing policy where the copyright holder provides a separate commercial license. If you wish to use the software for proprietary commercial services or exclusive use without complying with the AGPL obligations, you must obtain a separate Commercial License from the original author (Rejard).

If you wish to integrate the AI-S architecture into a commercial proprietary product or require dedicated technical support, please contact us at the email below.

- 📬 **Commercial & Technical Inquiries:** lemaiii@alonics.com
- **Copyright:** © 2026 Alonics Inc. All Rights Reserved.

