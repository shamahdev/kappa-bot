# Research 01 — LinkedIn Jobs Guest API Surface

**Ticket:** `01-linkedin-guest-api-surface` · **Date:** 2026-09-02 · **Status:** claimed

LinkedIn's public "guest" (unauthenticated) job-search stack is the only stable surface for server-side polling without OAuth/session hijacking. This note catalogs it from live probing (2026-09-02, Cloudflare/WWW), the npm `linkedin-jobs-api` scraper, and LinkedIn's own HTML.

---

## 1. Authority & Scope

| Claim | Primary Source |
|---|---|
| Guest APIs are unauthenticated HTML fragments, not JSON | Live `curl` + `WebFetch` to `linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Engineer&location=United%20States&start=0` (HTTP 200, `content-type: text/html`) — see §2 |
| Base host is `https://www.linkedin.com` | Same fetch headers show `server: cloudflare`, `x-li-fabric: prod-lor1` |
| Authenticated Voyager API (`/voyager/api/jobs/...`) is 403 without session | `curl -i https://www.linkedin.com/voyager/api/jobs/jobPostings/4456297886` → `403` (probe 2026-09-02) |
| Filter grammar documented by community scraper | [`linkedin-jobs-api` v1.0.7 `index.js:130-158`](https://registry.npmjs.org/linkedin-jobs-api) — `f_TPR`, `f_E`, `f_WT`, `f_JT`, `f_SB2`, `f_EA`, `f_VJ`, pagination `start` |
| AI-powered search retiring classic filters (Sept 2026) | [LinkedIn Help a6889044](https://www.linkedin.com/help/linkedin/answer/a6889044): "AI-powered job search ... We're gradually retiring classic job search starting in September." Remaining filters: Date posted, Company, Experience level, Employment type, Remote, LinkedIn Apply, Under-10, In my network |

No official LinkedIn API documents these endpoints; all knowledge is reverse-engineered from `jobs-guest-frontend` (pageKey `d_jobs_guest_search`, `data-service-name="jobs-guest-frontend"` in the SERP HTML).

---

## 2. Core Endpoints

### 2.1 `GET /jobs-guest/jobs/api/seeMoreJobPostings/search` — **primary search (anchor)**

The only paginated, pollable endpoint. Returns an HTML fragment — *not* JSON — containing `<li>` cards. This is what `jobs-guest-frontend` lazy-loads.

**Full URL (example):**
```
https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Engineer&location=United%20States&start=0
```

**Method:** `GET`

**Response:** `200 text/html; charset=utf-8`, `cache-control: no-cache, no-store`. Body is ~30 kB for 10 results, ~0 bytes (empty fragment with whitespace) when exhausted or no results.

**Observed live:** 2026-09-02 with `User-Agent: Mozilla/5.0` returned 10 `<li>` for `start=0` and `start=10`, 10 for `start=100`, 0 for `start=500` and `start=990/1000` (see §4).

#### Query params

| Param | Type | Required | Notes / Values | Source |
|---|---|---|---|---|
| `keywords` | string | no (but usually with `location` or `geoId`) | Free text. Spaces encoded as `+` or `%20`. Empty → broad result set (still returns cards) | Live fetch + `linkedin-jobs-api/index.js:135` |
| `location` | string | no | Free-text place: `United States`, `Berlin`, `Green Bay, WI`. Ignored if `geoId` supplied | Same |
| `geoId` | string (numeric) | no | LinkedIn geography id. Example `103644278` = United States, `105015875` ≈ Austin. Takes precedence over `location`. Found in SERP hidden input `name="geoId" value="103644278"` | SERP HTML `input[name=geoId]` + probe `geoId=105015875` → 10 results |
| `distance` | string/number | no | Radius in miles/km (LinkedIn docs call it `distance`). Tested `25` and `100` both returned 10 | Probe with `location=Berlin&distance=25/100` |
| `start` | int | no (default 0) | **Offset**, not page number. Increment by page size (10 observed). `start=0,10,20,...` | Live pagination loop + `linkedin-jobs-api/index.js:162` (`start + this.getPage()` where `getPage()=page*25` — note: actual page size is 10, not 25; npm lib over-fetches and dedupes) |
| `sortBy` | string | no | `DD` = Most recent, `R` = Most relevant (per npm). Omit → LinkedIn default (relevant) | `linkedin-jobs-api/index.js:163-165` |
| `f_TPR` | string | no | **Date posted:** `r86400` past 24h, `r604800` past week, `r2592000` past month | SERP filter inputs `f_TPR-0/1/2` + npm mapping |
| `f_WT` | string | no | **Workplace type / Remote filter:** `1` On-site, `2` Remote, `3` Hybrid | npm `getRemoteFilter()` + live SERP `f_WT=2` accepted |
| `f_E` | string | no | **Experience level:** `1` Internship, `2` Associate (Entry), `3` Associate, `4` Mid-Senior, `5` Director, `6` Executive | npm `getExperienceLevel()` |
| `f_JT` | string | no | **Job type / Employment type:** `F` Full-time, `P` Part-time, `C` Contract, `T` Temporary, `V` Volunteer, `I` Internship | npm `getJobType()` |
| `f_SB2` | string | no | **Salary bucket:** `1` 40k, `2` 60k, `3` 80k, `4` 100k, `5` 120k (USD) | npm `getSalary()` |
| `f_C` | string (numeric company id) | no | Company filter. Value is LinkedIn company numeric id (e.g. `1412` Northrop Grumman). Repeatable | SERP filter `f_C-0 value="1412"` + typeahead endpoint |
| `f_AL` | boolean string | no | Easy Apply: `true` | SERP link `f_AL=true` |
| `f_EA` | boolean string | no | Under 10 applicants: `true` (npm maps `under_10_applicants` → `f_EA`) | npm `getUnder10Applicants()` + SERP link `f_EA=true` |
| `f_VJ` | boolean string | no | Has verification: `true` | npm `getHasVerification()` |
| `trk` | string | no | Tracking param — optional, no effect on results (`public_jobs_jserp-result_search-card`) | SERP |
| `position`, `pageNum` | — | no | Only used in the `href` for job cards, not as search inputs | Card `href` |

> `location` vs `geoId`: either works. `geoId` is canonical; `location` is resolved server-side to a `geoId`. For deterministic polling, use `geoId` once resolved (scrape the SERP's hidden `geoId` input for a human query, then pin it).

#### Headers required

| Header | Required? | Evidence |
|---|---|---|
| `User-Agent` | **No**, but strongly recommended | `curl` with default UA and with `Mozilla/5.0` both returned 200; without UA also 200 in testing. npm lib rotates via `random-useragent`. Not rotating risks Cloudflare bot challenge (`__cf_bm` cookie) |
| `Accept` | No | Live: default `*/*` worked. npm sends `Accept: application/json, text/javascript, */*; q=0.01` but response is still HTML |
| `Csrf-Token` / `X-Li-Track` | **No** | Guest endpoints set `JSESSIONID=ajax:...` + `bcookie`/`bscookie`/`lidc`/`__cf_bm` cookies but do *not* require them on request. No `csrfParam` needed unlike authenticated Voyager |
| `Referer`, `X-Requested-With` | No | npm sends them; not required for 200 |
| Cookies | No | Request with no cookies still 200. Response always sets cookies |
| Auth / `li_at` | **No** | Whole point of `jobs-guest` |

No `Authorization`, no `csrf-token`. Cloudflare is the only gate; it may issue `429` or `999` (LinkedIn throttle) under burst load.

#### Paging / continuation

- **Mechanism:** offset param `start`. No cursor, no `nextPageToken`, no JSON `paging` object.
- **Page size:** **10** (observed). npm code assumes 25 (`BATCH_SIZE = 25`) and will skip dedupe if you follow it literally — use 10 or 25-agnostic loop (fetch until `<li>` count == 0).
- **Termination:** response body contains no `<li>` (essentially empty document) → stop. Also `start` beyond ~1000 returns 0 even when result count header says `11,000+` (see probe `start=500` → 0). LinkedIn caps or probabilistically throttles deep pages.
- **Concurrency:** sequential with 2 s delay recommended by npm lib (`2000 + random*1000`) + exponential backoff on 429. Immediate burst of 3 sequential requests still returned 200 in testing, but sustained polling should delay.

#### Response shape (HTML fragment)

Each page is a concatenation of `<li>` → `div.base-card.job-search-card`:

```html
<li>
  <div class="base-card ... job-search-card"
       data-entity-urn="urn:li:jobPosting:4456297886"
       data-impression-id="jobs-search-result-0"
       data-reference-id="..."
       data-tracking-id="...">
    <a class="base-card__full-link"
       href="https://www.linkedin.com/jobs/view/entry-level-mechanical-engineer-at-schneider-4456297886?position=1&pageNum=0&refId=...&trackingId=..."></a>
    <div class="search-entity-media">
      <img class="artdeco-entity-image"
           data-delayed-url="https://media.licdn.com/dms/image/.../company-logo_100_100/..."
           alt>
    </div>
    <div class="base-search-card__info">
      <h3 class="base-search-card__title">Entry Level Mechanical Engineer</h3>
      <h4 class="base-search-card__subtitle">
        <a href="https://www.linkedin.com/company/schneider">Schneider</a>
      </h4>
      <div class="base-search-card__metadata">
        <span class="job-search-card__location">Green Bay, WI</span>
        <div class="job-posting-benefits">Be an early applicant</div>
        <time class="job-search-card__listdate" datetime="2026-08-21">1 week ago</time>
        <!-- optional -->
        <span class="job-search-card__salary-info">$80k–$100k</span>
      </div>
    </div>
  </div>
</li>
```

Extractable fields per card:

| Field | Selector / Attribute | Example |
|---|---|---|
| Job id | `data-entity-urn` → `urn:li:jobPosting:4460913082` | `4460913082` |
| Position | `.base-search-card__title` text | `Controls Engineer` |
| Company | `.base-search-card__subtitle` text | `SG Morris` |
| Company URL | `.base-search-card__subtitle a[href]` | `https://www.linkedin.com/company/sgmorris` |
| Location | `.job-search-card__location` text | `Cleveland, OH` |
| Posted datetime | `time[datetime]` attribute | `2026-09-02` |
| Ago text | `time` text | `2 hours ago` / `2 weeks ago` |
| Salary (rare) | `.job-search-card__salary-info` text | Often empty |
| Job URL | `.base-card__full-link[href]` | `https://www.linkedin.com/jobs/view/...-4460913082?...&position=1&pageNum=0` — note: `position` & `pageNum` are tracking, not stable |
| Company logo | `.artdeco-entity-image[data-delayed-url]` | `https://media.licdn.com/dms/image/...` |
| Benefits badge | `.job-posting-benefits__text` | `Be an early applicant` / empty |

`data-reference-id`, `data-tracking-id`, `data-impression-id` are ephemeral — do not store.

Parsing: `cheerio` (see npm `parseJobList` in `index.js:223-267`) — `$('li').map(...)` with `.find('.base-search-card__title')` etc. Only keep if `position && company`.

#### Limits observed

- Deep pagination ghost: `start=500` returned 0 in live test despite `11,000+` header on SERP. Assume LinkedIn truncates guest search around ~1000 (100 pages × 10) or rate-limits deep offsets. Treat >100 fetches per query as unreliable.
- No explicit rate-limit headers returned (`retry-after` absent). 429 is the kill signal; exponential backoff `2^attempt` seconds per npm.
- Cloudflare `__cf_bm` cookie with 30-min TTL; may require JS challenge under high frequency.

---

### 2.2 `GET /jobs-guest/jobs/api/jobPosting/{jobId}` — job detail fragment

Returns a small HTML shell containing the top card + description. This is the guest analogue of `/jobs/view/{slug}-{id}`.

**Full URL:**
```
https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4456297886
```

**Method:** `GET`

**Response:** `200 text/html`, top card (`top-card-layout__title`), flavor row, and `description__text--rich` → `show-more-less-html__markup`.

**Observed:** `time=2026-09-02T04:25:38Z`, 200, body contains:

```html
<section class="top-card-layout container-lined ...">
  <h2 class="top-card-layout__title topcard__title">Entry Level Mechanical Engineer</h2>
  <a class="topcard__org-name-link" href="https://www.linkedin.com/company/schneider">Schneider</a>
  <span class="topcard__flavor">Green Bay, WI</span>
</section>
<section class="description">
  <div class="description__text description__text--rich">
    <section class="show-more-less-html" data-max-lines="5">
      <div class="show-more-less-html__markup">
        <strong>Work Model:</strong> On-Site<br><br>...
      </div>
    </section>
  </div>
</section>
```

**Params:** none (path `jobId` is the numeric id from `urn:li:jobPosting:{id}`).

**Headers:** same as §2.1 — no auth, UA optional.

**Use:** fetch description, employment type, seniority, apply URL (follow `apply` button link inside). Not needed for polling dedupe, but useful for per-notification enrichment.

---

### 2.3 Ancillary guest endpoints (discovered via SERP crawl)

| Endpoint | Method | Purpose | Response | Source |
|---|---|---|---|---|
| `GET /jobs-guest/api/typeaheadHits?typeaheadType=COMPANY&query={text}` | GET | Company typeahead for `f_C` | Expected JSON (array of company suggest), but probe with `?query=Amazon` returned 404 — may require different param name (`keywords` vs `query`) or CSRF. Listed in SERP as `data-base-api-url="/jobs-guest/api/typeaheadHits?typeaheadType=COMPANY"` | SERP HTML `data-base-api-url` |
| `GET /jobs/search`, `GET /jobs-guest/jobs/api/*` (SERP shell) | GET | Human SERP that issues `seeMoreJobPostings` XHR. Useful to harvest `geoId` and available filter values | Full HTML page, 200 | WebFetch of `linkedin.com/jobs/search?keywords=Engineer&location=United%20States` → `input[name=geoId] value="103644278"` |
| `POST /jobs-guest/api/ingraphs/counter`, `GET /jobs-guest/api/ingraphs/gauge` | POST/GET | Metrics beacons (page view, impression tracking). Not for polling | — | SERP `meta[name=clientSideIngraphs]` `data-gauge-metric-endpoint="/jobs-guest/api/ingraphs/gauge"` |
| `GET /voyager/api/jobs/...` | — | **Not guest** — authenticated only. Always 403 without `li_at`. Listed here to avoid confusion | 403 | Probe 2026-09-02 |

Only §2.1 and §2.2 are pollable for kappa-bot.

---

## 3. curl Examples (live, 2026-09-02)

All tested with stock `curl` (no cookies, no CSRF). Add `-H "User-Agent: ..."` to reduce Cloudflare risk.

### 3a. Basic search — first page, keyword + location

```bash
curl -s "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Engineer&location=United%20States&start=0" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -H "Accept: text/html" | grep -c "<li>"
# → 10
```

### 3b. Filtered + paginated — remote, past 24h, experience level, page 2

`f_WT=2` remote, `f_TPR=r86400` past 24h, `f_E=2` entry-level, `f_JT=F` full-time, `start=10` second page:

```bash
curl -s "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=python&location=Berlin&distance=25&f_TPR=r86400&f_WT=2&f_E=2&f_JT=F&start=10" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: text/html" | head -c 2000

# Combine filters the way linkedin-jobs-api does:
curl -s "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Engineer&location=United%20States&f_TPR=r86400&f_WT=1&f_JT=F&f_E=2&start=0" \
  -H "User-Agent: Mozilla/5.0" | grep -o 'data-entity-urn="[^"]*"' | head
# → urn:li:jobPosting:4460913082 ...
```

### 3c. Detail fetch — description + metadata for a job id

```bash
# Search to get an id, then fetch detail:
ID=4456297886
curl -s "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/$ID" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: text/html" | grep -o 'top-card-layout__title[^<]*' | head

# Full description text:
curl -s "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/$ID" \
  -H "User-Agent: Mozilla/5.0" | sed -n 's/.*description__text--rich.*//p' | head
```

### 3d. Loop until exhausted (bash pattern for kappa-bot)

```bash
keywords="Engineer"
location="United States"
start=0
while true; do
  html=$(curl -s "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${keywords// /+}&location=${location// /+}&start=$start" \
    -H "User-Agent: Mozilla/5.0")
  count=$(echo "$html" | grep -c '<li>')
  [ "$count" -eq 0 ] && break
  echo "start=$start count=$count"
  # parse with cheerio / puppeteer / python bs4 here
  start=$((start + count))  # 10 per page observed; use count not fixed
  sleep 2
done
```

---

## 4. Parsing Approach

**HTML fragment → structured jobs.** No JSON variant exists for guest.

Recommended (Node.js) — as implemented in [`linkedin-jobs-api/index.js:223-267`](https://registry.npmjs.org/linkedin-jobs-api/-/linkedin-jobs-api-1.0.7.tgz) (`package/index.js:223`):

```js
const cheerio = require('cheerio');

function parseJobList(html) {
  const $ = cheerio.load(html);
  return $('li').map((_, el) => {
    const job = $(el);
    const position = job.find('.base-search-card__title').text().trim();
    const company  = job.find('.base-search-card__subtitle').text().trim();
    if (!position || !company) return null;
    return {
      id: (job.find('[data-entity-urn]').attr('data-entity-urn') || '').split(':').pop(),
      position,
      company,
      location: job.find('.job-search-card__location').text().trim(),
      datetime: job.find('time').attr('datetime') || null,
      agoTime: job.find('time').text().trim(),
      salary: job.find('.job-search-card__salary-info').text().trim() || null,
      url: job.find('.base-card__full-link').attr('href') || null,
      logo: job.find('.artdeco-entity-image').attr('data-delayed-url') || null,
    };
  }).get().filter(Boolean);
}
```

**Python equivalent** (for alternative source parity):

```python
from bs4 import BeautifulSoup
from urllib.parse import urlparse

def parse_jobs(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    jobs = []
    for li in soup.select("li"):
        title = li.select_one(".base-search-card__title")
        company = li.select_one(".base-search-card__subtitle")
        if not title or not company:
            continue
        urn = li.select_one("[data-entity-urn]")
        jobs.append({
            "id": urn["data-entity-urn"].split(":")[-1] if urn else None,
            "position": title.get_text(strip=True),
            "company": company.get_text(strip=True),
            "location": (li.select_one(".job-search-card__location") or {}).get_text(strip=True) if li.select_one(".job-search-card__location") else None,
            "datetime": (li.select_one("time") or {}).get("datetime"),
            "agoTime": li.select_one("time").get_text(strip=True) if li.select_one("time") else None,
            "url": (li.select_one(".base-card__full-link") or {}).get("href"),
        })
    return jobs
```

**Dedupe key:** `id` (numeric jobPosting id). URL `position`/`pageNum`/`trackingId` are transient — never use for dedupe. Store `urn:li:jobPosting:{id}`.

**Detail parsing:** `$('h2.top-card-layout__title').text()`, `$('.description__text--rich').html()` or `.text()`, and the apply link.

---

## 5. Operational Constraints for kappa-bot

- **Auth-free but not contract-guaranteed.** LinkedIn may change class names or throttle without notice. Probe suite should fetch once per deploy and fail loudly if selectors return 0 when `1` expected.
- **Rate-limit:** No published limit. Observed: 3 rapid sequential requests succeeded; npm lib uses 2–3 s jitter + exponential backoff on 429. Recommend **≤ 1 req/2s per IP**, with `random-useragent` rotation.
- **geoId pinning:** Resolve `location` → `geoId` once (scrape `input[name=geoId]`) and persist; avoids ambiguous geocoding on every poll.
- **Filter sunset risk:** LinkedIn Help confirms classic filters retiring Sept 2026 in favor of AI NL search. `seeMoreJobPostings` may survive (it already accepts free-text `keywords`) but `f_TPR`/`f_C` etc. could be dropped. Keep a fallback path that folds filters into `keywords` (e.g. `"Entry-level sales jobs in healthcare posted in the last week"` per Help examples).
- **Empty result signal:** HTTP 200 with no `<li>` — not 404, not 204. Must be treated as termination, not error. Verified: nonsense keyword returned 200 with ~30 kB shell but 0 job cards.

---

## 6. Sources

- Live probe `GET https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Engineer&location=United%20States&start=0` — 200 `text/html`, 10 `<li>` with `data-entity-urn="urn:li:jobPosting:*"` (2026-09-02)
- Live probe pagination: `start=10` → 10, `start=100` → 10, `start=500` → 0, `start=990` → 0
- Live probe detail: `GET https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4456297886` — 200 `text/html` with `top-card-layout__title` and `description__text--rich`
- Live probe Voyager: `GET https://www.linkedin.com/voyager/api/jobs/jobPostings/4456297886` — 403
- Live probe SERP: `GET https://www.linkedin.com/jobs/search?keywords=Engineer&location=United%20States` — contains `input[name=geoId] value="103644278"`, `data-service-name="jobs-guest-frontend"`, `f_TPR` filter options, `data-base-api-url="/jobs-guest/api/typeaheadHits?typeaheadType=COMPANY"`
- npm package [`linkedin-jobs-api@1.0.7`](https://registry.npmjs.org/linkedin-jobs-api) — `package/index.js:130-165` URL builder, `package/index.js:223-267` cheerio parser, `README.md` filter docs (keywords, location, dateSincePosted, jobType, remoteFilter, salary, experienceLevel, limit, page, has_verification, under_10_applicants)
- [LinkedIn Help — Discover new opportunities with AI-powered job search (a6889044)](https://www.linkedin.com/help/linkedin/answer/a6889044) — filter retirement timeline, recommended NL query examples
- [cdn.jsdelivr.net — linkedin-jobs-api README](https://cdn.jsdelivr.net/npm/linkedin-jobs-api@latest/README.md) — query object docs and example response shape

---

*Next tickets that depend on this:* `02-linkedin-guest-constraints` (rate limit / ToS), `03-alternative-job-sources` (fallback APIs), `07-subscription-data-model` (filter vocabulary → column mapping), `08-fetch-delivery-pipeline` (poll loop + dedupe + backoff).
