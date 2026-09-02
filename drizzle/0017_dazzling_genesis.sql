CREATE TABLE `legal_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`site_url` text NOT NULL,
	`effective_date` text NOT NULL,
	`country` text NOT NULL,
	`governing_law` text NOT NULL,
	`contact_email` text NOT NULL,
	`contact_phone` text,
	`contact_url` text,
	`contact_address` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
