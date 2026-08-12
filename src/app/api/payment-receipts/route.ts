import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { isAdmin, hasPermission } from "@/lib/authz";
import { getTodayRate } from "@/lib/bcv";

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
    })
    .from(schema.paymentReceipts)
    .leftJoin(schema.users, eq(schema.users.id, schema.paymentReceipts.clientId));

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
  return NextResponse.json(receipt, { status: 201 });
}
