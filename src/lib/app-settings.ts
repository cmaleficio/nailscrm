import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db, schema } from "@/db/index";

export type SettingsDb = BetterSQLite3Database<typeof schema>;

/**
 * Ajustes globales del salón (clave/valor). Solo las claves de
 * esta lista son editables desde el dashboard; un valor que no
 * está aquí no se lee ni se escribe.
 */
export const APP_SETTING_KEYS = ["detectDuplicateClients"] as const;
export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export function getAppSetting(
  dbc: SettingsDb,
  key: AppSettingKey,
  fallback: string
): string {
  const row = dbc
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, key))
    .get();
  return row?.value ?? fallback;
}

export function setAppSetting(
  dbc: SettingsDb,
  key: AppSettingKey,
  value: string,
  updatedBy?: string | null
): void {
  const now = Math.floor(Date.now() / 1000);
  dbc.insert(schema.appSettings)
    .values({ key, value, updatedAt: now, updatedBy: updatedBy ?? null })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value, updatedAt: now, updatedBy: updatedBy ?? null },
    })
    .run();
}

/**
 * Interruptor de "¿Ya eres cliente?" en el registro
 * con Google: cuando está en 0 el prompt no aparece y
 * ninguna unión auto-gestionada es posible. Apagado
 * por defecto.
 */
export function isDuplicateDetectionEnabled(
  dbc: SettingsDb = db
): boolean {
  return getAppSetting(dbc, "detectDuplicateClients", "0") === "1";
}
