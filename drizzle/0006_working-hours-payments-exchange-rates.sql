CREATE TABLE `exchange_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`rate` real NOT NULL,
	`source` text DEFAULT 'bcv' NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exchange_rates_date_unique` ON `exchange_rates` (`date`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`appointment_id` text,
	`amount_usd` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_ves` real,
	`rate` real,
	`reference` text NOT NULL,
	`paid_at` integer,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_user_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_appointment_idx` ON `payments` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `working_hours` (
	`day_of_week` integer PRIMARY KEY NOT NULL,
	`is_open` integer DEFAULT 1 NOT NULL,
	`start_time` text DEFAULT '09:00' NOT NULL,
	`end_time` text DEFAULT '18:00' NOT NULL
);
