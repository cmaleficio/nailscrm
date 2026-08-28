import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeFinancialStatus } from "@/lib/financial-status";
import { getRateByDate } from "@/lib/bcv";
import { todayStr } from "@/lib/time";

function paidAtToDateStr(paidAt: number): string {
  const d = new Date(paidAt * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const q = db.select().from(schema.payments);
  const rows = userId
    ? q.where(eq(schema.payments.userId, userId)).orderBy(desc(schema.payments.paidAt)).all()
    : q.orderBy(desc(schema.payments.paidAt)).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const {
    userId,
    appointmentId,
    amountUsd,
    currency,
    amountVes,
    rate,
    reference,
    paidAt,
    notes,
    photoUrl,
  } = body;

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  const client = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (appointmentId) {
    const appt = db
      .select({ clientId: schema.appointments.clientId })
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appointmentId))
      .get();
    if (!appt || appt.clientId !== userId) {
      return NextResponse.json(
        { error: "La cita no pertenece al cliente" },
        { status: 400 }
      );
    }
  }

  const cur: "USD" | "VES" = currency === "VES" ? "VES" : "USD";
  let usd = 0;
  let effectiveRate: number | null = null;
  if (cur === "VES") {
    if (typeof amountVes !== "number" || amountVes <= 0) {
      return NextResponse.json({ error: "amountVes es requerido para pagos en Bs" }, { status: 400 });
    }
    effectiveRate = typeof rate === "number" && rate > 0 ? rate : null;
    if (!effectiveRate) {
      const paidDateStr = typeof paidAt === "number" ? paidAtToDateStr(paidAt) : todayStr();
      const fetched = await getRateByDate(paidDateStr);
      effectiveRate = fetched.rate;
    }
    if (!effectiveRate || effectiveRate <= 0) {
      return NextResponse.json({
        error: `No hay tasa BCV para la fecha ${paidAt ? paidAtToDateStr(paidAt) : todayStr()}. Regístalas en /dashboard/exchange-rates`,
      }, { status: 400 });
    }
    usd = Math.round((amountVes / effectiveRate) * 100) / 100;
  } else {
    if (typeof amountUsd !== "number" || amountUsd <= 0) {
      return NextResponse.json({ error: "amountUsd es requerido" }, { status: 400 });
    }
    usd = Math.round(amountUsd * 100) / 100;
  }

  const now = Math.floor(Date.now() / 1000);
  const payment = {
    id: crypto.randomUUID(),
    userId,
    appointmentId: appointmentId ?? null,
    amountUsd: usd,
    currency: cur,
    amountVes: cur === "VES" ? amountVes : null,
    rate: cur === "VES" ? effectiveRate : null,
    reference: typeof reference === "string" && reference.trim() ? reference.trim() : null,
    photoUrl: typeof photoUrl === "string" && photoUrl.trim() ? photoUrl.trim() : null,
    paidAt: typeof paidAt === "number" ? paidAt : now,
    notes: typeof notes === "string" ? notes : null,
    createdBy: adminId,
    createdAt: now,
  };

  db.insert(schema.payments).values(payment).run();
  recomputeFinancialStatus(payment.userId);
  return NextResponse.json(payment);
}
