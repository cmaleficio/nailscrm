import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { getTodayRate } from "@/lib/bcv";
import { logActivity } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = await isAdmin(session);
  const q = db
    .select({
      id: schema.paymentReceipts.id,
      clientId: schema.paymentReceipts.clientId,
      clientName: schema.users.name,
      appointmentId: schema.paymentReceipts.appointmentId,
      amountVes: schema.paymentReceipts.amountVes,
      rate: schema.paymentReceipts.rate,
      amountUsd: schema.paymentReceipts.amountUsd,
      photoUrl: schema.paymentReceipts.photoUrl,
      status: schema.paymentReceipts.status,
      reviewedBy: schema.paymentReceipts.reviewedBy,
      reviewedAt: schema.paymentReceipts.reviewedAt,
      reviewNotes: schema.paymentReceipts.reviewNotes,
      paymentId: schema.paymentReceipts.paymentId,
      createdAt: schema.paymentReceipts.createdAt,
      // Cifras del pago acreditado, si ya fue aprobado. La captura guarda lo que
      // la clienta reportó; si el admin lo editó después, las dos cosas ya no
      // coinciden y la UI tiene que poder mostrar las dos.
      paymentAmountUsd: schema.payments.amountUsd,
      paymentAmountVes: schema.payments.amountVes,
      paymentRate: schema.payments.rate,
      paymentPaidAt: schema.payments.paidAt,
      paymentAppointmentId: schema.payments.appointmentId,
      paymentCurrency: schema.payments.currency,
    })
    .from(schema.paymentReceipts)
    .leftJoin(schema.users, eq(schema.users.id, schema.paymentReceipts.clientId))
    .leftJoin(schema.payments, eq(schema.payments.id, schema.paymentReceipts.paymentId));

  if (admin) {
    const status = req.nextUrl.searchParams.get("status");
    const rows =
      status === "pending" || status === "approved" || status === "rejected"
        ? q.where(eq(schema.paymentReceipts.status, status)).orderBy(desc(schema.paymentReceipts.createdAt)).all()
        : q.orderBy(desc(schema.paymentReceipts.createdAt)).all();
    return NextResponse.json(rows);
  }

  const mine = q
    .where(eq(schema.paymentReceipts.clientId, session.user.id))
    .orderBy(desc(schema.paymentReceipts.createdAt))
    .all();
  return NextResponse.json(mine);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const amountVes = Number(body.amountVes);
  const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() : "";
  if (!Number.isFinite(amountVes) || amountVes <= 0) {
    return NextResponse.json({ error: "amountVes es requerido y debe ser mayor a 0" }, { status: 400 });
  }
  if (!photoUrl) {
    return NextResponse.json({ error: "La captura es requerida" }, { status: 400 });
  }
  const { rate } = await getTodayRate();
  if (!rate || rate <= 0) {
    return NextResponse.json(
      { error: "No hay tasa BCV disponible; refresca la tasa del día antes" },
      { status: 400 }
    );
  }
  const appointmentId = body.appointmentId ? String(body.appointmentId) : null;
  if (appointmentId) {
    const appt = db
      .select({ clientId: schema.appointments.clientId })
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appointmentId))
      .get();
    if (!appt || appt.clientId !== session.user.id) {
      return NextResponse.json({ error: "La cita no pertenece al cliente" }, { status: 400 });
    }
  }
  const now = Math.floor(Date.now() / 1000);
  const receipt = {
    id: crypto.randomUUID(),
    clientId: session.user.id,
    appointmentId,
    amountVes: Math.round(amountVes * 100) / 100,
    rate,
    amountUsd: Math.round((amountVes / rate) * 100) / 100,
    photoUrl,
    status: "pending" as const,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    paymentId: null,
    createdAt: now,
  };
  db.insert(schema.paymentReceipts).values(receipt).run();
  logActivity(db, {
    entity: "payment_receipts",
    action: "report",
    entityId: receipt.id,
    label: `Captura de pago reportada: $${receipt.amountUsd} (${receipt.amountVes} Bs)`,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
  return NextResponse.json(receipt, { status: 201 });
}
