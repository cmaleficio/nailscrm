import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/index";
import { eq, and, gte, sql } from "drizzle-orm";
import { ProfileContent } from "./ProfileContent";

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

  const upcomingAppointments = db
    .select({
      id: schema.appointments.id,
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
      status: schema.appointments.status,
      referencePhotoUrl: schema.appointments.referencePhotoUrl,
      serviceName: sql<string>`coalesce(${schema.servicePurchases.serviceName}, ${schema.services.name})`,
    })
    .from(schema.appointments)
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .leftJoin(
      schema.servicePurchases,
      eq(schema.servicePurchases.appointmentId, schema.appointments.id)
    )
    .where(
      and(
        eq(schema.appointments.clientId, user.id),
        sql`${schema.appointments.status} IN ('pending', 'confirmed')`,
        gte(schema.appointments.startTime, sql`(unixepoch() - 3600)`)
      )
    )
    .orderBy(schema.appointments.startTime)
    .all();

  const completedAppointments = db
    .select({
      id: schema.appointments.id,
      startTime: schema.appointments.startTime,
      finalPhotoUrl: schema.appointments.finalPhotoUrl,
      reviewRating: schema.appointments.reviewRating,
      reviewText: schema.appointments.reviewText,
      serviceName: sql<string>`coalesce(${schema.servicePurchases.serviceName}, ${schema.services.name})`,
    })
    .from(schema.appointments)
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .leftJoin(
      schema.servicePurchases,
      eq(schema.servicePurchases.appointmentId, schema.appointments.id)
    )
    .where(
      and(
        eq(schema.appointments.clientId, user.id),
        eq(schema.appointments.status, "completed")
      )
    )
    .orderBy(schema.appointments.startTime)
    .all();

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
      upcomingAppointments={upcomingAppointments.map((a) => ({
        id: a.id,
        startTime: a.startTime ?? 0,
        endTime: a.endTime ?? 0,
        status: a.status ?? "pending",
        referencePhotoUrl: a.referencePhotoUrl,
        serviceName: a.serviceName,
      }))}
      appointments={completedAppointments.map((a) => ({
        id: a.id,
        startTime: a.startTime ?? 0,
        finalPhotoUrl: a.finalPhotoUrl,
        reviewRating: a.reviewRating,
        reviewText: a.reviewText,
        serviceName: a.serviceName,
      }))}
    />
  );
}
