CREATE TABLE `appointment_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_usage_unique_idx` ON `appointment_usage` (`appointment_id`,`inventory_item_id`);--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `category` text;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `subcategory` text;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `max_uses` integer;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `uses_consumed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `is_exhausted` integer DEFAULT 0 NOT NULL;