Status: resolved
Type: grilling
Blocked by:

## Question

Decide the bot runtime and framework: Node.js + TypeScript + discord.js v14 vs alternatives (Eris, discord.py, Sapphire, Nest-based). Criteria: modular feature loading, slash-command lifecycle, sharding story, ecosystem/maintenance, Neon driver compatibility, and hiring/contributor friction. Record the decision, rejected alternatives with one-line reason, and version pins. If Node is chosen, decide package manager and TS target.

## Answer

**Status: resolved — Decision: Bun 1.x + Elysia 1.x (HTTP) + discord.js v14 (Discord) + TypeScript + bun**

- **Runtime:** `Bun >=1.1` (LTS, Node-compat). Required by Elysia. `engines: bun >=1.1` in `package.json`, `packageManager: bun`.
- **HTTP framework:** `elysia >=1.1` — serves `/health`, `/metrics`, future webhooks/dashboard; runs alongside the `discord.js` `Client` in the same Bun process (gateway) or as a separate lightweight process if sharded. Does not replace discord.js.
- **Discord framework:** `discord.js@14.14.1` (plain) — `REST`, `SlashCommandBuilder`, `ShardingManager`. A custom `defineFeature({ name, commands, events, schedule })` registry in `src/core/feature.ts` auto-discovers `src/features/*/index.ts`. No Sapphire/Nest wrapper.
- **Language & build:** TypeScript `strict: true`, `target ESNext`, `module ESNext`, `moduleResolution bundler`, `esModuleInterop true`, `declaration true`. `bun --watch` for dev, `bun run build` via `tsc --noEmit` (typecheck) + Bun's native TS execution.
- **Package manager:** `bun` (lockfile `bun.lockb`). `pnpm` remains fallback if Bun's `pg`/`ws` compat regresses.
- **Version pins (initial):** `discord.js@14.14.1`, `elysia@1.1.x`, `drizzle-orm@0.34.x`, `drizzle-kit@0.24.x`, `@neondatabase/serverless@0.10.x`, `pg@8.11.x` (under Bun Node compat) or `postgres@3.4.x` if `pg` proves flaky on Bun, `cheerio@1.0.x` for LinkedIn HTML parsing.
- **Neon driver mapping (unchanged):** gateway `pg` Pool on pooled host (`-pooler`) when possible under Bun compat; polling worker `@neondatabase/serverless` HTTP `neon()` via `drizzle-orm/neon-http` (stateless, no WS).
- **Rejected alternatives:**
  - Node 22 + pnpm + discord.js alone — most mature for Neon/Drizzle, but rejected per explicit `Elysia.js` requirement (needs Bun).
  - Sapphire — adds Piece loader conventions but smaller hiring pool and locks framework; plain `defineFeature` registry is lighter and owner-neutral.
  - Eris — lighter, faster, but no built-in slash builders, less maintained, smaller plugin ecosystem.
  - discord.py / Python — loses Drizzle/Neon research (04) and forces `asyncpg`/`SQLAlchemy` re-research.
  - NestJS / full DI container — heavier ceremony for a bot; registry pattern scales to N features without container.

Evidence: research-04 for Neon drivers, live grilling Q&A 2026-09-02 confirming `Bun+Elysia+discord.js` (Option A). Domain terms locked to `CONTEXT.md:1` (`Feature`, `Subscription`, `JobPosting`, `SeenJob`, `Source Adapter`); ADR `docs/adr/0001-bun-elysia-discordjs-runtime.md:1` records the tradeoff.

## Resolution Comment

Claimed `claimed` → `resolved` via grilling rounds 2026-09-02. Owner confirmed Bun+Elysia+discord.js. `CONTEXT.md` and ADR `0001` created; this answer is the ticket's resolution record.

