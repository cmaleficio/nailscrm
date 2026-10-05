import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { backfillMissingRates } from "@/lib/bcv";
import { isValidCronSecret } from "@/lib/cron-secret";

export async function GET(request: Request) {
  const session = await auth();
  if (!(await hasPermission(session, "exchangeRates")) && !isValidCronSecret(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const result = await backfillMissingRates();
  if (result.failed) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
