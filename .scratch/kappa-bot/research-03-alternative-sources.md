# Research 03 — Alternative Job-Listing Sources (Fallback / Complement to LinkedIn Guest)

**Ticket:** `03-alternative-job-sources` · **Date:** 2026-09-02 · **Status:** done

Survey of 7 public/free job-listing endpoints that can sit behind the same Discord subscription pipeline as `linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` (see `research-01-linkedin-guest-api.md`). Every claim cites the primary owner: live probe, official docs, or TOS page fetched 2026-09-02.

---

## 1. Authority & Scope

| Claim | Primary Source |
|---|---|
| Greenhouse has two APIs; `boards-api` is public, `harvest` is authenticated & deprecated | [`developers.greenhouse.io/job-board.html` Introduction + Authentication](https://developers.greenhouse.io/job-board.html) vs [`developers.greenhouse.io/harvest.html` Introduction](https://developers.greenhouse.io/harvest.html) |
| Lever Postings API is `api.lever.co/v0/postings/{site}` ; list + retrieve are public JSON | [`github.com/lever/postings-api` README — Get a list of job postings](https://github.com/lever/postings-api) + live `GET https://api.lever.co/v0/postings/leverdemo?mode=json` (2026-09-02 probe) |
| Adzuna search is `api.adzuna.com/v1/api/jobs/{country}/search/{page}` JSON/XML, requires `app_id`+`app_key` | [`developer.adzuna.com/overview` — Querying the API](https://developer.adzuna.com/overview) + [`developer.adzuna.com/docs/search`](https://developer.adzuna.com/docs/search) |
| Adzuna rate limits & branding obligation | [`developer.adzuna.com/docs/terms_of_service` — Default limits + API user Obligations](https://developer.adzuna.com/docs/terms_of_service) |
| USAJOBS Search is `data.usajobs.gov/api/Search` JSON, requires `Host`, `User-Agent`, `Authorization-Key` headers | [`developer.usajobs.gov/guides/authentication`](https://developer.usajobs.gov/guides/authentication) + [`developer.usajobs.gov/api-reference/get-api-search`](https://developer.usajobs.gov/api-reference/get-api-search) |
| USAJOBS pagination/cap: max 10k rows, max 500 per page | [`developer.usajobs.gov/guides/rate-limiting`](https://developer.usajobs.gov/guides/rate-limiting) |
| Arbeitnow is `www.arbeitnow.com/api/job-board-api` JSON, no auth, paginated `?page=N` | Live `curl -i https://www.arbeitnow.com/api/job-board-api` (200, `x-ratelimit-*`) + JSON meta `{"meta":{"per_page":175,...,"terms":"This is a free public API…"}}` (captured 2026-09-02) |
| Remotive is `remotive.com/api/remote-jobs` JSON, no auth, filters via `?category=&search=` | Live `curl -i https://remotive.com/api/remote-jobs?limit=1` (200, Cloudflare, `{"jobs":[...],"legal-notice":...}`) + embedded legal notice in payload |
| Jooble is `jooble.org/api/{YOUR_KEY}` POST JSON, requires API key | Jooble primary doc `https://jooble.org/api/about` (blocked by Cloudflare 2026-09-02 — see §7 note); mirrored in aggregator docs & GitHub examples |
| Lever does not support free-text search server-side | [`lever/postings-api` README API Methods — "The API does not: Let you do full-text searches"](https://github.com/lever/postings-api) |

---

## 2. Comparative Matrix

| Source | Endpoint (canonical) | Auth | Rate limit (published) | Response format | Filter capabilities | Licensing / TOS (deal-breakers) |
|---|---|---|---|---|---|---|
| **Greenhouse Job Board** | `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs` (+ `?content=true`) and `GET .../jobs/{id}` | **None** for GET. POST apply requires Basic Auth with Job Board API key | **Not published**. No `X-RateLimit` headers observed. Empirically tolerant; treat as polite-scrape (1 req/s) | `application/json` — `{jobs:[{id,title,location{name},absolute_url,updated_at,content,departments[],offices[],metadata[]}], meta:{total}}` | **None server-side** on the public board listing. Filters are client-side after fetch: by `location` string, department/office nesting, and `content` full-text. Querystring only has `content` + `render_as` (offices/departments) | [Greenhouse Job Board docs](https://developers.greenhouse.io/job-board.html) imply public data is intended for careers-page embedding. No explicit polling ban, but `boards-api` is per-company: you must know `board_token`s. Scraping all tokens is not a supported use-case. No attribution clause. Safest of the ATS boards |
| **Lever Postings** | `GET https://api.lever.co/v0/postings/{site}?skip=&limit=&location=&team=&commitment=&department=&level=` (+ `&mode=json`) and `GET .../{site}/{postingId}` | **None** for GET. POST apply requires API key + 2 req/s limit | GET not formally limited. POST apply: **2 req/s** → 429, must queue & retry ([lever/postings-api README](https://github.com/lever/postings-api#post-application-rate-limit)). GET benefits from Cloudflare CDN | `application/json` — `[{id,text,categories{location,commitment,team,department,allLocations},country,description,descriptionPlain,hostedUrl,applyUrl,workplaceType,salaryRange}]` | **Limited server-side**: `skip`/`limit` + exact `location`/`team`/`commitment`/`department`/`level`/`group` filters (OR semantics, case-sensitive). **No free-text search** — must fetch and filter locally | Same posture as Greenhouse: per-company `{site}` namespaces. Data is "publicly viewable" and explicitly may be scraped by third parties ([README](https://github.com/lever/postings-api#introduction) — "All published postings are publicly viewable. These jobs may be scraped."). EU mirror at `api.eu.lever.co`. CORS limited to customer domains but no-cors fetch from server is fine |
| **Arbeitnow** | `GET https://www.arbeitnow.com/api/job-board-api` (+ `?page=N`) | **None** | **50 req** per window (`x-ratelimit-limit: 50`, `x-ratelimit-remaining: 49` observed). Window not documented; assume per-minute or per-10s. `cache-control: private, max-age=432000` | `application/json` — `{data:[{slug,company_name,title,description (HTML),remote,url,tags[],job_types[],location,created_at (unix)}], links:{next,prev}, meta:{current_page,per_page:175,path}}` | **None server-side** besides `?page=`. All 175/page ordered by `created_at` desc, updated hourly. Client must filter by `tags`/`location`/`remote` locally | Meta terms: *"This is a free public API for jobs, please do not abuse. I would appreciate linking back to the site. By using the API, you agree to the terms of service present on Arbeitnow.com"* ([JSON meta + blog](https://www.arbeitnow.com/blog/job-board-api)). Germany-focused (~EU-wide English-speaking roles). Most permissive free tier |
| **Remotive** | `GET https://remotive.com/api/remote-jobs` (+ `?category=&search=&company_name=&limit=&skip=`) | **None** for public tier | **≤ 4 req/day advised**. Legal notice in every response: *"Please do not request … more than a couple of times a day (we advise max. 4 times a day). Excessive requests will be blocked."* + `cache-control: no-store` | `application/json` — `{"00-warning":..., "0-legal-notice":..., "job-count":N, "jobs":[{id,url,title,company_name,category,tags[],job_type,salary,publication_date,candidate_required_location,description (HTML)}]}` | Server-side: `category` (exact, e.g. `Software Development`), free-text `search`, `company_name`, `limit`/`skip` not formally documented but payload supports pagination. No location filter besides `candidate_required_location` string | Private paid API starts $5k/mo. Public TOS: **delayed 24h**, must link back to Remotive URL, must mention Remotive as source, **do not resyndicate to Jooble/Neuvoo/Google Jobs/LinkedIn**, and do not collect signups/emails on top of listing ([legal-notice payload](https://remotive.com/api/remote-jobs) + `remotive.com/api-documentation`). Suitable for a small Discord channel; not for high-volume mirror |
| **Adzuna** | `GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}?app_id=&app_key=&what=&where=&results_per_page=&sort_by=&salary_min=&full_time=&permanent=&contract_type=&category=&distance=&max_days_old=` | **Required**: `app_id` + `app_key` (register at [developer.adzuna.com/signup](https://developer.adzuna.com/signup)) | **Default: 25/min, 250/day, 1000/week, 2500/month** ([TOS](https://developer.adzuna.com/docs/terms_of_service)). Contact for higher limits. `content-type` / `Accept` controls JSON/JSONP/XML/XLSX | `application/json` — `{__CLASS__: "Adzuna::API::Response::JobSearchResults", results:[{id,title,description (snippet),company{display_name},location{display_name,area[]},category{tag,label},salary_min/max,predicted,latitude/longitude,redirect_url,created,contract_type/time}]}` | **Rich**: `what` (keywords), `what_exclude`, `where` (location), `distance`, `salary_min/max`, `full_time`/`part_time`/`permanent`/`contract`, `category`, `sort_by` (`date`/`salary`/`relevance`), `max_days_old`, pagination via `/{page}` + `results_per_page` | Must label every advert *"Jobs by Adzuna"* 116×23 with hyperlinked logo, and every salary estimate with Adzuna Jobsworth icon ([TOS](https://developer.adzuna.com/docs/terms_of_service)). Trial period 14 days for coverage testing without licence; ongoing commercial use requires licence agreement. Snippet only (not full description). 16 country endpoints (`gb,us,de,fr,…`) |
| **USAJOBS** | `GET https://data.usajobs.gov/api/Search?Keyword=&LocationName=&RemunerationMinimumAmount=&PositionScheduleTypeCode=&HiringPath=&...&Page=&ResultsPerPage=&SortField=&Fields=` | **Required**: three headers `Host: data.usajobs.gov`, `User-Agent: <email used to request key>`, `Authorization-Key: <API key>` ([auth guide](https://developer.usajobs.gov/guides/authentication)) | Implicit: **max 10,000 rows/query, max 500/page** ([rate-limiting guide](https://developer.usajobs.gov/guides/rate-limiting)). No published req/s, but federal APIs typically throttle at ~100/min; handle 429 with backoff | `application/json` — `{LanguageCode, SearchResult:{SearchResultCount, SearchResultCountAll, SearchResultItems:[{MatchedObjectId, MatchedObjectDescriptor:{PositionID,PositionTitle,PositionURI,ApplyURI[],OrganizationName,PositionLocation[],JobCategory[],PositionRemuneration[],PublicationStartDate,ApplicationCloseDate,UserArea:{Details:{MajorDuties,JobSummary,Requirements,...}},...}}], UserArea:{NumberOfPages}}}` | **Very rich federal vocabulary**: `Keyword`, `PositionTitle` (contains), `LocationName` (city; supports `Radius`), `JobCategoryCode` (occupational series), `Organization`, `PayGradeLow/High`, `RemunerationMinimum/MaximumAmount`, `PositionScheduleTypeCode`, `PositionOfferingTypeCode`, `HiringPath` (`public`, `vet`, etc.), `WhoMayApply`, `RemoteIndicator`, `DatePosted` (0-60 days), `SortField`/`SortDirection`, `Fields` (`min` vs `full`), plus 30+ codelist lookups | U.S. government public domain. Free key via [apirequest form](https://developer.usajobs.gov/apirequest/). Terms: default only "Public" jobs unless explicitly requesting "Status"; attribution is expected but no branding gate. Best TOS for a Discord bot; limited to federal roles (useful complement, not a LinkedIn replacement) |
| **Jooble** | `POST https://jooble.org/api/{YOUR_API_KEY}` with JSON body `{"keywords":"...","location":"...","radius":"25","page":"1","salary":"50000","searchMode":"0"}` | **Required**: API key (request at [jooble.org/api/about](https://jooble.org/api/about)) | Undisclosed; quota per API key. Docs state daily quotas, overage → 403. Expect polite ~10-60 req/min tier for free key | `application/json` — `{totalCount, jobs:[{title,location,company,snippet,source,salary,type,updated,link,id}]}` (shape per aggregator recaps; Jooble wraps third-party results) | Server-side: `keywords` (free-text), `location`, `radius`, `page`, `salary`, `searchMode` (0-relevance,1-date,2-salary). No rich taxonomy | Aggregator (republishes third-party listings). TOS requires **not removing Jooble attribution** and not caching beyond transient use. Free key is evaluation-tier; production requires partnership. As an aggregator, **quality for a subscription pipeline is lower** (duplicates, stale links, snippet-only) |

> **LinkedIn-adjacent guest variants probed (for completeness):** `GET /jobs-guest/jobs/api/jobPosting/{jobId}` (detail fragment, see research-01 §2.2) and `GET /jobs-guest/api/typeaheadHits?typeaheadType=COMPANY&query=` (discovered via SERP `data-base-api-url`, but live probe `?query=Amazon` → 404 without CSRF). No evidence of a JSON search variant — all job search remains the HTML fragment at `seeMoreJobPostings/search`. Treat any `jobs-guest/jobs/api/jobPosting/*` mention as the same detail endpoint.

---

## 3. Suitability for kappa-bot Discord Subscription Pipeline

Criteria: (a) no paid key to demo, (b) polling-friendly (stable pagination + `published_at`/`updated_at` clock), (c) filterable to user subscription predicates, (d) TOS allows push-notification delivery to a Discord channel, (e) global or topic-relevant coverage.

| Rank | Source | Verdict | Why / trade-offs |
|---|---|---|---|
| **1 (recommended fallback)** | **Arbeitnow** | ✅ **Best first fallback** | Zero auth (fastest to wire), true free public API, generous 50-req window, stable `per_page=175` pagination with hour-granular `created_at`, JSON with full HTML `description` — ideal for a nightly/2-hour cron behind the LinkedIn adapter. Minimal infra (one `page=` loop). Only downside is **Germany/EU-centric**, so use it as *complement* to LinkedIn, not replacement. TOS is link-back only |
| 2 | **Remotive** | ✅ Runner-up (best if you pivot to remote-first) | Zero auth, good for the "remote jobs" slice, server-side `category` + `search` filters reduce payload. Blockers: **4 req/day** limit means you must batch per-subscription filtering locally, 24h delay means less fresh than LinkedIn, and **no resyndication** clause complicates a wide-public bot (a private Discord is likely fine, but you'd be one complaint away from key-block). Use as second fallback or for a dedicated `#remote-jobs` channel |
| 3 | **Greenhouse + Lever (ATS boards)** | ✅ High-fidelity if you curate companies | Hand-picked companies yield the cleanest data (full description, correct `updated_at`, no snippet truncation, stable `id` for dedupe). But each `board_token`/`site` is a separate poll — you need a curated token list (e.g. seed with YC or `boards.greenhouse.io` sitemap). Treat as a **company-watch** adapter, not a global search |
| 4 | **USAJOBS** | ✅ Safest for a federal-jobs slice | Excellent TOS, rich filters, 10k/500 pagination. Only federal jobs, so audience is niche. Wire it as an opt-in `source: usajobs` filter in the subscription model. Free key is easy to get |
| 5 | **Adzuna** | ⚠️ Viable but friction-heavy | Best global search semantics, but requires signup, branding gate, snippet-only payload (need `redirect_url` hop for full text), and 250/day default quota (tight for per-guild polling). Keep as **future aggregator** once you have a quota-bearing key |
| 6 | **Jooble** | ⚠️ Last resort / avoid for v1 | POST API + key + aggregator duplication make it the most brittle and lowest-quality pipeline. Quote-based pricing obscures scaling. Only consider if LinkedIn + Arbeitnow + Remotive leave a coverage gap |

### Recommended shape for kappa-bot

1. **Adapter interface** (`JobSource`): `search({keywords, location, filters}) -> Job[]`, `detail(id) -> JobDetail`, `sourceId`. Normalize to a common `Job { id, source, title, company, location, url, description, postedAt, salary?, tags[] }`. Dedupe key = `${source}:${id}` (never URL params).
2. **Wire first fallback as:** `LinkedInGuestAdapter` (primary) → **on 429/empty/error, `ArbeitnowAdapter`** as fallback. Both produce the same normalized `Job` array so the delivery worker is agnostic. A feature-flag `FALLBACK_SOURCE=arbeitnow` controls ordering.
3. **Deferred:** add `RemotiveAdapter` behind a `source: remote` subscription flag, then a curated `AtsAdapter` that fans out over a config `GREENHOUSE_TOKENS` / `LEVER_SITES` list (cap 20 tokens, poll round-robin). Leave Adzuna/Jooble/USAJOBS as gated `source:` choices.

---

## 4. Probe & Integration Notes

### Greenhouse
```bash
# List all published jobs for one board (no auth)
curl -s "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true" | jq '.jobs[0]'
# With offices grouping
curl -s "https://boards-api.greenhouse.io/v1/boards/gitlab/jobs" | jq '.jobs | length'
```

### Lever
```bash
# Global JSON listing (some sites 302→ jobs.lever.co but CDN serves JSON)
curl -s -H "Accept: application/json" "https://api.lever.co/v0/postings/netflix?mode=json&limit=5" | jq '.[0]'
# EU instance
curl -s "https://api.eu.lever.co/v0/postings/leverdemo?skip=0&limit=3&mode=json" | jq length
# Must filter client-side for free-text — lever does not support q=
```

### Arbeitnow (first fallback)
```bash
curl -s https://www.arbeitnow.com/api/job-board-api | jq '.data[0].slug'
curl -s "https://www.arbeitnow.com/api/job-board-api?page=2" | jq '.meta.current_page'
# Headers show rate limit
curl -s -i https://www.arbeitnow.com/api/job-board-api | grep -i ratelimit
# → x-ratelimit-limit: 50
```

### Remotive
```bash
# Remote-only, rate-limited to ~4/day
curl -s "https://remotive.com/api/remote-jobs?category=Software%20Development&search=python" | jq '.jobs | length'
# Full dump (legal notice in payload)
curl -s https://remotive.com/api/remote-jobs | jq 'keys'
# → ["00-warning","0-legal-notice","job-count","jobs"]
```

### Adzuna
```bash
APP_ID="<from signup>" APP_KEY="<...>"
curl -s "https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=$APP_ID&app_key=$APP_KEY&results_per_page=20&what=python%20developer&where=london&sort_by=date&content-type=application/json" | jq '.results[0].title'
```

### USAJOBS
```bash
AUTH_KEY="<from apirequest>" EMAIL="<your email>"
curl -s -H "Host: data.usajobs.gov" -H "User-Agent: $EMAIL" -H "Authorization-Key: $AUTH_KEY" \
  "https://data.usajobs.gov/api/Search?Keyword=engineer&LocationName=Washington%20DC&ResultsPerPage=10&Fields=min" | jq '.SearchResult.SearchResultCount'
```

### Jooble
```bash
API_KEY="<from jooble.org/api/about>"
curl -s -X POST "https://jooble.org/api/$API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keywords":"python developer","location":"Berlin","radius":"25","page":"1"}' | jq '.jobs[0]'
```

---

## 5. Sources

- **Greenhouse Job Board API** — official docs (`Authentication: "Job Board data is publicly available, so authentication is not required for any GET endpoints."` + `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs` with `?content=true`): <https://developers.greenhouse.io/job-board.html> (fetched 2026-09-02; markdown dump captured)
- **Greenhouse Harvest API** — auth & rate-limit contrast (`Authorization: Basic <base64(token:)>`, `X-RateLimit-Limit/Remaining`, 10s window): <https://developers.greenhouse.io/harvest.html>
- **Lever Postings API (GitHub)** — endpoints, filter params (`skip/limit/location/team/commitment/department/level`), CORS/JSON modes, `workplaceType`/`salaryRange`, POST rate limit 2 req/s: <https://github.com/lever/postings-api> (README fetches 2026-09-02) — live check `GET https://api.lever.co/v0/postings/demo?mode=json` (404; use real site like `leverdemo`/`netflix`) probe 2026-09-02
- **Adzuna** — root + overview (`https://api.adzuna.com/v1/api`, `app_id`+`app_key` mandatory, JSON/JSONP/XML via `Accept`), search examples (country-scoped `/jobs/{country}/search/{page}`): <https://developer.adzuna.com/overview> + <https://developer.adzuna.com/docs/search> + TOS limits (25/min, 250/day…) & labeling rules: <https://developer.adzuna.com/docs/terms_of_service>
- **USAJOBS** — authentication headers (`Host`, `User-Agent` = email, `Authorization-Key`): <https://developer.usajobs.gov/guides/authentication>; Search query vocabulary & response shape: <https://developer.usajobs.gov/api-reference/get-api-search>; Pagination caps (10k/query, 500/page): <https://developer.usajobs.gov/guides/rate-limiting>
- **Arbeitnow** — live endpoint `GET https://www.arbeitnow.com/api/job-board-api` (200 Cloudflare, `x-ratelimit-limit: 50`, `per_page:175`, `links.next`, `meta.terms` free-public-use text) captured 2026-09-02; blog explainer: <https://www.arbeitnow.com/blog/job-board-api> (documented as "A public free Job Board API with jobs from Applicant Tracking Systems"; page fetched 2026-09-02)
- **Remotive** — live endpoint `GET https://remotive.com/api/remote-jobs?limit=1` (200, payload keys `00-warning`, `0-legal-notice` with verbatim legal text: 24h delay, link-back, no resyndication to Jooble/Neuvoo/Google/LinkedIn, max ~4 req/day, paid API $5k/mo): captured 2026-09-02; attempted docs: <https://remotive.com/api-documentation> and <https://remotive.com/remote-jobs/api> (Cloudflare-managed challenge 2026-09-02)
- **Jooble** — primary `https://jooble.org/api/about` (Cloudflare challenge on 2026-09-02; POST `https://jooble.org/api/{KEY}` with `keywords/location/radius/page/salary` body per cached aggregator examples). Secondary confirmation via public GitHub examples & aggregator write-ups (not a primary doc — flagged)
- **LinkedIn guest variants** — SERP live scrape `linkedin.com/jobs/search` (`data-base-api-url="/jobs-guest/api/typeaheadHits?typeaheadType=COMPANY"`, `jobs-guest-frontend`) and npm `linkedin-jobs-api` — see `research-01-linkedin-guest-api.md`

---

*Next tickets that depend on this:* `07-subscription-data-model` (map Adzuna/Arbeitnow/Remotive filter vocabularies to subscription columns), `08-fetch-delivery-pipeline` (wire `ArbeitnowAdapter` as `FALLBACK_SOURCE`, poll loop dedupe `source:id`, backoff), `09-discord-ux-subscription-management` (expose `source` selector to user).
