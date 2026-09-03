import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  permissions: text("permissions"),
  lockedAt: integer("locked_at"),
  lockedReason: text("locked_reason"),
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
  isGroup: integer("is_group").notNull().default(0),
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

export const galleryPhotos = sqliteTable("gallery_photos", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  serviceId: text("service_id").references(() => services.id),
  caption: text("caption"),
  position: integer("position").notNull().default(0),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at"),
});

export const servicePurchases = sqliteTable("service_purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "cascade" }),
  serviceId: text("service_id").references(() => services.id),
  serviceName: text("service_name").notNull(),
  serviceDescription: text("service_description"),
  servicePrice: real("service_price").notNull(),
  serviceDurationMins: integer("service_duration_mins").notNull(),
  financialStatus: text("financial_status")
    .$type<"pending" | "partial" | "paid" | "void">()
    .notNull()
    .default("pending"),
  completionDate: integer("completion_date"),
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
  createdAt: integer("created_at"),
});

export const blockouts = sqliteTable("blockouts", {
  id: text("id").primaryKey(),
  startTime: integer("start_time"),
  endTime: integer("end_time"),
  reason: text("reason"),
});

export const workingHours = sqliteTable("working_hours", {
  dayOfWeek: integer("day_of_week").primaryKey(),
  isOpen: integer("is_open").notNull().default(1),
  startTime: text("start_time").notNull().default("09:00"),
  endTime: text("end_time").notNull().default("18:00"),
});

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    appointmentId: text("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    amountUsd: real("amount_usd").notNull(),
    currency: text("currency").$type<"USD" | "VES">().notNull().default("USD"),
    amountVes: real("amount_ves"),
    rate: real("rate"),
    reference: text("reference"),
    photoUrl: text("photo_url"),
    paidAt: integer("paid_at"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at"),
  },
  (t) => [
    index("payments_user_idx").on(t.userId),
    index("payments_appointment_idx").on(t.appointmentId),
  ]
);

export const exchangeRates = sqliteTable("exchange_rates", {
  id: text("id").primaryKey(),
  date: text("date").unique().notNull(),
  rate: real("rate").notNull(),
  source: text("source").$type<"bcv" | "manual">().notNull().default("bcv"),
  createdAt: integer("created_at"),
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: integer("created_at"),
});

export const expenseCategories = sqliteTable("expense_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: integer("created_at"),
});

export const bankAccounts = sqliteTable("bank_accounts", {
  id: text("id").primaryKey(),
  bankName: text("bank_name").notNull(),
  accountType: text("account_type").$type<"savings" | "checking" | "cash">().notNull().default("savings"),
  accountNumber: text("account_number"),
  currency: text("currency").$type<"USD" | "VES">().notNull().default("USD"),
  isActive: integer("is_active").notNull().default(1),
  notes: text("notes"),
  createdAt: integer("created_at"),
});

export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("unidad"),
  stock: real("stock").notNull().default(0),
  avgCost: real("avg_cost").notNull().default(0),
  minStock: real("min_stock").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  notes: text("notes"),
  barcode: text("barcode"),
  photoUrl: text("photo_url"),
  category: text("category"),
  subcategory: text("subcategory"),
  maxUses: integer("max_uses"),
  usesConsumed: integer("uses_consumed").notNull().default(0),
  isExhausted: integer("is_exhausted").notNull().default(0),
  createdAt: integer("created_at"),
});

export const inventoryMovements = sqliteTable(
  "inventory_movements",
  {
    id: text("id").primaryKey(),
    inventoryItemId: text("inventory_item_id").notNull().references(() => inventoryItems.id),
    kind: text("kind").$type<"in" | "out" | "adjust" | "cost_adjust">().notNull(),
    quantity: real("quantity").notNull(),
    unitCostUsd: real("unit_cost_usd"),
    refType: text("ref_type").$type<"bill" | "manual" | "usage">().notNull().default("manual"),
    refId: text("ref_id"),
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id),
    createdAt: integer("created_at"),
  },
  (t) => [index("inventory_movements_item_idx").on(t.inventoryItemId)]
);

export const bills = sqliteTable(
  "bills",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id").references(() => suppliers.id),
    categoryId: text("category_id").references(() => expenseCategories.id),
    invoiceNumber: text("invoice_number"),
    type: text("type").$type<"inventory" | "fixed">().notNull().default("inventory"),
    billDate: integer("bill_date"),
    dueDate: integer("due_date"),
    currency: text("currency").$type<"USD" | "VES">().notNull().default("USD"),
    amountVes: real("amount_ves"),
    rate: real("rate"),
    totalUsd: real("total_usd").notNull(),
    status: text("status").$type<"pending" | "partial" | "paid">().notNull().default("pending"),
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id),
    createdAt: integer("created_at"),
  },
  (t) => [
    index("bills_bill_date_idx").on(t.billDate),
    index("bills_status_idx").on(t.status),
    index("bills_supplier_idx").on(t.supplierId),
  ]
);

