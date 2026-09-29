/**
 * Origen público del sitio (sin barra final). Lo usan `robots.txt`, `sitemap.xml`
 * y el `metadataBase` del layout raíz, que necesitan URLs **absolutas**: sin esto
 * Next las emitiría relativas y Google las descartaría.
 *
 * Se lee de `NEXT_PUBLIC_SITE_URL` con fallback a `AUTH_URL` (que ya está
 * seteada al dominio público) y por último a localhost para que el dev server
 * no reviente. Sin `NEXT_PUBLIC_SITE_URL` en producción el sitemap publicaría
 * URLs de `localhost`, que es peor que no tener sitemap: hay que tenerla.
 */
export const DEV_FALLBACK_ORIGIN = "http://localhost:3001";

/** Recorta espacios y las barras finales, que romperían el join de rutas. */
export function normalizeSiteUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/**
 * `primary` gana; `secondary` es el respaldo declarado en `.env`. Se expone con
 * parámetros en vez de leer `process.env` adentro para que los tests puedan
 * ejercitar la precedencia sin mutar el entorno.
 */
export function resolveSiteUrl(primary?: string, secondary?: string): string {
  return normalizeSiteUrl(primary || secondary || DEV_FALLBACK_ORIGIN);
}

export function getSiteUrl(): string {
  return resolveSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.AUTH_URL
  );
}
