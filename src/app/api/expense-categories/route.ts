import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const rows = includeInactive
    ? db.select().from(schema.expenseCategories).orderBy(schema.expenseCategories.name).all()
    : db
        .select()
        .from(schema.expenseCategories)
        .where(eq(schema.expenseCategories.isActive, 1))
        .orderBy(schema.expenseCategories.name)
        .all();
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
    isActive: 1,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.expenseCategories).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
