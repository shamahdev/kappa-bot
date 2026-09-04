Status: resolved
Type: research
Blocked by: 01

## Question

Given the endpoints found in `01-linkedin-guest-api-surface`, what are the practical constraints for using LinkedIn Jobs Guest APIs in a bot: rate limits / throttling behavior, IP/UA sensitivity, Terms of Service and robots posture, required backoff/retry pattern, and failure modes (429, 999, empty HTML, redirect to auth)? Propose a compliant usage posture (request cadence, header rotation, caching) that keeps the job subscription feature viable without authenticated scraping.

## Answer

**Research file:** `.scratch/kappa-bot/research-02-linkedin-constraints.md`

Summary: `robots.txt` **Disallows** `/jobs-guest/` for all major crawlers (Googlebot/Bingbot/etc.) and header states automated access is "strictly prohibited" without permission (`whitelist-crawl@linkedin.com`); Crawling Terms (2017-05-25) require true IP/UA, no masking, search-engine-only use, revocable, bulk-transfer ban; ToS §8.2 (2025-11-03) bans scraping/bots/bypassing use limits/copying/unreasonable load (§2,3,4,13,16). No published rate limit and no `Retry-After`/`X-RateLimit` headers observed — gate is Cloudflare (`server: cloudflare`, `__cf_bm` 30-min, `cf-ray`, `x-li-fabric`); throttling is heuristic (IP > UA; cloud IPs flagged; burst > ~1 req/s triggers 429/999 within minutes; deep pagination ghosts beyond ~500/1000). UA not required for 200 but missing/static UA raises challenge risk; honest single UA (`kappa-bot/1.0 + contact`) recommended over rotation (rotation violates Crawling Terms §4–5). Failure modes: 429/999 (exponential backoff 2^attempt + jitter, 4 retries, 15-min circuit breaker), 403 JS challenge / 302 authwall→checkpoint/login (stop, cool-down 15–30 min, do not solve), 200+empty HTML (0 `<li>` — end-of-results vs throttle; retry once if suspicious, else stop), 404 detail for bad id, 5xx single retry, selector drift (probe suite). Compliant posture: **strictly compliant = do not poll** (permission or alternative sources per Research 03); risk-accepted prototype (feature-flagged, operator opt-in, kill-switch) = sequential 2–3 s jittered between pages, 5–10 s between queries, ≥60 min poll interval (default 2–4 h), ≤3 pages/poll (max 10), concurrency 1, ≤500 req/day/IP, 15-min throttle cool-down, single honest UA, cookie jar for `__cf_bm`/`bcookie`/`lidc`, 15-min query cache + 24 h detail cache + geoId pinning + `urn:li:jobPosting:{id}` dedupe, observability (`cf-ray`/`x-li-uuid`) + daily selector probe. See research file §2–6 for full analysis, §4 retry code, §5 failure table, §8 sources (live `robots.txt`, `crawling-terms`, `user-agreement`, `curl -i` probes 2026-09-02, `linkedin-jobs-api@1.0.7`).

Sources: research file §8.
