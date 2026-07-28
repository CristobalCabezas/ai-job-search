import { describe, expect, test } from "bun:test";
import { runCLI } from "./helpers";

describe("Chiletrabajos CLI error contract", () => {
  test("detail without an ID fails before making a request", async () => {
    const result = await runCLI(["detail"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      error: "Job ID or URL is required",
      code: "MISSING_REQUIRED",
    });
  });

  test("search with an unknown --location fails before making a request", async () => {
    const result = await runCLI(["search", "--location", "Marte"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    const error = JSON.parse(result.stderr);
    expect(error.code).toBe("INVALID_LOCATION");
    expect(error.error).toContain("Marte");
  });

  test("an invalid numeric option fails before making a request", async () => {
    const result = await runCLI(["search", "--page", "not-a-number"]);
    const error = JSON.parse(result.stderr);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(error.ok).toBe(false);
    expect(error.error.kind).toBe("validation");
    expect(error.error.option).toBe("page");
    expect(error.error.message).toContain("Expected number");
  });

  test("an invalid --sort value fails schema validation", async () => {
    const result = await runCLI(["search", "--sort", "popularity"]);
    const error = JSON.parse(result.stderr);

    expect(result.exitCode).toBe(1);
    expect(error.ok).toBe(false);
    expect(error.error.kind).toBe("validation");
    expect(error.error.option).toBe("sort");
  });
});
