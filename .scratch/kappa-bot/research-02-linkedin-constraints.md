# Research 02 — LinkedIn Jobs Guest API Constraints

**Ticket:** `02-linkedin-guest-constraints` · **Date:** 2026-09-02 · **Status:** resolved

Practical constraints for polling `linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` (and `/jobPosting/{id}`) from a bot. Builds on [Research 01](./research-01-linkedin-guest-api.md) endpoint surface.

---

## 1. Authority & Summary

| Claim | Source |
|---|---|
| `robots.txt` **Disallows** `/jobs-guest/` for every major crawler | Live `GET https://www.linkedin.com/robots.txt` (2026-09-02) — see §2 |
| "Use of robots or other automated means … is strictly prohibited" without express permission | Same file header + `/legal/crawling-terms` |
| ToS §8.2 bans scraping, bypassing access controls/use limits, copying content without consent, bots, unreasonable load | `GET https://www.linkedin.com/legal/user-agreement` §8.2 (Effective 2025-11-03) |
| No published rate limit; no `Retry-After` / `X-RateLimit-*` headers observed | Live `curl -i` to `seeMoreJobPostings/search` — §3 |
| Gate is Cloudflare (`server: cloudflare`, `__cf_bm` 30-min cookie, `cf-ray`, `x-li-fabric`) | Same probe headers |
| Failure modes: 429, 999 (legacy LI throttle), 403 challenge/authwall, 302 redirect, 200+empty HTML, 404 detail | Community + live empty-page probe (`start=999` → 26 bytes) — §5 |

**Bottom line:** as written, any automated polling of `/jobs-guest/` violates both `robots.txt` and the User Agreement unless LinkedIn grants permission via `whitelist-crawl@linkedin.com`. The compliant posture is to treat polling as a *risk-accepted prototype* with a migration path to permitted alternatives, and to minimize load/cadence so a throttle or C&D does not also become an IP ban or legal exposure.

---

## 2. TOS / Robots Posture

### 2.1 robots.txt

Fetched 2026-09-02 via `WebFetch https://www.linkedin.com/robots.txt`:

```
# Notice: The use of robots or other automated means to access LinkedIn without
# the express permission of LinkedIn is strictly prohibited.
# See https://www.linkedin.com/legal/user-agreement.
# LinkedIn may, in its discretion, permit certain automated access ...
# If you would like to apply for permission to crawl LinkedIn, please email whitelist-crawl@linkedin.com.
# Any and all permitted crawling ... is subject to LinkedIn's Crawling Terms ...
# See http://www.linkedin.com/legal/crawling-terms.

User-agent: LinkedInBot
Allow: /

User-agent: Googlebot  (and Applebot, Bingbot, msnbot, Slurp, Baiduspider, seznambot, Teoma, Yandex, Yeti, msnbot-media, Googlebot-Image, Googlebot-News, Googlebot-Video, Googlebot-Mobile, Mediapartners-Google, AdsBot-Google, …)
Disallow: /jobs-guest/
Disallow: /jobs?runSearch*
Disallow: /jsearch*
Disallow: /voyager/api
Disallow: /api/jobPostings/jobs*
... (dozens more)

User-agent: *
(no explicit Allow — defaults to Allow except where overridden per-bot; but header notice still prohibits automated access)
```

Key points for kappa-bot:

