import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  phone: text("phone"),
  googleId: text("google_id"),
  techNotes: text("tech_notes"),
  totalVisits: integer("total_visits").default(0),
  totalRevenue: real("total_revenue").default(0),
  createdAt: integer("created_at"),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  durationMins: integer("duration_mins").notNull(),
  isActive: integer("is_active").default(1),
});

export const appointments = sqliteTable("appointments", {
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
});

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
