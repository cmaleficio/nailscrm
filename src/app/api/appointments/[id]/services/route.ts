import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { hasPermission } from "@/lib/authz";
import { remainingCombination } from "@/lib/appointment-purchases";
import { recomputeFinancialStatus } from "@/lib/financial-status";
import { getAdminUserId, updateAppointmentEvent } from "@/lib/calendar";
import { logActivity } from "@/lib/audit";

/**
 * Quita UN servicio suelto de una cita sin cancelar la visita. Cancelar la cita
 * entera sigue siendo DELETE /api/appointments/[id], que además archiva el
 * snapshot; esta ruta es para el caso real de "me arrepentí del matiz".
 *
 * La compra se borra en duro (igual que al desinscribir un alumno de un curso)
 * porque service_purchases es el snapshot de lo que se cobró: dejar una fila
 * void seguiría sumando duración, precio y aparición en el estado de cuenta.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const purchaseId = req.nextUrl.searchParams.get("purchaseId");
  if (!purchaseId) {
    return NextResponse.json({ error: "purchaseId requerido" }, { status: 400 });
  }

  const appointment = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();
  if (!appointment) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }

  const isAdmin = await hasPermission(session, "appointments");
  if (!isAdmin && appointment.clientId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (appointment.status === "completed") {
    return NextResponse.json(
      { error: "No se puede quitar un servicio de una cita completada" },
      { status: 400 }
    );
  }

  // La compra se filtra por cita además de por id: sin esto, una dueña podría
  // borrar el servicio de una cita ajena.
  const purchase = db
    .select()
    .from(schema.servicePurchases)
    .where(
      and(
        eq(schema.servicePurchases.id, purchaseId),
        eq(schema.servicePurchases.appointmentId, id)
      )
    )
    .get();
  if (!purchase) {
    return NextResponse.json(
      { error: "Ese servicio no pertenece a la cita" },
      { status: 404 }
    );
  }

  const all = db
    .select({
      id: schema.servicePurchases.id,
      serviceId: schema.servicePurchases.serviceId,
      serviceName: schema.servicePurchases.serviceName,
      servicePrice: schema.servicePurchases.servicePrice,
      serviceDurationMins: schema.servicePurchases.serviceDurationMins,
      isPrimary: schema.servicePurchases.isPrimary,
    })
    .from(schema.servicePurchases)
    .where(eq(schema.servicePurchases.appointmentId, id))
    .all();

  // Contar ANTES de borrar incluye la compra que se va: con una sola no quedaría nada.
  if (all.length <= 1) {
    return NextResponse.json(
      {
        error:
          "La cita debe tener al menos un servicio. Para eliminarla del todo, cancela la cita.",
      },
      { status: 400 }
    );
  }

  const enrollment = db
    .select({ id: schema.courseEnrollments.id })
    .from(schema.courseEnrollments)
    .where(eq(schema.courseEnrollments.appointmentId, id))
    .get();
  if (enrollment) {
    return NextResponse.json(
      { error: "Los alumnos de una sesión de curso se gestionan desde la sesión" },
      { status: 400 }
    );
  }

  const remaining = remainingCombination(all.filter((p) => p.id !== purchaseId));
  const summary = remaining.names.join(" + ");
  // Un start_time null es una cita rota: mejor no inventarle un end_time nuevo.
  const startTime = appointment.startTime ?? 0;
  const endTime = startTime + remaining.totalDurationMins * 60;

  db.transaction((tx) => {
    tx.delete(schema.servicePurchases)
      .where(eq(schema.servicePurchases.id, purchaseId))
      .run();
    tx.update(schema.appointments)
      .set({
        endTime,
        // Si ninguna compra restante trae service_id (compras huérfanas), se
        // conserva el ancla anterior en vez de dejar la cita sin servicio.
        ...(remaining.anchorServiceId
          ? { serviceId: remaining.anchorServiceId }
          : {}),
      })
      .where(eq(schema.appointments.id, id))
      .run();
  });

  // La clienta y el admin pagan la cita: recalcular solo para la dueña dejaría
  // al admin con el precio viejo.
  for (const userId of new Set([appointment.clientId, purchase.userId])) {
    recomputeFinancialStatus(userId);
  }

  logActivity(db, {
    entity: "purchases",
    action: "delete",
    entityId: purchaseId,
    label: `Quitó "${purchase.serviceName}" de la cita (${summary || "sin servicios"})`,
    metadata: {
      appointmentId: id,
      purchaseId,
      removedService: purchase.serviceName,
      newSummary: summary,
      newEndTime: endTime,
      newTotalDurationMins: remaining.totalDurationMins,
    },
    actorId: session.user.id,
    actorName: session.user.name ?? null,
  });

  if (process.env.GOOGLE_CALENDAR_ENABLED === "true") {
    if (appointment.googleEventIdClient) {
      await updateAppointmentEvent(
        appointment.clientId,
        appointment.googleEventIdClient,
        startTime,
        endTime,
        summary
      );
    }
    if (appointment.googleEventIdAdmin) {
      const adminUserId = await getAdminUserId();
      if (adminUserId) {
        await updateAppointmentEvent(
          adminUserId,
          appointment.googleEventIdAdmin,
          startTime,
          endTime,
          summary
        );
      }
    }
  }

  return NextResponse.json({
    success: true,
    appointmentId: id,
    serviceId: purchase.serviceId,
    endTime,
    serviceName: summary,
    totalDurationMins: remaining.totalDurationMins,
  });
}