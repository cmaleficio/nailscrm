PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_appointment_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text,
	`inventory_item_id` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_appointment_usage`("id", "appointment_id", "inventory_item_id", "quantity") SELECT "id", "appointment_id", "inventory_item_id", "quantity" FROM `appointment_usage`;--> statement-breakpoint
DROP TABLE `appointment_usage`;--> statement-breakpoint
ALTER TABLE `__new_appointment_usage` RENAME TO `appointment_usage`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_usage_unique_idx` ON `appointment_usage` (`appointment_id`,`inventory_item_id`);--> statement-breakpoint
CREATE TABLE `__new_service_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`appointment_id` text,
	`service_id` text,
	`service_name` text NOT NULL,
	`service_description` text,
	`service_price` real NOT NULL,
	`service_duration_mins` integer NOT NULL,
	`financial_status` text DEFAULT 'pending' NOT NULL,
	`completion_date` integer,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_service_purchases`("id", "user_id", "appointment_id", "service_id", "service_name", "service_description", "service_price", "service_duration_mins", "financial_status", "completion_date", "created_at") SELECT "id", "user_id", "appointment_id", "service_id", "service_name", "service_description", "service_price", "service_duration_mins", "financial_status", "completion_date", "created_at" FROM `service_purchases`;--> statement-breakpoint
DROP TABLE `service_purchases`;--> statement-breakpoint
ALTER TABLE `__new_service_purchases` RENAME TO `service_purchases`;--> statement-breakpoint
CREATE INDEX `service_purchases_user_idx` ON `service_purchases` (`user_id`);--> statement-breakpoint
CREATE INDEX `service_purchases_appointment_idx` ON `service_purchases` (`appointment_id`);