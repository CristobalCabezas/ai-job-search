# Get on Board (getonbrd.com) URL Reference

Investigated live on 2026-07-28, including a redesign of the job-detail page that
broke part of the original `detail` parser (fixed the same day — see "Detail page
redesign" below).

## Base URL

```
https://www.getonbrd.com
```

## Search Endpoint (public JSON API — no auth)

```
GET https://www.getonbrd.com/api/v0/search/jobs
```

Documented at [getonbrd.com/api-doc.html](https://www.getonbrd.com/api-doc.html) as a
public endpoint (unlike `/api/v0/jobs/{id}`, which requires an API key — confirmed live:
401 without one, which is why `detail` reads the public HTML page instead).

### Query Parameters

| Parameter | Description | Example |
|-----------|--------------|---------|
| `query` | Free-text keyword search | `query=desarrollador+backend` |
| `country_code` | ISO-3166 alpha-2 code; omit entirely for "all markets" | `country_code=CL` |
| `remote` | Filter by remote status | `remote=true` |
| `page` | Page number (1-indexed) | `page=1` |
| `per_page` | Results per page, max 120 | `per_page=20` |
| `lang` | Response language | `lang=es` |
| `expand` | JSON array of relations to inline | `expand=["company","location_cities","modality","seniority"]` |

### Response shape

```json
{
  "data": [
    {
      "id": "desarrollador-back-end-semi-senior-agilesoft-spa-remote",
      "type": "jobs",
      "attributes": {
        "title": "Desarrollador Back-end Semi Senior",
        "remote": true,
        "remote_modality": "...",
        "countries": ["CL", "DO"],
        "category_name": "Programación",
        "min_salary": null,
        "max_salary": null,
        "published_at": 1785278452,
        "location_cities": { "data": [] },
        "modality": { "data": { "attributes": { "name": "..." } } },
        "seniority": { "data": { "attributes": { "name": "Semi Senior" } } },
        "company": { "data": { "id": "...", "attributes": { "name": "Agilesoft SpA", "web": "http://www.agilesoft.cl" } } }
      },
      "links": { "public_url": "https://www.getonbrd.com/jobs/desarrollador-back-end-semi-senior-agilesoft-spa-remote" }
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total_pages": 58 }
}
```

- `id` is the job's URL slug (not a numeric ID) — pass it directly to `detail`.
- `published_at` is unix **seconds** (not milliseconds) — `toIsoDate()` in `helpers.ts` converts it.
- `location_cities.data` is often empty even for on-site roles; `formatLocation()` falls back to `countries`, then to `"Remote"` when `attributes.remote` is true.

## Job Detail Page

```
GET https://www.getonbrd.com/jobs/{slug}
```

As of the 2026-07-28 redesign, this 301-redirects to a category-prefixed URL:

```
https://www.getonbrd.com/empleos/{category-slug}/{slug}
```

`fetch(..., { redirect: "follow" })` in `htmlFetch` already handles this — no code change
needed for the redirect itself, only for the anchors below that moved with it.

### Parsing anchors (schema.org microdata — reliable across the redesign)

| Field | Anchor | Redesign note |
|-------|--------|----------------|
| `title` | `<span itemprop="title">` | unchanged |
| `company` | `<strong itemprop="name">` inside the `itemprop="hiringOrganization"` block | **changed** — previously anchored on `<span class="fake-hidden size-3">in {company}</span>`, which broke because the redesigned page renders that span in Spanish (`en {company}`), not English. The `itemprop="name"` anchor is language-independent and was already present in both versions. |
| `companyUrl` | `class="gb-company-logo__link" href="..."` | unchanged |
| `employmentType` | `<span itemprop="employmentType">` (schema.org enum, e.g. `FULL_TIME`) | unchanged |
| `date` (posted) | `<time datetime="..." itemprop="datePosted">` | unchanged |
| `seniority` | `<span itemprop="qualifications">` | unchanged |
| `location` (city) | `<a href="/empleos/ciudad/{slug}">{City}</a>` inside the `itemprop="jobLocation"` block | **changed** — path moved from `/jobs/city/{slug}` to `/empleos/ciudad/{slug}` |
| `location` (remote) | no city `<a>` at all; the `itemprop="jobLocation"` block instead contains the plain text `"Remoto"` next to an `icon-wifi` icon | new fallback added: if no city link, check for the word "Remoto" in the location block |
| `category` | `<a href="/empleos/{category-slug}">{Category}</a>` (excluding the city link) inside the same `itemprop="jobLocation"`…`</h2>` block | **changed** — path moved from `/jobs/{category-slug}` to `/empleos/{category-slug}` |
| `description` | `id="job-body"` or `class="job-body"` div content (`extractDivContent` handles either) | unchanged |
| `salary` | `icon-money-bill` badge, best-effort | not part of microdata; absent on most listings observed live — treat `null` as "not disclosed", not a parse failure |

### Apply link

```
https://www.getonbrd.com/jobs/{slug}/applications/new
```

Confirmed present as the `Postular` button's `href` on every detail page checked; some
postings additionally note "Requiere postular en Español" near the button.

## Access Rules

No login required to view search results or job-detail pages. `/api/v0/search/jobs` is
documented as public in Get on Board's own API docs. No personal-use warning required.
