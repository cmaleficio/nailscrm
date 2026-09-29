import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

/**
 * Lectura del snippet de etiquetas para los layouts públicos.
 *
 * Vive aparte de src/lib/tracking-tags.ts a propósito: ese módulo es puro y se
 * testea en entorno node, y este necesita la conexión de SQLite.
 */
const TRACKING_KEY = "head";

export type TrackingSettings = { snippet: string; isEnabled: boolean };

const EMPTY: TrackingSettings = { snippet: "", isEnabled: false };

export function getTrackingSettings(): TrackingSettings {
  const row = db
    .select({ snippet: schema.trackingTags.snippet, isEnabled: schema.trackingTags.isEnabled })
    .from(schema.trackingTags)
    .where(eq(schema.trackingTags.key, TRACKING_KEY))
    .get();

  if (!row) return EMPTY;
  return { snippet: row.snippet, isEnabled: row.isEnabled === 1 };
}
