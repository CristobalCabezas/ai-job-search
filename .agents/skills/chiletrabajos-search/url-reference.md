# Chiletrabajos.cl URL Reference

Investigated live on 2026-07-28. This skill is scoped to the "Informática / Telecomunicaciones"
category (`categoria=2007`) — `chiletrabajos.cl/trabajos/informatica`.

## Base URL

```
https://www.chiletrabajos.cl
```

## Search Endpoint

```
GET https://www.chiletrabajos.cl/encuentra-un-empleo
GET https://www.chiletrabajos.cl/encuentra-un-empleo/{offset}   (pagination, offset = (page-1) * 30)
```

Also reachable as a static category-browse page (used only for initial reconnaissance;
the CLI always uses `/encuentra-un-empleo` since it composes with keyword/location/date filters):

```
GET https://www.chiletrabajos.cl/trabajos/informatica
GET https://www.chiletrabajos.cl/trabajos/informatica/{offset}
```

No JSON API exists — both endpoints return server-rendered HTML. Discovered from the
`<form id="buscadorForm" action="https://www.chiletrabajos.cl/encuentra-un-empleo" method="GET">`
on the category page.

### Query Parameters (form field names, not descriptive — inherited from the site's own markup)

| Parameter | Form field | Description | Example |
|-----------|-----------|--------------|---------|
| Keyword | `2` | Free-text search query | `2=desarrollador+full+stack` |
| Location | `13` | Numeric city ID (see table below) | `13=1022` (Santiago) |
| Posting age | `fecha` | Discrete bucket, not arbitrary days | `fecha=6` (last month) |
| Category | `categoria` | Numeric category ID — **always `2007`** for this skill | `categoria=2007` |
| Company | `8` | Free-text company-name filter (unused by this skill) | `8=Falabella` |
| Job type | `14` | `21`=Part-time, `22`=Full-time, `26`=Both (unused by this skill) | `14=22` |
| Inclusion law | `inclusion` | `1`=Sí, `0`=Indiferente (unused by this skill) | `inclusion=1` |
| Sort order | `f` | `1`=Relevancia, `2`=Fecha (date, the site's own default) | `f=2` |

### `fecha` buckets (posting age)

| Value | Site label | Approx. cutoff |
|-------|-----------|-----------------|
| (absent) | — | all time |
| `1` | Hoy | today |
| `2` | Desde Ayer | ~2 days |
| `3` | Menor a 3 días | 3 days |
| `4` | Menor a 6 días | 6 days |
| `5` | Hace una semana | 7 days |
| `6` | Hace un mes | 30 days |

There is no bucket beyond 30 days — the CLI's `--jobage 9999` default omits `fecha` entirely.

### Location IDs (`13` param)

Full list of ~54 city IDs transcribed from the `<select name="13">` options on the
search form (`src/helpers.ts`'s `CITY_IDS` table). Examples: Santiago=`1022`,
Valparaíso=`1014`, Concepción=`1035`, Puerto Montt=`1043`, Antofagasta=`1004`.
If a city isn't in the table, fall back to including it in the keyword query instead.

### Examples

```bash
# Keyword search scoped to the Informática category
curl -G "https://www.chiletrabajos.cl/encuentra-un-empleo" \
  --data-urlencode "2=desarrollador full stack" --data-urlencode "categoria=2007"

# Same, filtered to jobs posted in the last week, sorted by date, Santiago only
curl -G "https://www.chiletrabajos.cl/encuentra-un-empleo" \
  --data-urlencode "2=desarrollador full stack" --data-urlencode "categoria=2007" \
  --data-urlencode "fecha=5" --data-urlencode "13=1022" --data-urlencode "f=2"

# Page 2 (offset 30)
curl -G "https://www.chiletrabajos.cl/encuentra-un-empleo/30" \
  --data-urlencode "2=desarrollador full stack" --data-urlencode "categoria=2007"
```

## Result Count

Embedded in the page's `<meta name="description">` tag, not a dedicated JSON field:

```html
<meta name='description' content='Se han encontrado 44 Ofertas de trabajo de desarrollador full stack | Chiletrabajos busca y publica empleos en chile.'>
```

Regex: `/[Ss]e han encontrado\s+([\d.,]+)/` — no thousands separator observed in practice
(unlike jobindex.dk's Danish `.` notation), but the regex strips `.`/`,` defensively anyway.

## Search Result Card Structure

Fixed page size: **30 results per page**. Every card observed (both category-browse
and keyword-search pages, sponsored and organic alike) shares the identical wrapper class:

```html
<div class="job-item with-thumb destacado no-hover ">
```

Inside each card:

| Field | Selector / anchor |
|-------|--------------------|
| `title` + `url` | `<h2 class="title overflow-hidden"><a href="...">Title…</a></h2>` (title may be truncated with `&#8230;`) |
| `id` | trailing digits of the title link's URL — works for `/trabajo/{slug}-{id}` and bare `/trabajo/{id}` alike |
| `company` | leading text (before the city `<a>`) inside the first `<h3 class="meta">`, trailing comma stripped |
| `location` | `<a href=".../ciudad/{slug}.html">{City}</a>` inside that same first `<h3 class="meta">` |
| `date` | second `<h3 class="meta">`, text after `<i class="far fa-calendar"></i>` — format `"D de  MonthName de YYYY"` (note the double space after the first "de") |
| `description` | `<p class="description">`, truncated, ending in a `<a class="ver-mas-btn">Ver más</a>` link that must be stripped before use |

Also present but unused by this skill: a `<script type="application/ld+json">` `ItemList`
block per results page giving `position` + canonical `url` for all 30 cards — useful as a
cross-check but carries no title/company/date, so it doesn't replace the HTML card parse.

## Job Detail Page

```
GET https://www.chiletrabajos.cl/trabajo/{slug}-{id}
GET https://www.chiletrabajos.cl/trabajo/{id}            (bare ID — confirmed to resolve the identical page; the slug is decorative)
```

The canonical `<link rel="canonical">` on a bare-ID fetch echoes back the bare-ID URL
(not the descriptive slug) — expected, not a bug.

### JobPosting JSON-LD (primary data source — far more reliable than HTML regexes)

The detail page embeds several `<script type="application/ld+json">` blocks: an `ItemList`
of related postings, and a `JobPosting` block for the posting itself. Find the one whose
`@type` is `"JobPosting"`:

```json
{
  "@type": "JobPosting",
  "title": "...",
  "description": "... (plain text, \\r\\n line breaks) ...",
  "datePosted": "2026-07-28 13:11:13",
  "validThrough": "2026-10-11T13:11:13",
  "employmentType": "FULL_TIME",
  "industry": "Informática / Telecomunicaciones",
  "jobLocationType": "TELECOMMUTE",
  "hiringOrganization": { "name": "Haibu Solutions" },
  "jobLocation": { "address": { "addressLocality": "Santiago", "addressRegion": "RM", "addressCountry": "CL" } },
  "baseSalary": { "currency": "CLP", "value": { "Value": "900000", "unitText": "MONTH" } }
}
```

Field quirks confirmed against multiple live listings:
- `jobLocationType` is only present when the role is remote (`"TELECOMMUTE"`); absent for on-site roles, where `jobLocation.address` is the location source instead.
- `baseSalary.value.Value` (note the capitalized `Value` key — inconsistent with typical schema.org casing, but what the site actually emits) is a **string** when a salary is disclosed (e.g. `"900000"`) and the **number** `0` when withheld. Treat `0` as "no salary disclosed", not a real amount.
- No `hiringOrganization` website URL is exposed in the JSON-LD (unlike jobindex/getonbrd, which expose a company homepage link) — `companyUrl` is not a field this skill's `detail` output carries.

### Apply link

```
https://www.chiletrabajos.cl/trabajo/postular/{id}
```

Present as a `Postular` button on the detail page (`data-id="{id}"`). Requires a
Chiletrabajos.cl account to actually submit — the CLI surfaces the link but does not
authenticate or submit anything.

## Access Rules

`https://www.chiletrabajos.cl/robots.txt` (fetched 2026-07-28):

```
User-agent: *
disallow: /partners/

User-agent: Scrapy,proximic
disallow: /

User-agent:*
Disallow:/ofertasmuchomas

Sitemap: https://www.chiletrabajos.cl/sitemap.xml
```

Neither `/encuentra-un-empleo` nor `/trabajo/` is disallowed for the general `User-agent: *`
rule. No login is required to view search results or job detail pages. No personal-use
warning is required per this skill's generation policy (compare `linkedin-search`, which
does carry one because LinkedIn's ToS explicitly prohibits automated access to *authenticated*
pages) — but keep request volume low regardless, as with any shipped portal skill.
