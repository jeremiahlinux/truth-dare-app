CREATE TABLE `gamePlayers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int,
	`playerName` varchar(64) NOT NULL,
	`playerIndex` int NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`streak` int NOT NULL DEFAULT 0,
	`completedCount` int NOT NULL DEFAULT 0,
	`passedCount` int NOT NULL DEFAULT 0,
	`skippedCount` int NOT NULL DEFAULT 0,
	`isReady` int NOT NULL DEFAULT 0,
	`isConnected` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gamePlayers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gameSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`round` int NOT NULL,
	`playerTurnId` int NOT NULL,
	`questionType` enum('truth','dare') NOT NULL,
	`promptId` int,
	`action` enum('completed','passed','skipped'),
	`responseText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gameSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameMode` enum('classic','spicy','party') NOT NULL,
	`playerCount` int NOT NULL,
	`type` enum('truth','dare') NOT NULL,
	`text` text NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prompts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomCode` varchar(8) NOT NULL,
	`hostId` int NOT NULL,
	`gameMode` enum('classic','spicy','party') NOT NULL,
	`roundCount` int NOT NULL DEFAULT 5,
	`status` enum('waiting','in_progress','completed') NOT NULL DEFAULT 'waiting',
	`currentRound` int NOT NULL DEFAULT 0,
	`currentPlayerIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rooms_roomCode_unique` UNIQUE(`roomCode`)
);
--> statement-breakpoint
ALTER TABLE `gamePlayers` ADD CONSTRAINT `gamePlayers_roomId_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gamePlayers` ADD CONSTRAINT `gamePlayers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gameSessions` ADD CONSTRAINT `gameSessions_roomId_rooms_id_fk` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gameSessions` ADD CONSTRAINT `gameSessions_playerTurnId_gamePlayers_id_fk` FOREIGN KEY (`playerTurnId`) REFERENCES `gamePlayers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gameSessions` ADD CONSTRAINT `gameSessions_promptId_prompts_id_fk` FOREIGN KEY (`promptId`) REFERENCES `prompts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_hostId_users_id_fk` FOREIGN KEY (`hostId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;