import type { NextConfig } from "next";

/**
 * Origen canónico. `www` se redirige aquí porque ambos hosts sirven el mismo
 * contenido y eso es contenido duplicado; el redirect vive en la capa de
 * routing, antes de cualquier auth. `next.config.ts` corre en build y no lee
 * `.env`, así que el dominio va literal (igual que en `allowedDevOrigins`); la
 * variable `NEXT_PUBLIC_SITE_URL` es la que usan robots/sitemap/metadata.
 */
const CANONICAL_ORIGIN = "https://studiodreamnails.com";
const WWW_HOST = "www.studiodreamnails.com";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.18.41", "studiodreamnails.com", "www.studiodreamnails.com"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "header", key: "host", value: WWW_HOST }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  // Defensa en profundidad para /public/uploads: los archivos se sirven en el mismo
  // origen que la app, así que se prohíbe que el navegador adivine el Content-Type de
  // un archivo que se subió con una extensión engañosa.
  //
  // El bloque `/(.*)` no lleva CSP a propósito: `tracking_tags` es JavaScript
  // arbitrario que pega el superadmin (GA4, GTM, un pixel) y se renderiza con
  // `<script>` nativos en el `<head>` del layout raíz. Una CSP con
  // `script-src` cerrado rompería el tag, y aflojar la CSP para que quepa
  // código de terceros no aporta seguridad. Lo que sí se puede fijar sin
  // depender del contenido del snippet son los controles de abajo.
  // `next.config.ts` corre tanto en dev como en producción, así que aquí no se
  // pone HSTS: en desarrollo el dominio se sirve por http y fijarlo dejaría al
  // navegador reescribiendo a https contra un servidor que no habla https.
  // HSTS lo emite Cloudflare en el borde, que es donde corresponde.
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // El salon no usa cámara ni micrófono: la agenda pide por texto y
            // las fotos se suben como archivo. Cercarlo por defecto evita que
            // una dependencia maliciosa pida permisos que la app no usa.
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  // NextAuth v5 detecta la URL desde la cabecera Host de la petición
  // Cuando NO hay NEXTAUTH_URL, usa el origin de la petición entrante
  // Esto permite que funcione en localhost, IP servidor, y túneles Cloudflare
};

export default nextConfig;
