---
name: chiletrabajos-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user wants to search for IT/tech jobs in Chile,
  find Informática / Telecomunicaciones job listings on Chiletrabajos.cl, look up a specific
  Chiletrabajos job posting, or asks anything about the Chilean IT job market — even if they
  don't mention chiletrabajos.cl explicitly. Invoke this skill for questions about open
  positions, job vacancies, hiring in Chile, tech job opportunities in Chilean cities or
  regions, or when the user wants to find IT/software/telecom work in Chile. Also trigger
  for phrases like "find me a job in Chile", "are there any developer jobs in Santiago", or
  "what IT jobs are available in Valparaíso" when the context is Chile. Trigger phrases
  include: chiletrabajos, trabajos en chile, empleos en chile, ofertas de trabajo chile,
  bolsa de trabajo chile, trabajo informática chile, empleos ti chile, busco trabajo chile,
  IT jobs chile, tech jobs chile, software developer jobs chile, jobs in santiago, jobs in
  valparaiso, jobs in concepcion, empleos santiago, empleos valparaiso, desarrollador full
  stack chile, ingeniero de software chile, analista de datos chile, soporte informático
  chile, programador chile, devops chile, ciberseguridad chile.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/chiletrabajos-search/cli/src/cli.ts *)
---

# Chiletrabajos Search Skill

Search live Informática / Telecomunicaciones (IT/Telecom) job listings from
Chiletrabajos.cl, one of Chile's major job boards. No authentication needed.
Scoped to `chiletrabajos.cl/trabajos/informatica` — software, IT support, data,
telecom, and related roles across Chile.

## When to use this skill

Invoke this skill when the user wants to:

- Search for IT/tech job openings in Chile by keyword, job title, or technology
- Find jobs in a specific Chilean city (`--location`, e.g. Santiago, Valparaíso, Concepción)
- Filter jobs by recency (today, last few days, last week, last month)
- Get the full description of a specific job listing, including salary and deadline when disclosed
- Explore the Chilean IT/Telecom job market for a given profession or skill set

## Commands

### Search job listings

```bash
bun run .agents/skills/chiletrabajos-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (job title, skill, company). Optional — omit it to browse the whole Informática / Telecomunicaciones category.
- `--location <city>` / `-l <city>` — Chilean city name (e.g. `Santiago`, `Valparaíso`, `Puerto Montt`). Covers ~54 cities; for others, include the city in `--query` instead.
- `--jobage <days>` — filter by posting age: `1` (today), `2`, `3`, `6`, `7`, `30`, or `9999` (all, default). Snaps to the nearest supported bucket.
- `--sort <order>` — `date` (newest first, default — matches the portal's own default) or `score` (relevance)
- `--page <n>` — page number (1-indexed, 30 results per page, fixed)
- `--limit <n>` — cap total results the CLI outputs (client-side)
- `--format json|table|plain`

### Fetch full job detail

```bash
bun run .agents/skills/chiletrabajos-search/cli/src/cli.ts detail <id> [--format json|plain]
```

`id` is the numeric job ID from `search` results (e.g. `3807840`). You may also pass the full Chiletrabajos URL. Returns the full job description, deadline, employment type, salary (when disclosed), and the in-portal apply link.

---

## How to use effectively

**Query is optional.** Unlike most job-board CLIs, `--query` isn't required — omitting it browses the entire Informática / Telecomunicaciones category, newest first.

**Use `--jobage 7` or `--jobage 1` for fresh listings.** Without it, results include all historical postings still live on the site.

**Use `--location` for a specific city** rather than trying to guess a URL path — the CLI maps ~54 Chilean city names to the portal's internal location IDs.

**Natural workflow: `search` → `detail`.**
1. Use `search` to find matching jobs and their `id` values.
2. Call `detail <id>` to get the full description, deadline, employment type, salary, and apply link.

**Use `--format table` for quick scanning**, `--format json` for data processing, and `--format plain` for reading a single job's full details.

**Pagination**: The site always returns 30 results per page. Use `--page` to navigate — check `meta.totalPages` in a prior response before requesting a page beyond it (requesting past the last page can return unrelated results, a site quirk — see `url-reference.md`).

---

## Usage examples

### Full-stack developer jobs, newest first

```bash
bun run .agents/skills/chiletrabajos-search/cli/src/cli.ts search \
  --query "desarrollador full stack" \
  --format table
```

### IT support jobs in Valparaíso, posted in the last week

```bash
bun run .agents/skills/chiletrabajos-search/cli/src/cli.ts search \
  --query "soporte" \
  --location "Valparaíso" \
  --jobage 7 \
  --format table
```

### Browse the whole category with no keyword — page 2

```bash
bun run .agents/skills/chiletrabajos-search/cli/src/cli.ts search \
  --page 2 \
  --format table
```

### Data engineer / analyst jobs, top 10 by relevance

```bash
bun run .agents/skills/chiletrabajos-search/cli/src/cli.ts search \
  --query "analista de datos" \
  --sort score \
  --limit 10 \
  --format table
```

### Jobs posted today across all of Informática / Telecomunicaciones

```bash
bun run .agents/skills/chiletrabajos-search/cli/src/cli.ts search \
  --jobage 1 \
  --limit 20 \
  --format table
```

### Get full details for a specific job

```bash
bun run .agents/skills/chiletrabajos-search/cli/src/cli.ts detail 3807840 --format plain
```

---

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, data processing, passing IDs to `detail` |
| `table` | Quick human-readable overview and scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

---

## Notes

- All data is from the public `chiletrabajos.cl` website — no credentials required. `robots.txt` allows automated access to the search and job-detail paths this skill uses (only `/partners/` and `/ofertasmuchomas` are disallowed).
- This skill is hardcoded to the "Informática / Telecomunicaciones" category — it does not search chiletrabajos.cl's other categories (Ventas, Salud, Educación, etc.).
- Page size is fixed at 30 results per page (site limitation — no `--per-page` flag).
- `--jobage` maps to the portal's own discrete date buckets (today / 2 days / 3 days / 6 days / week / month) rather than an arbitrary day count — see the CLI README for the exact mapping.
- Job titles in search results may be truncated with `…`; `detail` always returns the full title.
- `detail`'s output is sourced from the page's embedded schema.org `JobPosting` JSON-LD, which is more reliable than regexing rendered HTML — salary and deadline come from there when the posting discloses them.
- Applying to a job (`applyUrl`) requires logging into Chiletrabajos.cl — this skill only surfaces the link, it does not submit applications.
