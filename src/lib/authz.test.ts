import { describe, test, expect, beforeAll, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Session } from "next-auth";

/**
 * `authz.ts` lee el singleton `db` de `@/db/index`, que abre `dev.db` al
 * importarse. Para no tocar la base de desarrollo el módulo se sustituye por
 * una SQLite en memoria con el mismo `schema`. El mock se declara con un getter
 * porque `authz` solo lo consume dentro de las funciones: asignar `testDb` en
 * `beforeEach` es suficiente y evita abrir el archivo real.
 */
let testDb: ReturnType<typeof drizzle>;

vi.mock("@/db/index", async () => {
  const schema = await vi.importActual<typeof import("@/db/schema")>("@/db/schema");
  return {
    get db() {
      return testDb;
    },
    schema,
  };
});

const { isAdmin, isSuperAdmin, getPermissions, hasPermission, hasAnyPermission, canAdjustInventory } =
  await import("./authz");

const SUPER_ADMIN_EMAIL = "owner@example.com";
const RIVAL_ADMIN_EMAIL = "rival@example.com";

type SeedUser = {
  id: string;
  role: string;
  permissions?: string | null;
  lockedAt?: number | null;
};

function seed({ id, role, permissions = null, lockedAt = null }: SeedUser) {
  testDb
    .insert(schema.users)
    .values({
      id,
      name: id,
      email: id === SUPER_ADMIN_EMAIL ? SUPER_ADMIN_EMAIL : `${id}@example.com`,
      role,
      permissions,
      lockedAt,
    })
    .run();
}

const schema = await vi.importActual<typeof import("@/db/schema")>("@/db/schema");

function sessionFor(id: string, email?: string): Session {
  return {
    user: { id, email: email ?? `${id}@example.com`, role: "admin" },
    expires: "",
  } as unknown as Session;
}

beforeAll(() => {
  process.env.ADMIN_EMAIL = SUPER_ADMIN_EMAIL;
});

