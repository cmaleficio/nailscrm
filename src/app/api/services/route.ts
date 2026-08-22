import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

function withPhotos<T extends { id: string }>(rows: T[]) {
  const photos = db.select().from(schema.servicePhotos).all();
  const byService = new Map<string, { id: string; url: string; position: number }[]>();
  for (const p of photos) {
    const list = byService.get(p.serviceId) ?? [];
    list.push({ id: p.id, url: p.url, position: p.position });
    byService.set(p.serviceId, list);
  }
  return rows.map((r) => ({
    ...r,
    photos: (byService.get(r.id) ?? []).sort((a, b) => a.position - b.position),
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const includeInactive = searchParams.get("includeInactive") === "1";

  if (id) {
    const service = db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .get();
    if (!service) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(withPhotos([service])[0]);
  }

  if (includeInactive) {
    const session = await auth();
    if (!(await hasPermission(session, "services"))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json(
      withPhotos(db.select().from(schema.services).orderBy(schema.services.name).all())
    );
  }

  const services = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.isActive, 1))
    .all();
  return NextResponse.json(withPhotos(services));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "services"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = Number(body.price);
  const durationMins = Number(body.durationMins);

  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: "El precio es inválido" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(durationMins) || durationMins <= 0) {
    return NextResponse.json(
      { error: "La duración debe ser un número entero en minutos" },
      { status: 400 }
    );
  }

  const service = {
    id: crypto.randomUUID(),
    name,
    description:
      typeof body.description === "string" ? body.description.trim() : null,
    price,
    durationMins,
    isActive: body.isActive === false ? 0 : 1,
  };

  db.insert(schema.services).values(service).run();

  return NextResponse.json(service, { status: 201 });
}
