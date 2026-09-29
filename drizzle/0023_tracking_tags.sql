CREATE TABLE `tracking_tags` (
	`key` text PRIMARY KEY NOT NULL,
	`snippet` text DEFAULT '' NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
