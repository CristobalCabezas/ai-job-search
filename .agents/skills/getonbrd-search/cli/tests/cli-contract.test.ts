import { describe, expect, test } from "bun:test";
import { runCLI } from "./helpers";

describe("Get on Board CLI error contract", () => {
  test("detail without a slug/URL fails before making a request", async () => {
    const result = await runCLI(["detail"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      error: "Job slug or URL is required",
      code: "MISSING_REQUIRED",
    });
  });

  test("an invalid numeric option fails before making a request", async () => {
    const result = await runCLI(["search", "--page", "not-a-number"]);
    const error = JSON.parse(result.stderr);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(error.ok).toBe(false);
    expect(error.error.kind).toBe("validation");
    expect(error.error.option).toBe("page");
  });

  test("an invalid --remote value fails schema validation", async () => {
    const result = await runCLI(["search", "--remote", "maybe"]);
    const error = JSON.parse(result.stderr);

    expect(result.exitCode).toBe(1);
    expect(error.ok).toBe(false);
    expect(error.error.kind).toBe("validation");
    expect(error.error.option).toBe("remote");
  });

  test("--limit above the API's max (120) fails schema validation", async () => {
    const result = await runCLI(["search", "--limit", "500"]);
    const error = JSON.parse(result.stderr);

    expect(result.exitCode).toBe(1);
    expect(error.ok).toBe(false);
    expect(error.error.kind).toBe("validation");
    expect(error.error.option).toBe("limit");
  });
});
