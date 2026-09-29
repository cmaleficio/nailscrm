/**
 * Contrato entre src/proxy.ts y el layout raíz para decidir si la página lleva
 * etiquetas de analítica.
 *
 * Vive aparte de src/lib/tracking-tags.ts (puro, node) y de
 * src/lib/tracking-settings.ts (necesita SQLite) porque esto es solo una regla
 * de rutas: sin imports, se testea en node sin mocks.
 *
 * Por qué un header y no una allowlist de prefijos en el layout: el layout raíz
 * es el ÚNICO layout que puede escribir en <head> (los anidados renderizan
 * dentro de <body>), y para poner el `gtag('config')` inline en <head> el tag
 * tiene que montarse ahí. El layout raíz no sabe en qué ruta está, así que se
 * lo dice el proxy vía header de request.
 */

/** Header de request que el proxy escribe para marcar el scope. */
export const TRACKING_SCOPE_HEADER = "x-tracking-scope";

/** Único valor de scope que habilita las etiquetas. */
export const TRACKING_SCOPE_PUBLIC = "public";

/**
 * ¿La ruta es del dashboard (y por tanto NO debe llevar etiquetas)?
 *
 * Compara por frontera, no con `startsWith("/dashboard")` a secas: eso también
 * capturaría `/dashboardX` o `/dashboard-preview`, que son páginas públicas y
 * quedarían sin tracking por un bug de prefijo.
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

/** ¿Esta ruta exige sesión? (comportamiento previo del proxy, sin cambios) */
export function requiresAuth(pathname: string): boolean {
  return isAdminPath(pathname) || pathname === "/profile" || pathname.startsWith("/profile/");
}

/**
 * Segmentos que el matcher de `src/proxy.ts` deja fuera. Ahí no se renderiza
 * `<head>` (assets, binarios, metadata routes) y `auth()` no debe correr en
 * cada archivo. Vive acá y no en el proxy para que la regla sea testeable en
 * node sin levantar un request ni importar `next-auth`.
 *
 * `robots.txt` y `sitemap.xml` entran por volumen: son los dos archivos más
 * pedidos del sitio y los piden los rastreadores, no las personas.
 */
export const PROXY_EXCLUDED_SEGMENTS: string[] = [
  "api",
  "_next",
  "uploads",
  "robots.txt",
  "sitemap.xml",
  "favicon.ico",
];

/** El segundo patrón del matcher de `src/proxy.ts`, derivado de la lista de arriba. */
export function proxyPathExclusionPattern(): string {
  return `/((?!${PROXY_EXCLUDED_SEGMENTS.join("|")}).*)`;
}

/**
 * Scope de tracking para una ruta: el portal del cliente es público para
 * tracking (es parte de la experiencia pública) pero el dashboard nunca.
 */
export function trackingScopeFor(pathname: string): string | null {
  return isAdminPath(pathname) ? null : TRACKING_SCOPE_PUBLIC;
}

/**
 * ¿Monta el layout raíz las etiquetas, dado el header que recibió el proxy?
 *
 * Se extrae aquí para que la regla del lado del layout sea testeable sin
 * levantar un request: el dashboard llega SIN header (el proxy no lo pone), y
 * ese `null` es justo lo que apaga las etiquetas. Cualquier valor distinto del
 * scope público tampoco las monta, así que un header inventado no abre el
 * dashboard por accidente.
 */
export function shouldRenderTracking(scopeHeader: string | null | undefined): boolean {
  return scopeHeader === TRACKING_SCOPE_PUBLIC;
}
