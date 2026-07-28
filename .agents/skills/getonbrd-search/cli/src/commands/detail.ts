import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { BASE_URL, htmlFetch, writeError, decodeHtmlEntities, stripTags, extractDivContent, cleanDescriptionHtml } from "../helpers.js"

interface DetailResult {
  id: string
  title: string
  company: string | null
  companyUrl: string | null
  location: string | null
  date: string | null
  seniority: string | null
  employmentType: string | null
  category: string | null
  salary: string | null
  applyUrl: string
  url: string
  description: string | null
}

/** Extract a Get on Board job slug from a bare slug or a `/jobs/<slug>` (or `/empleos/<cat>/<slug>`) URL. */
function extractIdFromUrl(url: string): string | null {
  const m = url.match(/\/(?:jobs|empleos)\/(?:[^/?#]+\/)?([^/?#]+)/)
  return m ? m[1] : null
}

function buildUrl(idOrUrl: string): { url: string; id: string } {
  if (idOrUrl.startsWith("http")) {
    const id = extractIdFromUrl(idOrUrl) ?? idOrUrl
    return { url: idOrUrl, id }
  }
  return { url: `${BASE_URL}/jobs/${idOrUrl}`, id: idOrUrl }
}

/**
 * Parse the public job-detail page. The page carries schema.org microdata
 * (`itemprop="title"`, `itemprop="jobLocation"`, etc.), which anchors this more
 * reliably than the generic-class regexes jobindex-search relies on.
 */
function parseDetailPage(html: string, url: string, fallbackId: string): DetailResult {
  const titleMatch = html.match(/<span itemprop="title">\s*([\s\S]*?)\s*<\/span>/)
  const title = titleMatch ? decodeHtmlEntities(stripTags(titleMatch[1])) : ""

  if (!title) {
    throw new Error("Failed to parse job listing HTML")
  }

  // Company name: anchored on the itemprop microdata rather than the old
  // "fake-hidden size-3" English "in {company}" span, which broke once the
  // site started rendering that span in Spanish ("en {company}").
  const companyNameMatch = html.match(/<strong itemprop="name">\s*([\s\S]*?)\s*<\/strong>/)
  const company = companyNameMatch ? decodeHtmlEntities(stripTags(companyNameMatch[1])) || null : null

  const companyUrlMatch = html.match(/class="gb-company-logo__link" href="([^"]+)"/)
  const companyUrl = companyUrlMatch ? `${BASE_URL}${companyUrlMatch[1]}` : null

  const jobLocationMatch = html.match(/itemprop="jobLocation"[\s\S]*?<\/h2>/)
  const jobLocationHtml = jobLocationMatch ? jobLocationMatch[0] : ""

  // City is only a link on-site/hybrid postings (path moved from /jobs/city/
  // to /empleos/ciudad/ in a site redesign); remote postings render "Remoto"
  // as plain text instead, with no anchor at all.
  let location: string | null = null
  const cityLinkMatch = jobLocationHtml.match(/<a[^>]+href="\/empleos\/ciudad\/[^"]+"[^>]*>\s*([\s\S]*?)\s*<\/a>/)
  if (cityLinkMatch) {
    location = decodeHtmlEntities(stripTags(cityLinkMatch[1])) || null
  } else if (/\bRemoto\b/i.test(jobLocationHtml)) {
    location = "Remoto"
  }

  let seniority: string | null = null
  const seniorityMatch = jobLocationHtml.match(/<span itemprop="qualifications">\s*([\s\S]*?)\s*<\/span>/)
  if (seniorityMatch) seniority = decodeHtmlEntities(stripTags(seniorityMatch[1])) || null

  // Category link also moved from /jobs/ to /empleos/ in the same redesign.
  let category: string | null = null
  const categoryMatch = jobLocationHtml.match(/<a[^>]+href="\/empleos\/(?!ciudad\/)[^"]+"[^>]*>\s*([\s\S]*?)\s*<\/a>/)
  if (categoryMatch) category = decodeHtmlEntities(stripTags(categoryMatch[1])) || null

  let employmentType: string | null = null
  const employmentMatch = html.match(/itemprop="employmentType">\s*([\s\S]*?)\s*<\/span>/)
  if (employmentMatch) employmentType = employmentMatch[1].trim() || null

  let date: string | null = null
  const timeMatch = html.match(/<time[^>]+datetime="([^"]+)"[^>]*itemprop="datePosted"/)
  if (timeMatch) date = timeMatch[1].slice(0, 10)

  // "Sueldo bruto" salary badge — present on some listings, absent on others
  // (not part of the microdata, so this is best-effort, not guaranteed).
  let salary: string | null = null
  const salaryMatch = html.match(/icon-money-bill[^>]*>[\s\S]*?<span>\s*([\s\S]*?)\s*<\/span>/)
  if (salaryMatch) salary = decodeHtmlEntities(stripTags(salaryMatch[1])) || null

  const jobBodyHtml = extractDivContent(html, "job-body")
  const description = cleanDescriptionHtml(jobBodyHtml)

  const canonicalMatch =
    html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) ||
    html.match(/property="og:url"[^>]+content="([^"]+)"/i)
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : url
  const id = extractIdFromUrl(canonicalUrl) ?? fallbackId

  return {
    id,
    title,
    company,
    companyUrl,
    location,
    date,
    seniority,
    employmentType,
    category,
    salary,
    applyUrl: `${BASE_URL}/jobs/${id}/applications/new`,
    url: canonicalUrl,
    description,
  }
}

export const detail = defineCommand({
  name: "detail",
  description: "Fetch full job listing detail by slug or URL",
  options: {
    format: option(z.enum(["json", "plain"]).default("json"), {
      description: "Output format: json, plain",
    }),
  },
  handler: async ({ positional, flags, signal }) => {
    if (signal.aborted) return

    const idArg = positional[0]
    if (!idArg) {
      writeError("Job slug or URL is required", "MISSING_REQUIRED")
      process.exit(1)
    }

    const { url, id } = buildUrl(idArg)

    try {
      const html = await htmlFetch(url)

      if (signal.aborted) return

      let data: DetailResult
      try {
        data = parseDetailPage(html, url, id)
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
        writeError(msg, "PARSE_ERROR")
        process.exit(1)
      }

      if (flags.format === "json") {
        console.log(JSON.stringify(data, null, 2))
      } else {
        outputPlain(data)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("Job not found")) {
        writeError("Job not found", "NOT_FOUND")
      } else {
        writeError(message, "API_ERROR")
      }
      process.exit(1)
    }
  },
})

function outputPlain(data: DetailResult): void {
  console.log(`id: ${data.id}`)
  console.log(`title: ${data.title}`)
  console.log(`company: ${data.company ?? "-"}`)
  console.log(`location: ${data.location ?? "-"}`)
  console.log(`date: ${data.date ?? "-"}`)
  console.log(`seniority: ${data.seniority ?? "-"}`)
  console.log(`employmentType: ${data.employmentType ?? "-"}`)
  console.log(`category: ${data.category ?? "-"}`)
  console.log(`salary: ${data.salary ?? "-"}`)
  console.log(`applyUrl: ${data.applyUrl}`)
  console.log(`url: ${data.url}`)
  console.log("")
  if (data.description) {
    console.log(data.description)
  }
}
