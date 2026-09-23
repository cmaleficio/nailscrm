import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

export type LinkableDb = BetterSQLite3Database<typeof schema>;
export type UserRow = typeof schema.users.$inferSelect;

export interface LinkGoogleInput {
  email: string;
  googleSub: string;
  name?: string;
  image?: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  scope?: string;
}

export interface LinkGoogleResult {
  userId: string;
  created: boolean;
}

export function linkGoogleAccount(
  db: LinkableDb,
  input: LinkGoogleInput,
): LinkGoogleResult | null {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.googleSub) return null;

  const existingUser = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  if (!existingUser) return null;

  const existingAccount = db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.provider, "google"),
        eq(schema.accounts.providerAccountId, input.googleSub),
      ),
    )
    .get();
  if (existingAccount) return null;

  const userPatch: Partial<UserRow> = {};
  if (!existingUser.googleId) userPatch.googleId = input.googleSub;
  if (!existingUser.image && input.image) userPatch.image = input.image;
  if (!existingUser.emailVerified) userPatch.emailVerified = new Date();
  if (Object.keys(userPatch).length > 0) {
    db.update(schema.users)
      .set(userPatch)
      .where(eq(schema.users.id, existingUser.id))
      .run();
  }

  db.insert(schema.accounts)
    .values({
      userId: existingUser.id,
      type: "oauth",
      provider: "google",
      providerAccountId: input.googleSub,
      access_token: input.accessToken ?? null,
      refresh_token: input.refreshToken ?? null,
      id_token: input.idToken ?? null,
      expires_at: input.expiresAt ?? null,
      scope: input.scope ?? null,
      token_type: input.accessToken ? "Bearer" : null,
    })
    .run();

  return { userId: existingUser.id, created: true };
}