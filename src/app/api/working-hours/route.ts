import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { getWorkingHoursAll, parseHhMm } from "@/lib/workingHours";

export async function GET() {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(getWorkingHoursAll());
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const hours: unknown[] = Array.isArray(body.hours) ? body.hours : [];
  const parsed = hours.map((h) => {
    const r = h as { dayOfWeek: number; isOpen: boolean; startTime: string; endTime: string };
    if (
      typeof r.dayOfWeek !== "number" ||
      r.dayOfWeek < 0 ||
      r.dayOfWeek > 6 ||
      typeof r.startTime !== "string" ||
      typeof r.endTime !== "string"
    ) {
      throw new Error("Horario inválido");
    }
    if (parseHhMm(r.startTime) >= parseHhMm(r.endTime)) {
      throw new Error("La hora de inicio debe ser anterior a la de cierre");
    }
    return r;
  });
  try {
    db.transaction((tx) => {
      for (const r of parsed) {
        const existing = tx
          .select({ dayOfWeek: schema.workingHours.dayOfWeek })
          .from(schema.workingHours)
          .where(eq(schema.workingHours.dayOfWeek, r.dayOfWeek))
          .get();
        if (existing) {
          tx.update(schema.workingHours)
            .set({ isOpen: r.isOpen ? 1 : 0, startTime: r.startTime, endTime: r.endTime })
            .where(eq(schema.workingHours.dayOfWeek, r.dayOfWeek))
            .run();
        } else {
          tx.insert(schema.workingHours)
            .values({
              dayOfWeek: r.dayOfWeek,
              isOpen: r.isOpen ? 1 : 0,
              startTime: r.startTime,
              endTime: r.endTime,
            })
            .run();
        }
      }
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}
