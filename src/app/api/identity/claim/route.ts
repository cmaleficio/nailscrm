import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/index";
import { isDuplicateDetectionEnabled } from "@/lib/app-settings";
import {
  mergeClientInto,
  MergeClientsError,
} from "@/lib/merge-clients";
import { recomputeFinancialStatus } from "@/lib/financial-status";

/**
 * Auto-servicio: la clienta que acaba de registrarse con
 * Google (o que ya está en /profile) reclama el expediente
 * de una clienta existente con nombre similar. La fila de la
 * sesión sobrevive y absorbe el historial de la candidata,
 * así la sesión no se invalida. El servidor recalcula la
 * similitud de nombres: no se puede reclamar una clienta
 * arbitraria adivinando su id.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticada" }, { status: 401 });
  }
  if (!isDuplicateDetectionEnabled()) {
    return NextResponse.json(
      { error: "La detección de duplicados está desactivada" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId =
    typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  if (!targetUserId) {
    return NextResponse.json(
      { error: "Falta la clienta a fusionar" },
      { status: 400 }
    );
  }

  try {
    const result = mergeClientInto(db, {
      absorbedId: targetUserId,
      survivingId: session.user.id,
      actorId: session.user.id,
      actorName: session.user.name ?? null,
      requireSimilarity: true,
    });
    // Los estados financieros se recomputan tras mover compras y pagos.
    recomputeFinancialStatus(session.user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof MergeClientsError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("identity claim failed", err);
    return NextResponse.json(
      { error: "No se pudo unir el expediente" },
      { status: 500 }
    );
  }
}
