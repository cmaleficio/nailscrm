CREATE TABLE `payment_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`appointment_id` text,
	`amount_ves` real NOT NULL,
	`rate` real NOT NULL,
	`amount_usd` real NOT NULL,
	`photo_url` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`review_notes` text,
	`payment_id` text,
	`created_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_receipts_client_idx` ON `payment_receipts` (`client_id`);--> statement-breakpoint
CREATE INDEX `payment_receipts_status_idx` ON `payment_receipts` (`status`);--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `barcode` text;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `photo_url` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `photo_url` text;--> statement-breakpoint
ALTER TABLE `supplier_payments` ADD `photo_url` text;--> statement-breakpoint
ALTER TABLE `users` ADD `permissions` text;--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TEMP TABLE `_inv_map` (`old_id` text PRIMARY KEY NOT NULL, `new_id` text NOT NULL);--> statement-breakpoint
INSERT INTO `_inv_map` (`old_id`, `new_id`) SELECT `id`, printf('INV-%03d', row_number() OVER (ORDER BY `rowid`)) FROM `inventory_items`;--> statement-breakpoint
UPDATE `bill_items` SET `inventory_item_id` = (SELECT `new_id` FROM `_inv_map` WHERE `old_id` = `bill_items`.`inventory_item_id`) WHERE `inventory_item_id` IN (SELECT `old_id` FROM `_inv_map`);--> statement-breakpoint
UPDATE `inventory_movements` SET `inventory_item_id` = (SELECT `new_id` FROM `_inv_map` WHERE `old_id` = `inventory_movements`.`inventory_item_id`) WHERE `inventory_item_id` IN (SELECT `old_id` FROM `_inv_map`);--> statement-breakpoint
UPDATE `service_products` SET `inventory_item_id` = (SELECT `new_id` FROM `_inv_map` WHERE `old_id` = `service_products`.`inventory_item_id`) WHERE `inventory_item_id` IN (SELECT `old_id` FROM `_inv_map`);--> statement-breakpoint
UPDATE `inventory_items` SET `id` = (SELECT `new_id` FROM `_inv_map` WHERE `old_id` = `inventory_items`.`id`);--> statement-breakpoint
DROP TABLE `_inv_map`;