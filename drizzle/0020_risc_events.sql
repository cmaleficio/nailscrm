CREATE TABLE `risc_events` (
	`jti` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`subject_sub` text,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `locked_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `locked_reason` text;