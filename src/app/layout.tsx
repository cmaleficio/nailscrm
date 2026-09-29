import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { SessionWrapper } from "@/components/SessionWrapper";
import { getSiteUrl } from "@/lib/site-url";
import TrackingTags from "@/components/TrackingTags";
import { getTrackingSettings } from "@/lib/tracking-settings";
import { shouldRenderTracking, TRACKING_SCOPE_HEADER } from "@/lib/tracking-scope";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Necesario para que los canonical y las URLs de Open Graph salgan absolutas;
  // sin esto Next las emite relativas y Google las descarta. No se declara
  // `alternates.canonical` global a propósito: en el layout raíz haría que
  // /dashboard y /profile declararan "/" como su versión canónica.
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${process.env.NEXT_PUBLIC_SALON_NAME || "Nails Salon"} — Reserva tu cita de nail design online`,
    template: `%s | ${process.env.NEXT_PUBLIC_SALON_NAME || "Nails Salon"}`,
  },
  description:
    "Plataforma de gestión y reservas para DreamNails Studio: agenda citas de nail design, explora nuestro catálogo de servicios, inspírate con nuestra galería y lleva el seguimiento de tu historial y pagos desde tu perfil.",
  keywords: [
    "nail design",
    "salón de uñas",
    "manicura",
    "pedicura",
    "reservas online",
    "acrílico",
    "gel semipermanente",
    "diseño de uñas",
  ],
  openGraph: {
    type: "website",
    locale: "es_VE",
    title:
      process.env.NEXT_PUBLIC_SALON_NAME || "Nails Salon",
    description:
      "Reserva tu cita de nail design, descubre nuestro catálogo y la galería de inspiración.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El scope lo marca src/proxy.ts. Las páginas del dashboard llegan sin el
  // header, así que aquí no se monta nada y el admin nunca queda en las
  // métricas. El `&&` evita además la lectura de SQLite en el dashboard.
  const isPublicScope = shouldRenderTracking(
    (await headers()).get(TRACKING_SCOPE_HEADER),
  );

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Todo el snippet va aquí, externo e inline juntos. Este es el único
            layout que puede escribir en <head>: los anidados renderizan dentro
            de <body> y React 19 solo sube a <head> los <script async src>, no
            los inline, así que desde abajo el `gtag('config')` acababa en el
            body y Google lo leía tarde. */}
        {isPublicScope && <TrackingTags {...getTrackingSettings()} />}
      </head>
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
