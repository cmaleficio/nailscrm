import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/index";
import { eq, and } from "drizzle-orm";
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

  const completedAppointments = db
    .select({
      id: schema.appointments.id,
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

  return (
    <ProfileContent
      user={{
        name: user.name,
        image: user.image,
        totalVisits: user.totalVisits ?? 0,
        totalRevenue: user.totalRevenue ?? 0,
      }}
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
