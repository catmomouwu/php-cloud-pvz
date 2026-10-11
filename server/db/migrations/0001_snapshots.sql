CREATE TABLE `save_profile_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`source_version` integer NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`sha256` text NOT NULL,
	`size` integer NOT NULL,
	`stats` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `save_profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `save_profile_snapshot_profile_id_idx` ON `save_profile_snapshot` (`profile_id`);