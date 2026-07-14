CREATE TABLE `account` (
	`id` varchar(255) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`expires_at` timestamp,
	`password` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_config` (
	`id` varchar(36) NOT NULL,
	`logo_url` text,
	`app_name` varchar(255) DEFAULT 'Log Book',
	`permissions` json,
	`pdf_paper_size` varchar(20) DEFAULT 'A4',
	`pdf_orientation` varchar(20) DEFAULT 'portrait',
	`pdf_header_text` text,
	`pdf_footer_text` text,
	`log_limit` int DEFAULT 200,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`generated_by` varchar(36) NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`filter_user_id` varchar(36),
	`pdf_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`task_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`start_time` timestamp NOT NULL,
	`end_time` timestamp NOT NULL,
	`reminder_minutes_before` int DEFAULT 30,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `system_logs` (
	`id` varchar(36) NOT NULL,
	`level` varchar(20) NOT NULL DEFAULT 'info',
	`category` varchar(50),
	`message` text NOT NULL,
	`metadata` json,
	`user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`status` varchar(50) NOT NULL DEFAULT 'todo',
	`priority` varchar(50) NOT NULL DEFAULT 'medium',
	`assigned_to` varchar(36),
	`created_by` varchar(36) NOT NULL,
	`due_date` timestamp,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`task_source` varchar(20) DEFAULT 'atasan',
	`output_description` text,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tracker_logs` (
	`id` varchar(36) NOT NULL,
	`task_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`note` text,
	`duration_minutes` int,
	`logged_date` date NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`start_time` varchar(10) DEFAULT '08:00',
	`end_time` varchar(10) DEFAULT '17:00',
	`status` varchar(20) DEFAULT 'progress',
	`is_validated` boolean DEFAULT false,
	`validated_by` varchar(36),
	`remarks` text,
	CONSTRAINT `tracker_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`role` varchar(20) NOT NULL DEFAULT 'staff',
	`phone` varchar(20),
	`position` varchar(100),
	`bio` text,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(255) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp,
	`updated_at` timestamp,
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_generated_by_user_id_fk` FOREIGN KEY (`generated_by`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_filter_user_id_user_id_fk` FOREIGN KEY (`filter_user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `system_logs` ADD CONSTRAINT `system_logs_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assigned_to_user_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tracker_logs` ADD CONSTRAINT `tracker_logs_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tracker_logs` ADD CONSTRAINT `tracker_logs_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tracker_logs` ADD CONSTRAINT `tracker_logs_validated_by_user_id_fk` FOREIGN KEY (`validated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;