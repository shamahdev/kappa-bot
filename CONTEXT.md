# Kappa

Kappa is a subscription application with a job-listings sub-app. See [GLOSSARY.md](GLOSSARY.md) for domain terminology. Paid plans and a generic sub-app/plugin platform are not implemented.

## Ownership

- `apps/service/src/modules/job-listings/domain`: subscription identity, explicit personal/server scope, access rules, and validation.
- `application`: subscription/CV use cases, read models, polling, enrichment, retention, delivery recall, and timer lifecycle.
- `infrastructure`: external job sources, AI, PDF extraction, and shared posting persistence.
- `apps/service/src/routes`: HTTP controllers; translate sessions into trusted actors and application results into wire responses.
- `apps/discord/src/features/job-listings`: Discord controllers, views, and notification adapter. No subscription SQL or independent business rules.
- `apps/web/src/lib/use-subscription-editor.ts`, `use-jobs-table.ts`, and `use-cv-editor.ts`: frontend ViewModels; query/mutation coordination lives in `queries.ts`, HTTP decoding in `api.ts`.
- `packages/contracts`: wire shapes, normalized posting data, shared source metadata, and client-facing validation bounds.
- `packages/db`: connection, schema, and migrations, not domain/application orchestration.

The service module has a non-bootstrapping `@kappa/service/job-listings` entrypoint. HTTP and Discord use the same application implementation, not copies or an additional internal HTTP hop. The existing Discord gateway process hosts the service-owned poller with its gateway delivery adapter; the one-shot worker binds the same module to Discord REST. The service HTTP process does not start another poller. Do not run a continuous gateway poller and a separately scheduled worker unintentionally.

## Rules to preserve

- Personal subscriptions and CVs are owner-only. Server subscriptions require current server-management permission; `createdBy` is attribution, never an access grant. Web permission proofs retain the existing short-lived Discord membership cache.
- Deleting an account removes its personal subscriptions/history, CV, sessions, and connections. Server subscriptions survive with creator attribution cleared.
- Global polling is operator-controlled. Discord commands can adjust scoped retention, not the global interval.
- CV matching never reads personal CV data for server deliveries. CV rows intentionally lack an account FK because Discord-only users can have a CV before a web account exists.
- CV endpoints expose metadata only (filename, hasCv, uploaded timestamp). Extraction remains server-side for PDF/TXT/MD. The existing PUT input remains compatible but never echoes text.
- Matching sends the complete extracted CV and original posting to the configured model. Skills/relevant experience/keyword scores are combined at 50%/35%/15% into advisory A–E grades; the rubric and research caveats are recorded in `docs/research/cv-match-weighting.md`. Factor breakdowns persist in `seen_jobs.match_breakdown` (migration `0010_mature_bill_hollister`). Historical scores are not automatically recalculated.
- Personal CV reports are per user: a window opens at the previous report's end (or the first unreported DM delivery) and a scheduled report is created once it is 3 days old; a dashboard trigger closes it early. Queue rows retain posting snapshots and seen IDs and each stores its own assessment, so generation resumes per job. Transient AI failures are retried on later ticks up to a bounded attempt cap; permanent failures and exhausted retries are recorded per job and the report publishes with those jobs unassessed. A summary failure after the cap publishes the scores without a written summary. Description-less postings are skipped, not fatal. `cv_required`/`unavailable` reports can be requeued from the dashboard once a CV exists. No AI call runs inside a database transaction; generation is serialized per report with a cross-process advisory lock, publication is a compare-and-set on status, and DM notification is claimed before sending with a stale-claim lease. Reports assess one CV snapshot (a replaced CV restarts pending assessments; the snapshot reset is status-guarded). No-CV/unassessable reports have explicit non-scored states.
- Report list/detail APIs are owner-only and expose no raw CV or posting descriptions. List responses are paginated lightweight rows; detail responses include job snapshots and the summary. Home and personal Jobs link to dashboard reports. Discord report notifications open the owner's bot DM and contain only the grade and a `/dashboard/reports/<id>` link using `WEB_URL`. Account deletion removes reports explicitly; accumulation rows cascade with subscription deletion. Migration `0011_colossal_kat_farrell` adds report persistence and `0014_parched_whizzer` adds retry/notification-lease columns. CV removal clears CV-derived scores from job cards and tracked applications; reports remain as historical documents.
- Deduplication remains claim-first. A failed send keeps its claim, preventing duplicate sends but not guaranteeing eventual delivery. This refactor does not introduce a delivery queue or retry guarantee.
- Job subscriptions support up to 10 comma-separated keyword alternatives (100 characters each), an optional title (80 characters), onsite/remote/hybrid selections and a minimum salary fixed to IDR/month. Alternatives are OR; each alternative requires all its terms. `keyword_alternatives = NULL` preserves legacy search text as one query, including commas; title/filter-only edits do not split it. Titles are display-only. Migration `0015_subscription_criteria` adds the fields and source-only fact/evaluation tables without modifying existing subscriptions or history.
- Minimum salary passes when an advertised upper bound reaches the threshold, or a lower-bound-only salary already meets it. A lower-bound-only amount below the threshold is unknown. Explicit IDR annual pay is divided by 12; hourly/daily or unstated units are unknown, and explicit foreign currencies fail. Each active filter has its own include-unspecified option, default false. A completed extraction with missing evidence is unknown; fetch/AI failures stay pending/failed, never unspecified.
- Filtered candidates are evaluated before SeenJob claims, using structured metadata first and AI extraction from original evidence only where needed. Source-only facts are shared across subscriptions, never with CV content. Extraction has a 24-hour cache, three total ordinary-failure attempts, a cross-process lease, and an initial per-poll budget of 20 distinct postings or two minutes; oldest candidates go first. Broad AI-provider outages/configuration issues do not consume per-posting attempts. Dashboard/Discord show pending/failed counts and expose explicit retries. Combined alternative/source results are delivered once per subscription per poll, subject to existing SeenJob deduplication. See `docs/adr/0001-source-facts-before-delivery-claims.md`.
- Discord list pages contain every posting, split to fit platform limits. Recall stores the exact display order per message; numbering restarts for each message.
- Server subscriptions (not personal/DM) may store one optional `roleId` for a notification tag. The role must belong to the subscription's own server and must not be `@everyone` (the guild's own ID) or an integration-managed role; it does **not** need Discord's "allow anyone to mention" flag, which is off by default on most roles and would otherwise reject normal roles. The application rechecks the role on every create/update. Notifications ping the role at most once (first message of a batch, or the single card) using `allowed_mentions` restricted to that role, so other mentions never fire. For roles that are not mentionable by anyone, the bot needs the "Mention @everyone, @here and All Roles" permission for the ping to actually notify. Reply-by-number summaries, CV reports and "latest job" previews never ping it. Migration `0016_server_notification_role` adds the nullable column; personal subscriptions cannot set a tag.
- Database layout and existing HTTP paths remain compatible. `dm:<userId>` remains a legacy storage encoding behind the job-listings module. Existing `position` posting fields remain compatible with saved delivery snapshots.

