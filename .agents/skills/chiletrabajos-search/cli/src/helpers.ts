export const BASE_URL = "https://www.chiletrabajos.cl"

/** Categoría "Informática / Telecomunicaciones" — this skill is scoped to it. */
export const CATEGORY_ID = "2007"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/**
 * Fetch a public page's HTML with retry/backoff. Chiletrabajos has no JSON API —
 * both search and detail read the server-rendered HTML. `redirect: "follow"` matters
 * for `detail`: a bogus job ID 307-redirects to `/404`, which only surfaces as a
 * 404 status once the redirect is followed.
 */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; chiletrabajos-cli/1.0)",
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

// --- HTML entity / tag helpers ---

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

// --- Spanish date parsing ("28 de  Julio de 2026" -> "2026-07-28") ---

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

/** Strip accents so "Julio"/"julio" and "año" style variants normalize the same. */
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function parseSpanishDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})/i)
  if (!m) return null
  const day = m[1].padStart(2, "0")
  const month = SPANISH_MONTHS[stripAccents(m[2].toLowerCase())]
  if (!month) return null
  return `${m[3]}-${String(month).padStart(2, "0")}-${day}`
}

// --- Location lookup for the --location/-l flag (form field "13") ---
// Table transcribed from the <select name="13"> options on the search form.

const CITY_IDS: Record<string, string> = {
  arica: "1000",
  putre: "1001",
  iquique: "1002",
  "pozo-almonte": "1003",
  antofagasta: "1004",
  tocopilla: "1005",
  calama: "1006",
  copiapo: "1007",
  chanaral: "1008",
  vallenar: "1009",
  "la-serena": "1010",
  coquimbo: "1011",
  ovalle: "1012",
  illapel: "1013",
  valparaiso: "1014",
  "la-ligua": "1015",
  "los-andes": "1016",
  "san-felipe": "1017",
  quillota: "1018",
  "san-antonio": "1019",
  "hanga-roa": "1020",
  quilpue: "1021",
  santiago: "1022",
  colina: "1023",
  "puente-alto": "1024",
  "san-bernardo": "1025",
  melipilla: "1026",
  talagante: "1027",
  rancagua: "1028",
  "san-fernando": "1029",
  pichilemu: "1030",
  talca: "1031",
  curico: "1032",
  linares: "1033",
  cauquenes: "1034",
  concepcion: "1035",
  chillan: "1036",
  "los-angeles": "1037",
  lebu: "1038",
  temuco: "1039",
  angol: "1040",
  valdivia: "1041",
  "la-union": "1042",
  "puerto-montt": "1043",
  osorno: "1044",
  castro: "1045",
  chaiten: "1046",
  coyhaique: "1047",
  "puerto-aysen": "1048",
  "chile-chico": "1049",
  cochrane: "1050",
  "punta-arenas": "1051",
  "puerto-natales": "1052",
  porvenir: "1053",
  "puerto-williams": "1054",
  quirihue: "1055",
  bulnes: "1056",
  "san-carlos": "1057",
}

/** Normalize a user-typed city name ("Puerto Montt", "Valparaíso") to a lookup slug. */
function toSlug(text: string): string {
  return stripAccents(text.toLowerCase())
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Resolve a city name to its Chiletrabajos numeric location ID, or null if unknown. */
export function lookupCityId(location: string): string | null {
  return CITY_IDS[toSlug(location)] ?? null
}

// --- Search result card parsing ---

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  description: string | null
}

export function parseTotal(html: string): number {
  const match = html.match(/[Ss]e han encontrado\s+([\d.,]+)/)
  if (!match) return 0
  return parseInt(match[1].replace(/[.,]/g, ""), 10) || 0
}

