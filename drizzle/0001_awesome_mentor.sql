CREATE TABLE `appointment_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`url` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'client' NOT NULL;