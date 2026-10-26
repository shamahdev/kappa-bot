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
- Deduplication remains claim-first. A failed send keeps its claim, preventing duplicate sends but not guaranteeing eventual delivery. This refactor does not introduce a delivery queue or retry guarantee.
- Discord list pages contain every posting, split to fit platform limits. Recall stores the exact display order per message; numbering restarts for each message.
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
