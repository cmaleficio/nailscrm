import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  isAdminPath,
  proxyPathExclusionPattern,
  requiresAuth,
  shouldRenderTracking,
  trackingScopeFor,
  TRACKING_SCOPE_HEADER,
  TRACKING_SCOPE_PUBLIC,
} from "./tracking-scope";

describe("isAdminPath", () => {
  it("reconoce el dashboard y sus subrutas", () => {
    expect(isAdminPath("/dashboard")).toBe(true);
    expect(isAdminPath("/dashboard/")).toBe(true);
    expect(isAdminPath("/dashboard/clients")).toBe(true);
    expect(isAdminPath("/dashboard/admin-users")).toBe(true);
    expect(isAdminPath("/dashboard/inventory/kardex")).toBe(true);
  });

  it("no captura paginas publicas que empiezan igual por prefijo", () => {
    // Este es el motivo de comparar por frontera y no con startsPrefix pelado.
    expect(isAdminPath("/dashboardX")).toBe(false);
    expect(isAdminPath("/dashboard-preview")).toBe(false);
    expect(isAdminPath("/dashboard-public")).toBe(false);
  });

  it("deja fuera el resto de rutas", () => {
    expect(isAdminPath("/")).toBe(false);
    expect(isAdminPath("/book")).toBe(false);
    expect(isAdminPath("/login")).toBe(false);
    expect(isAdminPath("/profile")).toBe(false);
    expect(isAdminPath("/complete-registration")).toBe(false);
    expect(isAdminPath("/politicas")).toBe(false);
    expect(isAdminPath("/condiciones")).toBe(false);
    expect(isAdminPath("/review/abc")).toBe(false);
    expect(isAdminPath("/success")).toBe(false);
  });
});

describe("requiresAuth", () => {
  it("cubre dashboard y profile", () => {
    expect(requiresAuth("/dashboard")).toBe(true);
    expect(requiresAuth("/dashboard/balances")).toBe(true);
    expect(requiresAuth("/profile")).toBe(true);
    expect(requiresAuth("/profile/")).toBe(true);
  });

  it("no exige sesion en las paginas publicas", () => {
    expect(requiresAuth("/")).toBe(false);
    expect(requiresAuth("/book")).toBe(false);
    expect(requiresAuth("/login")).toBe(false);
    expect(requiresAuth("/complete-registration")).toBe(false);
  });
});

describe("trackingScopeFor", () => {
  it("marca publico todo lo que no es dashboard, incluido el portal del cliente", () => {
    expect(trackingScopeFor("/")).toBe(TRACKING_SCOPE_PUBLIC);
    expect(trackingScopeFor("/book")).toBe(TRACKING_SCOPE_PUBLIC);
    expect(trackingScopeFor("/profile")).toBe(TRACKING_SCOPE_PUBLIC);
    expect(trackingScopeFor("/complete-registration")).toBe(TRACKING_SCOPE_PUBLIC);
    expect(trackingScopeFor("/review/xyz")).toBe(TRACKING_SCOPE_PUBLIC);
  });

  it("devuelve null en el dashboard para que el layout no monte nada", () => {
    expect(trackingScopeFor("/dashboard")).toBeNull();
    expect(trackingScopeFor("/dashboard/clients")).toBeNull();
  });
});

describe("contrato del header", () => {
  it("usa un nombre de header no suceptible a colision con otro middleware", () => {
    expect(TRACKING_SCOPE_HEADER).toBe("x-tracking-scope");
    expect(TRACKING_SCOPE_PUBLIC).toBe("public");
  });
});

/**
 * Estas dos pruebas cubren el gate del lado del layout raíz, que es la parte
 * que decide si el dashboard lleva etiquetas. El proxy no se puede ejercitar
 * desde vitest (importa next-auth y necesita un request real), pero la regla
 * que el layout aplica sobre el header sí es pura.
 */
describe("shouldRenderTracking (gate del layout raiz)", () => {
  it("monta las etiquetas solo con el scope publico", () => {
    expect(shouldRenderTracking(TRACKING_SCOPE_PUBLIC)).toBe(true);
  });

  it("no monta nada cuando el header no viene (como en el dashboard)", () => {
    expect(shouldRenderTracking(null)).toBe(false);
    expect(shouldRenderTracking(undefined)).toBe(false);
    expect(shouldRenderTracking("")).toBe(false);
  });

  it("rechaza cualquier otro valor en vez de asumir publico", () => {
    // Fallar cerrado: un header inesperado o manipulado no debe abrir el tag
    // en una pagina que no lo pidio.
    expect(shouldRenderTracking("admin")).toBe(false);
    expect(shouldRenderTracking("PUBLIC")).toBe(false);
    expect(shouldRenderTracking("1")).toBe(false);
  });

  it("el proxy y el layout coinciden en la frontera de /dashboard", () => {
    for (const p of ["/dashboard", "/dashboard/clients", "/dashboard/admin-users"]) {
      const scope = trackingScopeFor(p);
      const rendered = shouldRenderTracking(scope);
      expect(rendered).toBe(false);
    }
    for (const p of ["/", "/book", "/profile", "/complete-registration"]) {
      const scope = trackingScopeFor(p);
      expect(shouldRenderTracking(scope)).toBe(true);
    }
  });
});

describe("proxyPathExclusionPattern", () => {
  // El patrón es un lookahead de path-to-regexp, pero su interior también es un
  // regex válido, así que se puede evaluar en node sin levantar Next.
  const excluded = new RegExp(`^${proxyPathExclusionPattern()}$`);

  it("saca del proxy los archivos que los rastreadores piden en volumen", () => {
    for (const p of ["/robots.txt", "/sitemap.xml"]) {
      expect(excluded.test(p), `${p} no debería pasar por el proxy`).toBe(false);
    }
  });

  it("mantiene fuera api, assets y binarios", () => {
    for (const p of [
      "/api/gallery",
      "/api/auth/callback/google",
      "/_next/static/chunk.js",
      "/uploads/gallery/foto.webp",
      "/favicon.ico",
    ]) {
      expect(excluded.test(p), `${p} no debería pasar por el proxy`).toBe(false);
    }
  });

  it("sigue dejando pasar las páginas, para que lleven etiquetas", () => {
    for (const p of ["/", "/book", "/condiciones", "/politicas", "/login", "/success"]) {
      expect(excluded.test(p), `${p} debería pasar por el proxy`).toBe(true);
    }
  });

  it("no confunde un asset con una página que comparte el prefijo", () => {
    // El lookahead no ancla el final del segmento, así que esto también queda
    // fuera. No molesta: no existe una página /apiario.
    expect(excluded.test("/apiario")).toBe(false);
  });

  it("el literal de src/proxy.ts no se desincroniza de la lista", () => {
    // Next exige strings estáticos en `config.matcher`, así que el lookahead
    // está escrito a mano en el proxy y no se puede derivar de la lista. Este
    // test ata las dos mitades: si alguien agrega un segmento a
    // PROXY_EXCLUDED_SEGMENTS y olvida el literal, el build sigue pasando pero
    // el proxy volvería a ejecutar auth() en cada request.
    const source = readFileSync(
      new URL("../proxy.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain(JSON.stringify(proxyPathExclusionPattern()).slice(1, -1));
  });
});
