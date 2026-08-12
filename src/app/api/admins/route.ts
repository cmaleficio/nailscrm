import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isSuperAdmin } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!(await isSuperAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admins = db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      permissions: schema.users.permissions,
    })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"))
    .all();

  const superAdminEmail = process.env.ADMIN_EMAIL || "";
  const res = admins.map((a) => {
    let permissions: string[] | null = null;
    try {
      const parsed = a.permissions ? JSON.parse(a.permissions) : null;
      permissions = Array.isArray(parsed) ? parsed : null;
    } catch {
      permissions = null;
    }
    return { ...a, permissions, isPrimary: a.email === superAdminEmail };
  });

  return NextResponse.json(res);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isSuperAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();

  if (!user) {
    return NextResponse.json(
      { error: "No existe un usuario con ese email" },
      { status: 404 }
    );
  }

  db.update(schema.users)
    .set({ role: "admin" })
    .where(eq(schema.users.email, email))
    .run();

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!(await isSuperAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  if (email === process.env.ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "No puedes quitarte el rol de admin principal" },
      { status: 403 }
    );
  }

  db.update(schema.users)
    .set({ role: "client" })
    .where(eq(schema.users.email, email))
    .run();

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!(await isSuperAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { email, permissions } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (email === process.env.ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "El admin principal tiene acceso a todos los módulos" },
      { status: 403 }
    );
  }
  const valid = Array.isArray(permissions) && permissions.every((p: unknown) => typeof p === "string");
  if (!valid) {
    return NextResponse.json({ error: "permissions debe ser un array de strings" }, { status: 400 });
  }
  db.update(schema.users)
    .set({ permissions: JSON.stringify(permissions) })
    .where(eq(schema.users.email, email))
    .run();
  return NextResponse.json({ success: true });
}