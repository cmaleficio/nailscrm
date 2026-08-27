import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { auth } from "@/lib/auth";

const DEFAULTS: Record<string, string> = {
  name: "DreamNails Studio",
  logo_url: "",
};

function getAll(): Record<string, string> {
  const rows = db.select().from(schema.brandSettings).all();
  const map: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) {
    if (r.value !== null) map[r.key] = r.value;
  }
  return map;
}

function set(key: string, value: string) {
  const existing = db
    .select()
    .from(schema.brandSettings)
    .where(eq(schema.brandSettings.key, key))
    .get();
  if (existing) {
    db.update(schema.brandSettings)
      .set({ value })
      .where(eq(schema.brandSettings.key, key))
      .run();
  } else {
    db.insert(schema.brandSettings).values({ key, value }).run();
  }
}

export async function GET() {
  return NextResponse.json(getAll());
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "settings"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { name, logo_url } = body as { name?: string; logo_url?: string };

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
    }
    set("name", trimmed);
  }

  if (logo_url !== undefined) {
    set("logo_url", logo_url.trim());
  }

  return NextResponse.json(getAll());
}
