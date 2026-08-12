import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin, hasPermission } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "paymentApproval"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const receipt = db.select().from(schema.paymentReceipts).where(eq(schema.paymentReceipts.id, id)).get();
  if (!receipt) {
    return NextResponse.json({ error: "Captura no encontrada" }, { status: 404 });
  }
  if (receipt.status !== "pending") {
    return NextResponse.json({ error: "Esta captura ya fue revisada" }, { status: 400 });
  }
  const body = await req.json();
  const action = body.action;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const now = Math.floor(Date.now() / 1000);
  const adminId = session?.user?.id;

  if (action === "approve") {
    const paymentId = crypto.randomUUID();
    const payment = {
      id: paymentId,
      userId: receipt.clientId,
      appointmentId: receipt.appointmentId,
      amountUsd: receipt.amountUsd,
      currency: "VES" as const,
      amountVes: receipt.amountVes,
      rate: receipt.rate,
      reference: `Captura aprobada ${id.slice(0, 8)}`,
      paidAt: now,
      notes,
      createdBy: adminId ?? receipt.clientId,
      photoUrl: receipt.photoUrl,
      createdAt: now,
    };
    db.transaction((tx) => {
      tx.insert(schema.payments).values(payment).run();
      tx.update(schema.paymentReceipts)
        .set({ status: "approved", reviewedBy: adminId, reviewedAt: now, reviewNotes: notes, paymentId })
        .where(eq(schema.paymentReceipts.id, id))
        .run();
    });
    return NextResponse.json({ success: true, paymentId });
  }

  if (action === "reject") {
    db.update(schema.paymentReceipts)
      .set({ status: "rejected", reviewedBy: adminId, reviewedAt: now, reviewNotes: notes })
      .where(eq(schema.paymentReceipts.id, id))
      .run();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const receipt = db.select().from(schema.paymentReceipts).where(eq(schema.paymentReceipts.id, id)).get();
  if (!receipt) {
    return NextResponse.json({ error: "Captura no encontrada" }, { status: 404 });
  }
  if (receipt.status !== "pending") {
    return NextResponse.json({ error: "Solo se pueden eliminar capturas pendientes" }, { status: 400 });
  }
  db.delete(schema.paymentReceipts).where(eq(schema.paymentReceipts.id, id)).run();
  return NextResponse.json({ success: true });
}