/**
 * Parse job cards from the search/category HTML using regex. Each result is
 * wrapped in `<div class="job-item ...">` with a stable inner structure; splitting
 * into per-card chunks first means one malformed card can't break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []

  const wrapperPattern = /<div class="job-item[^"]*">([\s\S]*?)(?=<div class="job-item[^"]*">|<\/body>|$)/g

  let match: RegExpExecArray | null
  while ((match = wrapperPattern.exec(html)) !== null) {
    const cardHtml = match[1]

    const titleSection = cardHtml.match(/<h2[^>]+class="title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)
    if (!titleSection) continue
    const titleLink = titleSection[1].match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!titleLink) continue

    const url = titleLink[1]
    const title = decodeHtmlEntities(stripTags(titleLink[2]))
    if (!title) continue

    const id = extractIdFromUrl(url)
    if (!id) continue

    const metaBlocks = [...cardHtml.matchAll(/<h3 class="meta">([\s\S]*?)<\/h3>/gi)]

    let company: string | null = null
    let location: string | null = null
    if (metaBlocks[0]) {
      const block = metaBlocks[0][1]
      const cityLink = block.match(/<a[^>]+href="[^"]*\/ciudad\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i)
      if (cityLink) location = decodeHtmlEntities(stripTags(cityLink[1])) || null
      const companyText = decodeHtmlEntities(stripTags(block.replace(/<a[\s\S]*?<\/a>/i, "")))
        .replace(/,\s*$/, "")
        .trim()
      company = companyText || null
    }

    let date: string | null = null
    if (metaBlocks[1]) {
      const dateMatch = metaBlocks[1][1].match(/fa-calendar[^>]*><\/i>\s*([^<]+)/i)
      if (dateMatch) date = parseSpanishDate(decodeHtmlEntities(dateMatch[1]))
    }

    let description: string | null = null
    const descMatch = cardHtml.match(/<p class="description"[^>]*>([\s\S]*?)<\/p>/i)
    if (descMatch) {
      const withoutVerMas = descMatch[1].replace(/<a[^>]+class="ver-mas-btn"[\s\S]*?<\/a>/i, "")
      const text = decodeHtmlEntities(stripTags(withoutVerMas)).replace(/\s+/g, " ").trim()
      description = text || null
    }

    results.push({ id, title, company, location, date, url, description })
  }

  return results
}

/**
 * Extract the trailing numeric job ID from any Chiletrabajos job URL/path shape:
 * `/trabajo/{slug}-{id}`, `/trabajo/{id}` (bare, confirmed to resolve the same page),
 * or `/trabajo/postular/{id}`.
 */
export function extractIdFromUrl(url: string): string | null {
  const match = url.match(/\/trabajo\/(?:postular\/)?[^/?#]*?(\d+)(?:[/?#].*)?$/)
  return match ? match[1] : null
}

// --- Detail-page JobPosting JSON-LD parsing ---

export interface JobPostingJsonLd {
  title?: string
  description?: string
  datePosted?: string
  validThrough?: string
  employmentType?: string
  industry?: string
  jobLocationType?: string
  hiringOrganization?: { name?: string }
  jobLocation?: {
    address?: {
      addressLocality?: string
      addressRegion?: string
    }
  }
  baseSalary?: {
    currency?: string
    value?: { Value?: string | number; unitText?: string }
  }
}

/**
 * The detail page embeds several `application/ld+json` blocks (an ItemList of
 * related postings plus the posting itself); find the one whose `@type` is
 * `JobPosting`. Far more reliable than regexing the rendered HTML.
 */
export function extractJobPostingJsonLd(html: string): JobPostingJsonLd | null {
  const scriptPattern = /<script[^>]+type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed && parsed["@type"] === "JobPosting") return parsed as JobPostingJsonLd
    } catch {
      continue
    }
  }
  return null
}

export function formatLocation(jobPosting: JobPostingJsonLd): string | null {
  if (jobPosting.jobLocationType === "TELECOMMUTE") return "Remoto"
  const address = jobPosting.jobLocation?.address
  if (!address) return null
  const parts = [address.addressLocality, address.addressRegion].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  TEMPORARY: "Temporal",
  CONTRACTOR: "Contrato",
  INTERN: "Práctica",
}

export function formatEmploymentType(raw: string | undefined): string | null {
  if (!raw) return null
  return EMPLOYMENT_TYPE_LABELS[raw] ?? raw
}

/** `"900.000 CLP/mes"`-style summary, or null when the posting withholds salary (baseSalary.value.Value is 0). */
export function formatSalary(jobPosting: JobPostingJsonLd): string | null {
  const raw = jobPosting.baseSalary?.value?.Value
  const amount = typeof raw === "string" ? parseInt(raw, 10) : raw
  if (!amount || amount <= 0) return null
  const currency = jobPosting.baseSalary?.currency ?? "CLP"
  return `${amount.toLocaleString("es-CL")} ${currency}/mes`
}
