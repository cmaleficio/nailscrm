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
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
  // NextAuth v5 detecta la URL desde la cabecera Host de la petición
  // Cuando NO hay NEXTAUTH_URL, usa el origin de la petición entrante
  // Esto permite que funcione en localhost, IP servidor, y túneles Cloudflare
};

export default nextConfig;
