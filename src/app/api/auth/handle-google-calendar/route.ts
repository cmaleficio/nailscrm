import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");

  if (!stateRaw) {
    return NextResponse.redirect(
      new URL("/profile?calendar_error=invalid_state", request.url)
    );
  }

  let state: { uid: string; returnTo: string };
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8"));
  } catch {
    return NextResponse.redirect(
      new URL("/profile?calendar_error=invalid_state", request.url)
    );
  }

  const returnTo = state.returnTo || "/profile";

  if (!code) {
    return NextResponse.redirect(
      new URL(`${returnTo}?calendar_error=missing_code`, request.url)
    );
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.AUTH_GOOGLE_ID || "",
      client_secret: process.env.AUTH_GOOGLE_SECRET || "",
      redirect_uri: `${request.nextUrl.origin}/api/auth/handle-google-calendar`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token exchange failed", tokenRes.status, await tokenRes.text());
    return NextResponse.redirect(
      new URL(`${returnTo}?calendar_error=token_exchange`, request.url)
    );
  }

  const tokens = await tokenRes.json();
  const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600);

  const existing = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, state.uid))
    .all()
    .find((a) => a.provider === "google");

  if (existing) {
    db.update(schema.accounts)
      .set({
        access_token: tokens.access_token,
        expires_at: expiresAt,
        refresh_token: tokens.refresh_token ?? existing.refresh_token,
        scope: tokens.scope ?? existing.scope,
        id_token: tokens.id_token ?? existing.id_token,
      })
      .where(eq(schema.accounts.userId, state.uid))
      .run();
  } else {
    db.insert(schema.accounts)
      .values({
        userId: state.uid,
        type: "oauth",
        provider: "google",
        providerAccountId: state.uid,
        access_token: tokens.access_token,
        expires_at: expiresAt,
        refresh_token: tokens.refresh_token ?? null,
        scope: tokens.scope ?? null,
        id_token: tokens.id_token ?? null,
      })
      .run();
  }

  return NextResponse.redirect(
    new URL(`${returnTo}?calendar_connected=1`, request.url)
  );
}