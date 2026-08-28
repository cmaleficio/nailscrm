import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { db, schema } from "@/db/index";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rows = db
    .select()
    .from(schema.exchangeRates)
    .orderBy(sql`${schema.exchangeRates.date} DESC`)
    .all();
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { date, rate } = body as { date?: string; rate?: number };
    if (!date || typeof rate !== "number" || rate <= 0) {
      return NextResponse.json(
        { error: "date y rate (number > 0) son obligatorios" },
        { status: 400 }
      );
    }
    const id = crypto.randomUUID();
    await db
      .insert(schema.exchangeRates)
      .values({
        id,
        date: date,
        rate: rate,
        source: "manual",
        createdAt: Math.floor(Date.now() / 1000),
      })
      .onConflictDoUpdate({
        target: schema.exchangeRates.date,
        set: {
          rate: rate,
          source: "manual",
          createdAt: Math.floor(Date.now() / 1000),
        },
      })
      .run();
    return NextResponse.json({ date, rate, source: "manual" });
  } catch (err) {
    console.error("POST /api/exchange-rate error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}