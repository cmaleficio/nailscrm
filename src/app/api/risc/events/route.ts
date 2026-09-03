import { NextResponse, type NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { db, schema } from "@/db/index";
import { and, eq } from "drizzle-orm";

const GOOGLE_RISC_ISSUER = "https://accounts.google.com";
const GOOGLE_CLIENT_ID = process.env.AUTH_GOOGLE_ID;

const oauthClient = new OAuth2Client();

interface SecEvent {
  iss: string;
  aud: string | string[];
  iat: number;
  jti: string;
  events: Record<
    string,
    { subject?: { sub?: string }; reason?: string; state?: string }
  >;
}

async function verifyToken(token: string): Promise<SecEvent> {
  if (!GOOGLE_CLIENT_ID) throw new Error("AUTH_GOOGLE_ID not configured");
  const ticket = await oauthClient.verifyIdToken({
    idToken: token,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("invalid token");
  if (payload.iss !== GOOGLE_RISC_ISSUER) throw new Error("bad issuer");
  return payload as unknown as SecEvent;
}

function subjectForSub(sub: string) {
  const account = db
    .select()
    .from(schema.accounts)
    .where(and(eq(schema.accounts.provider, "google"), eq(schema.accounts.providerAccountId, sub)))
    .get();
  return account?.userId ?? null;
}

function invalidateUser(userId: string) {
  db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
  db.delete(schema.accounts).where(eq(schema.accounts.userId, userId)).run();
}

function lockUser(userId: string, reason: string) {
  const now = Math.floor(Date.now() / 1000);
  db.update(schema.users)
    .set({ lockedAt: now, lockedReason: reason })
    .where(eq(schema.users.id, userId))
    .run();
  invalidateUser(userId);
}

function alreadySeen(jti: string): boolean {
  const row = db.select().from(schema.riscEvents).where(eq(schema.riscEvents.jti, jti)).get();
  return Boolean(row);
}

function recordEvent(jti: string, eventType: string, sub: string | null) {
  db.insert(schema.riscEvents)
    .values({ jti, eventType, subjectSub: sub, receivedAt: Math.floor(Date.now() / 1000) })
    .onConflictDoNothing()
    .run();
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return new NextResponse("missing bearer", { status: 401 });

  let event: SecEvent;
  try {
    event = await verifyToken(match[1]);
  } catch (err) {
    console.error("[risc] verify failed", err);
    return new NextResponse("invalid token", { status: 401 });
  }

  if (alreadySeen(event.jti)) {
    return new NextResponse(null, { status: 202 });
  }

  const expectedAud = Array.isArray(event.aud) ? event.aud : [event.aud];
  if (!expectedAud.includes(GOOGLE_CLIENT_ID ?? "")) {
    return new NextResponse("bad audience", { status: 401 });
  }

  for (const [eventType, payload] of Object.entries(event.events)) {
    const sub = payload.subject?.sub ?? null;
    recordEvent(event.jti, eventType, sub);

    const userId = sub ? subjectForSub(sub) : null;

    switch (eventType) {
      case "https://schemas.openid.net/secevent/risc/event-type/sessions-revoked":
      case "https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked":
      case "https://schemas.openid.net/secevent/oauth/event-type/token-revoked":
        if (userId) invalidateUser(userId);
        console.log(`[risc] ${eventType} -> invalidated user=${userId ?? "unknown"}`);
        break;
      case "https://schemas.openid.net/secevent/risc/event-type/account-disabled":
        if (userId) lockUser(userId, payload.reason ?? "disabled");
        console.log(`[risc] account-disabled -> locked user=${userId ?? "unknown"} reason=${payload.reason ?? "n/a"}`);
        break;
      case "https://schemas.openid.net/secevent/risc/event-type/account-enabled":
        if (userId) {
          db.update(schema.users)
            .set({ lockedAt: null, lockedReason: null })
            .where(eq(schema.users.id, userId))
            .run();
        }
        console.log(`[risc] account-enabled -> unlocked user=${userId ?? "unknown"}`);
        break;
      case "https://schemas.openid.net/secevent/risc/event-type/verification":
        console.log(`[risc] verification token received, state=${payload.state ?? "n/a"}`);
        break;
      case "https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required":
        console.log(`[risc] credential change required user=${userId ?? "unknown"}`);
        break;
      default:
        console.log(`[risc] unhandled type ${eventType}`);
    }
  }

  return new NextResponse(null, { status: 202 });
}