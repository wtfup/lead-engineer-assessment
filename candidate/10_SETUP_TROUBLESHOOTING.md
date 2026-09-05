# Setup, Windows, SQL and Docker handover

Environment setup is outside the clock. The verified native route is Node22.13+ plus Docker PostgreSQL. macOS/Linux terminals and Windows PowerShell can run Git/npm/Compose commands in the main README. Do not run both the native and Docker app on4317 at once. Do not use real database URLs.

## Sequential native verification

From the repository root, with no existing dev server:

```text
npm ci
docker compose up -d db
npm run doctor
npm run db:reset
npm test
npm run build
npm run typecheck
npm run dev
```

The last command stays running. Open http://127.0.0.1:4317. In a second terminal run `npm run test:challenge` (expected starter failures) and `npm run test:e2e`. If changing build configuration, stop dev first, build/typecheck, then restart. Do not concurrently mutate `.next` through dev and production build.

If PowerShell blocks `npm.ps1`, use `npm.cmd` for npm commands or a standard Command Prompt; do not disable system execution policy just for this test. Paths containing spaces should be quoted. On Windows clone into a short user-writable path, not a protected system directory. Use Git for Windows; no Unix-only tool is required for the primary lab.

## SQL access without installing psql locally

The database container includes psql. Open it from the repo root:

```text
docker compose exec db psql -U assessment -d assessment
```

Then enter:

```sql
SET search_path TO assessment_lab;
SELECT current_database(), current_schema();
SELECT tenant, status, count(*) FROM orders GROUP BY tenant, status ORDER BY tenant, status;
```

Exit psql with `\q`. These are orientation queries, not the financial solution. Keep your own SQL in `submission/reconciliation.sql`, beginning with `SET search_path TO assessment_lab;` and using the published data dictionary.

Run a saved SQL file (macOS/Linux/Git Bash):

```bash
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U assessment -d assessment < submission/reconciliation.sql
```

PowerShell equivalent:

```powershell
Get-Content -Raw .\submission\reconciliation.sql | docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U assessment -d assessment
$LASTEXITCODE
```

Use your terminal capture or redirect output to a reviewed evidence file under submission. Record exit code: `$?` immediately after the command in a POSIX shell, `$LASTEXITCODE` in PowerShell. Do not mistake shell-pipeline success for SQL success; `ON_ERROR_STOP=1` is intentional. Use the same procedure for performance.sql. `npm run db:performance` creates the supplied independent50,000-row plan lab; it is not your finished solution.

## Docker-only practical route

Use the README Docker build/reset/start commands. This is a production-build preview, not hot reload. The only host mount is `./submission:/app/submission`; no private home directory is mounted. Write response files in the host submission folder using your editor. The following container commands read/write that same folder:

```text
docker compose exec app npm run session -- start
docker compose exec app npm run session -- status
docker compose exec app npm run session -- card
docker compose exec app npm run submit:check
docker compose exec app npm test
docker compose exec app npm run test:challenge
docker compose exec app npm run typecheck
docker compose exec app npm run session -- finish
```

Open the change card at practical110 and finish only at the frozen-code boundary described in07_SUBMISSION. Editing source occurs on your laptop; run `docker compose up -d --build app` to rebuild/recreate the app after changes. The lab database volume and bind-mounted submission folder survive this operation. Do NOT run db:reset as part of ordinary restart. Check your host `submission/session.json` after start/recreation.

The app image does not include browser binaries. Native Playwright or an isolated approved browser-test environment is required for automated browser proof. If using Docker-only without that environment, perform the documented browser interactions, provide a runnable test, and label automated browser execution unverified. This is a declared evidence limitation, not a fabricated pass. No unnecessary privileged browser container is provided.

Use host Git to commit and archive the code plus host submission folder. If the Git identity is unset, configure it **for this repository only** using your chosen name and a GitHub no-reply email or another address you agree to publish. Do not publish your private contact address inadvertently. Git archive includes tracked files only, so inspect the staged/committed inventory before handover. You can hand the ZIP privately without any public fork or PR.

## Flutter setup on different shells

From mobile/, before using the commands in its README:

macOS/Linux/Git Bash:

```bash
export PUB_CACHE="$PWD/.pub-cache"
```

PowerShell:

```powershell
$env:PUB_CACHE = Join-Path (Get-Location) '.pub-cache'
```

The remaining flutter commands are the same. Confirm `flutter --version`. SDK installation and initial package downloads are outside the timed learning block. The no-SDK fallback in04_LEARNING is permitted and must be labelled EXECUTION_UNVERIFIED; it does not manufacture Flutter runtime proof.

## Common blockers

- Database starting: run `docker compose ps`, wait for the db health status, then doctor. If Docker itself is unavailable, ask for setup help before starting.
- Port4317 already used: stop only your own previous assessment process/container; never kill an unknown process.
- Empty schema: run the lab-only db:reset once. Save evidence first if you already worked.
- Docker Hub/package registry timeout: treat it as setup/provider failure, not a candidate intellectual failure. Use the verified native Node route if available; do not change host-wide proxy/security settings or use an unknown image mirror.
- Challenge tests fail on a clean starter: expected. Smoke/type/build failures are not intended challenge work.
- Static reasoning JSON fails to load: stop before the timer; reload the HTTPS page or ask for the printable paper. Do not invent an untimed test.
- Reasoning local storage unavailable: keep the tab open and export JSON/manual text before leaving. After confirmed private handover, browser site-data controls can remove this assessment site’s local data. Do not clear it before recovery/export. Downloaded files/local storage are not encrypted vaults.

No live API, advertising, payment, email, WhatsApp or LLM credential is required anywhere in this pack.
