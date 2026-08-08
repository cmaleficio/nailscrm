import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, like, or, and } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const conditions = [eq(schema.users.role, "client")];
  if (q) {
    conditions.push(
      or(
        like(schema.users.name, `%${q}%`),
        like(schema.users.email, `%${q}%`),
        like(schema.users.phone, `%${q}%`)
      )!
    );
  }
  const clients = db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.phone,
      address: schema.users.address,
      totalVisits: schema.users.totalVisits,
      totalRevenue: schema.users.totalRevenue,
      techNotes: schema.users.techNotes,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(and(...conditions))
    .orderBy(schema.users.name)
    .all();
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "El correo es inválido" }, { status: 400 });
  }

  if (!email) {
    email = `${crypto.randomUUID()}@local`;
  }

  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un cliente con ese correo" },
      { status: 409 }
    );
  }

  const randomPassword = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(randomPassword, 10);

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    phone: phone || null,
    address: address || null,
    passwordHash,
    totalVisits: 0,
    totalRevenue: 0,
    role: "client" as const,
    createdAt: Math.floor(Date.now() / 1000),
  };

  db.insert(schema.users).values(user).run();

  return NextResponse.json({ success: true, id: user.id }, { status: 201 });
}
