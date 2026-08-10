CREATE TABLE `cancelled_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text,
	`client_id` text NOT NULL,
	`service_id` text,
	`service_name` text NOT NULL,
	`service_price` real DEFAULT 0 NOT NULL,
	`start_time` integer,
	`end_time` integer,
	`reference_photo_urls` text,
	`cancelled_by` text NOT NULL,
	`cancelled_at` integer NOT NULL,
	`reason` text,
	FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cancelled_appointments_client_idx` ON `cancelled_appointments` (`client_id`);--> statement-breakpoint
CREATE INDEX `cancelled_appointments_cancelled_at_idx` ON `cancelled_appointments` (`cancelled_at`);