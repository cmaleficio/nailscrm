import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * El guard de cada endpoint está escrito a mano: unas 40 rutas repiten
 * `const session = await auth()` + `if (!(await hasPermission(...))) return 401`.
 * Eso funciona, pero no avisa cuando alguien añade un `route.ts` nuevo y
 * olvida la primera línea, y un handler sin guard es indistinguible del resto
 * hasta que se lee entero.
 *
 * Aquí se blinda la fuente con dos reglas distintas, porque "público" y
 * "admin" no son la misma cosa:
 *
 *   1. Toda ruta que lee la BD y no está en `PUBLIC_ROUTES` tiene que pasar por
 *      `auth()`, aunque solo sea para saber quién es (así funciona `/api/profile`).
 *   2. Toda ruta que toca una tabla financiera, de inventario o de auditoría
 *      tiene que consultar un permiso de `authz`, no solo una sesión.
 *
 * Añadir un endpoint público nuevo obliga a editar `PUBLIC_ROUTES`, que es
 * justo el punto: la lista es corta y se lee de un vistazo.
 *
 * No es una demostración de seguridad: es una red contra el olvido.
 */

const API_DIR = join(process.cwd(), "src", "app", "api");

/** Rutas expuestas a propósito. La superficie sin sesión es intencionada. */
const PUBLIC_ROUTES = new Set([
  // Catálogo, navegación y contenido del sitio público.
  "services",
  "brand",
  "nav-items",
  "slots",
  "gallery",
  "legal/privacy",
  "legal/terms",
  "exchange-rate/current",
  // Autenticación.
  "auth/register",
  "auth/[...nextauth]",
  "auth/handle-google-calendar",
  // Receptor de RISC: público por diseño, se autentica con el JWT de Google.
  "risc/events",
  // La URL es un token de la cita, no contenido: sin sesión y con `noindex`.
  "appointments/[id]/review",
]);

/**
 * Tablas que nunca deben quedar detrás de una simple comprobación de sesión.
 * Cada una es un módulo del dashboard con su propio permiso en `PERMISSION_KEYS`,
 * así que la ruta que las toque tiene que pasar por `authz`.
 */
const ADMIN_ONLY_TABLES = [
  "supplierPayments",
  "bankAccounts",
  "inventoryItems",
  "inventoryMovements",
  "bills",
  "billItems",
  "expenseCategories",
  "suppliers",
  "serviceProducts",
  "payments",
  "paymentReceipts",
  "servicePurchases",
  "activityLogs",
  "exchangeRates",
  "legalSettings",
  "trackingTags",
  "workingHours",
  "courseEnrollments",
  "cancelledAppointments",
  "blockouts",
];

const TOUCHES_DB = /\bdb\.(select|insert|update|delete|transaction)\b/;
const CALLS_AUTH = /\bauth\(\)/;
const CALLS_AUTHZ =
  /\b(hasPermission|hasAnyPermission|canAdjustInventory|isAdmin|isSuperAdmin)\b/;

function adminOnlyTablesUsed(source: string): string[] {
  return ADMIN_ONLY_TABLES.filter((t) => source.includes(`schema.${t}`));
}

/** Rutas relativas a `src/app/api`, con `/` como separador. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

function routeKey(file: string): string {
  return file
    .slice(API_DIR.length + 1)
    .replace(/[\\/]route\.ts$/, "")
    .split(/[\\/]/)
    .join("/");
}

const ROUTES = walk(API_DIR)
  .map((file) => ({ key: routeKey(file), source: readFileSync(file, "utf8") }))
  .sort((a, b) => a.key.localeCompare(b.key));

describe("inventario de rutas de la API", () => {
  it("recorre el árbol de verdad", () => {
    // Si el walk se rompe, todo lo de abajo pasa en verde sobre una lista
    // vacía, que es la peor forma de fallar un test de auditoría.
    expect(ROUTES.length).toBeGreaterThan(60);
  });

  it("las rutas de PUBLIC_ROUTES existen", () => {
    for (const key of PUBLIC_ROUTES) {
      expect(
        ROUTES.map((r) => r.key),
        `la ruta /api/${key} ya no existe: quítala de la lista o crea el guard`
      ).toContain(key);
    }
  });

  it("ninguna ruta no pública se cuela en la lista", () => {
    // Una ruta que se borró no debe quedarse en la lista: si se
    // reintrodujera después, el test pasaría sin comprobar nada.
    const keys = new Set(ROUTES.map((r) => r.key));
    const stale = [...PUBLIC_ROUTES].filter((k) => !keys.has(k));
    expect(stale).toEqual([]);
  });
});

describe("regla 1: leer la BD exige pasar por auth()", () => {
  const routes = ROUTES.filter((r) => !PUBLIC_ROUTES.has(r.key) && TOUCHES_DB.test(r.source));

  for (const { key, source } of routes) {
    it(`/api/${key} llama a auth()`, () => {
      expect(source, `/api/${key} lee la BD sin llamar a auth()`).toMatch(CALLS_AUTH);
    });
  }
});

describe("regla 2: las tablas de admin exigen permiso, no solo sesión", () => {
  for (const { key, source } of ROUTES) {
    if (PUBLIC_ROUTES.has(key)) continue;
    const used = adminOnlyTablesUsed(source);
    if (used.length === 0) continue;
    it(`/api/${key} protege ${used.join(", ")}`, () => {
      expect(
        source,
        `/api/${key} toca ${used.join(", ")} sin consultar ningún permiso de authz`
      ).toMatch(CALLS_AUTHZ);
    });
  }
});

describe("regresiones concretas ya corregidas", () => {
  it("cubriría la fuga de pagos a proveedores, bancos e inventario sin sesión", () => {
    // Estas tres son las que motivaron la auditoría: todas devuelven 401
    // anónimo, y la regla 2 es lo que lo fija en el código.
    for (const key of ["supplier-payments", "bank-accounts", "inventory/items"]) {
      const route = ROUTES.find((r) => r.key === key);
      expect(route, `falta /api/${key}`).toBeDefined();
      expect(route!.source).toMatch(CALLS_AUTHZ);
    }
  });

  it("/api/services?id= no devuelve un servicio desactivado sin permiso", () => {
    // El listado sí filtraba por isActive, pero pedir por id devolvía el
    // servicio inactivo a cualquiera. Se ancla el filtro en la respuesta.
    const source = ROUTES.find((r) => r.key === "services")!.source;
    const idBranch = source.slice(source.indexOf("if (id) {"));
    expect(idBranch).toMatch(/isActive/);
    expect(idBranch).toMatch(CALLS_AUTHZ);
  });

  it("ningún endpoint acepta CRON_SECRET por query string", () => {
    // Un secreto en la URL se fuga a los access logs, al Referer y al
    // historial. `?secret=` se retiró y solo queda el header Bearer.
    for (const { key, source } of ROUTES) {
      expect(
        source,
        `/api/${key} sigue leyendo ?secret=`
      ).not.toMatch(/searchParams\.get\(\s*["']secret["']/);
    }
  });

  it("el muro público trunca el nombre en el servidor, no en el componente", () => {
    // Si el truncado estuviera en `GalleryGrid`, el nombre completo ya habría
    // salido en la respuesta de la API y bastaría abrir las devtools.
    const source = ROUTES.find((r) => r.key === "gallery")!.source;
    expect(source).toMatch(/publicFirstName/);
  });
});