export const billItems = sqliteTable(
  "bill_items",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id").references(() => inventoryItems.id),
    description: text("description"),
    quantity: real("quantity").notNull(),
    unitCostUsd: real("unit_cost_usd").notNull(),
    totalUsd: real("total_usd").notNull(),
  },
  (t) => [index("bill_items_bill_idx").on(t.billId)]
);

export const supplierPayments = sqliteTable(
  "supplier_payments",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id").notNull().references(() => bills.id),
    bankAccountId: text("bank_account_id").references(() => bankAccounts.id),
    amountUsd: real("amount_usd").notNull(),
    currency: text("currency").$type<"USD" | "VES">().notNull().default("USD"),
    amountVes: real("amount_ves"),
    rate: real("rate"),
    paymentDate: integer("payment_date"),
    reference: text("reference"),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id),
    createdAt: integer("created_at"),
  },
  (t) => [index("supplier_payments_bill_idx").on(t.billId)]
);

export const serviceProducts = sqliteTable(
  "service_products",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id").notNull().references(() => inventoryItems.id),
    quantityPerService: real("quantity_per_service").notNull(),
  },
  (t) => [uniqueIndex("service_products_unique_idx").on(t.serviceId, t.inventoryItemId)]
);

export const cancelledAppointments = sqliteTable(
  "cancelled_appointments",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id"),
    clientId: text("client_id").notNull().references(() => users.id),
    serviceId: text("service_id").references(() => services.id),
    serviceName: text("service_name").notNull(),
    servicePrice: real("service_price").notNull().default(0),
    startTime: integer("start_time"),
    endTime: integer("end_time"),
    referencePhotoUrls: text("reference_photo_urls"),
    cancelledBy: text("cancelled_by").notNull().references(() => users.id),
    cancelledAt: integer("cancelled_at").notNull(),
    reason: text("reason"),
  },
  (t) => [
    index("cancelled_appointments_client_idx").on(t.clientId),
    index("cancelled_appointments_cancelled_at_idx").on(t.cancelledAt),
  ]
);

export const paymentReceipts = sqliteTable(
  "payment_receipts",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => users.id),
    appointmentId: text("appointment_id").references(() => appointments.id),
    amountVes: real("amount_ves").notNull(),
    rate: real("rate").notNull(),
    amountUsd: real("amount_usd").notNull(),
    photoUrl: text("photo_url").notNull(),
    status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: integer("reviewed_at"),
    reviewNotes: text("review_notes"),
    paymentId: text("payment_id").references(() => payments.id),
    createdAt: integer("created_at"),
  },
  (t) => [
    index("payment_receipts_client_idx").on(t.clientId),
    index("payment_receipts_status_idx").on(t.status),
  ]
);

export const brandSettings = sqliteTable("brand_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

export const appointmentUsage = sqliteTable(
  "appointment_usage",
  {
    id: text("id").primaryKey(),
  appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id").notNull().references(() => inventoryItems.id),
    quantity: real("quantity").notNull().default(1),
  },
  (t) => [uniqueIndex("appointment_usage_unique_idx").on(t.appointmentId, t.inventoryItemId)]
);

export const courseEnrollments = sqliteTable(
  "course_enrollments",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull().references(() => users.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("course_enrollments_unique_idx").on(t.appointmentId, t.clientId),
    index("course_enrollments_client_idx").on(t.clientId),
  ]
);

export const legalSettings = sqliteTable("legal_settings", {
  key: text("key").primaryKey(),
  companyName: text("company_name").notNull(),
  siteUrl: text("site_url").notNull(),
  effectiveDate: text("effective_date").notNull(),
  country: text("country").notNull(),
  governingLaw: text("governing_law").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  contactUrl: text("contact_url"),
  contactAddress: text("contact_address").notNull(),
  content: text("content"),
  updatedAt: integer("updated_at").notNull(),
  updatedBy: text("updated_by").references(() => users.id),
});

export const navItems = sqliteTable("nav_items", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  href: text("href").notNull(),
  position: integer("position").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  openInNewTab: integer("open_in_new_tab").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const riscEvents = sqliteTable("risc_events", {
  jti: text("jti").primaryKey(),
  eventType: text("event_type").notNull(),
  subjectSub: text("subject_sub"),
  receivedAt: integer("received_at").notNull(),
});
