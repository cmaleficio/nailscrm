import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { and, gte, lt } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { getOverlappingAppointments } from "@/lib/availability";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const conditions = [];
  if (from) conditions.push(gte(schema.blockouts.startTime, Number(from)));
  if (to) conditions.push(lt(schema.blockouts.startTime, Number(to)));
  const rows = conditions.length > 0
    ? db.select().from(schema.blockouts).where(and(...conditions)).all()
    : db.select().from(schema.blockouts).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { startTime, endTime, reason } = body;
  if (
    typeof startTime !== "number" ||
    typeof endTime !== "number" ||
    startTime >= endTime
  ) {
    return NextResponse.json(
      { error: "startTime y endTime válidos son requeridos" },
      { status: 400 }
    );
  }
  if (getOverlappingAppointments(startTime, endTime).length > 0) {
    return NextResponse.json(
      { error: "El bloque se solapa con una cita existente" },
      { status: 409 }
    );
  }
  const blockout = {
    id: crypto.randomUUID(),
    startTime,
    endTime,
    reason: typeof reason === "string" ? reason : null,
  };
  db.insert(schema.blockouts).values(blockout).run();
  return NextResponse.json(blockout);
}
