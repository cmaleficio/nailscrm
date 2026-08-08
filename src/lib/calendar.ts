import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CAL_BASE = "https://www.googleapis.com/calendar/v3";

async function fetchFreshGoogleToken(
  refreshToken: string | null
): Promise<{ accessToken: string; expiresAt: number } | null> {
  if (!refreshToken) return null;

  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID || "",
    client_secret: process.env.AUTH_GOOGLE_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  try {
    const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) {
      console.error("Google token refresh failed", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    if (!data.access_token) {
      console.error("Google refresh missing access_token");
      return null;
    }
    return {
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    };
  } catch (e) {
    console.error("Google token refresh error", e);
    return null;
  }
}

export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  const account = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId))
    .all()
    .find((a) => a.provider === "google");

  if (!account?.refresh_token) return null;

  const expiresAt = account.expires_at;
  if (
    account.access_token &&
    expiresAt &&
    expiresAt > Math.floor(Date.now() / 1000) - 60
  ) {
    return account.access_token;
  }

  const fresh = await fetchFreshGoogleToken(account.refresh_token);
  if (!fresh) return null;

  db.update(schema.accounts)
    .set({ access_token: fresh.accessToken, expires_at: fresh.expiresAt })
    .where(eq(schema.accounts.userId, userId))
    .run();

  return fresh.accessToken;
}

export async function createEventOnPrimaryCalendar(
  userId: string,
  event: {
    summary: string;
    description?: string;
    start: number;
    end: number;
  }
): Promise<string | null> {
  const token = await getValidAccessToken(userId);
  if (!token) {
    console.error(`createEvent: no token for user ${userId}`);
    return null;
  }

  const body = {
    summary: event.summary,
    ...(event.description ? { description: event.description } : {}),
    start: { dateTime: new Date(event.start * 1000).toISOString() },
    end: { dateTime: new Date(event.end * 1000).toISOString() },
  };

  try {
    const res = await fetch(`${GOOGLE_CAL_BASE}/calendars/primary/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Google event create failed", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.id ?? null;
  } catch (e) {
    console.error("Google event create error", e);
    return null;
  }
}

export async function updateEventOnPrimaryCalendar(
  userId: string,
  eventId: string,
  event: { start: number; end: number }
): Promise<boolean> {
  const token = await getValidAccessToken(userId);
  if (!token) return false;

  try {
    const res = await fetch(
      `${GOOGLE_CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start: { dateTime: new Date(event.start * 1000).toISOString() },
          end: { dateTime: new Date(event.end * 1000).toISOString() },
        }),
      }
    );
    return res.ok;
  } catch (e) {
    console.error("Google event update error", e);
    return false;
  }
}

export async function deleteEventOnPrimaryCalendar(
  userId: string,
  eventId: string
): Promise<boolean> {
  const token = await getValidAccessToken(userId);
  if (!token) return false;

  try {
    const res = await fetch(
      `${GOOGLE_CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.ok || res.status === 404;
  } catch (e) {
    console.error("Google event delete error", e);
    return false;
  }
}

export async function getAdminUserId(): Promise<string | null> {
  const email = process.env.ADMIN_EMAIL;
  if (!email) return null;
  const admin = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  return admin?.id ?? null;
}

export async function createAppointmentClientEvent(appointment: {
  clientId: string;
  startTime: number;
  endTime: number;
  summary: string;
  description?: string;
}): Promise<string | null> {
  return createEventOnPrimaryCalendar(appointment.clientId, {
    summary: appointment.summary,
    description: appointment.description,
    start: appointment.startTime,
    end: appointment.endTime,
  });
}

export async function createAppointmentAdminEvent(appointment: {
  startTime: number;
  endTime: number;
  summary: string;
  description?: string;
}): Promise<string | null> {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) return null;
  return createEventOnPrimaryCalendar(adminUserId, {
    summary: appointment.summary,
    description: appointment.description,
    start: appointment.startTime,
    end: appointment.endTime,
  });
}

export async function updateAppointmentEvent(
  userId: string,
  eventId: string,
  start: number,
  end: number
): Promise<boolean> {
  return updateEventOnPrimaryCalendar(userId, eventId, { start, end });
}

export async function deleteAppointmentEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  return deleteEventOnPrimaryCalendar(userId, eventId);
}