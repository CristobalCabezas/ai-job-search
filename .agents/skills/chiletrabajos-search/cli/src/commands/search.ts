import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { BASE_URL, CATEGORY_ID, htmlFetch, lookupCityId, parseJobCards, parseTotal, writeError, type JobCard } from "../helpers.js"

const PAGE_SIZE = 30

// fecha buckets, smallest days-cutoff first. The portal has no arbitrary "last N
// days" param — only these discrete buckets — so --jobage picks the first bucket
// whose cutoff covers the request; jobage > 30 (including the 9999 default) applies
// no date filter at all.
const JOBAGE_BUCKETS: Array<{ days: number; fecha: string }> = [
  { days: 1, fecha: "1" },
  { days: 2, fecha: "2" },
  { days: 3, fecha: "3" },
  { days: 6, fecha: "4" },
  { days: 7, fecha: "5" },
  { days: 30, fecha: "6" },
]

function jobageToFecha(jobage: number): string | null {
  const bucket = JOBAGE_BUCKETS.find((b) => jobage <= b.days)
  return bucket ? bucket.fecha : null
}

export const search = defineCommand({
  name: "search",
  description: "Search for Informática / Telecomunicaciones job listings on Chiletrabajos.cl",
  options: {
    query: option(z.string().optional(), {
      short: "q",
      description: "Keyword search query (e.g. desarrollador full stack, analista de datos)",
    }),
    location: option(z.string().optional(), {
      short: "l",
      description: "City name (e.g. Santiago, Valparaíso, Puerto Montt) — maps to the portal's location filter",
    }),
    page: option(z.coerce.number().int().min(1).default(1), {
      description: "Page number (1-indexed)",
    }),
    jobage: option(z.coerce.number().default(9999), {
      description: "Max age of posting in days: 1, 2, 3, 6, 7, 30, or 9999 (all, default) — snaps to the nearest supported bucket",
    }),
    sort: option(z.enum(["score", "date"]).default("date"), {
      description: "Sort order: date (newest first, the portal's own default) or score (relevance)",
    }),
    limit: option(z.coerce.number().int().min(1).optional(), {
      description: "Cap total results returned by the CLI (client-side)",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ flags, signal }) => {
    if (signal.aborted) return

    const params = new URLSearchParams({ categoria: CATEGORY_ID })
    if (flags.query) params.set("2", flags.query)
    if (flags.location) {
      const cityId = lookupCityId(flags.location)
      if (!cityId) {
        writeError(`Unknown location "${flags.location}" — pass a Chilean city name, or include it in --query instead`, "INVALID_LOCATION")
        process.exit(1)
      }
      params.set("13", cityId)
    }
    const fecha = jobageToFecha(flags.jobage)
    if (fecha) params.set("fecha", fecha)
    params.set("f", flags.sort === "date" ? "2" : "1")

    const offset = (flags.page - 1) * PAGE_SIZE
    const path = offset > 0 ? `/encuentra-un-empleo/${offset}` : "/encuentra-un-empleo"

    try {
      const html = await htmlFetch(`${BASE_URL}${path}?${params.toString()}`)

      if (signal.aborted) return

      const total = parseTotal(html)
      let results = parseJobCards(html)

      if (flags.limit !== undefined) {
        results = results.slice(0, flags.limit)
      }

      const output = {
        meta: {
          total,
          page: flags.page,
          perPage: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE),
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

function outputTable(results: JobCard[]): void {
  console.log("id        title                                    company              location")
  for (const r of results) {
    const id = r.id.padEnd(9)
    const title = r.title.substring(0, 40).padEnd(40)
    const company = (r.company ?? "-").substring(0, 20).padEnd(20)
    const location = r.location ?? "-"
    console.log(`${id} ${title} ${company} ${location}`)
  }
}

function outputPlain(results: JobCard[]): void {
  for (const r of results) {
    console.log(`id: ${r.id}`)
    console.log(`title: ${r.title}`)
    console.log(`company: ${r.company ?? "-"}`)
    console.log(`location: ${r.location ?? "-"}`)
    console.log(`date: ${r.date ?? "-"}`)
    console.log(`url: ${r.url}`)
    if (r.description) console.log(`description: ${r.description}`)
    console.log("")
  }
}
