import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { hasPermission } from "@/lib/authz";
import { mimeTypeForExtension } from "@/lib/image-upload";
import {
  isPrivateMediaKind,
  parsePrivateMediaFile,
  PRIVATE_MEDIA_RULES,
  PRIVATE_UPLOADS_DIRNAME,
  type PrivateMediaKind,
} from "@/lib/private-media";

type RouteParams = { params: Promise<{ kind: string; file: string }> };

/**
 * Sirve la media que no puede estar en `/public/uploads`, porque allí se
 * distribuye como archivo estático y sin sesión.
 *
 * La autorización sale de la **fila**, no de la URL: se busca la fila cuyo
 * `photo_url` sea exactamente esta URL y se comprueba que quien pregunta sea
 * la clienta dueña o un admin con el permiso del módulo. Un archivo huérfano
 * (subido y nunca ligado a una fila) no se sirve, que es lo que evita que
 * cualquiera que se aparee la URL se lo lleve.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { kind, file } = await params;
  if (!isPrivateMediaKind(kind)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const parsed = parsePrivateMediaFile(file);
  if (!parsed) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const name = `${parsed.filename}.${parsed.extension}`;
  const url = `/api/media/${kind}/${name}`;

  const owner = await findOwner(kind, url);
  if (!owner.found) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!(await canView(session, kind, owner.clientId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // El path en disco se arma con el UUID que ya validó el patrón, nunca con la
  // URL completa, y se resuelve contra el directorio privado.
  //
  // El build emite "Dynamic filesystem access causes tracing of the whole
  // project": es esperado, porque el nombre del archivo solo se conoce en
  // runtime. Solo afecta a `output: "standalone"` (que este proyecto no usa;
  // despliega con `npm start`), así que no se silencia.
  const path = join(process.cwd(), PRIVATE_UPLOADS_DIRNAME, name);
  let buffer: Buffer;
  try {
    buffer = await readFile(path);
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeTypeForExtension(parsed.extension) ?? "application/octet-stream",
      "Content-Length": String(buffer.length),
      // Es la foto de una clienta o una captura bancaria: no debe quedar en
      // ningún caché intermedio (el del túnel, el del navegador) ni en el
      // back-forward cache de la pestaña.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * La clienta ve su propia captura (es lo que pinta "Mis pagos" en el portal) y
 * el admin ve todo el módulo. Para `supplier-payment` e `inventory` no hay
 * clienta dueña: son datos del salón, así que `clientId` llega `null` y solo
 * cuenta el permiso.
 */
async function canView(
  session: Session,
  kind: PrivateMediaKind,
  clientId: string | null
): Promise<boolean> {
  const rule = PRIVATE_MEDIA_RULES[kind];
  if (rule.ownerColumn !== null && clientId !== null && clientId === session.user?.id) {
    return true;
  }
  return hasPermission(session, rule.permission);
}

type Owner =
  | { found: false }
  | { found: true; clientId: string | null };

async function findOwner(kind: PrivateMediaKind, url: string): Promise<Owner> {
  switch (kind) {
    case "receipt": {
      const row = db
        .select({ owner: schema.paymentReceipts.clientId })
        .from(schema.paymentReceipts)
        .where(eq(schema.paymentReceipts.photoUrl, url))
        .get();
      return row ? { found: true, clientId: row.owner } : { found: false };
    }
    case "payment": {
      const row = db
        .select({ owner: schema.payments.userId })
        .from(schema.payments)
        .where(eq(schema.payments.photoUrl, url))
        .get();
      return row ? { found: true, clientId: row.owner } : { found: false };
    }
    case "supplier-payment": {
      const row = db
        .select({ id: schema.supplierPayments.id })
        .from(schema.supplierPayments)
        .where(eq(schema.supplierPayments.photoUrl, url))
        .get();
      return row ? { found: true, clientId: null } : { found: false };
    }
    case "inventory": {
      const row = db
        .select({ id: schema.inventoryItems.id })
        .from(schema.inventoryItems)
        .where(eq(schema.inventoryItems.photoUrl, url))
        .get();
      return row ? { found: true, clientId: null } : { found: false };
    }
  }
}
