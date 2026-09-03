import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "settings"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = db
    .select()
    .from(schema.navItems)
    .orderBy(asc(schema.navItems.position))
    .all();

  return NextResponse.json(rows);
}

type ItemBody = {
  id: string;
  label: string;
  href: string;
  position: number;
  isActive: boolean;
  openInNewTab: boolean;
};

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "settings"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ItemBody[] | null;
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Body debe ser un array" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  const existingIds = new Set(
    db.select({ id: schema.navItems.id }).from(schema.navItems).all().map((r) => r.id)
  );
  const incomingIds = new Set(body.map((b) => b.id));

  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      db.delete(schema.navItems).where(eq(schema.navItems.id, id)).run();
    }
  }

  for (const item of body) {
    if (!item.id || typeof item.id !== "string" || item.id.length > 50) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    if (!item.label || typeof item.label !== "string" || item.label.trim().length === 0) {
      return NextResponse.json({ error: "La etiqueta es obligatoria" }, { status: 400 });
    }
    if (!item.href || typeof item.href !== "string" || item.href.trim().length === 0) {
      return NextResponse.json({ error: "El enlace es obligatorio" }, { status: 400 });
    }
    if (typeof item.position !== "number" || !Number.isFinite(item.position)) {
      return NextResponse.json({ error: "Posición inválida" }, { status: 400 });
    }

    const label = item.label.trim();
    const href = item.href.trim();

    if (existingIds.has(item.id)) {
      db.update(schema.navItems)
        .set({
          label,
          href,
          position: item.position,
          isActive: item.isActive ? 1 : 0,
          openInNewTab: item.openInNewTab ? 1 : 0,
          updatedAt: now,
        })
        .where(eq(schema.navItems.id, item.id))
        .run();
    } else {
      db.insert(schema.navItems)
        .values({
          id: item.id,
          label,
          href,
          position: item.position,
          isActive: item.isActive ? 1 : 0,
          openInNewTab: item.openInNewTab ? 1 : 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  const rows = db
    .select()
    .from(schema.navItems)
    .orderBy(asc(schema.navItems.position))
    .all();

  return NextResponse.json(rows);
}
