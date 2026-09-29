import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/index";
import { eq, and, inArray, ne, sql } from "drizzle-orm";
import { ProfileContent } from "./ProfileContent";
import { summarizePurchases } from "@/lib/appointment-purchases";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .get();

  if (!user) {
    redirect("/");
  }

  if (!user.phone) {
    redirect("/complete-registration");
  }

  // Sin leftJoin a service_purchases: el JOIN multiplicaba la fila de la cita
  // por cada compra, así que una cita de 3 servicios salía 3 veces con el mismo
  // appointments.id (claves duplicadas en React). Las compras se cargan aparte y
  // se fusionan en memoria, igual que las citas completadas de más abajo.
  const upcomingAppointments = db
    .select({
      id: schema.appointments.id,
      clientId: schema.appointments.clientId,
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
      status: schema.appointments.status,
      referencePhotoUrl: schema.appointments.referencePhotoUrl,
      serviceName: schema.services.name,
    })
    .from(schema.appointments)
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(
      and(
        eq(schema.appointments.clientId, user.id),
        eq(schema.appointments.status, "confirmed")
      )
    )
    .orderBy(schema.appointments.startTime)
    .all();

  // Sin LEFT JOIN a service_purchases: una cita con principal + complementarios
  // (o una sesión de curso con N alumnos) salía repetida una vez por cada
  // compra. Los nombres se fusionan aparte con summarizePurchases.
  const completedAppointments = db
    .select({
      id: schema.appointments.id,
      clientId: schema.appointments.clientId,
      startTime: schema.appointments.startTime,
      finalPhotoUrl: schema.appointments.finalPhotoUrl,
      reviewRating: schema.appointments.reviewRating,
      reviewText: schema.appointments.reviewText,
      serviceName: schema.services.name,
    })
    .from(schema.appointments)
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(
      and(
        eq(schema.appointments.clientId, user.id),
        eq(schema.appointments.status, "completed")
      )
    )
    .orderBy(schema.appointments.startTime)
    .all();

  const purchaseSelect = {
    id: schema.servicePurchases.id,
    appointmentId: schema.servicePurchases.appointmentId,
    userId: schema.servicePurchases.userId,
    serviceName: schema.servicePurchases.serviceName,
    servicePrice: schema.servicePurchases.servicePrice,
    serviceDurationMins: schema.servicePurchases.serviceDurationMins,
    isPrimary: schema.servicePurchases.isPrimary,
  };

  const upcomingIds = upcomingAppointments.map((a) => a.id);
  const upcomingPurchases = upcomingIds.length
    ? db
        .select(purchaseSelect)
        .from(schema.servicePurchases)
        .where(inArray(schema.servicePurchases.appointmentId, upcomingIds))
        .all()
    : [];

  const upcomingSummaries = summarizePurchases(
    upcomingAppointments.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      serviceName: a.serviceName,
    })),
    upcomingPurchases
  );

  const purchaseSummaries = summarizePurchases(
    completedAppointments,
    completedAppointments.length
      ? db
          .select(purchaseSelect)
          .from(schema.servicePurchases)
          .where(
            inArray(
              schema.servicePurchases.appointmentId,
              completedAppointments.map((a) => a.id)
            )
          )
          .all()
      : []
  );

  const completedWithNames = completedAppointments.map((a) => ({
    ...a,
    serviceName: purchaseSummaries.get(a.id)?.serviceName ?? a.serviceName,
  }));

  // Todas las fotos finales de esas visitas, no solo appointments.final_photo_url
  // (que es únicamente la primera). El admin sube varias al completar la cita.
  const completedIds = completedAppointments.map((a) => a.id);
  const finalPhotos = completedIds.length
    ? db
        .select({
          appointmentId: schema.appointmentPhotos.appointmentId,
          id: schema.appointmentPhotos.id,
          url: schema.appointmentPhotos.url,
        })
        .from(schema.appointmentPhotos)
        .where(
          and(
            inArray(schema.appointmentPhotos.appointmentId, completedIds),
            eq(schema.appointmentPhotos.kind, "final")
          )
        )
        .orderBy(schema.appointmentPhotos.position)
        .all()
    : [];

  const photosByAppointment = new Map<string, { id: string; url: string }[]>();
  for (const photo of finalPhotos) {
    const list = photosByAppointment.get(photo.appointmentId) ?? [];
    list.push({ id: photo.id, url: photo.url });
    photosByAppointment.set(photo.appointmentId, list);
  }

  const due = db    .select({ s: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)` })
    .from(schema.servicePurchases)
    .where(and(eq(schema.servicePurchases.userId, user.id), ne(schema.servicePurchases.financialStatus, "void")))
    .get()?.s ?? 0;

  const statementItems = db
    .select({
      id: schema.servicePurchases.id,
      serviceName: schema.servicePurchases.serviceName,
      price: schema.servicePurchases.servicePrice,
      financialStatus: schema.servicePurchases.financialStatus,
      completionDate: schema.servicePurchases.completionDate,
      startTime: schema.appointments.startTime,
    })
    .from(schema.servicePurchases)
    .leftJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
    .where(and(eq(schema.servicePurchases.userId, user.id), ne(schema.servicePurchases.financialStatus, "void")))
    .orderBy(schema.servicePurchases.createdAt)
    .all();

  const paid = db
    .select({ s: sql<number>`coalesce(sum(${schema.payments.amountUsd}), 0)` })
    .from(schema.payments)
    .where(eq(schema.payments.userId, user.id))
    .get()?.s ?? 0;

  const balanceUsd = Math.round((due - paid) * 100) / 100;

  return (
    <ProfileContent
      user={{
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role ?? "client",
        image: user.image,
        totalVisits: user.totalVisits ?? 0,
        totalRevenue: user.totalRevenue ?? 0,
      }}
      upcomingAppointments={upcomingAppointments.map((a) => {
        const s = upcomingSummaries.get(a.id);
        return {
          id: a.id,
          startTime: a.startTime ?? 0,
          endTime: a.endTime ?? 0,
          status: a.status ?? "pending",
          referencePhotoUrl: a.referencePhotoUrl,
          serviceName: s?.serviceName ?? a.serviceName,
          items: s?.items ?? [],
        };
      })}
      appointments={completedWithNames.map((a) => ({
        id: a.id,
        startTime: a.startTime ?? 0,
        finalPhotoUrl: a.finalPhotoUrl,
        reviewRating: a.reviewRating,
        reviewText: a.reviewText,
        serviceName: a.serviceName,
        photos: photosByAppointment.get(a.id) ??
          // Citas antiguas completadas antes de que existiera appointment_photos
          (a.finalPhotoUrl ? [{ id: `${a.id}-final`, url: a.finalPhotoUrl }] : []),
      }))}
      balanceUsd={balanceUsd}
      statementItems={statementItems.map((s) => ({
        id: s.id,
        serviceName: s.serviceName,
        price: s.price,
        financialStatus: s.financialStatus,
        completionDate: s.completionDate,
        startTime: s.startTime,
      }))}
    />
  );
}
