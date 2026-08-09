CREATE TABLE `bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_name` text NOT NULL,
	`account_type` text DEFAULT 'savings' NOT NULL,
	`account_number` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `bill_items` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`inventory_item_id` text,
	`description` text,
	`quantity` real NOT NULL,
	`unit_cost_usd` real NOT NULL,
	`total_usd` real NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bill_items_bill_idx` ON `bill_items` (`bill_id`);--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text,
	`category_id` text,
	`invoice_number` text,
	`type` text DEFAULT 'inventory' NOT NULL,
	`bill_date` integer,
	`due_date` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_ves` real,
	`rate` real,
	`total_usd` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bills_bill_date_idx` ON `bills` (`bill_date`);--> statement-breakpoint
CREATE INDEX `bills_status_idx` ON `bills` (`status`);--> statement-breakpoint
CREATE INDEX `bills_supplier_idx` ON `bills` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit` text DEFAULT 'unidad' NOT NULL,
	`stock` real DEFAULT 0 NOT NULL,
	`avg_cost` real DEFAULT 0 NOT NULL,
	`min_stock` real DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`inventory_item_id` text NOT NULL,
	`kind` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_cost_usd` real,
	`ref_type` text DEFAULT 'manual' NOT NULL,
	`ref_id` text,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inventory_movements_item_idx` ON `inventory_movements` (`inventory_item_id`);--> statement-breakpoint
CREATE TABLE `service_products` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`quantity_per_service` real NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_products_unique_idx` ON `service_products` (`service_id`,`inventory_item_id`);--> statement-breakpoint
CREATE TABLE `supplier_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`bank_account_id` text,
	`amount_usd` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_ves` real,
	`rate` real,
	`payment_date` integer,
	`reference` text NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `supplier_payments_bill_idx` ON `supplier_payments` (`bill_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`notes` text,
	`created_at` integer
);
