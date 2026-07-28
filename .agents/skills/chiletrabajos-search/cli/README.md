# chiletrabajos-cli

CLI for searching Informática / Telecomunicaciones jobs on [Chiletrabajos.cl](https://www.chiletrabajos.cl).

**Base URL**: `https://www.chiletrabajos.cl/`
**Authentication**: None required for search/detail. `applyUrl` links to the portal's own apply flow, which does require a Chiletrabajos.cl account.
**Format**: No JSON API — the CLI parses server-rendered HTML. Search results are regex-parsed per-card; job detail is read from the page's embedded `JobPosting` JSON-LD block (far more reliable than HTML regexes).
**Scope**: Hardcoded to the "Informática / Telecomunicaciones" category (`categoria=2007`) — this skill is specifically for `chiletrabajos.cl/trabajos/informatica`, not the whole site.

---

## Installation

```bash
cd .agents/skills/chiletrabajos-search/cli
bun install
```

---

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search Informática / Telecomunicaciones job listings |
| `detail` | Fetch full detail for a single job listing |

All commands accept `--format json|table|plain` (default: `json`).
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

---

## `search` — Search for job listings

**Endpoint**: `GET https://www.chiletrabajos.cl/encuentra-un-empleo` (category-scoped via `categoria=2007`)

```bash
bun run src/cli.ts search [flags]
```

Page size is fixed at 30 results per page (no `--per-page` flag — the site doesn't offer one).

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--query` / `-q` | string | — | Keyword search query (e.g. `desarrollador full stack`, `analista de datos`) |
| `--location` / `-l` | string | — | Chilean city name (e.g. `Santiago`, `Valparaíso`, `Puerto Montt`) — maps to the portal's location filter |
| `--page` | number | `1` | Page number (1-indexed) |
| `--jobage` | number | `9999` | Max age of posting in days: `1`, `2`, `3`, `6`, `7`, `30`, or `9999` (all) — snaps to the nearest supported bucket |
| `--sort` | string | `date` | Sort order: `date` (newest first, the portal's own default) or `score` (relevance) |
| `--limit` | number | — | Cap total results returned by the CLI (client-side) |
| `--format` | string | `json` | Output format: `json`, `table`, `plain` |

### jobage buckets

The portal has no arbitrary "last N days" parameter — only these discrete buckets (`fecha` param). `--jobage` picks the first bucket whose cutoff covers the request:

| `--jobage` | Bucket used | Site label |
|------------|-------------|------------|
| `1` | `fecha=1` | Hoy |
| `2` | `fecha=2` | Desde Ayer |
| `3` | `fecha=3` | Menor a 3 días |
| `4`–`6` | `fecha=4` | Menor a 6 días |
| `7` | `fecha=5` | Hace una semana |
| `8`–`30` | `fecha=6` | Hace un mes |
| `31`–`9999` (default) | no filter | all postings |

### Example

```bash
# Search for full-stack developer jobs
bun run src/cli.ts search --query "desarrollador full stack"

# Jobs in Valparaíso posted in the last week
bun run src/cli.ts search --query "soporte" --location "Valparaíso" --jobage 7

# Browse the whole category with no keyword, newest first, page 2
bun run src/cli.ts search --page 2 --format table
```

### Response shape

```json
{
  "meta": {
    "total": 44,
    "page": 1,
    "perPage": 30,
    "totalPages": 2
  },
  "results": [
    {
      "id": "3807840",
      "title": "Desarrollador Full Stack .NET (Inglés Billingue)",
      "company": "Haibu solutions",
      "location": "Santiago",
      "date": "2026-07-28",
      "url": "https://www.chiletrabajos.cl/trabajo/desarrollador-full-stack-net-ingles-billingue-3807840",
      "description": "Objetivo del cargo buscamos un/a software engineer ii / desarrollador full stack .net…"
    }
  ]
}
```

**Field notes:**
- `id` — bare numeric string (e.g. `3807840`). Use this with the `detail` command.
- `title` — may be truncated with `…` in the listing; `detail` returns the full title.
- `company` — may be `"Confidencial"` when the employer withholds its name; `null` only if the field is genuinely absent.
- `location` — city name (e.g. `"Santiago"`); `null` if not listed on the card.
- `date` — ISO date (`YYYY-MM-DD`) parsed from the Spanish `"28 de  Julio de 2026"` format (note the site's own double space after the first "de").
- `description` — short excerpt truncated by the site, with its "Ver más" link stripped.
- `total` in `meta` — parsed from the page's `"Se han encontrado N ..."` copy.

> **Location note**: `--location` covers the ~54 cities in the portal's own filter dropdown. For a location the lookup doesn't know, include the city name in `--query` instead (e.g. `--query "python providencia"`).

---

## `detail` — Fetch full job listing detail

**URL**: `https://www.chiletrabajos.cl/trabajo/{id}` (the descriptive slug is decorative — the bare numeric ID alone resolves the same page)

```bash
bun run src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric ID from `search` results (e.g. `3807840`). You may also pass the full URL from a `search` result's `url` field.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | string | `json` | Output format: `json`, `plain` |

### Example

```bash
# Using the bare numeric ID from search results
bun run src/cli.ts detail 3807840

# Using the full URL
bun run src/cli.ts detail "https://www.chiletrabajos.cl/trabajo/desarrollador-full-stack-net-ingles-billingue-3807840"

# Plain text output
bun run src/cli.ts detail 3807840 --format plain
```

### Response shape

```json
{
  "id": "3807840",
  "title": "Desarrollador Full Stack .NET (Inglés Billingue)",
  "company": "Haibu Solutions",
  "location": "Remoto",
  "date": "2026-07-28",
  "deadline": "2026-10-11",
  "employmentType": "Full-time",
  "category": "Informática / Telecomunicaciones",
  "salary": null,
  "applyUrl": "https://www.chiletrabajos.cl/trabajo/postular/3807840",
  "url": "https://www.chiletrabajos.cl/trabajo/3807840",
  "description": "Full job description text here..."
}
```

**Field notes:**
- All fields are read from the page's embedded `JobPosting` schema.org JSON-LD block, not scraped from rendered HTML markup.
- `location` — `"Remoto"` when the posting's `jobLocationType` is `TELECOMMUTE`; otherwise `"{city}, {region}"` from the posting's address, or `null` if neither is present.
- `deadline` — from `validThrough`; `null` if not listed.
- `employmentType` — schema.org enum (`FULL_TIME`, `PART_TIME`, …) mapped to a Spanish label; unmapped values pass through as-is.
- `salary` — from `baseSalary`; most postings set `Value: 0` (withheld), which the CLI reports as `null` rather than `"0 CLP/mes"`.
- `applyUrl` — the in-portal application page; applying requires a Chiletrabajos.cl account (this CLI does not authenticate).
- `description` — full plain-text job description with paragraph breaks preserved (`\r\n` normalized to `\n`).

---

## Error handling

All errors are written to **stderr** in JSON format and exit with code `1`:

```json
{ "error": "Job not found", "code": "NOT_FOUND" }
{ "error": "API request failed: 500 Internal Server Error", "code": "API_ERROR" }
{ "error": "Failed to parse job listing HTML", "code": "PARSE_ERROR" }
{ "error": "Job ID or URL is required", "code": "MISSING_REQUIRED" }
{ "error": "Unknown location \"Marte\" — pass a Chilean city name, or include it in --query instead", "code": "INVALID_LOCATION" }
```

---

## Parsing notes

### Total count

Extracted from the page's `"Se han encontrado N ofertas de trabajo..."` copy (case varies: lowercase on category-browse pages, capitalized "Ofertas" on keyword-search pages). No thousands separator to strip (unlike jobindex.dk's Danish `.` notation).

### Search result cards

Each result is wrapped in `<div class="job-item with-thumb destacado no-hover ">` — confirmed identical across all 30 cards on both category-browse and keyword-search pages. The CLI splits the HTML into per-card chunks on this boundary before parsing each independently, so one malformed card can't break the rest.

| Field | Anchor |
|-------|--------|
| `title` + `url` | `<h2 class="title ...">` → `<a href="...">` |
| `id` | trailing digits of the title link's URL |
| `company` + `location` | first `<h3 class="meta">` — company is the leading text, location is the `<a href=".../ciudad/...">` link text |
| `date` | second `<h3 class="meta">`, inside `<a><i class="far fa-calendar"></i> DATE</a>` |
| `description` | `<p class="description">`, with the trailing `<a class="ver-mas-btn">Ver más</a>` link stripped |

### Job detail JSON-LD

The detail page embeds multiple `<script type="application/ld+json">` blocks (an `ItemList` of related postings plus the posting itself). The CLI scans all of them and picks the one whose `@type` is `JobPosting`.

### Pagination quirk

Pagination is offset-based in the URL path: `/encuentra-un-empleo/{offset}` where `offset = (page - 1) * 30`. Requesting an offset past the last available page (e.g. combining a narrow `fecha` filter with a `--page` beyond the filtered result count) returns unrelated results from a fallback listing rather than an empty page — a site quirk, not a CLI bug. Keep `--page` within `meta.totalPages` from a prior response.

### robots.txt

`https://www.chiletrabajos.cl/robots.txt` disallows only `/partners/` and `/ofertasmuchomas` for `User-agent: *` (plus a blanket disallow for the `Scrapy` user-agent specifically). Neither `/encuentra-un-empleo` nor `/trabajo/` is restricted.
