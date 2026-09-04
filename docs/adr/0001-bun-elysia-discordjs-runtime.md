# Bun + Elysia + discord.js as runtime

Context: kappa-bot needs modular Discord features, scheduled job polling, Neon Postgres, and a health/webhook HTTP surface; the owner mandated Elysia.js. We chose **Bun 1.x** as runtime, **Elysia 1.x** for HTTP, and **discord.js v14** for Discord gateway — plain discord.js with a custom `defineFeature` registry, no Sapphire/Nest wrapper, TypeScript `ESNext`/`bundler`, package manager `bun`.

Considered: Node 22 + discord.js + pnpm (most mature Discord/Neon path, Drizzle docs use it), Sapphire framework (adds Piece loader but locks conventions), Eris (lighter but smaller ecosystem), discord.py/Python (loses Drizzle/Neon driver research). Rejected Node/pnpm not for technical inferiority but to satisfy the Elysia constraint — Bun has Node-compat for `discord.js`/`pg` and keeps Elysia native; pnpm reserved as fallback if Bun compat breaks.

Consequences: Neon Neon pooling via `@neondatabase/serverless` HTTP for the polling worker is unchanged; for the long-lived gateway, `pg` Pool runs under Bun's Node compat layer (verify `ws` polyfill) or swap to `postgres.js` if needed; TS config switches to `target ESNext, module ESNext, moduleResolution bundler`.
