CREATE TABLE `course_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`client_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_enrollments_unique_idx` ON `course_enrollments` (`appointment_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `course_enrollments_client_idx` ON `course_enrollments` (`client_id`);--> statement-breakpoint
ALTER TABLE `service_purchases` ADD `financial_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_purchases` ADD `completion_date` integer;--> statement-breakpoint
ALTER TABLE `services` ADD `is_group` integer DEFAULT 0 NOT NULL;