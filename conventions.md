# Convenciones de Desarrollo

## Stack
- Framework: Next.js 15 (App Router)
- Lenguaje: TypeScript
- Estilos: Tailwind CSS v4 + shadcn/ui
- Base de Datos: SQLite (archivo local `dev.db`)
- ORM: Drizzle ORM (sintaxis SQL pura, NO Prisma)
- Auth: NextAuth v5 (Auth.js) con Google Provider
- Calendarios: Google Calendar API (Push/Write only)
- WhatsApp: Deep Links (wa.me) - NO API oficial
- Exposición: Cloudflare Tunnel (cloudflared)

## Reglas
- Mobile-first en todas las vistas de cliente
- SQL puro a través de Drizzle (no usar el query builder complejo)
- Componentes de shadcn/ui siempre que sea posible
- Colores: Paleta pastel (rosa suave, blancos, grises claros)
- Idioma de la UI: Español
- Archivos de imágenes en `/public/uploads`
- Timezone fijo: America/Caracas (o la zona del salón)

## Estructura de carpetas preferida
/src
  /app
    /api
    /(public)       -> Landing, reserva, muro
    /(client)       -> Portal de la clienta
    /(admin)        -> Dashboard de la manicurista
  /components
  /db
    schema.ts       -> Drizzle schema
    index.ts        -> Conexión a SQLite
  /lib
    auth.ts         -> NextAuth config
    calendar.ts     -> Google Calendar API
    whatsapp.ts     -> Deep links helpers
  /uploads          -> Imágenes locales