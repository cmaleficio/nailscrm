CREATE TABLE `service_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`service_id` text,
	`service_name` text NOT NULL,
	`service_description` text,
	`service_price` real NOT NULL,
	`service_duration_mins` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `service_purchases_user_idx` ON `service_purchases` (`user_id`);--> statement-breakpoint
CREATE INDEX `service_purchases_appointment_idx` ON `service_purchases` (`appointment_id`);--> statement-breakpoint
INSERT INTO `service_purchases` (`id`, `user_id`, `appointment_id`, `service_id`, `service_name`, `service_description`, `service_price`, `service_duration_mins`, `created_at`)
SELECT lower(hex(randomblob(16))), a.`client_id`, a.`id`, a.`service_id`, s.`name`, s.`description`, s.`price`, s.`duration_mins`, a.`created_at`
FROM `appointments` a
JOIN `services` s ON s.`id` = a.`service_id`
WHERE NOT EXISTS (
  SELECT 1 FROM `service_purchases` p WHERE p.`appointment_id` = a.`id`
);