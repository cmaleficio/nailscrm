CREATE TABLE `service_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`url` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `appointment_photos` ADD `kind` text DEFAULT 'reference' NOT NULL;