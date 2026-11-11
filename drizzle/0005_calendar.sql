CREATE TABLE `calendar` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`remote_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#1f4a7a' NOT NULL,
	`read_only` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `calendar_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_user_idx` ON `calendar` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_remote_idx` ON `calendar` (`account_id`,`remote_id`);--> statement-breakpoint
CREATE TABLE `calendar_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`credentials` text,
	`status` text DEFAULT 'ok' NOT NULL,
	`error` text,
	`last_sync_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_account_user_idx` ON `calendar_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `calendar_event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`calendar_id` text NOT NULL,
	`remote_id` text,
	`etag` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`recurring` integer DEFAULT false NOT NULL,
	`dirty` integer DEFAULT false NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`remote_updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendar`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_event_range_idx` ON `calendar_event` (`user_id`,`start`);--> statement-breakpoint
CREATE INDEX `calendar_event_calendar_idx` ON `calendar_event` (`calendar_id`);--> statement-breakpoint
CREATE TABLE `calendar_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_id` text,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_history_user_idx` ON `calendar_history` (`user_id`);