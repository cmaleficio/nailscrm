import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { ServiceCard } from "@/components/ServiceCard";
import { GalleryGrid } from "@/components/GalleryGrid";

export default async function HomePage() {
  const services = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.isActive, 1))
    .all();

  const allPhotos = db.select().from(schema.servicePhotos).all();
  const byService = new Map<string, { id: string; url: string }[]>();
  for (const p of allPhotos) {
    const list = byService.get(p.serviceId) ?? [];
    list.push({ id: p.id, url: p.url });
    byService.set(p.serviceId, list);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <section className="mb-16">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {process.env.NEXT_PUBLIC_SALON_NAME || "Nails Salon"}
          </h1>
          <p className="mt-2 text-gray-500">
            Reserva tu cita online y descubre nuestro catálogo de servicios
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.id} {...s} photos={byService.get(s.id) ?? []} />
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold text-gray-900">
          Muro de Inspiración
        </h2>
        <GalleryGrid />
      </section>
    </div>
  );
}
