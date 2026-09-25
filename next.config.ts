import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.18.41", "studiodreamnails.com", "www.studiodreamnails.com"],
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
