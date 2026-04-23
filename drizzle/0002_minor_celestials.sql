ALTER TABLE `rooms` DROP FOREIGN KEY `rooms_hostId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `gameSessions` ADD `status` enum('pending','awaiting_confirmation','completed','skipped') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `gameSessions` ADD `promptText` text NOT NULL;--> statement-breakpoint
ALTER TABLE `gameSessions` ADD `performedByPlayerId` int;--> statement-breakpoint
ALTER TABLE `gameSessions` ADD `confirmedByPlayerId` int;--> statement-breakpoint
ALTER TABLE `gameSessions` ADD `confirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `gameSessions` ADD CONSTRAINT `gameSessions_performedByPlayerId_gamePlayers_id_fk` FOREIGN KEY (`performedByPlayerId`) REFERENCES `gamePlayers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gameSessions` ADD CONSTRAINT `gameSessions_confirmedByPlayerId_gamePlayers_id_fk` FOREIGN KEY (`confirmedByPlayerId`) REFERENCES `gamePlayers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rooms` DROP COLUMN `hostId`;