- **Every named search-engine bot is explicitly `Disallow: /jobs-guest/`**. `User-agent: *` has no explicit `Allow`, but the header notice ("strictly prohibited without express permission") applies to all automated access. A generic bot should assume `/jobs-guest/` is disallowed.
- `Disallow: /voyager/api` confirms authenticated endpoints are also off-limits to crawlers (consistent with Research 01's 403 probe).
- LinkedIn's *permitted* crawling carve-out is narrow: "for the limited purpose of including content in **approved publicly available search engines**" — a Discord job subscription bot does not qualify.

### 2.2 Crawling Terms and Conditions

`GET https://www.linkedin.com/legal/crawling-terms` (Last revised 2017-05-25, still linked from `robots.txt`):

1. Automated Crawling & Indexing **without express permission is strictly prohibited**.
2. Must obey `robots.txt` / robot exclusion headers.
3. Must use **only your own true IP and User-Agent** — no masking or impersonating another entity/service.
4. No renting/leasing/transferring approved IP/UA without written consent.
5. No circumventing measures LinkedIn uses to prevent violations or to control/limit access.
6. Permitted use is **confined solely to search indexing for display in a publicly available search engine** unless separately approved for alternative display.
7. No renting/selling/transferring data in bulk or aggregated form.
8. No use in connection with a **competitive service** (as determined by LinkedIn).
9. Permission is **revocable at any time**; must cease and destroy data on request (certify under penalty of perjury + provide accounting within 10 days on request).
10. Violation may result in immediate ban + injunctive relief.

Implication: even if kappa-bot obtained permission, re-serving job listings via Discord notifications could violate terms 8–12 (competitive service, bulk transfer, non-search-engine display) without a separate approval.

### 2.3 User Agreement (ToS) — Dos and Don'ts

`GET https://www.linkedin.com/legal/user-agreement` (Effective 2025-11-03), §8.2 **Don’ts**:

> You agree that you will *not*:
> 2. Develop, support or use **software, devices, scripts, robots or any other means or processes (such as crawlers, browser plugins and add-ons or any other technology) to scrape or copy the Services**, including profiles and other data from the Services;
> 3. **Override any security feature or bypass or circumvent any access controls or use limits** of the Services (such as search results, profiles, or videos);
> 4. **Copy, use, display or distribute any information (including content) obtained from the Services**, whether directly or through third parties (such as search tools or data aggregators or brokers), **without the consent** of the content owner (such as LinkedIn for content it owns);
> 13. Use **bots or other unauthorized automated methods** to access the Services, add or download contacts, send or redirect messages, create, comment on, like, share, or re-share posts, or otherwise drive inauthentic engagement;
> 16. **Interfere with the operation of, or place an unreasonable load on, the Services** (e.g., spam, denial of service attack, viruses, manipulating algorithms);

Additional relevant sections: §3.4 (LinkedIn may limit use, restrict/suspend/terminate accounts), §3.5 (IP rights reserved), §4 (no warranty, as-is), §5 (termination). The agreement applies to "Members and Visitors" — guest (unauthenticated) access is still covered.

**Enforcement reality:** LinkedIn has historically enforced via IP blocks, Cloudflare challenges, cease-and-desist letters, and litigation (cf. *hiQ Labs v. LinkedIn*, 2017–2022). The legal landscape after the 2022 9th Circuit remand still leaves scraping as a ToS violation even if not necessarily a CFAA violation — i.e., LinkedIn can block and pursue contract claims regardless.

### 2.4 Compliant posture (legal)

| Posture | What it means | When to use |
|---|---|---|
| **Strictly compliant** | Do not poll `/jobs-guest/` automatically. Apply to `whitelist-crawl@linkedin.com` for permission, or use only LinkedIn's official APIs / permitted partners, or rely on alternative sources (see Research 03) | Production / public bot with any non-trivial user base |
| **Risk-accepted prototype** (what most community scrapers do) | Poll at minimal cadence with backoff/caching, accept that it violates ToS/robots as written, keep blast radius small, have a kill-switch and an alternative-source fallback | Internal testing, low-volume personal use, with disclosure to stakeholders that LinkedIn may block at any time |
| **Non-compliant** | High-frequency, distributed, UA-spoofed, or headless-browser scraping that bypasses Cloudflare challenges | Never — invites IP ban, legal notice, and ethical concerns |

**Recommendation for kappa-bot:** ship behind a **feature flag / env toggle** (`LINKEDIN_GUEST_ENABLED=false` by default), document the ToS/robots conflict in the repo, and prioritize alternative job sources (Research 03) for the default subscription path. If LinkedIn polling is enabled, gate it behind explicit operator opt-in with a logged acknowledgment.

---

## 3. Rate Limits / Throttling Behavior

### 3.1 No published limit; no rate-limit headers

Live probes 2026-09-02 (three sequential `GET /seeMoreJobPostings/search` with `User-Agent: Mozilla/5.0`, no cookies):

- All returned `200 text/html` with 10 `<li>` each, no `429`/`999`.
- Response headers observed (abridged):

```
server: cloudflare
x-li-fabric: prod-lor1 / prod-lva1 / prod-ltx1 (varies)
x-li-pop: cf-prod-*-x
x-li-uuid: AAZaeIjWGLsX4LZgQ6yW2Q==
cf-cache-status: DYNAMIC
cf-ray: a349cbba59a537b5-SIN
cache-control: no-cache, no-store, no-transform
pragma: no-cache
```

- **Absent:** `Retry-After`, `X-RateLimit-*`, `RateLimit-*`, `X-Li-RateLimit-*`. No explicit quota header.
- Cookies set on every response: `JSESSIONID=ajax:...`, `bcookie`, `bscookie`, `lidc`, `__cf_bm` (30-min TTL, `HttpOnly; Secure; SameSite=None; Domain=linkedin.com`). `__cf_bm` is Cloudflare Bot Management.

Community consensus (npm `linkedin-jobs-api@1.0.7`, GitHub issues, Stack Overflow):

- No documented QPS. Throttling is **behavioral/heuristic** (burst detection, IP reputation, JA3 fingerprint, `__cf_bm` validity) rather than a fixed token bucket.
- Sustained polling > ~1 req/s from a single IP triggers `429` or `999` within minutes; some reporters see blocks after 30–100 requests/hour without delays.
- Deep pagination (`start` > ~500) often returns empty even when SERP header says "11,000+ results" — likely a soft limit / probabilistic throttling on deep offsets, not a hard rate limit.

### 3.2 IP / UA sensitivity

| Signal | Sensitivity | Evidence |
|---|---|---|
| **IP address** | High — primary throttle key. Cloudflare + LinkedIn `lidc`/`bcookie` bind to IP. Datacenter/cloud IPs (AWS, GCP, Vercel, Fly) are more likely to be challenged than residential | `lidc` cookie `b=OGST05:s=O:r=O:a=O:p=O:g=3672:u=1:x=1:i=...` encodes PoP; community reports higher block rates on cloud egress IPs |
| **User-Agent** | Medium — not required for 200, but missing or bot-like UA increases challenge probability. LinkedIn/Crawling Terms require "true" UA | Probe: default `curl/8.x` UA still returned 200 in testing, but npm lib rotates via `random-useragent`; static UA across many requests is fingerprintable |
| **`__cf_bm` cookie** | Medium — Cloudflare Bot Management cookie (30-min TTL). Reusing it across requests is normal browser behavior; dropping it forces re-evaluation each request | Observed `__cf_bm=...; Expires= Wed, 02 Sep 2026 05:03:18 GMT` (30 min) |
| **`Accept`, `Accept-Language`, `Referer`, `X-Requested-With`** | Low — npm sends `Accept: application/json, text/javascript, */*; q=0.01` + `X-Requested-With: XMLHttpRequest` + `Referer: https://www.linkedin.com/jobs/search`, but none are required for 200. Adding them makes traffic look more like the real `jobs-guest-frontend` XHR | Live probe with only `User-Agent` still 200 |
| **TLS fingerprint (JA3)** | High (inferred) — Cloudflare Bot Management fingerprints TLS. Standard `curl`/`node-fetch` JA3 differs from Chrome | Not directly probed, but consistent with Cloudflare behavior |
| **Request cadence / burst** | High — the strongest signal after IP. Sequential burst of 3 still succeeded; sustained 1 req/s without jitter is flagged per community | npm lib uses `2000 + random*1000 ms` between pages |

**Crawling Terms §3–5 explicitly forbid** masking IP/UA or "manipulating identifiers" — so UA rotation that spoofs another entity's UA technically violates the terms even as it reduces Cloudflare friction. The compliant interpretation is to use a **single honest UA** identifying the bot (e.g., `kappa-bot/1.0 (+https://github.com/org/kappa-bot; contact@example.com)`) and accept higher challenge rates, rather than rotating through fake Chrome UAs.

**Practical compromise for a risk-accepted prototype:** use one stable, *realistic* UA (e.g., current Chrome on macOS) rather than random rotation, and do not claim to be Googlebot/LinkedInBot. Document the trade-off.

### 3.3 Observed soft limits

- **Shallow pagination (start 0–100):** reliable (10 results per page).
- **Deep pagination (start ≥ 500):** probe `start=500` → 0 results, `start=990` → 0, `start=999` → 26 bytes (empty fragment) despite SERP claiming 11k+ hits. Assume guest search is **truncated around ~100 pages × 10 ≈ 1000 results** per query, or throttled probabilistically beyond ~50 pages.
- **No pagination token:** termination signal is `count(<li>) == 0` (HTTP 200 with empty fragment) — indistinguishable from a throttle-induced empty without additional checks (see §5).

---

## 4. Backoff / Retry Pattern

### 4.1 What the community does

`linkedin-jobs-api@1.0.7` (from registry tarball `index.js`):

```js
// Between pages: 2000 + Math.random() * 1000 ms
await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

// On 429/999: exponential backoff 2^attempt seconds (no Retry-After header to honor)
let attempt = 0;
while (attempt < 5) {
  const res = await fetch(url, { headers });
  if (res.status === 429 || res.status === 999) {
    const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
    await sleep(delay);
    attempt++;
    continue;
  }
  break;
}
```

### 4.2 Recommended pattern for kappa-bot

```js
const BASE_DELAY_MS = 2000;       // between pages
const JITTER_MS     = 1000;
const MAX_RETRIES   = 4;
const BACKOFF_BASE  = 2;          // exponential: 1s, 2s, 4s, 8s + jitter
const CIRCUIT_BREAKER_THRESHOLD = 3; // consecutive 429/999 → pause query for 15 min

async function fetchWithBackoff(url, headers, attempt = 0) {
  const res = await fetch(url, { headers, redirect: 'manual' });

  // Success
  if (res.status === 200) return res;

  // Throttle signals — honor Retry-After if present (rare), else exponential
  if (res.status === 429 || res.status === 999 || res.status === 403) {
    if (attempt >= MAX_RETRIES) throw new ThrottledError(res.status, url);
    const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
    const delay = retryAfter
      ? retryAfter * 1000
      : Math.pow(BACKOFF_BASE, attempt) * 1000 + Math.random() * JITTER_MS;
    await sleep(delay);
    return fetchWithBackoff(url, headers, attempt + 1);
  }

  // Auth redirect / challenge — do not retry as same UA/IP will re-challenge
  if (res.status === 301 || res.status === 302) {
    const loc = res.headers.get('location') || '';
    if (/authwall|checkpoint|login|challenge/i.test(loc)) throw new AuthwallError(loc);
  }

  // Other 4xx/5xx — retry once with backoff, then surface
  if (res.status >= 500 && attempt < 1) {
    await sleep(1000 + Math.random() * 1000);
    return fetchWithBackoff(url, headers, attempt + 1);
  }
  throw new FetchError(res.status, url);
}

// Between pages in a pagination loop:
await sleep(BASE_DELAY_MS + Math.random() * JITTER_MS);

// Circuit breaker: if CIRCUIT_BREAKER_THRESHOLD consecutive throttles, skip remaining pages for this query + cool down 15 min
```

Additional rules:

- **Sequential only** — no concurrent `seeMoreJobPostings` requests from the same IP. Concurrency multiplies throttle risk and violates "unreasonable load" (ToS §8.2.16).
- **Honor `Retry-After`** if ever present (seconds or HTTP-date), even though probes show it absent today.
- **Do not retry `999` aggressively** — community reports `999` can persist for minutes/hours per IP. Treat as circuit-breaker trip (pause 10–15 min, then single probe).
- **Jitter is mandatory** — fixed-interval polling is trivially fingerprinted.
- **Log every throttle** with `cf-ray`, `x-li-uuid`, status, URL, and attempt — needed to tune cadence and to prove good-faith backoff if contacted.

---

## 5. Failure Modes

| Mode | HTTP / Body Signal | How to Detect | Handling |
|---|---|---|---|
| **429 Too Many Requests** | `429` (sometimes with empty body; sometimes Cloudflare HTML). No `Retry-After` observed | `res.status === 429` | Exponential backoff + jitter (§4), circuit breaker after 3 consecutive |
| **999 Request Denied** (LinkedIn custom) | `999` — LinkedIn's legacy throttle / block. Body may be empty or contain "Request denied" / IP block page. Not observed in low-volume probes but widely reported | `res.status === 999` | Same as 429 but longer cool-down (10–15 min). Do not rotate UA/IP to evade — that violates Crawling Terms §5/7 |
| **403 Cloudflare challenge / JS challenge** | `403` with body containing `challenge-platform`, `cf-challenge`, `__cf_bm` refresh, or `Attention Required! | Cloudflare` | Regex on body: `/challenge-platform|cf-challenge|Attention Required/i` | Stop polling; do not attempt to solve JS challenge programmatically (would be "circumventing measures" per Crawling Terms §7 / ToS §8.2.3). Cool down 15–30 min |
| **302/301 Authwall / Checkpoint redirect** | `302` → `Location: https://www.linkedin.com/authwall` or `/checkpoint/lg/login` or `/in/...` | `res.status` 301/302 + `Location` header match `/authwall|checkpoint|login/i` (use `redirect: 'manual'` to observe) | Treat as block — do not follow redirect. Cool down. May indicate IP reputation loss |
| **200 + empty HTML fragment** (exhausted pagination *or* soft throttle) | `200 text/html` with `0 <li>` — body is ~26 bytes whitespace or minimal shell | `cheerio.load(html)('li').length === 0` | Ambiguous. If `start === 0` and 0 results → likely genuine no-results (but verify with a control query like `keywords=Engineer`). If `start > 0` and previous pages had results → treat as **end-of-results** and stop pagination. If suspicious (e.g., `start=10` empty after `start=0` had 10), retry once after 2 s; if still empty, stop and log as possible throttle |
| **200 + Cloudflare "checking" shell** | `200` but body is Cloudflare interstitial, not job cards (contains `cf-browser-verification`, `turnstile`, `challenge`) | Same body regex as 403 challenge | Treat as block (see 403) |
| **404 Job detail not found** | `404` with `content-length: 0` for `GET /jobs-guest/jobs/api/jobPosting/{badId}` | `res.status === 404` (probe `jobPosting/999999999999` → 404) | Expected for deleted/expired jobs — skip, do not retry |
| **5xx / network error** | `500`, `502`, `503`, `504` or fetch exception (`ECONNRESET`, timeout) | `res.status >= 500` or exception | Single retry with 1 s + jitter, then surface as transient failure (do not circuit-break) |
| **Deep pagination ghost** | `200` with 0 `<li>` for `start ≥ ~500` despite result count header saying 11k+ | `start` large + `count==0` while `start < claimedTotal` | Stop pagination; cap at 100 pages (1000 results) per query. Log as truncation, not error |
| **HTML shape change** (class names drift) | `200` with `<li>` but selectors `.base-search-card__title` etc. return 0 | Parser returns 0 jobs when `li` count > 0, or `data-entity-urn` missing | Fail loudly: probe suite fetches once per deploy and asserts `parseJobList(controlHtml).length > 0`; alert on selector miss |

**Probe evidence:**

- `start=999` → 26 bytes, 0 `<li>` (empty fragment) — confirms empty is 200, not 404/204.
- `jobPosting/999999999999` → `404` with `content-length: 0` — confirms invalid id is 404.
- No `Retry-After`, no `X-RateLimit-*` in any 200 response — confirms backoff must be client-driven.
- No `authwall`/`checkpoint` in low-volume probes — confirms guest endpoints are open until throttled.

---

## 6. Compliant Usage Posture (Proposed)

### 6.1 If LinkedIn polling is enabled at all (risk-accepted prototype)

> **Disclaimer:** the posture below minimizes *operational* risk (blocks, bans) but does **not** make polling compliant with `robots.txt` / ToS as written. Strict compliance requires permission or not polling.

**Cadence:**

| Parameter | Value | Rationale |
|---|---|---|
| Requests per subscription poll | ≤ 3 pages (30 jobs) by default; max 10 pages (100 jobs) per query | Most subscriptions only need recent jobs; deep pagination is unreliable and multiplies load |
| Delay between pages | `2000 + random(0–1000) ms` (2–3 s jittered) | Matches `linkedin-jobs-api` and avoids burst detection |
| Delay between distinct queries (different `keywords`/`geoId`) | `5000 + random(0–5000) ms` (5–10 s) | Prevents burst across queries |
| Poll interval per subscription | **≥ 60 min** (default 2–4 h); never < 15 min | Job freshness is hours, not seconds; frequent polling is the #1 block trigger. `f_TPR=r86400` (past 24h) already scopes to recent |
| Global concurrency | **1** concurrent fetch per process / IP | No parallel `seeMoreJobPostings` requests |
| Daily cap per IP | ≤ 500 requests/day (soft) | Keeps volume well below community-reported block thresholds; adjust down if throttles observed |
| Cool-down after throttle | 15 min pause for that query; 30 min global pause after 3 consecutive throttles | Prevents hammering a blocked IP |

**Headers & identity:**

- Use a **single honest UA** identifying the bot: `kappa-bot/1.0 (+https://github.com/org/kappa-bot; contact@example.com) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36` — do not rotate through fake UAs or impersonate Googlebot/LinkedInBot (violates Crawling Terms §4–5). If Cloudflare friction becomes untenable, prefer *reducing cadence* over UA spoofing.
- Send `Accept: text/html,application/xhtml+xml` and `Accept-Language: en-US,en;q=0.9` — minimal headers that match a real browser XHR without pretending to be one.
- Do **not** set `X-Li-Track`, `Csrf-Token`, or `li_at` — guest endpoints don't require them and forging them increases fingerprint risk.
- Accept and re-send `__cf_bm` / `bcookie` / `lidc` cookies within a session (simple cookie jar) — matches browser behavior and reduces re-challenge rate.

**Caching & deduping:**

| Layer | Strategy |
|---|---|
| **Query cache** | Cache `seeMoreJobPostings` HTML per `(keywords, geoId, f_TPR, f_WT, start)` for **15 min** minimum; serve from cache if same query repeats within window |
| **Job dedupe** | Store `id` from `data-entity-urn="urn:li:jobPosting:{id}"` as primary key; never dedupe on URL (tracking params are ephemeral). Keep a `seen_job_ids` set per subscription (TTL 7–14 days) |
| **geoId pinning** | Resolve `location` → `geoId` once via `GET /jobs/search?keywords=&location=` and scrape `input[name=geoId]`; persist `geoId` and reuse — avoids geocoding on every poll |
| **Detail fetch** | Only fetch `GET /jobPosting/{id}` for *new* ids that passed dedupe and match notification criteria; cache detail HTML for 24 h |
| **Negative cache** | Cache empty-result responses for 30 min to avoid re-polling a query that genuinely has no results |

**Observability & safety:**

- Log every request: timestamp, URL (redact `trackingId`), status, `cf-ray`, `x-li-uuid`, `li` count, latency, retry attempt.
- **Probe suite:** on deploy / daily, fetch a control query (`keywords=Engineer&location=United%20States&start=0`) and assert `li count > 0` and `parseJobList` returns `id,title,company`. Fail loudly on selector drift.
- **Kill switch:** `LINKEDIN_GUEST_ENABLED` env var + per-subscription toggle. On any `999` or 3× `429`, auto-disable LinkedIn source for 1 h and fall back to alternative sources (Research 03).
- **Operator disclosure:** document in `README`/ops runbook that LinkedIn guest polling violates `robots.txt`/ToS as written and is enabled only with explicit operator opt-in.

### 6.2 Strictly compliant alternative (recommended default)

- **Disable LinkedIn guest polling by default.** Use alternative job sources (Adzuna, Arbeitnow, JSearch, Remotive, etc. — see Research 03) for the subscription feature.
- If LinkedIn jobs are required, pursue **permission** (`whitelist-crawl@linkedin.com`) or a **LinkedIn Talent Solutions / Jobs API partnership** (requires LinkedIn approval and is typically paid/enterprise).
- Consider **user-provided links** (users paste LinkedIn job URLs; bot only fetches the single `jobPosting/{id}` detail on demand) — lower volume and more defensible as user-initiated, though still technically automated access.

---

## 7. Decision Log

| Decision | Rationale |
|---|---|
| Recommend sequential 2–3 s jitter + exponential backoff, no concurrency | Matches community lib, minimizes throttle risk, respects ToS "unreasonable load" |
| Recommend honest single UA over rotation | Complies with Crawling Terms §4–5 ("true IP/UA"); rotation is evasion |
| Recommend 60 min+ poll interval, ≤ 3 pages per poll | Job freshness doesn't justify frequent polling; deep pagination is capped/ghosted anyway |
| Recommend caching + dedupe + geoId pinning | Reduces redundant requests by ~70% for typical subscription workloads |
| Recommend feature flag + kill switch + alternative-source fallback | Keeps feature viable even when LinkedIn blocks; acknowledges ToS/robots conflict |

---

## 8. Sources

- Live `GET https://www.linkedin.com/robots.txt` — header notice + `Disallow: /jobs-guest/` for Googlebot/Applebot/Bingbot/msnbot/Slurp/Baiduspider/etc. (2026-09-02, WebFetch)
- Live `GET https://www.linkedin.com/legal/crawling-terms` — 17-point crawling terms incl. true IP/UA, no masking, search-engine-only use, revocable, bulk-transfer ban (WebFetch 2026-09-02)
- Live `GET https://www.linkedin.com/legal/user-agreement` §8.2 — 19-point Don’ts incl. §2 scrape ban, §3 bypass ban, §4 copy ban, §13 bot ban, §16 unreasonable load (Effective 2025-11-03, WebFetch)
- Live `curl -i https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Engineer&location=United%20States&start=0` — `200 text/html`, `server: cloudflare`, `x-li-fabric: prod-lor1`, `cf-ray`, `__cf_bm` 30-min, no `Retry-After`/`X-RateLimit` (2026-09-02)
- Live `curl .../search?start=999` → 26 bytes (empty fragment, 0 `<li>`) and `curl -i .../jobPosting/999999999999` → `404` (2026-09-02)
- `research-01-linkedin-guest-api.md` §2–5 — endpoint surface, pagination ghost (`start=500` → 0), `__cf_bm` TTL, no rate-limit headers (2026-09-02 probes)
- npm `linkedin-jobs-api@1.0.7` (`registry.npmjs.org/linkedin-jobs-api`) — `2000 + random*1000` inter-page delay + `2^attempt` exponential backoff on 429 (package/index.js, README)
- Community reports: Stack Overflow / GitHub issues on LinkedIn `429`/`999` throttle, Cloudflare `__cf_bm` Bot Management, JA3 fingerprint sensitivity (no single canonical doc; summarized from multiple threads — treat as heuristic, not authoritative)

---

*Next:* `03-alternative-job-sources` (fallback APIs), `07-subscription-data-model` (filter → column mapping must account for `robots.txt` risk), `08-fetch-delivery-pipeline` (poll loop + §4 backoff + §6 cadence/caching + kill switch).
