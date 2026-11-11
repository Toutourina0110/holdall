CREATE TABLE `note` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`file_name` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`trashed_at` integer,
	`size` integer DEFAULT 0 NOT NULL,
	`file_mtime` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_user_idx` ON `note` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `note_file_idx` ON `note` (`user_id`,`folder`,`file_name`);--> statement-breakpoint
CREATE TABLE `note_link` (
	`from_id` text NOT NULL,
	`user_id` text NOT NULL,
	`target` text NOT NULL,
	PRIMARY KEY(`from_id`, `target`),
	FOREIGN KEY (`from_id`) REFERENCES `note`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_link_target_idx` ON `note_link` (`user_id`,`target`);--> statement-breakpoint
CREATE TABLE `note_tag` (
	`note_id` text NOT NULL,
	`user_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`note_id`, `tag`),
	FOREIGN KEY (`note_id`) REFERENCES `note`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_tag_user_idx` ON `note_tag` (`user_id`,`tag`);--> statement-breakpoint
CREATE TABLE `note_version` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `note`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_version_note_idx` ON `note_version` (`note_id`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`list_id` text,
	`parent_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`due_date` text,
	`due_time` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`labels` text DEFAULT '[]' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`note_id` text,
	`note_item` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `task_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `note`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `task_user_idx` ON `task` (`user_id`);--> statement-breakpoint
CREATE INDEX `task_due_idx` ON `task` (`user_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `task_list` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_list_user_idx` ON `task_list` (`user_id`);