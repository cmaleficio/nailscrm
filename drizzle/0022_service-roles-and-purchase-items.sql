ALTER TABLE `cancelled_appointments` ADD `service_items` text;--> statement-breakpoint
ALTER TABLE `service_purchases` ADD `is_primary` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `is_complementary` integer DEFAULT 0 NOT NULL;