import type { Metadata, MetadataRoute } from "next";

export type PublicRoute = {
  /** Ruta interna, siempre con barra inicial. */
  path: string;
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
};

/**
 * Lo único que el sitio ofrece a un visitante que no ha iniciado sesión y que
 * además vale como resultado de búsqueda. La lista es cerrada a propósito: el
 * muro de inspiración vive dentro de `/` (no hay `/gallery` público) y los
 * servicios son un modal sobre `/` (no hay `/services/[id]`), así que no hay
 * nada dinámico que enumerar. El único tramo parametrizado, `/review/[id]`,
 * queda fuera: sus ids son UUID y la URL es un token, no contenido.
 */
export const PUBLIC_INDEXABLE_ROUTES: PublicRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/book", changeFrequency: "weekly", priority: 0.9 },
  { path: "/condiciones", changeFrequency: "yearly", priority: 0.3 },
  { path: "/politicas", changeFrequency: "yearly", priority: 0.3 },
];

/**
 * Prefijos que los rastreadores no deben solicitar.
 *
 * `/dashboard` cubre las 17 páginas del admin por prefijo (Next sirve
 * `/(admin)/dashboard` exactamente en esa ruta, sin `basePath`). No es
 * cosmético: el proyecto no tiene `middleware.ts`, así que una visita a
 * `/dashboard/balances` ejecuta el layout admin en el servidor —con `auth()` y
 * `getPermissions()`— antes de que la página redirija.
 *
 * `/api/` saca las 71 rutas de la superficie rastreada. Googlebot no pide los
 * XHR que dispara el cliente, así que no rompe nada funcional.
 *
 * `/uploads/` NO se bloquea a propósito: las fotos del muro son el mayor activo
 * SEO de un salón de uñas (Google Images) y viven ahí. `_next/` tampoco, porque
 * bloquearlo impide leer el CSS y el JS.
 */
export const ROBOTS_DISALLOWED_PATHS: string[] = [
  "/api/",
  "/dashboard",
  "/profile",
  "/complete-registration",
  "/login",
  "/success",
  "/review/",
];

/** Rutas que nunca deben quedar bloqueadas en robots.txt. */
export const ROBOTS_ALWAYS_ALLOWED_PATHS: string[] = ["/uploads/", "/_next/"];

/**
 * Para las rutas públicas que no entran al sitemap (`/login`, `/success` y
 * `/review/[id]`). Redundante con el `Disallow` de robots.txt —Google no
 * descarga una URL bloqueada, así que nunca llega a ver el `noindex`— pero
 * cubre a Bing y al resto de rastreadores, y el caso de que alguien comparta
 * por fuera el enlace de una reseña.
 */
export const NOINDEX_METADATA: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Sin `lastModified`: Google lo ignora en la práctica y sellarlo con
 * `new Date()` en un archivo generado en build convertiría cada despliegue en un
 * cambio de contenido inventado. `changeFrequency` cubre la señal.
 */
export function buildSitemap(origin: string): MetadataRoute.Sitemap {
  return PUBLIC_INDEXABLE_ROUTES.map((route) => ({
    url: `${origin}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

export function buildRobots(origin: string): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ROBOTS_DISALLOWED_PATHS,
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}

/**
 * ¿Un prefijo de robots.txt alcanzaría esta ruta? Replica el matching de
 * Google (prefijo literal, sin soporte de comodines) para que el test de
 * invariantes pueda comprobar que ninguna ruta indexable quedó bloqueada por
 * error.
 */
export function isDisallowedByPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path.startsWith(prefix));
}
