import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  phone: text("phone"),
  address: text("address"),
  passwordHash: text("password_hash"),
  googleId: text("google_id"),
  techNotes: text("tech_notes"),
  totalVisits: integer("total_visits").default(0),
  totalRevenue: real("total_revenue").default(0),
  role: text("role").notNull().default("client"),
  createdAt: integer("created_at"),
});

export const accounts = sqliteTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<"oauth" | "oidc" | "email">().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => ({
  compositePk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
}, (vt) => ({
  compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
}));

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  durationMins: integer("duration_mins").notNull(),
  isActive: integer("is_active").default(1),
});

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => users.id),
    serviceId: text("service_id").notNull().references(() => services.id),
    startTime: integer("start_time"),
    endTime: integer("end_time"),
    status: text("status").default("pending"),
    referencePhotoUrl: text("reference_photo_url"),
    finalPhotoUrl: text("final_photo_url"),
    sharedToGallery: integer("shared_to_gallery").default(0),
    reviewRating: integer("review_rating"),
    reviewText: text("review_text"),
    googleEventIdClient: text("google_event_id_client"),
    googleEventIdAdmin: text("google_event_id_admin"),
    createdAt: integer("created_at"),
  },
  (t) => [
    index("appointments_client_id_idx").on(t.clientId),
    index("appointments_start_time_idx").on(t.startTime),
  ]
);

export const appointmentPhotos = sqliteTable("appointment_photos", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at"),
  kind: text("kind").notNull().default("reference"),
});

export const servicePhotos = sqliteTable("service_photos", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at"),
});

export const servicePurchases = sqliteTable("service_purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  appointmentId: text("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  serviceId: text("service_id").references(() => services.id),
  serviceName: text("service_name").notNull(),
  serviceDescription: text("service_description"),
  servicePrice: real("service_price").notNull(),
  serviceDurationMins: integer("service_duration_mins").notNull(),
  createdAt: integer("created_at"),
}, (t) => [
  index("service_purchases_user_idx").on(t.userId),
  index("service_purchases_appointment_idx").on(t.appointmentId),
]);

export const waitlist = sqliteTable("waitlist", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => users.id),
  preferredDate: integer("preferred_date"),
  notified: integer("notified").default(0),
});

export const blockouts = sqliteTable("blockouts", {
  id: text("id").primaryKey(),
  startTime: integer("start_time"),
  endTime: integer("end_time"),
  reason: text("reason"),
});
