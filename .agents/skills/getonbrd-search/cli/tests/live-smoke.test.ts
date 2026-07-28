import { describe, expect, test } from "bun:test";
import { parseJSON, runCLI } from "./helpers";

// Live network tests against the real getonbrd.com site. Keep volume low — one
// search, one detail fetch. The detail assertions on company/location/category
// exist specifically to catch a repeat of the 2026-07-28 regression: a site
// redesign moved several anchors (/jobs/city/ -> /empleos/ciudad/, an
// English-only "in {company}" span -> itemprop="name") and silently nulled
// those fields until the parser was updated to match. See url-reference.md.

interface SearchResult {
  meta: { count: number; page: number; perPage: number; totalPages: number };
  results: Array<{ id: string; title: string; company: string | null; location: string | null; date: string | null; url: string }>;
}

describe("live: search", () => {
  test("returns real results for a realistic query", async () => {
    const result = await runCLI(["search", "-q", "desarrollador", "--limit", "5"]);
    const data = parseJSON<SearchResult>(result);

    expect(data.results.length).toBeGreaterThan(0);
    const first = data.results[0];
    expect(first.id.length).toBeGreaterThan(0);
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.url).toContain("getonbrd.com/jobs/");
  });
});

describe("live: detail", () => {
  test("fetches full detail with company and location populated (regression check)", async () => {
    const searchResult = await runCLI(["search", "-q", "desarrollador", "--limit", "1"]);
    const { results } = parseJSON<SearchResult>(searchResult);
    expect(results.length).toBeGreaterThan(0);

    const detailResult = await runCLI(["detail", results[0].id]);
    const detail = parseJSON<{
      id: string;
      title: string;
      company: string | null;
      location: string | null;
      category: string | null;
      description: string | null;
      applyUrl: string;
    }>(detailResult);

    expect(detail.title.length).toBeGreaterThan(0);
    expect(detail.company).not.toBeNull();
    expect(detail.location).not.toBeNull();
    expect(detail.category).not.toBeNull();
    expect(detail.applyUrl).toContain("/applications/new");
  });

  test("a bogus job slug resolves as not found", async () => {
    const result = await runCLI(["detail", "this-slug-does-not-exist-9999999"]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("NOT_FOUND");
  });
});
