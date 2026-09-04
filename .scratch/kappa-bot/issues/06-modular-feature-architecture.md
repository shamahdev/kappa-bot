Status: resolved
Type: grilling
Blocked by: 05

## Question

Define the modular feature architecture that makes the bot scalable to N features: core vs feature boundary, plugin/module loader contract, command registry & event bus, dependency injection, per-feature config/migrations, and failure isolation (one feature failing must not crash core). Sketch the directory layout (`src/core/*` vs `src/features/job-subscription/*`) and the interface a new feature must implement to register commands, scheduled jobs, and DB tables. Reference discord.js / chosen framework idioms.

## Answer

**Status: resolved — Decision: flat `src/core` + `src/features/*` with `defineFeature` registry, central REST dispatch, try/catch isolation, Elysia in-core.**

- **Directory layout (Option A):**
  ```
  src/
    index.ts              # entry: loads env, boots app
    app.ts                # creates Client + Elysia, runs loader
    core/
      client.ts           # discord.js Client + ShardingManager
      feature.ts          # defineFeature contract + types (Command, Event, Schedule, ServerHook)
      registry.ts         # FeatureRegistry: list, get, dispatch
      loader.ts           # Glob('../features/*/index.ts'), validate, register/start
      server.ts           # Elysia app: GET /health, /metrics
      db.ts               # drizzle instance (gateway pg Pool vs worker neon HTTP)
      config.ts           # env (Neon URLs, DISCORD_TOKEN, CLIENT_ID)
      logger.ts           # pino with feature context
      commands/deploy.ts  # manual REST deploy script
    db/
      schema.ts           # re-exports: export * from '../features/job-subscription/schema'
    features/
      job-subscription/
        index.ts          # export default defineFeature({ name:'job-subscription', ... })
        commands/         # /jobs subscribe|list|unsubscribe|config
        events/           # guildCreate, channelDelete cleanup
        schedule.ts       # cron: fetch→filter→dedup→deliver
        schema.ts         # Drizzle tables (subscriptions, seen_jobs)
        adapter/
          linkedin.ts     # SourceAdapter for jobs-guest
          arbeitnow.ts    # fallback adapter
  drizzle/                # generated SQL migrations
  ```
  Features never import each other; only `core` is shared. No `apps/packages` workspaces (premature — ticket Q1 confirms flat).

- **Feature contract (`src/core/feature.ts`):**
  ```ts
  export const defineFeature = (f: Feature) => f;
  type Feature = {
    name: string; description: string;
    commands?: SlashCommand[]; // { data: SlashCommandBuilder, execute: (i) => Promise<void> }
    events?: EventHandler[];   // { event: string, once?: boolean, handler: (...args)=>Promise<void> }
    schedule?: { cron: string; run: (ctx: AppContext)=>Promise<void> };
    schema?: Record<string, unknown>; // Drizzle tables re-exported via src/db/schema.ts
    server?: (app: Elysia) => void;   // optional HTTP mounts
  }
  ```
  Loader uses `new Glob('../features/*/index.ts')` (Bun) / `import.meta.glob` alternative, validates `name` uniqueness, calls `feature.server?.(elysia)` during `app.ts` boot.

- **Command & event registry (Q3 A — central):**
  - Startup: `registry.commandsFlat = features.flatMap(f=>f.commands??[])` → single `REST.put(Routes.applicationCommands(clientId), { body: commands.map(c=>c.data.toJSON()) })` before `client.login()`.
  - Dispatch: `client.on('interactionCreate', async i => { const cmd = registry.findCommand(i.commandName); await wrapFeature(cmd.feature, ()=>cmd.execute(i, ctx)); })`. Same for `client.on(event, wrapFeature(...))`. Logging includes `feature=name`. `core/commands/deploy.ts` allows `bun run deploy:commands` for manual sync.

- **Isolation & failure boundary (Q4 A — supervisor):**
  - Every `execute`/`handler`/`schedule.run` wrapped in `try/catch`, `logger.error({ feature, err })`, metric `feature_error_total{feature}`, continue.
  - Schedule: `cron` (e.g. `cron` or `node-cron`) runs `schedule.run(ctx).catch(e=>supervisor(e, feature))`; not `worker_threads` yet.
  - Process-level: `process.on('unhandledRejection', e=>logger.fatal(e))` does **not** `process.exit(1)`; `SIGTERM` graceful shutdown. Contract permits later moving schedule to `Bun.spawn('./src/worker.ts')` without changing `Feature` interface.

- **Elysia role & DB migrations (Q5 A — in-core):**
  - `src/core/server.ts`: `new Elysia().get('/health', () => ({ ok:true, uptime:process.uptime(), features: registry.names() })).get('/metrics', prometheusHandler)`; listen on `PORT` (default `3000`), started after `migrate()`.
  - DB: `src/db/schema.ts` re-exports per-feature schemas; `drizzle.config.ts` points at `DATABASE_URL_UNPOOLED` (direct, not `-pooler`); `bun run db:generate` → `drizzle/*.sql`; `await migrate(db, { migrationsFolder:'./drizzle' })` on **direct** URL before REST registration (per research-04).

- **Rejected:** `apps/packages` workspaces (overkill), decorator/class `BaseFeature` (boilerplate), per-feature `REST.put` (race), per-feature `Worker` threads (Neon pool pressure, premature), Elysia as separate service (split too early).

Evidence: ADR `docs/adr/0002-modular-feature-architecture.md:1`, owner confirmation 2026-09-02 “Accept all A”. Unblocks schema (`07`), pipeline (`08`), hosting (`12`) and informs prototype (`10`).

## Resolution Comment

Claimed → resolved via grilling 2026-09-02. All five Qs answered A. ADR 0002 and this answer are the resolution record.

