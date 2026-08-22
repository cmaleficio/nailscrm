import Link from "next/link";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { ReviewForm } from "./ReviewForm";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const row = db
    .select({
      serviceName: schema.services.name,
      startTime: schema.appointments.startTime,
      status: schema.appointments.status,
      clientName: schema.users.name,
      reviewRating: schema.appointments.reviewRating,
    })
    .from(schema.appointments)
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(eq(schema.appointments.id, id))
    .get();

  const salonName = process.env.NEXT_PUBLIC_SALON_NAME || "Nails Salon";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {!row ? (
          <>
            <h1 className="text-xl font-bold text-gray-900">
              Cita no encontrada
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              El enlace de reseña no es válido o la cita ya no existe.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Volver al inicio
            </Link>
          </>
        ) : row.status !== "completed" ? (
          <>
            <h1 className="text-xl font-bold text-gray-900">
              Aún no se puede reseñar
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Las reseñas están disponibles cuando la cita ha sido completada.
            </p>
          </>
        ) : (
          <>
            <div className="mb-5 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-pink-600">
                {salonName}
              </p>
              <h1 className="mt-1 text-xl font-bold text-gray-900">
                Tu opinión nos importa
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {row.serviceName} ·{" "}
                {row.startTime != null
                  ? new Intl.DateTimeFormat("es-ES", {
                      dateStyle: "long",
                      timeZone: "America/Caracas",
                    }).format(new Date(row.startTime * 1000))
                  : ""}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Reseña de {row.clientName?.trim().split(/\s+/)[0] ?? "la clienta"}
              </p>
            </div>
            <ReviewForm appointmentId={id} alreadyReviewed={row.reviewRating != null} />
          </>
        )}
      </div>
    </div>
  );
}
