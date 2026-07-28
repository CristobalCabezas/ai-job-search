import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { BASE_URL, apiFetch, toResult, writeError, type JobResult, type SearchResponse } from "../helpers.js"

const EXPAND = JSON.stringify(["company", "location_cities", "modality", "seniority"])

export const search = defineCommand({
  name: "search",
  description: "Search for job listings on Get on Board (getonbrd.com)",
  options: {
    query: option(z.string().optional(), {
      short: "q",
      description: "Keyword search query (e.g. desarrollador backend, product manager)",
    }),
    country: option(z.string().default("CL"), {
      description: 'ISO-3166 alpha-2 country code, or "all" for every Get on Board market',
    }),
    page: option(z.coerce.number().int().min(1).default(1), {
      description: "Page number (1-indexed)",
    }),
    jobage: option(z.coerce.number().default(9999), {
      description: "Max age of posting in days, filtered client-side on the fetched page: 1, 7, 14, 30, or 9999 (all)",
    }),
    remote: option(z.enum(["true", "false"]).optional(), {
      description: "Filter by remote status: true or false",
    }),
    limit: option(z.coerce.number().int().min(1).max(120).default(20), {
      description: "Results per page (maps to the API's per_page, max 120)",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ flags, signal }) => {
    if (signal.aborted) return

    const params: Record<string, string> = {
      page: String(flags.page),
      per_page: String(flags.limit),
      lang: "es",
      expand: EXPAND,
    }
    if (flags.query) params.query = flags.query
    if (flags.country.toLowerCase() !== "all") params.country_code = flags.country.toUpperCase()
    if (flags.remote) params.remote = flags.remote

    try {
      const res = await apiFetch<SearchResponse>("/api/v0/search/jobs", params)

      let results = res.data.map(toResult)

      if (flags.jobage < 9999) {
        const cutoff = Date.now() - flags.jobage * 24 * 60 * 60 * 1000
        results = results.filter((r) => r.date === null || new Date(r.date).getTime() >= cutoff)
      }

      const output = {
        meta: {
          count: results.length,
          page: res.meta.page,
          perPage: res.meta.per_page,
          totalPages: res.meta.total_pages,
        },
        results,
      }

      if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2))
      } else if (flags.format === "table") {
        outputTable(results)
      } else {
        outputPlain(results)
      }
    } catch (err) {
      writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      process.exit(1)
    }
  },
})

function outputTable(results: JobResult[]): void {
  console.log("id (slug)                                     title                                    company              location")
  for (const r of results) {
    const id = r.id.substring(0, 44).padEnd(45)
    const title = r.title.substring(0, 40).padEnd(40)
    const company = (r.company ?? "-").substring(0, 20).padEnd(20)
    const location = r.location ?? "-"
    console.log(`${id} ${title} ${company} ${location}`)
  }
  console.log(`\n${BASE_URL}`)
}

function outputPlain(results: JobResult[]): void {
  for (const r of results) {
    console.log(`id: ${r.id}`)
    console.log(`title: ${r.title}`)
    console.log(`company: ${r.company ?? "-"}`)
    console.log(`location: ${r.location ?? "-"}`)
    console.log(`date: ${r.date ?? "-"}`)
    console.log(`remote: ${r.remote}`)
    console.log(`seniority: ${r.seniority ?? "-"}`)
    console.log(`salary: ${r.salary ?? "-"}`)
    console.log(`url: ${r.url}`)
    console.log("")
  }
}
