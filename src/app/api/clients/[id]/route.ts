import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const update: Partial<typeof schema.users.$inferSelect> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.address !== undefined) update.address = body.address;
  if (body.techNotes !== undefined) update.techNotes = body.techNotes;

  if (Object.keys(update).length > 0) {
    db.update(schema.users).set(update).where(eq(schema.users.id, id)).run();
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const client = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const dueRow = db
    .select({
      due: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)`,
    })
    .from(schema.servicePurchases)
    .innerJoin(
      schema.appointments,
      eq(schema.appointments.id, schema.servicePurchases.appointmentId)
    )
    .where(
      and(
        eq(schema.appointments.status, "completed"),
        eq(schema.servicePurchases.userId, id)
      )
    )
    .get();

  const paidRow = db
    .select({ paid: sql<number>`coalesce(sum(${schema.payments.amountUsd}), 0)` })
    .from(schema.payments)
    .where(eq(schema.payments.userId, id))
    .get();

  const payments = db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.userId, id))
    .orderBy(sql`${schema.payments.paidAt} DESC`)
    .limit(10)
    .all();

  return NextResponse.json({
    ...client,
    balanceUsd: Math.round(((dueRow?.due ?? 0) - (paidRow?.paid ?? 0)) * 100) / 100,
    payments,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  if (!user) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (user.role === "admin") {
    return NextResponse.json(
      { error: "No se puede eliminar a un usuario administrador" },
      { status: 403 }
    );
  }

  const appointmentsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.appointments)
      .where(eq(schema.appointments.clientId, id))
      .get()?.count ?? 0;

  if (appointmentsCount > 0) {
    return NextResponse.json(
      { error: "El cliente tiene citas; no se puede eliminar" },
      { status: 400 }
    );
  }

  const paymentsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.payments)
      .where(eq(schema.payments.userId, id))
      .get()?.count ?? 0;

  if (paymentsCount > 0) {
    return NextResponse.json(
      { error: "El cliente tiene pagos o cuentas por cobrar; no se puede eliminar" },
      { status: 400 }
    );
  }

  const waitlistCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.waitlist)
      .where(eq(schema.waitlist.clientId, id))
      .get()?.count ?? 0;

  if (waitlistCount > 0) {
    return NextResponse.json(
      { error: "El cliente está en la lista de espera; no se puede eliminar" },
      { status: 400 }
    );
  }

  const archivedCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.cancelledAppointments)
      .where(eq(schema.cancelledAppointments.clientId, id))
      .get()?.count ?? 0;

  if (archivedCount > 0) {
    return NextResponse.json(
      { error: "El cliente tiene citas canceladas archivadas; no se puede eliminar" },
      { status: 400 }
    );
  }

  db.delete(schema.users).where(eq(schema.users.id, id)).run();

  return NextResponse.json({ success: true });
}
