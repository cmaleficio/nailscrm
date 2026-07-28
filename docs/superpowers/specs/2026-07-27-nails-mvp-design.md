# Nails MVP - Design Document

## Stack
- **Framework:** Next.js 15 (App Router, `src/`)
- **Language:** TypeScript strict
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Database:** SQLite via better-sqlite3 (local `dev.db`)
- **ORM:** Drizzle ORM (SQL-first, no Prisma)
- **Auth:** NextAuth v5 (Auth.js) + Google Provider
- **Timezone:** America/Caracas (UTC-4)

## Architecture Decisions

### 1. Salon Name Configurable
Instead of hardcoding, use `NEXT_PUBLIC_SALON_NAME` env var with fallback "Nails Salon".

### 2. Folder Structure
```
src/
  app/
    api/auth/[...nextauth]/route.ts
    (public)/  page.tsx, book/, review/
    (client)/  profile/
    (admin)/   dashboard/, dashboard/clients/, dashboard/services/
  components/
    ui/        (shadcn/ui)
    ServiceCard.tsx, AppointmentCard.tsx, ClientCRMPanel.tsx
    GalleryGrid.tsx, FilterPills.tsx, GoogleSignInButton.tsx
    StatsBanner.tsx
  db/          schema.ts, index.ts, seed.ts
  lib/         auth.ts, slots.ts, calendar.ts, whatsapp.ts, utils.ts
```

### 3. Schema
5 tables as defined: users, services, appointments, waitlist, blockouts.

### 4. Auth
Google OAuth via NextAuth v5. Admin by ADMIN_EMAIL env var. Middleware guards /dashboard/* and /profile/*.

### 5. Slots
Pure function in lib/slots.ts: takes date, duration, existing appointments, blockouts; returns available time slots (9am-6pm).

### 6. Booking
3-step wizard: select service → pick date/time → upload photo + confirm.

### 7. Dashboard
Sidebar layout with agenda, client CRM panel, actions (complete/cancel).

### 8. Gallery
Cursor-paginated grid of shared photos with filter pills.

### 9. WhatsApp
Deep links via wa.me with pre-filled message template.

### 10. Google Calendar Push
Create events on client's and admin's calendars on booking confirm.