beforeEach(() => {
  const sqlite = new Database(":memory:");
  // DDL copiado de `dev.db`. Esta versión de Drizzle genera el INSERT con
  // todas las columnas de la tabla (las que no tienen default salen como
  // `null` literal), así que el esquema de la tabla en memoria tiene que
  // existir completo, no solo las columnas que usa el test.
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      emailVerified integer,
      image text,
      phone text,
      google_id text,
      tech_notes text,
      total_visits integer DEFAULT 0,
      total_revenue real DEFAULT 0,
      created_at integer,
      role text DEFAULT 'client' NOT NULL,
      address text,
      password_hash text,
      permissions text,
      locked_at integer,
      locked_reason text
    );
  `);
  testDb = drizzle(sqlite, { schema });
});

describe("getPermissions", () => {
  test("never reports full access when there is no session", async () => {
    await expect(getPermissions(null)).resolves.toEqual([]);
    await expect(
      getPermissions({ user: { id: undefined } } as unknown as Parameters<
        typeof getPermissions
      >[0])
    ).resolves.toEqual([]);
  });

  test("null en la columna vale como acceso total", async () => {
    seed({ id: "admin-full", role: "admin", permissions: null });
    await expect(getPermissions(sessionFor("admin-full"))).resolves.toBeNull();
  });

  test("una clienta sin permisos almacenados no recibe acceso total", async () => {
    // Regresión: `parseStoredPermissions(null)` devuelve `null` (= todos los
    // módulos), así que antes una clienta cualquiera salía del layout con el
    // sidebar completo del dashboard. Solo un admin activo puede obtener `null`.
    seed({ id: "client-1", role: "client", permissions: null });
    await expect(getPermissions(sessionFor("client-1"))).resolves.toEqual([]);
  });

  test("un admin bloqueado no recibe permisos aunque su fila diga role=admin", async () => {
    seed({ id: "locked", role: "admin", permissions: null, lockedAt: 1700000000 });
    await expect(getPermissions(sessionFor("locked"))).resolves.toEqual([]);
  });
});

describe("isAdmin", () => {
  test("true para un admin activo", async () => {
    seed({ id: "admin-1", role: "admin" });
    await expect(isAdmin(sessionFor("admin-1"))).resolves.toBe(true);
  });

  test("false para una clienta", async () => {
    seed({ id: "client-1", role: "client" });
    await expect(isAdmin(sessionFor("client-1"))).resolves.toBe(false);
  });

  test("false para un admin bloqueado por RISC", async () => {
    seed({ id: "locked", role: "admin", lockedAt: 1700000000 });
    await expect(isAdmin(sessionFor("locked"))).resolves.toBe(false);
  });

  test("false si la fila del usuario no existe", async () => {
    await expect(isAdmin(sessionFor("ghost"))).resolves.toBe(false);
  });
});

describe("isSuperAdmin", () => {
  test("true para el ADMIN_EMAIL que además es admin activo", async () => {
    seed({ id: SUPER_ADMIN_EMAIL, role: "admin" });
    await expect(isSuperAdmin(sessionFor(SUPER_ADMIN_EMAIL, SUPER_ADMIN_EMAIL))).resolves.toBe(
      true
    );
  });

  test("false para un ADMIN_EMAIL bloqueado", async () => {
    // El superadmin no puede ser una puerta trasera para saltarse el bloqueo
    // que Google notifica por RISC.
    seed({ id: SUPER_ADMIN_EMAIL, role: "admin", lockedAt: 1700000000 });
    await expect(isSuperAdmin(sessionFor(SUPER_ADMIN_EMAIL, SUPER_ADMIN_EMAIL))).resolves.toBe(
      false
    );
  });

  test("false para un admin que no es el ADMIN_EMAIL", async () => {
    seed({ id: RIVAL_ADMIN_EMAIL, role: "admin" });
    await expect(isSuperAdmin(sessionFor(RIVAL_ADMIN_EMAIL, RIVAL_ADMIN_EMAIL))).resolves.toBe(
      false
    );
  });

  test("falla cerrado si no hay ADMIN_EMAIL en el entorno", async () => {
    // Sin la variable, comparar `session.user.email === process.env.ADMIN_EMAIL`
    // daba `undefined === undefined` y cualquier admin se volvía superadmin.
    // Se comprueba con `permissions: []` para que el atajo sea lo único que
    // podría conceder acceso: como está vacío, solo el atajo lo abriría.
    const previous = process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_EMAIL;
    try {
      seed({ id: SUPER_ADMIN_EMAIL, role: "admin", permissions: JSON.stringify([]) });
      await expect(
        isSuperAdmin(sessionFor(SUPER_ADMIN_EMAIL, SUPER_ADMIN_EMAIL))
      ).resolves.toBe(false);
      await expect(hasPermission(sessionFor(SUPER_ADMIN_EMAIL), "inventory")).resolves.toBe(
        false
      );
    } finally {
      process.env.ADMIN_EMAIL = previous;
    }
  });
});

describe("hasPermission", () => {
  test("concede el permiso almacenado", async () => {
    seed({ id: "a1", role: "admin", permissions: JSON.stringify(["inventory"]) });
    await expect(hasPermission(sessionFor("a1"), "inventory")).resolves.toBe(true);
    await expect(hasPermission(sessionFor("a1"), "balances")).resolves.toBe(false);
  });

  test("un admin sin permisos restringidos tiene todos", async () => {
    seed({ id: "a2", role: "admin", permissions: null });
    await expect(hasPermission(sessionFor("a2"), "anything")).resolves.toBe(true);
  });

  test("un JSON corrupto no abre el acceso", async () => {
    seed({ id: "a3", role: "admin", permissions: "{not json" });
    await expect(hasPermission(sessionFor("a3"), "inventory")).resolves.toBe(false);
  });

  test("el superadmin pasa con cualquier permiso, incluso los no listados", async () => {
    seed({ id: SUPER_ADMIN_EMAIL, role: "admin", permissions: JSON.stringify([]) });
    await expect(
      hasPermission(sessionFor(SUPER_ADMIN_EMAIL, SUPER_ADMIN_EMAIL), "activityLog")
    ).resolves.toBe(true);
  });

  test("un admin bloqueado pierde todos los permisos", async () => {
    seed({
      id: "locked",
      role: "admin",
      permissions: JSON.stringify(["inventory", "balances"]),
      lockedAt: 1700000000,
    });
    await expect(hasPermission(sessionFor("locked"), "inventory")).resolves.toBe(false);
    await expect(hasPermission(sessionFor("locked"), "balances")).resolves.toBe(false);
  });

  test("una clienta nunca tiene permisos de admin", async () => {
    seed({ id: "client-1", role: "client", permissions: JSON.stringify(["inventory"]) });
    await expect(hasPermission(sessionFor("client-1"), "inventory")).resolves.toBe(false);
  });

  test("sin sesión no hay permisos", async () => {
    await expect(hasPermission(null, "inventory")).resolves.toBe(false);
  });
});

describe("hasAnyPermission", () => {
  test("basta con uno de los módulos pedidos", async () => {
    seed({ id: "a1", role: "admin", permissions: JSON.stringify(["balances"]) });
    await expect(
      hasAnyPermission(sessionFor("a1"), ["inventory", "balances"])
    ).resolves.toBe(true);
    await expect(hasAnyPermission(sessionFor("a1"), ["inventory", "financials"])).resolves.toBe(
      false
    );
  });

  test("un admin bloqueado no pasa aunque tenga la lista vacía", async () => {
    // `[]` es falsy, así que un `if (perms.length && ...)` sincrónico abriría
    // un agujero. `some` sobre lista vacía es `false`, que es lo correcto.
    seed({ id: "locked", role: "admin", lockedAt: 1700000000 });
    await expect(hasAnyPermission(sessionFor("locked"), [])).resolves.toBe(false);
  });
});

describe("canAdjustInventory", () => {
  test("delega en el permiso adjustInventory", async () => {
    seed({ id: "a1", role: "admin", permissions: JSON.stringify(["inventory"]) });
    await expect(canAdjustInventory(sessionFor("a1"))).resolves.toBe(false);
    seed({ id: "a2", role: "admin", permissions: JSON.stringify(["adjustInventory"]) });
    await expect(canAdjustInventory(sessionFor("a2"))).resolves.toBe(true);
  });
});
