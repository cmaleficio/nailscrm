CREATE TABLE `gallery_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`service_id` text,
	`caption` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` integer,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
