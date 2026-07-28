import { afterEach, describe, expect, test } from "bun:test";
import { apiFetch, htmlFetch } from "../src/helpers";

// A stalled upstream connection (accepted socket, no response) would otherwise
// hang the CLI forever - fetch has no default timeout. Assert both request
// wrappers carry an AbortSignal timeout.
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("request timeout", () => {
  test("apiFetch passes an AbortSignal timeout to fetch", async () => {
    let init: RequestInit | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, i?: RequestInit) => {
      init = i;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await apiFetch("/api/v0/search/jobs", {});
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("htmlFetch passes an AbortSignal timeout to fetch", async () => {
    let init: RequestInit | undefined;
    globalThis.fetch = (async (_url: string | URL | Request, i?: RequestInit) => {
      init = i;
      return new Response("<html></html>", { status: 200 });
    }) as unknown as typeof fetch;

    await htmlFetch("https://www.getonbrd.com/jobs/x");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
