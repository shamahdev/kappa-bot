Status: resolved
Type: research
Blocked by:

## Question

Catalog the LinkedIn Jobs Guest API surface anchored at `linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` and related guest endpoints. For each endpoint record: full URL, HTTP method, query/path params (keywords, location, distance, geoId, f_TPR, f_WT, start/pagination, etc.), response shape (HTML fragment vs JSON), paging/continuation mechanism, required headers (user-agent, csrf), and any observed limits. Include 2–3 real curl examples and parsing approach (HTML parsing vs JSON extraction). Link sources.

## Answer

**Status: resolved — research file:** `.scratch/kappa-bot/research-01-linkedin-guest-api.md`

Summary: `GET /jobs-guest/jobs/api/seeMoreJobPostings/search` is the sole pollable guest endpoint — returns `200 text/html` fragments of 10 `<li>` job cards (not JSON), paginated by `start` offset (0,10,20…) until empty. No auth/csrf required; UA rotation recommended for Cloudflare. Full param catalog: `keywords`, `location`/`geoId` (103644278 = US), `distance`, `start`, `sortBy` (DD/R), `f_TPR` (r86400/r604800/r2592000), `f_WT` (1/2/3 onsite/remote/hybrid), `f_E` (1–6), `f_JT` (F/P/C/T/V/I), `f_SB2` (1–5 salary), `f_C`, `f_AL`, `f_EA`, `f_VJ`; plus detail endpoint `GET /jobs-guest/jobs/api/jobPosting/{id}` (HTML top-card + `description__text--rich`). Limits: ~1000 deep-pagination cap, no rate-limit headers (429 + exponential backoff, 2 s jitter). Parsing via `cheerio` on `<li>` cards keyed by `data-entity-urn="urn:li:jobPosting:{id}"` — see research file §3 for 3 live curl examples, §4 for Node/Python parsers, §6 for sources (live probes 2026-09-02, `linkedin-jobs-api@1.0.7`, LinkedIn Help a6889044).

Sources: research file §6.

