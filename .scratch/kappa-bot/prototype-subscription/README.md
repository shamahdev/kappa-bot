# Prototype: job-subscription wireframe (ticket 10)

Throwaway stub — **not production code**. Proves the decided UX (ticket 09)
fits the decided schema (ticket 07) against the real Neon DB (ticket 11).

## Run

```bash
bun .scratch/kappa-bot/prototype-subscription/register.ts  # command JSON dry-run
bun .scratch/kappa-bot/prototype-subscription/embed.ts     # embed JSON for 2 mock jobs
bun .scratch/kappa-bot/prototype-subscription/run.ts       # full flow + cleanup
```

`run.ts` writes test rows (fake `999…` snowflakes) to the linked Neon branch
and deletes them at the end — the branch is left empty. It prints no secrets.

## Files

| File | Covers |
|---|---|
| `register.ts` | `/jobs` subscribe/list/unsubscribe/config builders (09 Q1–Q2); REST PUT skipped while `CLIENT_ID` is blank |
| `subscribe.ts` | Neon-backed subscribe handler: filter-JSON validation (research-01 vocab) + guild/channel/subscription upsert (ADR-0003) |
| `embed.ts` | `embedForJob`: single rich embed, no detail fetch (09 Q5 A) |
| `mock-jobs.ts` | Two guest-card-shaped jobs from the research-01 live probe (one with salary+logo, one without — null tolerance) |
| `run.ts` | Orchestrates 1–4 + `deliverIfNew` dedup demo (ADR-0004 insert-first: first=true, retry=false) |

## Known simplifications (do NOT copy to production)

- Uses drizzle `neon-http`; production gateway uses `pg` Pool (ADR-0001).
- No Discord login, no permission check, no ephemeral reply — interaction is mocked.
- No `location`→`geo_id` resolution, no scheduler, no fingerprint group-by.

## React to this (owner)

1. `filters` as raw JSON string — readable enough, or want typed options (`experience`, `workplace`, …) per filter?
2. Embed density — keep Location/Posted/Salary only, or add company link / Easy Apply badge field?
3. `unsubscribe` by numeric id — fine, or prefer autocomplete showing `keywords @ channel`?
4. Confirm/cleanup behavior above matches expectations before build tickets copy it into `src/`.
