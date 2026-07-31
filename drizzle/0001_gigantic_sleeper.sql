CREATE TABLE `room_call_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`participant_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`muted` integer DEFAULT false NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_call_members_participant_idx` ON `room_call_members` (`room_code`,`participant_id`);--> statement-breakpoint
CREATE INDEX `room_call_members_presence_idx` ON `room_call_members` (`room_code`,`last_seen_at`);--> statement-breakpoint
CREATE TABLE `room_call_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`type` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `room_call_signals_recipient_idx` ON `room_call_signals` (`room_code`,`recipient_id`,`id`);--> statement-breakpoint
CREATE INDEX `room_call_signals_created_at_idx` ON `room_call_signals` (`created_at`);