PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`appointment_id` text,
	`amount_usd` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_ves` real,
	`rate` real,
	`reference` text,
	`photo_url` text,
	`paid_at` integer,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "user_id", "appointment_id", "amount_usd", "currency", "amount_ves", "rate", "reference", "photo_url", "paid_at", "notes", "created_by", "created_at") SELECT "id", "user_id", "appointment_id", "amount_usd", "currency", "amount_ves", "rate", "reference", "photo_url", "paid_at", "notes", "created_by", "created_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `payments_user_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_appointment_idx` ON `payments` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `__new_supplier_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`bank_account_id` text,
	`amount_usd` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_ves` real,
	`rate` real,
	`payment_date` integer,
	`reference` text,
	`photo_url` text,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_supplier_payments`("id", "bill_id", "bank_account_id", "amount_usd", "currency", "amount_ves", "rate", "payment_date", "reference", "photo_url", "notes", "created_by", "created_at") SELECT "id", "bill_id", "bank_account_id", "amount_usd", "currency", "amount_ves", "rate", "payment_date", "reference", "photo_url", "notes", "created_by", "created_at" FROM `supplier_payments`;--> statement-breakpoint
DROP TABLE `supplier_payments`;--> statement-breakpoint
ALTER TABLE `__new_supplier_payments` RENAME TO `supplier_payments`;--> statement-breakpoint
CREATE INDEX `supplier_payments_bill_idx` ON `supplier_payments` (`bill_id`);