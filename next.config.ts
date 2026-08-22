import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.18.41"],
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
  // NextAuth v5 detecta la URL desde la cabecera Host de la petición
  // Cuando NO hay NEXTAUTH_URL, usa el origin de la petición entrante
  // Esto permite que funcione en localhost, IP servidor, y túneles Cloudflare
};

export default nextConfig;
