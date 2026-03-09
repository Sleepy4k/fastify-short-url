CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`admin_id` int,
	`action` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`metadata` text,
	`ip_address` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `urls` ADD `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `urls` ADD `title` varchar(255);--> statement-breakpoint
ALTER TABLE `urls` ADD `description` text;--> statement-breakpoint
ALTER TABLE `urls` ADD `og_image_url` varchar(512);--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_admin_id_admins_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `log_admin_id_idx` ON `activity_logs` (`admin_id`);--> statement-breakpoint
CREATE INDEX `log_action_idx` ON `activity_logs` (`action`);--> statement-breakpoint
CREATE INDEX `log_created_at_idx` ON `activity_logs` (`created_at`);