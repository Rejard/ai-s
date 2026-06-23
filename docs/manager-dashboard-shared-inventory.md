# Manager Dashboard Shared Logic Inventory

Goal: keep PC and mobile manager pages visually separate while moving shared behavior into common hooks and helpers. This file is the checklist used to avoid dropping a state value, handler, API call, or calculation that exists in only one shell.

## Current Shells

- Mobile shell: `frontend/src/pages/ManagerDashboard.jsx`
- PC shell: `frontend/src/pages/PcManagerDashboard.jsx`
- First shared helper: `frontend/src/lib/managerDashboard.js`

## Shared State Candidates

These values are present in both manager shells and should eventually come from one shared manager hook.

- User/admin data: `pendingUsers`, `allUsers`, `stats`, `recentPayments`, `withdrawals`, `loading`
- AI/grid settings: `gridSettings`
- Manager portfolio: `portfolio`, `walletSutBalance`
- Transaction modal: `showTxModal`, `txType`, `txAmount`, `processingTx`
- Gate.io data: `gateioBalance`, `performance`, `yieldHistory`
- AI logs: `aiLogs`, `lastExecutedStrategyIdRef`
- Manual order form: `orderAmount`, `orderPrice`, `submittingOrder`
- Gate.io credential form: `localApiKey`, `localApiSecret`, `localDepositAddress`
- SUT transfer modal: `showSendSutModal`, `sendSutAmount`, `sendingSut`
- KYC image modal: `selectedIdCard`, `submittingId`

## Mobile-Only State To Preserve

- `managerAuth`
- `managerPassword`

These are mobile-shell concerns unless later confirmed otherwise. Do not delete them during shared hook extraction.

## Shared Handler Candidates

Move in this order, verifying after each group.

1. Safe helpers
   - `getManagerHeaders`
   - `isMaskedCredential`
   - manager email normalization

2. Read-only loading
   - `fetchManagerData`
   - pending users
   - stats and recent payments
   - all users
   - withdrawals
   - AI settings
   - manager portfolio
   - wallet SUT balance
   - Gate.io balance
   - Gate.io performance and yield history
   - AI logs

3. Credential management
   - `handleSaveApiKeys`
   - `handleClearApiKeys`
   - masked local credential cleanup
   - deposit address hydration

4. Manager actions
   - `handleApprove`
   - `handleReject`
   - `handleApproveWithdrawal`

5. Settings actions
   - `handleToggleAiStatus`
   - `handleSaveGridSettings`
   - `handleTriggerAIProfit`

6. High-risk money-moving actions
   - `handleGateIoOrder`
   - `handleSendSutToGateIo`
   - `handleTxSubmit`

Do not move group 6 until groups 1-5 have passed tests, build, and browser checks.

## Shared API Calls

- `GET /manager/pending-users`
- `GET /manager/stats`
- `GET /manager/users`
- `GET /manager/withdrawals`
- `GET /manager/ai-settings`
- `GET /investment/portfolio/:walletAddress`
- Polygon RPC `balanceOf(walletAddress)`
- `GET /manager/gateio-balance`
- `GET /manager/gateio-performance`
- `GET /manager/ai-logs`
- `POST /manager/save-gateio-keys`
- `POST /manager/clear-gateio-keys`
- `POST /manager/approve-user`
- `POST /manager/reject-user`
- `POST /manager/approve-withdrawal`
- `POST /manager/ai-settings`
- `POST /manager/trigger-ai-profit`
- `POST /manager/gateio-order`

## Verification Gates

After every small extraction:

- Run `npm run test` in `frontend`
- Run `npm run build` in `frontend`
- Check `https://ais.alonics.com/` in the browser, not localhost
- Confirm both desktop width and mobile width still render
- Confirm no unexpected live Gate.io order or SUT transfer is triggered during testing

## Refactor Boundary

The intended final shape is:

- `frontend/src/hooks/useManagerDashboardLogic.js`: shared state, loading, and handlers
- `frontend/src/lib/managerDashboard.js`: pure helpers and calculation utilities
- `frontend/src/pages/ManagerDashboard.jsx`: mobile UI shell
- `frontend/src/pages/PcManagerDashboard.jsx`: PC UI shell

The shells should call shared logic and render differently. They should not each reimplement the same API calls or calculations.
