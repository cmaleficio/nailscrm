import { describe, expect, it } from "vitest";
import {
  PUBLIC_INDEXABLE_ROUTES,
  ROBOTS_ALWAYS_ALLOWED_PATHS,
  ROBOTS_DISALLOWED_PATHS,
  buildRobots,
  buildSitemap,
  isDisallowedByPrefix,
} from "./seo";

const ORIGIN = "https://example.com";

describe("invariante: ninguna ruta indexable puede estar bloqueada", () => {
  it("no haycho de robots.txt alcanza a una ruta del sitemap", () => {
    for (const route of PUBLIC_INDEXABLE_ROUTES) {
      const blocked = ROBOTS_DISALLOWED_PATHS.filter((prefix) =>
        isDisallowedByPrefix(route.path, [prefix])
      );
      expect(blocked, `${route.path} está bloqueada por ${blocked.join(", ")}`).toEqual([]);
    }
  });

  it("/uploads y /_next no aparecen en los bloqueos", () => {
    for (const path of ROBOTS_ALWAYS_ALLOWED_PATHS) {
      expect(ROBOTS_DISALLOWED_PATHS).not.toContain(path);
      // Ni como prefijo más corto que se coma el subárbol.
      expect(
        ROBOTS_DISALLOWED_PATHS.filter((prefix) => path.startsWith(prefix))
      ).toEqual([]);
    }
  });
});

describe("buildSitemap", () => {
  const sitemap = buildSitemap(ORIGIN);

  it("devuelve las 4 rutas públicas con valor SEO", () => {
    expect(sitemap.map((entry) => entry.url)).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/book`,
      `${ORIGIN}/condiciones`,
      `${ORIGIN}/politicas`,
    ]);
  });

  it("emite URLs absolutas, sin duplicados y sin barra doble", () => {
    const urls = sitemap.map((entry) => entry.url);
    for (const url of urls) {
      expect(url.startsWith(`${ORIGIN}/`)).toBe(true);
      // Un único "//": el del protocolo. El resto sería un join mal armado.
      expect(url.match(/\/\//g)?.length).toBe(1);
    }
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("no incluye nada que requiera inicio de sesión", () => {
    const serialized = JSON.stringify(sitemap);
    for (const privatePath of ["/dashboard", "/profile", "/complete-registration", "/review/", "/api/"]) {
      expect(serialized).not.toContain(privatePath);
    }
  });

  it("respeta el origen que le pasen (no hardcodea el dominio)", () => {
    expect(buildSitemap("http://localhost:3001")[0].url).toBe("http://localhost:3001/");
  });
});

describe("buildRobots", () => {
  const robots = buildRobots(ORIGIN);
  // `MetadataRoute.Robots["rules"]` es objeto o array según Next; aquí siempre
  // emitimos uno solo.
  const [rule] = Array.isArray(robots.rules) ? robots.rules : [robots.rules];

  it("permite todo y bloquea la lista de prefijos privados", () => {
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(ROBOTS_DISALLOWED_PATHS);
  });

  it("declara un único sitemap con la URL del origen", () => {
    expect(robots.sitemap).toBe(`${ORIGIN}/sitemap.xml`);
  });

  it("bloquea las tres familias de rutas que no son públicas", () => {
    // Admin.
    expect(isDisallowedByPrefix("/dashboard", ROBOTS_DISALLOWED_PATHS)).toBe(true);
    expect(isDisallowedByPrefix("/dashboard/balances", ROBOTS_DISALLOWED_PATHS)).toBe(true);
    // Portal del cliente.
    expect(isDisallowedByPrefix("/profile", ROBOTS_DISALLOWED_PATHS)).toBe(true);
    expect(isDisallowedByPrefix("/complete-registration", ROBOTS_DISALLOWED_PATHS)).toBe(true);
    // Token de reseña.
    expect(isDisallowedByPrefix("/review/abc-123", ROBOTS_DISALLOWED_PATHS)).toBe(true);
  });

  it("deja rastreables las fotos del muro y los assets de Next", () => {
    expect(isDisallowedByPrefix("/uploads/gallery/foto.webp", ROBOTS_DISALLOWED_PATHS)).toBe(false);
    expect(isDisallowedByPrefix("/_next/static/chunk.js", ROBOTS_DISALLOWED_PATHS)).toBe(false);
  });
});

describe("isDisallowedByPrefix", () => {
  it("es prefijo literal, sin comodines", () => {
    expect(isDisallowedByPrefix("/dashboards", ["/dashboard"])).toBe(true);
    expect(isDisallowedByPrefix("/logins", ["/login"])).toBe(true);
  });

  it("no alcanza la raíz con un prefijo de subárbol", () => {
    // `/` no empieza por `/dashboard` ni por `/api/` (con barra final), así que
    // el home nunca queda bloqueado por accidente.
    expect(isDisallowedByPrefix("/", ["/dashboard", "/api/"])).toBe(false);
    expect(isDisallowedByPrefix("/", ROBOTS_DISALLOWED_PATHS)).toBe(false);
  });

  it("un prefijo más corto sí alcanza al subárbol, como en Google", () => {
    // Google hace match literal de prefijo: `Disallow: /bo` bloquearía /book.
    // Por eso los prefijos de la lista son explícitos y no abreviados.
    expect(isDisallowedByPrefix("/book", ["/bo"])).toBe(true);
    expect(isDisallowedByPrefix("/dashboard/legal", ["/dashboard"])).toBe(true);
  });
});
