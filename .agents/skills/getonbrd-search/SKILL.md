---
name: getonbrd-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user wants to search for tech jobs in Chile
  or Latin America, find listings on Get on Board (getonbrd.com), look up a specific
  Get on Board job posting, or asks anything about the Chilean/LatAm tech job market —
  even if they don't mention getonbrd.com explicitly. Invoke this skill for questions
  about open positions, job vacancies, hiring in Chile or Latin America, tech job
  opportunities in Chilean or LatAm cities, or when the user wants to find software/
  data/design/product work in the region. Also trigger for phrases like "find me a tech
  job in Chile", "are there any backend jobs in Santiago", or "remote jobs in Latin
  America" when the context is tech/Chile/LatAm. Trigger phrases include: getonbrd, get
  on board, trabajos tech chile, empleos tecnologia chile, trabajo remoto latam, IT jobs
  chile, tech jobs latam, software developer jobs chile, jobs in santiago, empleos
  santiago, desarrollador chile, ingeniero de software chile, product manager chile,
  UX/UI designer chile, data scientist chile, devops chile.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/getonbrd-search/cli/src/cli.ts *)
---

# Get on Board Search Skill

Search live tech job listings from Get on Board (getonbrd.com), a job board focused
on software, data, design, and product roles across Chile and Latin America. No
authentication needed for search or detail lookups.

## When to use this skill

Invoke this skill when the user wants to:

- Search for tech job openings in Chile or Latin America by keyword, job title, or technology
- Filter jobs by country (`--country`), remote status (`--remote`), or posting age (`--jobage`)
- Get the full description of a specific job listing, including seniority, category, and (when disclosed) salary
- Explore the Chilean/LatAm tech job market for a given profession or skill set

## Commands

### Search job listings

```bash
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (job title, skill, company)
- `--country <code>` — ISO-3166 alpha-2 country code (default `CL`), or `all` for every Get on Board market
- `--remote <true|false>` — filter by remote status
- `--jobage <days>` — filter by posting age in days, applied client-side: `1`, `7`, `14`, `30`, or `9999` (all, default)
- `--page <n>` — page number (1-indexed)
- `--limit <n>` — results per page (maps to the API's `per_page`, max 120, default 20)
- `--format json|table|plain`

### Fetch full job detail

```bash
bun run .agents/skills/getonbrd-search/cli/src/cli.ts detail <slug|url> [--format json|plain]
```

`slug` is the job's `id` from `search` results (e.g. `desarrollador-back-end-semi-senior-agilesoft-spa-remote` — use the full slug, table output truncates it for display). You may also pass the full Get on Board URL. Returns the full job description, seniority, category, employment type, salary (when disclosed), and apply link.

---

## How to use effectively

**`--query` is optional.** Omitting it browses the whole Chile market (or `--country all` for every market Get on Board covers).

**Use `--remote true` for remote-only roles**, common across the LatAm tech market.

**Use `--jobage 7` or `--jobage 1` for fresh listings.** Applied client-side after the fetch, so results are still capped by `--limit`/pagination first.

**Natural workflow: `search` → `detail`.**
1. Use `search` to find matching jobs and their `id` (slug) values — read the full slug from JSON output, not the truncated `table` column.
2. Call `detail <slug>` to get the full description, seniority, employment type, and apply link.

**Use `--format table` for quick scanning**, `--format json` for data processing, and `--format plain` for reading a single job's full details.

---

## Usage examples

### Backend developer jobs in Chile

```bash
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search \
  --query "desarrollador backend" \
  --format table
```

### Remote-only tech jobs across all LatAm markets

```bash
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search \
  --country all \
  --remote true \
  --format table
```

### Data roles posted in the last week

```bash
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search \
  --query "data engineer" \
  --jobage 7 \
  --format table
```

### Product manager jobs, top 10

```bash
bun run .agents/skills/getonbrd-search/cli/src/cli.ts search \
  --query "product manager" \
  --limit 10 \
  --format table
```

### Get full details for a specific job

```bash
bun run .agents/skills/getonbrd-search/cli/src/cli.ts detail "desarrollador-back-end-semi-senior-agilesoft-spa-remote" --format plain
```

---

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, data processing, passing IDs to `detail` |
| `table` | Quick human-readable overview and scanning (note: `id` column is truncated to ~44 chars — read the full slug from `json` output when piping into `detail`) |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

---

## Notes

- Search uses Get on Board's public, unauthenticated `/api/v0/search/jobs` JSON API — no credentials required. `detail` reads the public job page instead (the equivalent `/api/v0/jobs/{id}` endpoint requires an API key).
- `getonbrd.com` redesigned its job-detail pages after this CLI was first written (site markup verified live on 2026-07-28); `company`, `location`, and `category` parsing in `detail` were fixed to match the new markup (`/jobs/city/` → `/empleos/ciudad/`, `/jobs/{category}` → `/empleos/{category}`, and the old English-only "in {company}" span replaced with the `itemprop="name"` anchor). See `url-reference.md` for the exact anchors if the site changes again.
- `salary` in `detail` is best-effort — most listings don't disclose it, in which case it's `null`.
- `location` in `detail` is `"Remoto"` for fully remote postings (no city link on the page at all) or the city name for on-site/hybrid postings.
