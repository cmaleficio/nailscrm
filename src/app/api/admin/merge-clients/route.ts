import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { db } from "@/db/index";
import {
  mergeClientInto,
  MergeClientsError,
} from "@/lib/merge-clients";
import { recomputeFinancialStatus } from "@/lib/financial-status";

/**
 * Fusión del admin (CRM): mueve TODO el estado de una clienta
 * (citas, pagos, compras, capturas, lista de espera, cursos,
 * saldo, notas) a otra y elimina la fila absorbida. Protegida
 * por el permiso propio `mergeClients`. A diferencia del
 * auto-servicio, NO exige similitud de nombres: el admin
 * elige explícitamente ambas filas.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "mergeClients"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const absorbedId =
    typeof body.absorbedId === "string" ? body.absorbedId.trim() : "";
  const survivingId =
    typeof body.survivingId === "string" ? body.survivingId.trim() : "";
  if (!absorbedId || !survivingId) {
    return NextResponse.json(
      { error: "Falta el id de una de las clientas" },
      { status: 400 }
    );
  }

  try {
    const result = mergeClientInto(db, {
      absorbedId,
      survivingId,
      actorId: session?.user?.id ?? null,
      actorName: session?.user?.name ?? null,
      requireSimilarity: false,
    });
    // Los estados financieros se recomputan tras mover compras y pagos.
    recomputeFinancialStatus(survivingId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof MergeClientsError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("admin merge failed", err);
    return NextResponse.json(
      { error: "No se pudo fusionar las clientas" },
      { status: 500 }
    );
  }
}
