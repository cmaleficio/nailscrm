CREATE TABLE `payment_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`amount_usd` real NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`purchase_id`) REFERENCES `service_purchases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_allocations_unique` ON `payment_allocations` (`payment_id`,`purchase_id`);--> statement-breakpoint
CREATE INDEX `payment_allocations_purchase_idx` ON `payment_allocations` (`purchase_id`);