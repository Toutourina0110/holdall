CREATE TABLE `plugin_setting` (
	`plugin_id` text NOT NULL,
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`plugin_id`, `owner`, `key`),
	FOREIGN KEY (`plugin_id`) REFERENCES `plugin`(`id`) ON UPDATE no action ON DELETE cascade
);
