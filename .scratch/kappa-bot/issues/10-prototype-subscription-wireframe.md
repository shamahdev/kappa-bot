Status: resolved
Type: prototype
Blocked by: 07, 09

## Question

Prototype the subscription flow at low fidelity: a slash-command registration snippet, one Neon-backed handler for `/jobs subscribe` that persists a subscription row, and a job embed renderer (with mock LinkedIn data) showing how fetched jobs become Discord messages. The prototype should be a runnable stub or linked branch/files under `.scratch/kappa-bot/prototype-*`, not production code, sufficient to react to UX and schema choices before the spec locks.

## Answer

**Status: resolved — runnable stub at `.scratch/kappa-bot/prototype-subscription/` (5 files + README), verified live against Neon 2026-09-04.**

| Asset | Covers |
|---|---|
| `register.ts` | `/jobs` subscribe/list/unsubscribe/config builders (09); prints registration JSON (`subcommands: subscribe, list, unsubscribe, config`, `default_member_permissions: 32`); REST PUT correctly skipped while `CLIENT_ID` is blank |
| `subscribe.ts` | Neon-backed subscribe handler: filter-JSON validation against research-01 vocab + guild/channel/subscription upsert (ADR-0003); uses drizzle `neon-http` (production gateway will use `pg` Pool per ADR-0001 — same SQL shape) |
| `embed.ts` | `embedForJob`: single rich embed, no detail fetch (09 Q5 A); null-tolerant logo/salary |
| `mock-jobs.ts` | Two guest-card-shaped jobs from the research-01 live probe |
| `run.ts` | Full flow + cleanup; `README.md` lists 4 react-questions for the owner |

**Proof (real Neon `production` branch, then cleaned to all-zeros):**
- `subscribe ok: id=1 … filters={"f_E":"2","f_TPR":"r86400"}` — write + JSONB round-trip
- `filter validation ok: unknown filter key "f_BOGUS" …` — bad input rejected, no row written
- `deliverIfNew: first=true (would send), retry=false (skipped as seen)` — ADR-0004 insert-first dedup proven
- Embed JSON matches 09's format exactly (title/url/Location/Posted/Salary/footer/thumbnail)
- `cleanup ok`, post-run counts `guilds/channels/subscriptions/seen_jobs: 0`; `bun run typecheck` exit 0; no secrets printed

**Bug found in 09's sketch:** `source` combined `.setAutocomplete(true)` + `.addChoices()` → discord.js `RangeError` (mutually exclusive). Fixed to choices-only in the prototype; correction note appended to ticket 09. Build tickets must copy the fixed form.

**Simplifications (do NOT copy):** neon-http instead of pg Pool; mocked interaction (no login/permission/ephemeral); no geo_id resolution, scheduler, or fingerprint group-by. `discord.js@14.27.0` installed as a decided-stack dep to make the stub runnable.

## Resolution Comment

Claimed → resolved 2026-09-04. Artifact linked above; evidence is the run transcript in this answer. Owner react-questions are in `prototype-subscription/README.md` and the closing summary — answers feed build tickets, not further wayfinding.

