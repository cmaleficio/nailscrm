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
