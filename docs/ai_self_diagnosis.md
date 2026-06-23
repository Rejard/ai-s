# 🤖 AI Self-Diagnosis & Error Avoidance Log

This log is strictly for AI self-reference to avoid repeating developer mistakes and expedite debugging.

---

## ⚠️ [ERR_CODE_01] code_edit_corruption (코드 수정 도구 오작동 및 누락)
- **Sym**: `replace_file_content` or `multi_replace_file_content` runs successfully, but unrelated code (especially top-level imports) is silently deleted or corrupted.
- **Cause**: Broad `[StartLine, EndLine]` range, causing fuzzy/duplicate pattern matching inside the file tool wrapper.
- **Action**:
  1. **Tighten Window**: Always set `StartLine` and `EndLine` to cover only the exact lines being changed.
  2. **Unique Context**: Ensure `TargetContent` contains highly unique strings.
  3. **Immediate Diff**: Proactively run `git diff <file>` to verify all changes right after running edit tools.
  4. **Instant Rollback**: If code is deleted or corrupted, instantly execute `git restore <file>` and apply edits in smaller chunks.

---

## ⚠️ [ERR_CODE_02] blank_screen_runtime (프론트엔드 흰색 화면 먹통)
- **Sym**: The web application loads as a completely blank screen. Browser console logs show `ReferenceError: <Component> is not defined`.
- **Cause**: New components (or existing dependent components like `SutPriceCard`) are missing `import` statements at the top of page files, often due to tool-induced overwrite bugs.
- **Action**:
  1. **Import Checklist**: Double-check the top 40 lines of modified page files to ensure all imported modules are correctly listed.
  2. **Bundler Check**: Run `npm run build` in `frontend/` to spot compilation warnings or unresolved imports.
  3. **Browser Check**: Always fire `browser_subagent` to navigate to the target site (`https://ais.alonics.com/`) and inspect console logs for reference errors.
- **Case Example**:
  * *2026-06-09*: `SutPriceCard` and `ManagerTradeExecutions` imports were missing in `PcManagerDashboard.jsx` and `ManagerDashboard.jsx`, resulting in a runtime `ReferenceError` post-build. Resolved by restoring imports, rebuilding, and restarting `ai-s`.

---

## ⚠️ [ERR_CODE_03] module_not_found_local (로컬 유틸리티 실행 모듈 에러)
- **Sym**: Node.js scripts in `scratch/` or project root fail with `MODULE_NOT_FOUND` (e.g. `sqlite3` missing).
- **Cause**: Root directory doesn't have `node_modules`; all dependencies are localized inside sub-folders like `backend/` or `frontend/`.
- **Action**:
  1. **Path injection**: Add `module.paths.push(path.resolve(__dirname, '../backend/node_modules'));` (or appropriate sub-folder) at the very top of utility scripts.
  2. **Working Directory**: Run execution commands with target `Cwd` set to `backend/` or `frontend/` where node modules reside.

---

## ⚠️ [ERR_CODE_04] past_incident_syntax_error (과거 식별자 중복 선언 구문 에러)
- **Sym**: Node.js backend server crashes and does not start, causing entire site down.
- **Cause**: Variable redeclaration error (`SyntaxError: Identifier 'sortedTrades' has already been declared`) in `backend/routes/manager.js` inside `/gateio-performance` endpoint.
- **Action**:
  1. **Identifier Check**: Avoid declaring identical variable names within the same block scope. Use distinct local names like `chronTrades`.
  2. **Process Check**: Always monitor backend server status via `pm2 status` or logs when site goes down, and run `pm2 restart ai-s`.

---

## ⚠️ [ERR_CODE_05] past_incident_reference_error (과거 미사용 함수 호출 참조 에러)
- **Sym**: Manager dashboard fails to load, blank screen.
- **Cause**: Calling undeclared/removed function `buildNextPriceHistory` inside `PcManagerDashboard.jsx` and `ManagerDashboard.jsx`.
- **Action**:
  1. **Dead Code Elimination**: Remove dead/undeclared function calls.
  2. **Vite Compile Check**: Verify components compile properly using `npm run build` before deploying.

---

## 💡 [RULE_CHECK] git_safety_check (깃허브 수동 안전장치)
- **Sym**: Accidental automatic commit/push occurs without direct confirmation.
- **Cause**: AI execution path skipped manual checkpoints.
- **Action**:
  1. **Must Confirm**: Always ask the user for confirmation via `ask_question` before running any git modifying command (`git add`, `git commit`, `git push`, `git rm`, etc.).
