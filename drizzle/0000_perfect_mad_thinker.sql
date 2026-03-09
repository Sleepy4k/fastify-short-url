CREATE TABLE `admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('superadmin','admin') NOT NULL DEFAULT 'admin',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `admins_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `urls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shortcode` varchar(32) NOT NULL,
	`original_url` text NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`expires_at` datetime,
	`total_clicks` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `urls_id` PRIMARY KEY(`id`),
	CONSTRAINT `urls_shortcode_unique` UNIQUE(`shortcode`),
	CONSTRAINT `shortcode_idx` UNIQUE(`shortcode`)
);
--> statement-breakpoint
CREATE TABLE `clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url_id` int NOT NULL,
	`ip_hash` varchar(64),
	`user_agent` varchar(512),
	`referer` varchar(512),
	`clicked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `clicks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`type` enum('string','boolean','number','json') NOT NULL DEFAULT 'string',
	`label` varchar(255) NOT NULL,
	`description` text,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
ALTER TABLE `clicks` ADD CONSTRAINT `clicks_url_id_urls_id_fk` FOREIGN KEY (`url_id`) REFERENCES `urls`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `is_active_idx` ON `urls` (`is_active`);--> statement-breakpoint
CREATE INDEX `url_id_idx` ON `clicks` (`url_id`);--> statement-breakpoint
CREATE INDEX `clicked_at_idx` ON `clicks` (`clicked_at`);