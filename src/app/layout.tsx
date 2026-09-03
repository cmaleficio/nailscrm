import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionWrapper } from "@/components/SessionWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
