import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { db } from "@/db/index";
import {
  APP_SETTING_KEYS,
  getAppSetting,
  setAppSetting,
  type AppSettingKey,
} from "@/lib/app-settings";
import { logActivity } from "@/lib/audit";

/**
 * Ajustes globales del salón. Lectura/escritura restringida a
 * admins con permiso `clients` (el superadmin lo tiene por
 * defecto). Las claves están en whitelist: no se puede leer ni
 * escribir ninguna otra.
 */
export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "clients"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const settings: Record<string, string> = {};
  for (const key of APP_SETTING_KEYS) {
    settings[key] = getAppSetting(db, key, key === "detectDuplicateClients" ? "0" : "");
  }
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "clients"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === "string" ? body.key : "";
  const value = typeof body.value === "string" ? body.value : "";

  if (!APP_SETTING_KEYS.includes(key as AppSettingKey)) {
    return NextResponse.json({ error: "Ajuste desconocido" }, { status: 400 });
  }
  if (key === "detectDuplicateClients" && value !== "0" && value !== "1") {
    return NextResponse.json({ error: "El valor debe ser 0 o 1" }, { status: 400 });
  }

  setAppSetting(db, key as AppSettingKey, value, session?.user?.id ?? null);
  logActivity(db, {
    entity: "app_settings",
    action: "update",
    entityId: key,
    label: `Ajuste actualizado: ${key} = ${value}`,
    metadata: { key, value },
    actorId: session?.user?.id ?? null,
    actorName: session?.user?.name ?? null,
  });

  return NextResponse.json({ success: true, key, value });
}
