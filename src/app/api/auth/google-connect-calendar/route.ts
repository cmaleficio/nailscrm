import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/profile";
  const state = Buffer.from(
    JSON.stringify({ uid: session.user.id, returnTo })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID || "",
    redirect_uri: `${request.nextUrl.origin}/api/auth/handle-google-calendar`,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authorizeUrl);
}