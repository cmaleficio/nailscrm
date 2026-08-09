import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { refreshTodayRate } from "@/lib/bcv";

function isValidSecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    const url = new URL(request.url);
    const header = request.headers.get("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!isValidSecret(url.searchParams.get("secret") || bearer)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }
  const result = await refreshTodayRate();
  if (result.rate === null) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
