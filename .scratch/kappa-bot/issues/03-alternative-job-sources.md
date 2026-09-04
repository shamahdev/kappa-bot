Status: open
Type: research
Blocked by:

## Question

Survey additional public/free job-listing endpoints and APIs that can complement or fallback from LinkedIn Guest: e.g. LinkedIn-adjacent guest variants (`jobs-guest/jobs/api/jobPosting/*`), Greenhouse/Lever board APIs, Arbeitnow, Remotive, Adzuna, Jooble, USAJOBS, or RSS feeds. For each, record endpoint, auth requirement, rate limit, response format, filter capabilities, licensing/TOS, and suitability for a Discord subscription pipeline. Recommend a first fallback source to wire behind the LinkedIn adapter.

## Answer

**Status: done** — findings captured in [`research-03-alternative-sources.md`](../research-03-alternative-sources.md) (2026-09-02, 7 sources, primary-source cited).

**Summary:** Survived 7 endpoints vs. 6 required. **First fallback recommended: Arbeitnow** (`www.arbeitnow.com/api/job-board-api`) — the only zero-auth, truly free, rate-generous (50/window), full-description JSON with stable `?page=` pagination (175/page, `created_at` hourly). Wire as `LinkedInGuestAdapter → ArbeitnowAdapter` behind a `FALLBACK_SOURCE=arbeitnow` flag under a shared `JobSource` interface (`source:id` dedupe). Runner-up: **Remotive** for a dedicated `#remote-jobs` slice (free but 4 req/day, 24h-delayed, no-resyndication clause). **Greenhouse + Lever** are best as a curated company-watch adapter (per-`board_token`/`site`, no server free-text search, but cleanest data). **USAJOBS** is safest for a federal-jobs opt-in; **Adzuna** is the richest search but gated by `app_id`/`app_key`, 250/day default quota and snippet-only + branding gate; **Jooble** (`POST jooble.org/api/{KEY}`) is last-resort aggregator (key, quota, duplication). See the report §2 matrix + §3 suitability ranking + §4 curl probes for integration.

**Link:** `/.scratch/kappa-bot/research-03-alternative-sources.md`


