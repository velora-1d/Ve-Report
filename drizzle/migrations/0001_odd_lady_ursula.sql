CREATE TABLE `division_validators` (
	`division_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `division_validators_division_id_user_id_pk` PRIMARY KEY(`division_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `divisions` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `divisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `divisions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `user_divisions` (
	`user_id` varchar(36) NOT NULL,
	`division_id` varchar(36) NOT NULL,
	CONSTRAINT `user_divisions_user_id_division_id_pk` PRIMARY KEY(`user_id`,`division_id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `division_id` varchar(36);--> statement-breakpoint
ALTER TABLE `tracker_logs` ADD `division_id` varchar(36);--> statement-breakpoint
ALTER TABLE `division_validators` ADD CONSTRAINT `division_validators_division_id_divisions_id_fk` FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `division_validators` ADD CONSTRAINT `division_validators_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_divisions` ADD CONSTRAINT `user_divisions_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_divisions` ADD CONSTRAINT `user_divisions_division_id_divisions_id_fk` FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_division_id_divisions_id_fk` FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tracker_logs` ADD CONSTRAINT `tracker_logs_division_id_divisions_id_fk` FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON DELETE set null ON UPDATE no action;