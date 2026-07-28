export const BASE_URL = "https://www.getonbrd.com"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/**
 * GET the public, unauthenticated `/api/v0/search/jobs` JSON API with retry/backoff.
 * This is a documented public endpoint (see https://www.getonbrd.com/api-doc.html) —
 * unlike `/api/v0/jobs/{id}`, it carries no `security: ApiKeyAuth` requirement.
 */
export async function apiFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params)
  const url = `${BASE_URL}${path}?${qs.toString()}`

  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; getonbrd-cli/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((resolve) => setTimeout(resolve, delay + jitter))
      delay = Math.min(delay * 2, 5000)
      continue
    }
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<T>
  }
  throw new Error("API request failed after max retries")
}

/**
 * Fetch a public job-detail page's HTML with retry/backoff. `/api/v0/jobs/{id}`
 * requires an API key (verified live: 401 without one), so `detail` reads the
 * public page instead, same as jobindex-search.
 */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; getonbrd-cli/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((resolve) => setTimeout(resolve, delay + jitter))
      delay = Math.min(delay * 2, 5000)
      continue
    }
    if (response.status === 404) {
      throw new Error("Job not found")
    }
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

// --- Search API response shapes (the fields this skill reads; the wire shape carries more) ---

export interface GetOnBrdCompany {
  id: string
  attributes: {
    name: string
    web: string | null
  }
}

export interface GetOnBrdLocationCity {
  id: string
  attributes: {
    name: string
    country: string
  }
}

export interface GetOnBrdModality {
  attributes: { name: string }
}

export interface GetOnBrdSeniority {
  attributes: { name: string }
}

export interface GetOnBrdJob {
  id: string
  type: string
  attributes: {
    title: string
    remote: boolean
    remote_modality: string
    countries: string[]
    category_name: string
    min_salary: number | null
    max_salary: number | null
    published_at: number // unix seconds
    location_cities?: { data: GetOnBrdLocationCity[] }
    modality?: { data: GetOnBrdModality }
    seniority?: { data: GetOnBrdSeniority }
    company?: { data: GetOnBrdCompany }
  }
  links: { public_url: string }
}

export interface SearchResponse {
  data: GetOnBrdJob[]
  meta: { page: number; per_page: number; total_pages: number }
}

export interface JobResult {
  id: string
  title: string
  company: string | null
  companyUrl: string | null
  location: string | null
  date: string | null
  url: string
  remote: boolean
  seniority: string | null
  category: string | null
  salary: string | null
}

/** Unix seconds -> `YYYY-MM-DD`, or null when absent. */
export function toIsoDate(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds == null) return null
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

/** "City, Country" from expanded location_cities, falling back to the country list, then "Remote". */
export function formatLocation(job: GetOnBrdJob): string | null {
  const city = job.attributes.location_cities?.data?.[0]?.attributes
  if (city) return `${city.name}, ${city.country}`
  if (job.attributes.countries?.length) return job.attributes.countries.join(", ")
  if (job.attributes.remote) return "Remote"
  return null
}

/** `"1600-2500 USD"`-style summary from min/max salary, or null when neither is set. */
export function formatSalary(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${min}-${max} USD`
  return `${min ?? max} USD`
}

/** Reshape a Get on Board API job into the portal-skill contract's search-result shape. */
export function toResult(job: GetOnBrdJob): JobResult {
  const a = job.attributes
  return {
    id: job.id,
    title: a.title,
    company: a.company?.data?.attributes?.name ?? null,
    companyUrl: a.company?.data?.attributes?.web ?? null,
    location: formatLocation(job),
    date: toIsoDate(a.published_at),
    url: job.links.public_url,
    remote: a.remote,
    seniority: a.seniority?.data?.attributes?.name ?? null,
    category: a.category_name ?? null,
    salary: formatSalary(a.min_salary, a.max_salary),
  }
}

// --- HTML entity / tag helpers (shared by the detail-page parser) ---

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim()
}

/**
 * Extract the content of the first element with the given class, tracking div
 * nesting depth so a class whose content contains further nested `<div>`s (as
 * Get on Board's `#job-body` does) is not truncated at the first `</div>`.
 * Ported from jobindex-search/cli/src/helpers.ts.
 */
export function extractDivContent(html: string, className: string): string | null {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const openRe = new RegExp(`<div[^>]*(?:class|id)="[^"]*${escaped}[^"]*"[^>]*>`, "i")
  const open = openRe.exec(html)
  if (!open) return null

  let i = open.index + open[0].length
  let depth = 1

  while (depth > 0 && i < html.length) {
    const nextOpen = html.indexOf("<div", i)
    const nextClose = html.indexOf("</div>", i)

    if (nextClose === -1) return null

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 4
    } else {
      depth--
      i = nextClose + 6
    }
  }

  return html.slice(open.index + open[0].length, i - 6)
}

/**
 * Turn the `#job-body` rich-text HTML into readable prose: block-level closing
 * tags become newlines, entities are decoded, remaining tags are stripped.
 */
export function cleanDescriptionHtml(html: string | null): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}
