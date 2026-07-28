import { describe, test, expect } from "bun:test";
import {
  parseJobCards,
  parseTotal,
  parseSpanishDate,
  extractIdFromUrl,
  lookupCityId,
  extractJobPostingJsonLd,
  formatLocation,
  formatSalary,
  formatEmploymentType,
} from "../src/helpers";

// Minimal job-item markup mirroring the real cards on chiletrabajos.cl/trabajos/informatica —
// verified live on 2026-07-28. Card boundary is the literal `<div class="job-item ...">`.
function card(id: string, title: string, company = "Acme SpA", city = "Santiago"): string {
  return `<div class="job-item with-thumb destacado no-hover ">
    <div class="col-sm-12 px-0" onclick="window.location.href='https://www.chiletrabajos.cl/trabajo/${title.toLowerCase().replace(/\s+/g, "-")}-${id}';">
      <h2 class="title overflow-hidden">
        <a href="https://www.chiletrabajos.cl/trabajo/${title.toLowerCase().replace(/\s+/g, "-")}-${id}" class="font-weight-bold">${title}</a>
      </h2>
      <h3 class="meta">
        ${company},
        <a href="https://www.chiletrabajos.cl/ciudad/${city.toLowerCase()}.html">${city}</a>
      </h3>
      <h3 class="meta"><a href='#'><i class="far fa-calendar"></i> 28 de  Julio de 2026</a></h3>
    </div>
    <div class="col-sm-12 px-0 mt-2">
      <p class="description" style="word-break: break-all;">
        Descripción de prueba&#8230;                            <a href="#" class="ver-mas-btn">Ver m&aacute;s</a>
      </p>
    </div>
  </div>`;
}

describe("parseJobCards", () => {
  test("extracts id, title, company, location, date, url, description from a card", () => {
    const [c] = parseJobCards(card("3807840", "Desarrollador Full Stack"));
    expect(c.id).toBe("3807840");
    expect(c.title).toBe("Desarrollador Full Stack");
    expect(c.company).toBe("Acme SpA");
    expect(c.location).toBe("Santiago");
    expect(c.date).toBe("2026-07-28");
    expect(c.url).toContain("3807840");
    expect(c.description).toBe("Descripción de prueba…");
  });

  test("parses multiple cards without one bleeding into the next", () => {
    const html = card("111", "Backend Engineer", "Empresa Uno", "Santiago") + card("222", "Frontend Engineer", "Empresa Dos", "Valparaiso");
    const results = parseJobCards(html);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("111");
    expect(results[0].company).toBe("Empresa Uno");
    expect(results[1].id).toBe("222");
    expect(results[1].company).toBe("Empresa Dos");
  });

  test("decodes HTML entities in the title", () => {
    const [c] = parseJobCards(card("333", "Ingeniero &amp; Analista"));
    expect(c.title).toBe("Ingeniero & Analista");
  });

  test("skips a chunk with no title link instead of throwing", () => {
    const malformed = `<div class="job-item with-thumb destacado no-hover "><p>no title here</p></div>`;
    expect(parseJobCards(malformed)).toEqual([]);
  });
});

describe("parseTotal", () => {
  test("parses the count from the Spanish meta description", () => {
    expect(parseTotal("Se han encontrado 1114 ofertas de trabajo en la categoría")).toBe(1114);
  });

  test("parses the capitalized variant from search-result pages", () => {
    expect(parseTotal("Se han encontrado 44 Ofertas de trabajo de desarrollador")).toBe(44);
  });

  test("returns 0 when the phrase is absent", () => {
    expect(parseTotal("<html>no match here</html>")).toBe(0);
  });
});

describe("parseSpanishDate", () => {
  test("parses a date with the double-space quirk after the first 'de'", () => {
    expect(parseSpanishDate("28 de  Julio de 2026")).toBe("2026-07-28");
  });

  test("parses a date with single spacing too", () => {
    expect(parseSpanishDate("3 de Enero de 2026")).toBe("2026-01-03");
  });

  test("pads single-digit days", () => {
    expect(parseSpanishDate("3 de Enero de 2026")).toBe("2026-01-03");
  });

  test("returns null for unparseable input", () => {
    expect(parseSpanishDate("not a date")).toBeNull();
  });
});

