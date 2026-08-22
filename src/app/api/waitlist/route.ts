import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { and, asc, eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rows = db
    .select({
      id: schema.waitlist.id,
      clientId: schema.waitlist.clientId,
      clientName: schema.users.name,
      clientPhone: schema.users.phone,
      preferredDate: schema.waitlist.preferredDate,
      notified: schema.waitlist.notified,
      createdAt: schema.waitlist.createdAt,
    })
    .from(schema.waitlist)
    .innerJoin(schema.users, eq(schema.waitlist.clientId, schema.users.id))
    .orderBy(asc(schema.waitlist.preferredDate), asc(schema.waitlist.createdAt))
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Inicia sesión para unirte a la lista de espera" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const preferredDate = body?.preferredDate;
  if (!Number.isInteger(preferredDate) || (preferredDate as number) <= 0) {
    return NextResponse.json(
      { error: "Fecha inválida" },
      { status: 400 }
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if ((preferredDate as number) < nowSec) {
    return NextResponse.json(
      { error: "No puedes unirte a la lista de espera de una fecha pasada" },
      { status: 400 }
    );
  }

  const existing = db
    .select({ id: schema.waitlist.id })
    .from(schema.waitlist)
    .where(
      and(
        eq(schema.waitlist.clientId, session.user.id),
        eq(schema.waitlist.preferredDate, preferredDate as number)
      )
    )
    .get();

  if (existing) {
    return NextResponse.json(
      { error: "Ya estás en la lista de espera para ese día" },
      { status: 409 }
    );
  }

  const row = {
    id: crypto.randomUUID(),
    clientId: session.user.id,
    preferredDate: preferredDate as number,
    notified: 0,
    createdAt: nowSec,
  };
  db.insert(schema.waitlist).values(row).run();

  return NextResponse.json(row, { status: 201 });
}
