Status: resolved
Type: grilling
Blocked by: 01, 07

## Question

Decide the job fetch → filter → dedup → deliver pipeline: polling trigger (cron/node-cron/BullMQ/pg-boss/pg_cron), interval per subscription and global budget, batching across subscriptions with overlapping filters, deduplication & "seen" checks, retry/backoff on 429/999/empty, and delivery transaction (mark-seen + send to channel atomically where possible). Clarify where the scheduler lives (gateway process vs separate worker) and how horizontal scaling will avoid duplicate sends.

## Answer

**Status: resolved — Decision: gateway in-process `cron` 15m tick, fingerprint group-by, tiered backoff, insert-first delivery (all A).**

- **Scheduler (Q1 A):** Runs inside gateway Bun process. `src/features/job-subscription/schedule.ts` exports `{ cron: '*/15 * * * *', run: pollAll }` wired via ADR-0002 `loader.ts` → `cron` lib (`cron` package, `CronJob`). Elysia+client boot sequence: `migrate()` → `REST.put` → `client.login()` → `CronJob.start()`. No `pg_cron`/`pg-boss`/`BullMQ`/Redis (overkill <100 subs, Neon `pg_cron` availability varies). Contract allows promotion to `Bun.spawn('./src/worker.ts')` or separate Docker without changing `Feature` interface.

- **Interval & budget (Q2 A):** Global tick `*/15 * * * *` (`bot_config.poll_interval_minutes` default 15, tunable). Per tick: `SELECT * FROM subscriptions WHERE is_active=true`. Each **fingerprint** budgets ≤3 pages × 10 cards = ≤30 jobs, 2s delay → ~6s per fingerprint. Global cap: sequential execution (no parallel fingerprints) → `N_fingerprints * 6s`; for 20 fingerprints ≈120s worst-case, acceptable inside 15m window. If `N > 30`, future: semaphore `p-limit(1)` + token bucket 30 req/min. Per-sub `retention_days` already in schema; `poll_interval_minutes` column deferred — use global for MVP.

- **Batching (Q3 A — group-by fingerprint):**
  ```ts
  type Fingerprint = Pick<Subscription,'source'|'keywords'|'location'|'geoId'|'distance'|'filters'>;
  const groups = Map.groupBy(subs, s => hash(s.source, s.keywords, s.location, s.geoId, s.distance, JSON.stringify(s.filters)));
  for (const [fp, groupSubs] of groups) {
    const jobs = await fetchFingerprint(fp); // 1 LinkedIn query per distinct filter
    for (const job of jobs) for (const sub of groupSubs) await deliverIfNew(sub, job);
  }
  ```
  Savings: 5 subs sharing `backend Berlin` → 1 fetch, fan-out 5× `seen_jobs` inserts with per-sub `(sub,source,extId)` isolation (ADR-0003). Fingerprint is transient (hash), not persisted.

- **Retry/backoff (Q4 A — tiered):**
  - `429`/`999`: `for attempt=1..3 { sleep(2**attempt*1000 + rand(1000)); retry; }` after 3 failures → mark fingerprint `circuitOpenUntil = now+60m`, skip remaining pages/tick, `logger.warn({fingerprint, attempt, status}, 'linkedin throttle')`, metric `linkedin_circuit_open{fp}=1`.
  - `403`/`302` (`__cf_bm` challenge): 1 retry with rotated `User-Agent: Mozilla/5.0 ...` + `sleep(5000)`, then same circuit logic.
  - `200` + `0 <li>`: success — end paging (not error).
  - `5xx`: 1 retry.
  - Health: `GET /health` exposes `linkedin_circuit_open` fingerprints; if all open, tick logs `skip: all circuits open` and returns early. No kill-switch env needed (circuit is self-healing).

- **Delivery transaction & horizontal scaling (Q5 A — insert-first):**
  ```ts
  async function deliverIfNew(sub: Subscription, job: JobPosting) {
    // advisory lock only when SCALE>1 (env REPLICAS >1)
    if (process.env.REPLICAS) await db.execute(sql`SELECT pg_try_advisory_xact_lock(${hashtext(jobFingerprint(fp))})`);
    const inserted = await db.insert(seenJobs).values({
      subscriptionId: sub.id, source: sub.source, externalId: job.id, url: job.url,
      snapshot: { title: job.position, company: job.company, location: job.location }
    }).onConflictDoNothing().returning({ id: seenJobs.id });
    if (!inserted.length) return; // already seen (dedup covers horizontal duplicate)
    try { await channelSend(sub.channelId, embedFor(job)); }
    catch (e) { logger.error({sub, job, e}, 'discord send failed'); /* row stays, at-most-once semantics */ }
  }
  ```
  - Insert commits **before** `channel.send` → if send fails, dedup prevents re-delivery (acceptable loss vs double-send). `send-then-insert` (B) was rejected — risks double-send on crash. Outbox (C) deferred to future when >1k deliveries/min.
  - Horizontal: unique `(subscription_id,source,external_id)` guarantees second replica's `INSERT` is no-op → it skips `send`. Optional `pg_try_advisory_xact_lock` per fingerprint serializes fetches when `REPLICAS>1`. No leader election / distributed queue for MVP.

- **Rejected:** Separate worker (extra deploy), per-sub cron timers (herd), per-sub fetch without coalescing (N× LinkedIn calls), single global job store + local filter (extra infra), send-then-insert (double-send risk), outbox (premature).

Evidence: research-01 paging/limits, research-02 failure modes (429/999/403), ADR-0002 schedule contract, ADR-0003 dedup key, owner confirmation 2026-09-02 “Accept all A”. ADR `docs/adr/0004-fetch-delivery-pipeline.md:1` records the tradeoff. Unblocks prototype `10`.

## Resolution Comment

Claimed → resolved via grilling 2026-09-02. All five Qs answered A. ADR 0004 and this pipeline sketch are the resolution record.