describe("extractIdFromUrl", () => {
  test("extracts the trailing numeric id from a slug URL", () => {
    expect(extractIdFromUrl("https://www.chiletrabajos.cl/trabajo/analistas-qa-3867873")).toBe("3867873");
  });

  test("extracts the id from a bare-id URL (no slug)", () => {
    expect(extractIdFromUrl("https://www.chiletrabajos.cl/trabajo/3807840")).toBe("3807840");
  });

  test("extracts the id from a postular URL", () => {
    expect(extractIdFromUrl("https://www.chiletrabajos.cl/trabajo/postular/3807840")).toBe("3807840");
  });

  test("returns null when no id is present", () => {
    expect(extractIdFromUrl("https://www.chiletrabajos.cl/encuentra-un-empleo")).toBeNull();
  });
});

describe("lookupCityId", () => {
  test("resolves an accented display name to its numeric id", () => {
    expect(lookupCityId("Valparaíso")).toBe("1014");
  });

  test("resolves a multi-word city name", () => {
    expect(lookupCityId("Puerto Montt")).toBe("1043");
  });

  test("is case-insensitive", () => {
    expect(lookupCityId("SANTIAGO")).toBe("1022");
  });

  test("returns null for an unknown city", () => {
    expect(lookupCityId("Marte")).toBeNull();
  });
});

describe("extractJobPostingJsonLd / formatLocation / formatSalary / formatEmploymentType", () => {
  function detailHtml(jobPosting: object): string {
    return `<html><head>
      <script type="application/ld+json">{"@context":"https://schema.org/","@type":"ItemList","numberOfItems":1,"itemListElement":[]}</script>
      <script type='application/ld+json'>${JSON.stringify(jobPosting)}</script>
    </head></html>`;
  }

  test("finds the JobPosting block among several ld+json scripts", () => {
    const jp = extractJobPostingJsonLd(detailHtml({ "@type": "JobPosting", title: "Test Job" }));
    expect(jp?.title).toBe("Test Job");
  });

  test("returns null when no JobPosting block is present", () => {
    expect(extractJobPostingJsonLd("<html><body>no json-ld</body></html>")).toBeNull();
  });

  test("formatLocation returns 'Remoto' for TELECOMMUTE jobs", () => {
    expect(formatLocation({ jobLocationType: "TELECOMMUTE" })).toBe("Remoto");
  });

  test("formatLocation builds 'city, region' from the address", () => {
    expect(
      formatLocation({ jobLocation: { address: { addressLocality: "Santiago", addressRegion: "RM" } } })
    ).toBe("Santiago, RM");
  });

  test("formatLocation returns null when neither is present", () => {
    expect(formatLocation({})).toBeNull();
  });

  test("formatSalary formats a numeric string value", () => {
    expect(formatSalary({ baseSalary: { currency: "CLP", value: { Value: "900000" } } })).toBe("900.000 CLP/mes");
  });

  test("formatSalary returns null when the posting withholds salary (Value: 0)", () => {
    expect(formatSalary({ baseSalary: { currency: "CLP", value: { Value: 0 } } })).toBeNull();
  });

  test("formatSalary returns null when baseSalary is absent", () => {
    expect(formatSalary({})).toBeNull();
  });

  test("formatEmploymentType maps known schema.org enums to Spanish labels", () => {
    expect(formatEmploymentType("FULL_TIME")).toBe("Full-time");
    expect(formatEmploymentType("PART_TIME")).toBe("Part-time");
  });

  test("formatEmploymentType passes through unknown values instead of dropping them", () => {
    expect(formatEmploymentType("VOLUNTEER")).toBe("VOLUNTEER");
  });

  test("formatEmploymentType returns null when absent", () => {
    expect(formatEmploymentType(undefined)).toBeNull();
  });
});
