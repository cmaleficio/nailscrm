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
    ? db.select().from(schema.bankAccounts).orderBy(schema.bankAccounts.bankName).all()
    : db
        .select()
        .from(schema.bankAccounts)
        .where(eq(schema.bankAccounts.isActive, 1))
        .orderBy(schema.bankAccounts.bankName)
        .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const bankName = typeof body.bankName === "string" ? body.bankName.trim() : "";
  if (!bankName) {
    return NextResponse.json({ error: "El nombre del banco es requerido" }, { status: 400 });
  }
  const currency: "USD" | "VES" = body.currency === "VES" ? "VES" : "USD";
  const accountType: "savings" | "checking" | "cash" =
    body.accountType === "checking" ? "checking" : body.accountType === "cash" ? "cash" : "savings";
  const row = {
    id: crypto.randomUUID(),
    bankName,
    accountType,
    accountNumber: typeof body.accountNumber === "string" && body.accountNumber.trim() ? body.accountNumber.trim() : null,
    currency,
    isActive: 1,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.bankAccounts).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
