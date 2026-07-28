import { describe, expect, test } from "bun:test";
import { runCLI } from "./helpers";

// All cases fail schema validation (or a guard) before any network request, so
// the suite is network-free.

function expectValidationError(result: { exitCode: number; stdout: string; stderr: string }, option: string) {
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  const error = JSON.parse(result.stderr);
  expect(error.ok).toBe(false);
  expect(error.error.kind).toBe("validation");
  expect(error.error.option).toBe(option);
}

describe("Chiletrabajos CLI flag validation", () => {
  test("--limit=-1 is rejected instead of silently dropping the last result", async () => {
    const result = await runCLI(["search", "--limit=-1"]);
    expectValidationError(result, "limit");
  });

  test("--limit=0 is rejected", async () => {
    const result = await runCLI(["search", "--limit=0"]);
    expectValidationError(result, "limit");
  });

  test("--limit=1.5 is rejected as non-integer", async () => {
    const result = await runCLI(["search", "--limit=1.5"]);
    expectValidationError(result, "limit");
  });

  test("--page=0 is rejected on the 1-indexed portal", async () => {
    const result = await runCLI(["search", "--page=0"]);
    expectValidationError(result, "page");
  });
});
