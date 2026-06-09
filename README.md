# AI-S

AI-S is a Polygon-based membership, KYC, referral, and simulated SUT trading platform.

The production service is served from:

```text
https://edenai.alonics.com/
```

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

We invite like-minded developers who believe in **survival through wild diversity rather than sterile over-regulation** to join our movement.

