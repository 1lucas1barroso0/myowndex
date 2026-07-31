CREATE TABLE `room_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`player_id` text,
	`author` text NOT NULL,
	`type` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `room_events_room_id_idx` ON `room_events` (`room_code`,`id`);--> statement-breakpoint
CREATE TABLE `room_media` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`object_key` text NOT NULL,
	`title` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `room_media_room_code_idx` ON `room_media` (`room_code`);--> statement-breakpoint
CREATE TABLE `room_players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`display_name` text NOT NULL,
	`token_hash` text NOT NULL,
	`accent` text DEFAULT '#38bdf8' NOT NULL,
	`ready` integer DEFAULT false NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_players_token_hash_idx` ON `room_players` (`token_hash`);--> statement-breakpoint
CREATE INDEX `room_players_room_code_idx` ON `room_players` (`room_code`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`narrator_secret_hash` text NOT NULL,
	`invite_secret_hash` text NOT NULL,
	`state_json` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rooms_updated_at_idx` ON `rooms` (`updated_at`);