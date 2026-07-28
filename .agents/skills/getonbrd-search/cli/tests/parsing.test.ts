import { describe, test, expect } from "bun:test";
import {
  toIsoDate,
  formatLocation,
  formatSalary,
  toResult,
  decodeHtmlEntities,
  stripTags,
  extractDivContent,
  cleanDescriptionHtml,
  type GetOnBrdJob,
} from "../src/helpers";

function job(overrides: Partial<GetOnBrdJob["attributes"]> = {}, id = "test-job-slug"): GetOnBrdJob {
  return {
    id,
    type: "jobs",
    attributes: {
      title: "Test Job",
      remote: false,
      remote_modality: "",
      countries: [],
      category_name: "Programación",
      min_salary: null,
      max_salary: null,
      published_at: 1785278452, // 2026-07-28T ...
      ...overrides,
    },
    links: { public_url: `https://www.getonbrd.com/jobs/${id}` },
  };
}

describe("toIsoDate", () => {
  test("converts unix seconds to YYYY-MM-DD", () => {
    expect(toIsoDate(1785278452)).toBe("2026-07-28");
  });

  test("returns null for null/undefined", () => {
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
  });
});

describe("formatLocation", () => {
  test("prefers 'City, Country' from expanded location_cities", () => {
    const j = job({ location_cities: { data: [{ id: "1", attributes: { name: "Santiago", country: "Chile" } }] } });
    expect(formatLocation(j)).toBe("Santiago, Chile");
  });

  test("falls back to the countries list when no city is expanded", () => {
    const j = job({ countries: ["CL", "DO"] });
    expect(formatLocation(j)).toBe("CL, DO");
  });

  test("falls back to 'Remote' when remote and no city/country data", () => {
    const j = job({ remote: true });
    expect(formatLocation(j)).toBe("Remote");
  });

  test("returns null when nothing is available", () => {
    expect(formatLocation(job())).toBeNull();
  });
});

describe("formatSalary", () => {
  test("formats a min-max range", () => {
    expect(formatSalary(1600, 2500)).toBe("1600-2500 USD");
  });

  test("formats a single bound (min only)", () => {
    expect(formatSalary(1600, null)).toBe("1600 USD");
  });

  test("formats a single bound (max only)", () => {
    expect(formatSalary(null, 2500)).toBe("2500 USD");
  });

  test("returns null when neither bound is set", () => {
    expect(formatSalary(null, null)).toBeNull();
  });
});

describe("toResult", () => {
  test("reshapes a job into the search-result contract shape", () => {
    const j = job({
      company: { data: { id: "c1", attributes: { name: "Acme SpA", web: "https://acme.cl" } } },
      seniority: { data: { attributes: { name: "Senior" } } },
    });
    const result = toResult(j);
    expect(result.id).toBe("test-job-slug");
    expect(result.title).toBe("Test Job");
    expect(result.company).toBe("Acme SpA");
    expect(result.companyUrl).toBe("https://acme.cl");
    expect(result.seniority).toBe("Senior");
    expect(result.category).toBe("Programación");
    expect(result.date).toBe("2026-07-28");
  });

  test("nulls out company/seniority when not expanded", () => {
    const result = toResult(job());
    expect(result.company).toBeNull();
    expect(result.seniority).toBeNull();
  });
});

describe("decodeHtmlEntities / stripTags", () => {
  test("decodes decimal and hex numeric entities", () => {
    expect(decodeHtmlEntities("Caf&#233; con &#xF1;")).toBe("Café con ñ");
  });

  test("decodes the basic named entity set (&amp;, &quot;, &nbsp;, ...)", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry &quot;show&quot;&nbsp;")).toBe('Tom & Jerry "show" ');
  });

  test("strips tags and trims", () => {
    expect(stripTags("  <b>Hola</b> mundo  ")).toBe("Hola mundo");
  });
});

describe("extractDivContent", () => {
  test("matches a class or id attribute (getonbrd's #job-body uses id, not class)", () => {
    expect(extractDivContent('<div id="job-body">Contenido</div>', "job-body")).toBe("Contenido");
    expect(extractDivContent('<div class="job-body">Contenido</div>', "job-body")).toBe("Contenido");
  });

  test("handles nested divs without truncating early", () => {
    const html = '<div id="job-body"><div>Uno</div><div>Dos</div></div>';
    expect(extractDivContent(html, "job-body")).toBe("<div>Uno</div><div>Dos</div>");
  });

  test("returns null when absent", () => {
    expect(extractDivContent("<div>no match</div>", "job-body")).toBeNull();
  });
});

describe("cleanDescriptionHtml", () => {
  test("converts block-level closing tags to newlines and strips remaining tags", () => {
    const html = "<p>Primer párrafo.</p><ul><li>Uno</li><li>Dos</li></ul>";
    const text = cleanDescriptionHtml(html);
    expect(text).toContain("Primer párrafo.");
    expect(text).toContain("Uno");
    expect(text).not.toContain("<");
  });

  test("returns null for null input", () => {
    expect(cleanDescriptionHtml(null)).toBeNull();
  });
});
