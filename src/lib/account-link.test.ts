import { describe, test, expect } from "vitest";
import { eq, and } from "drizzle-orm";
import { linkGoogleAccount } from "./account-link";
import { createTestDb, seedUser, type TestDb } from "./account-link.test-helpers";
import * as schema from "@/db/schema";

describe("linkGoogleAccount", () => {
  test("links existing user by email when no google account row exists", () => {
    const db = createTestDb();
    const user = seedUser(db, {
      id: "u-1",
      email: "ana@example.com",
      name: "Ana Martínez",
      passwordHash: "bcrypt-hash",
    });

    const result = linkGoogleAccount(db, {
      email: "ana@example.com",
      googleSub: "google-sub-123",
      name: "Ana Martínez",
      image: "https://lh3.googleusercontent.com/ana.jpg",
    });

    expect(result).toEqual({ userId: "u-1", created: true });

    const account = db
      .select()
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.provider, "google"),
          eq(schema.accounts.providerAccountId, "google-sub-123"),
        ),
      )
      .get();
    expect(account).toBeDefined();
    expect(account?.userId).toBe("u-1");
    expect(account?.type).toBe("oauth");

    const updatedUser = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, "u-1"))
      .get();
    expect(updatedUser?.googleId).toBe("google-sub-123");
    expect(updatedUser?.image).toBe("https://lh3.googleusercontent.com/ana.jpg");
    expect(updatedUser?.emailVerified).not.toBeNull();
    expect(updatedUser?.passwordHash).toBe("bcrypt-hash");
  });

  test("is a no-op when no user matches the email", () => {
    const db = createTestDb();
    seedUser(db, {
      id: "u-1",
      email: "ana@example.com",
      name: "Ana Martínez",
    });

    const result = linkGoogleAccount(db, {
      email: "nadie@example.com",
      googleSub: "google-sub-999",
    });

    expect(result).toBeNull();

    const accountCount = db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.provider, "google"))
      .all();
    expect(accountCount).toHaveLength(0);
  });

  test("is a no-op when google account row already exists for that user", () => {
    const db = createTestDb();
    const user = seedUser(db, {
      id: "u-1",
      email: "ana@example.com",
      name: "Ana Martínez",
    });
    db.insert(schema.accounts)
      .values({
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: "google-sub-123",
        access_token: "old-token",
      })
      .run();

    const result = linkGoogleAccount(db, {
      email: "ana@example.com",
      googleSub: "google-sub-123",
      accessToken: "new-token",
      refreshToken: "new-refresh",
    });

    expect(result).toBeNull();

    const account = db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, "u-1"))
      .all();
    expect(account).toHaveLength(1);
    expect(account[0].access_token).toBe("old-token");
  });

  test("does not overwrite fields that are already populated", () => {
    const db = createTestDb();
    seedUser(db, {
      id: "u-1",
      email: "ana@example.com",
      name: "Ana Martínez",
      googleId: "old-google-sub",
      image: "https://custom.com/ana.jpg",
      emailVerified: new Date(1700000000000),
    });

    linkGoogleAccount(db, {
      email: "ana@example.com",
      googleSub: "new-google-sub",
      image: "https://lh3.googleusercontent.com/ana.jpg",
    });

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, "u-1"))
      .get();
    expect(user?.googleId).toBe("old-google-sub");
    expect(user?.image).toBe("https://custom.com/ana.jpg");
    expect(user?.emailVerified?.getTime()).toBe(1700000000000);
  });

  test("persists OAuth tokens when provided", () => {
    const db = createTestDb();
    seedUser(db, {
      id: "u-1",
      email: "ana@example.com",
      name: "Ana Martínez",
    });

    linkGoogleAccount(db, {
      email: "ana@example.com",
      googleSub: "google-sub-123",
      accessToken: "ya29.access",
      refreshToken: "1//refresh",
      idToken: "id-token.jwt",
      expiresAt: 1234567890,
      scope: "openid email profile",
    });

    const account = db
      .select()
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.provider, "google"),
          eq(schema.accounts.providerAccountId, "google-sub-123"),
        ),
      )
      .get();
    expect(account?.access_token).toBe("ya29.access");
    expect(account?.refresh_token).toBe("1//refresh");
    expect(account?.id_token).toBe("id-token.jwt");
    expect(account?.expires_at).toBe(1234567890);
    expect(account?.scope).toBe("openid email profile");
    expect(account?.token_type).toBe("Bearer");
  });

  test("normalizes email comparison (trim + lowercase)", () => {
    const db = createTestDb();
    seedUser(db, {
      id: "u-1",
      email: "ana@example.com",
      name: "Ana Martínez",
    });

    const result = linkGoogleAccount(db, {
      email: "  ANA@Example.COM ",
      googleSub: "google-sub-123",
    });

    expect(result).toEqual({ userId: "u-1", created: true });
  });
});