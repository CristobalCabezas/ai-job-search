# getonbrd-cli

CLI for searching jobs on [Get on Board](https://www.getonbrd.com), the tech recruitment platform for Latin America — Chile market by default.

**Base URL**: `https://www.getonbrd.com/`
**Authentication**: None required for `search` or `detail`.
**Format**: `search` uses Get on Board's public, unauthenticated `/api/v0/search/jobs` JSON API. `detail` reads the public job-detail HTML page instead (the equivalent `/api/v0/jobs/{id}` endpoint requires an API key — verified live: 401 without one) and parses its embedded schema.org microdata.

---

## Installation

```bash
cd .agents/skills/getonbrd-search/cli
bun install
```

---

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings |
| `detail` | Fetch full detail for a single job listing |

All commands accept `--format json|table|plain` (default: `json`).
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

---

## `search` — Search for job listings

**Endpoint**: `GET https://www.getonbrd.com/api/v0/search/jobs`

```bash
bun run src/cli.ts search [flags]
```

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--query` / `-q` | string | — | Keyword search query (e.g. `desarrollador backend`, `product manager`) |
| `--country` | string | `CL` | ISO-3166 alpha-2 country code, or `"all"` for every Get on Board market |
| `--page` | number | `1` | Page number (1-indexed) |
| `--jobage` | number | `9999` | Max age of posting in days, filtered client-side on the fetched page: `1`, `7`, `14`, `30`, or `9999` (all) |
| `--remote` | string | — | Filter by remote status: `true` or `false` |
| `--limit` | number | `20` | Results per page (maps to the API's `per_page`, max `120`) |
| `--format` | string | `json` | Output format: `json`, `table`, `plain` |

### Example

```bash
# Backend developer jobs in Chile
bun run src/cli.ts search --query "desarrollador backend"

# Remote-only jobs across all LatAm markets
bun run src/cli.ts search --country all --remote true

# Data engineer jobs posted in the last week, table view
bun run src/cli.ts search --query "data engineer" --jobage 7 --format table
```

### Response shape

```json
{
  "meta": { "count": 20, "page": 1, "perPage": 20, "totalPages": 58 },
  "results": [
    {
      "id": "desarrollador-back-end-semi-senior-agilesoft-spa-remote",
      "title": "Desarrollador Back-end Semi Senior",
      "company": "Agilesoft SpA",
      "companyUrl": "http://www.agilesoft.cl",
      "location": "Remoto",
      "date": "2026-07-27",
      "url": "https://www.getonbrd.com/jobs/desarrollador-back-end-semi-senior-agilesoft-spa-remote",
      "remote": true,
      "seniority": "Semi Senior",
      "category": "Programación",
      "salary": null
    }
  ]
}
```

**Field notes:**
- `id` — the job's URL **slug** (not numeric). Use this with `detail`. The `table` format truncates this column to ~44 chars for display — read the full slug from `json` output before passing it to `detail`.
- `date` — ISO date (`YYYY-MM-DD`) converted from the API's unix-seconds `published_at`.
- `location` — `"{city}, {country}"` when `location_cities` is populated, else the country list, else `"Remote"` when `attributes.remote` is true, else `null`.
- `salary` — `"{min}-{max} USD"` when both bounds are set, `"{min or max} USD"` when only one is, else `null` (most listings don't disclose it).

---

## `detail` — Fetch full job listing detail

**URL**: `https://www.getonbrd.com/jobs/{slug}` (301-redirects to `https://www.getonbrd.com/empleos/{category}/{slug}` — `htmlFetch` follows this automatically)

```bash
bun run src/cli.ts detail <slug|url> [--format json|plain]
```

The `slug` is the job's `id` from `search` results. You may also pass the full URL directly.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | string | `json` | Output format: `json`, `plain` |

### Example

```bash
# Using the slug from search results
bun run src/cli.ts detail "desarrollador-back-end-semi-senior-agilesoft-spa-remote"

# Using the full URL
bun run src/cli.ts detail "https://www.getonbrd.com/jobs/desarrollador-back-end-semi-senior-agilesoft-spa-remote"

# Plain text output
bun run src/cli.ts detail "desarrollador-back-end-semi-senior-agilesoft-spa-remote" --format plain
```

### Response shape

```json
{
  "id": "desarrollador-back-end-semi-senior-agilesoft-spa-remote",
  "title": "Desarrollador Back-end Semi Senior",
  "company": "Agilesoft SpA",
  "companyUrl": "https://www.getonbrd.com/companies/agilesoft-spa-cl",
  "location": "Remoto",
  "date": "2026-07-27",
  "seniority": "Semi Senior",
  "employmentType": "FULL_TIME",
  "category": "Programación",
  "salary": null,
  "applyUrl": "https://www.getonbrd.com/jobs/desarrollador-back-end-semi-senior-agilesoft-spa-remote/applications/new",
  "url": "https://www.getonbrd.com/jobs/desarrollador-back-end-semi-senior-agilesoft-spa-remote",
  "description": "Full job description text here..."
}
```

**Field notes:**
- Parsed from the page's schema.org microdata (`itemprop="title"`, `itemprop="jobLocation"`, etc.) rather than generic classes — anchors more reliable than regexing arbitrary rendered HTML.
- `location` — `"Remoto"` for fully remote postings (no city link on the page); the city name for on-site/hybrid postings.
- `salary` — best-effort from an on-page badge, not part of the microdata; `null` on most listings (not disclosed).
- All fields may be `null` if not present on the page.

---

## Error handling

All errors are written to **stderr** in JSON format and exit with code `1`:

```json
{ "error": "Job not found", "code": "NOT_FOUND" }
{ "error": "API request failed: 500 Internal Server Error", "code": "API_ERROR" }
{ "error": "Failed to parse job listing HTML", "code": "PARSE_ERROR" }
```

---

## Parsing notes

See `../url-reference.md` for the full endpoint reference, including the 2026-07-28
site redesign that changed the `detail` page's location/category link paths
(`/jobs/city/` → `/empleos/ciudad/`, `/jobs/{category}` → `/empleos/{category}`) and
the company-name anchor (moved off an English-only "in {company}" span onto the
language-independent `itemprop="name"` microdata).
