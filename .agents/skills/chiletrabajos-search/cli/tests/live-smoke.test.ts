import { describe, expect, test } from "bun:test";
import { parseJSON, runCLI } from "./helpers";

// Live network tests against the real chiletrabajos.cl site. Keep volume low —
// one search, one detail fetch. Verified manually on 2026-07-28 before this
// suite was written; see url-reference.md for the parsing anchors these depend on.

interface SearchResult {
  meta: { total: number; page: number; perPage: number; totalPages: number };
  results: Array<{ id: string; title: string; company: string | null; location: string | null; date: string | null; url: string; description: string | null }>;
}

describe("live: search", () => {
  test("returns real results for a realistic query", async () => {
    const result = await runCLI(["search", "-q", "desarrollador full stack", "--limit", "5"]);
    const data = parseJSON<SearchResult>(result);

    expect(data.results.length).toBeGreaterThan(0);
    const first = data.results[0];
    expect(first.id).toMatch(/^\d+$/);
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.url).toContain("chiletrabajos.cl/trabajo/");
  });
});

describe("live: detail", () => {
  test("fetches full detail for a job found via search", async () => {
    const searchResult = await runCLI(["search", "-q", "desarrollador full stack", "--limit", "1"]);
    const { results } = parseJSON<SearchResult>(searchResult);
    expect(results.length).toBeGreaterThan(0);

    const detailResult = await runCLI(["detail", results[0].id]);
    const detail = parseJSON<{ id: string; title: string; description: string | null; applyUrl: string }>(detailResult);

    expect(detail.id).toBe(results[0].id);
    expect(detail.title.length).toBeGreaterThan(0);
    expect(detail.applyUrl).toContain("/trabajo/postular/");
  });

  test("a bogus job ID resolves as not found", async () => {
    const result = await runCLI(["detail", "999999999999"]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toEqual({ error: "Job not found", code: "NOT_FOUND" });
  });
});