## Git hooks

`bun install` runs `prepare` to install the Lefthook pre-commit hook. Run `bun run prepare` to reinstall it in an existing checkout. The hook runs `bun run check` on supported staged file paths and blocks commits on lint or formatting errors. It does not rewrite files or automatically stage changes; use `bun run fix` and review/stage the result before committing.

## Manual operation

Deployment automation, checked-in Nginx setup, and automated rollback support are retired. Existing PM2 configuration may still be used manually; no replacement deployment framework is introduced.

1. Install dependencies with `bun install --frozen-lockfile`. Configure secrets using `.env.example`; never commit the resulting `.env` or overwrite host-managed secrets during updates.
2. Run `bun run check`, `bun run typecheck`, and `bun run test`. Ultracite runs Oxlint and Oxfmt across the monorepo; `bun run fix` applies safe lint fixes and formatting. Use `bun run lint`, `bun run format`, or `bun run format:check` to run each tool separately. The web workspace adds React and TanStack presets. Generated files and migration metadata are excluded. Tests use in-memory data and mocked integrations, not a live database or Discord account.
3. For development, run `bun apps/service/src/index.ts`, `bun apps/discord/src/index.ts`, and `bun --filter @kappa/web dev` in separate terminals from the repository root. The web dev server proxies `/api` to the service.
4. Apply reviewed forward migrations manually with `bun run db:migrate` using the direct database URL. Service/gateway boot also applies migrations when `DATABASE_URL_UNPOOLED` is present; migrations are never reversed by an application-code rollback.
5. Before manually starting production web output, run `bun --filter @kappa/web build`. Start it with `PORT=3444 bun apps/web/.output/server/index.mjs`; the service defaults to port 3443.
6. Production hosting must provide HTTPS and same-origin `/api` routing to the service, with other routes going to the web server. Production session cookies are Secure. The development proxy is not a production routing configuration.
7. To run only one polling cycle, stop the continuous gateway poller first and run `BOT_ROLE=worker bun apps/discord/src/index.ts`.

The global interval is the existing `bot_config` singleton, defaulting to 30 minutes. An operator can change it directly, then restart the poller:

```sql
INSERT INTO bot_config (id, poll_interval_minutes) VALUES (1, 30)
ON CONFLICT (id) DO UPDATE SET poll_interval_minutes = EXCLUDED.poll_interval_minutes;
```

The existing supported setting is an integer from 1 to 1440 minutes. Polling now uses exact elapsed intervals rather than cron hour/minute conversion. Slash commands are synchronized when the gateway starts; `bun --filter @kappa/discord deploy:commands` remains a manual Discord command-registration utility, not application deployment automation.

Job-source permission and terms constraints remain an operator responsibility. Historical scraper research is not evidence that a provider currently permits automated access.
