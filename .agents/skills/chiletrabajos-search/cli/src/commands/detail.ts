import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import {
  BASE_URL,
  extractIdFromUrl,
  extractJobPostingJsonLd,
  formatEmploymentType,
  formatLocation,
  formatSalary,
  htmlFetch,
  writeError,
} from "../helpers.js"

interface DetailResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  deadline: string | null
  employmentType: string | null
  category: string | null
  salary: string | null
  applyUrl: string
  url: string
  description: string | null
}

function buildUrl(idOrUrl: string): { url: string; id: string } {
  if (idOrUrl.startsWith("http")) {
    const id = extractIdFromUrl(idOrUrl) ?? idOrUrl
    return { url: idOrUrl, id }
  }
  return { url: `${BASE_URL}/trabajo/${idOrUrl}`, id: idOrUrl }
}

function parseDetailPage(html: string, url: string, fallbackId: string): DetailResult {
  const jobPosting = extractJobPostingJsonLd(html)
  if (!jobPosting || !jobPosting.title) {
    throw new Error("Failed to parse job listing HTML")
  }

  const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : url
  const id = extractIdFromUrl(canonicalUrl) ?? fallbackId

  return {
    id,
    title: jobPosting.title,
    company: jobPosting.hiringOrganization?.name ?? null,
    location: formatLocation(jobPosting),
    date: jobPosting.datePosted ? jobPosting.datePosted.slice(0, 10) : null,
    deadline: jobPosting.validThrough ? jobPosting.validThrough.slice(0, 10) : null,
    employmentType: formatEmploymentType(jobPosting.employmentType),
    category: jobPosting.industry ?? null,
    salary: formatSalary(jobPosting),
    applyUrl: `${BASE_URL}/trabajo/postular/${id}`,
    url: canonicalUrl,
    description: jobPosting.description ? jobPosting.description.replace(/\r\n/g, "\n").trim() : null,
  }
}

export const detail = defineCommand({
  name: "detail",
  description: "Fetch full job listing detail by ID or URL",
  options: {
    format: option(z.enum(["json", "plain"]).default("json"), {
      description: "Output format: json, plain",
    }),
  },
  handler: async ({ positional, flags, signal }) => {
    if (signal.aborted) return

    const idArg = positional[0]
    if (!idArg) {
      writeError("Job ID or URL is required", "MISSING_REQUIRED")
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
  console.log(`deadline: ${data.deadline ?? "-"}`)
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
