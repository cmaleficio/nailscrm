import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { like, or } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const rows = q
    ? db
        .select()
        .from(schema.suppliers)
        .where(or(like(schema.suppliers.name, `%${q}%`), like(schema.suppliers.phone, `%${q}%`)))
        .orderBy(schema.suppliers.name)
        .all()
    : db.select().from(schema.suppliers).orderBy(schema.suppliers.name).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  const row = {
    id: crypto.randomUUID(),
    name,
    phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
    email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
    address: typeof body.address === "string" && body.address.trim() ? body.address.trim() : null,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.suppliers).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
