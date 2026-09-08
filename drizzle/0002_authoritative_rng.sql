ALTER TABLE `rooms` ADD `authority_claim` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `room_rolls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`actor_key` text NOT NULL,
	`request_id` text NOT NULL,
	`request_fingerprint` text NOT NULL,
	`player_id` text,
	`author` text NOT NULL,
	`action_type` text NOT NULL,
	`mode` text DEFAULT 'normal' NOT NULL,
	`request_json` text NOT NULL,
	`result_json` text NOT NULL,
	`event_type` text NOT NULL,
	`event_payload_json` text NOT NULL,
	`sfx_payload_json` text,
	`status` text DEFAULT 'ready' NOT NULL,
	`claim_token` text DEFAULT '' NOT NULL,
	`server_authoritative` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_rolls_request_idx` ON `room_rolls` (`room_code`,`actor_key`,`request_id`);
--> statement-breakpoint
CREATE INDEX `room_rolls_room_id_idx` ON `room_rolls` (`room_code`,`id`);
