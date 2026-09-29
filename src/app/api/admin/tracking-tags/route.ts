import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/authz";
import { logActivity } from "@/lib/audit";
import { MAX_SNIPPET_LENGTH, parseTrackingSnippet } from "@/lib/tracking-tags";

/**
 * Snippet de etiquetas de analítica. Lo edita SOLO el superadmin (no una clave
 * de PERMISSION_KEYS) porque el snippet es JS arbitrario que se ejecuta en el
 * navegador de cada visitante: delegarlo a un sub-admin sería XSS almacenado.
 * La misma pantalla (/dashboard/admin-users) ya está restringida igual.
 */
const TRACKING_KEY = "head";

const EMPTY = { snippet: "", isEnabled: true, updatedAt: null as number | null };

export async function GET() {
  const session = await auth();
  if (!(await isSuperAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const row = db
    .select()
    .from(schema.trackingTags)
    .where(eq(schema.trackingTags.key, TRACKING_KEY))
    .get();

  if (!row) return NextResponse.json(EMPTY);

  return NextResponse.json({
    snippet: row.snippet,
    isEnabled: row.isEnabled === 1,
    updatedAt: row.updatedAt,
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!(await isSuperAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { snippet?: unknown; isEnabled?: unknown }
    | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const snippet = typeof body.snippet === "string" ? body.snippet : "";
  if (snippet.length > MAX_SNIPPET_LENGTH) {
    return NextResponse.json(
      { error: `El snippet no puede superar los ${MAX_SNIPPET_LENGTH} caracteres` },
      { status: 400 }
    );
  }

  // Avisamos temprano si no hay un solo <script>: casi siempre es un pegado
  // truncado o un tag que no se va a cargar nunca.
  if (snippet.trim() && parseTrackingSnippet(snippet).length === 0) {
    return NextResponse.json(
      { error: "No se encontró ninguna etiqueta <script> en el código" },
      { status: 400 }
    );
  }

  const isEnabled = body.isEnabled === undefined ? true : body.isEnabled === true;
  const now = Math.floor(Date.now() / 1000);

  db.insert(schema.trackingTags)
    .values({
      key: TRACKING_KEY,
      snippet,
      isEnabled: isEnabled ? 1 : 0,
      updatedAt: now,
      updatedBy: session?.user?.id ?? null,
    })
    .onConflictDoUpdate({
      target: schema.trackingTags.key,
      set: { snippet, isEnabled: isEnabled ? 1 : 0, updatedAt: now, updatedBy: session?.user?.id ?? null },
    })
    .run();

  const parsed = parseTrackingSnippet(snippet);
  // El snippet puede llevar IDs o claves de terceros: al log solo va su tamaño.
  logActivity(db, {
    entity: "tracking_tags",
    action: "update",
    label: isEnabled ? "Etiquetas de analítica actualizadas" : "Etiquetas de analítica desactivadas",
    metadata: { bytes: snippet.length, tags: parsed.length, isEnabled },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });

  return NextResponse.json({ snippet, isEnabled, updatedAt: now });
}
