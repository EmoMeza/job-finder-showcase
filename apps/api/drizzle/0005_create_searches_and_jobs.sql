CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`company` text,
	`location` text,
	`cities` text DEFAULT '[]' NOT NULL,
	`countries` text DEFAULT '[]' NOT NULL,
	`modality` text,
	`employment_type` text,
	`seniority` text,
	`salary_min` integer,
	`salary_max` integer,
	`salary_currency` text,
	`salary_period` text,
	`salary_basis` text,
	`salary_public` integer,
	`published_on` text,
	`apply_notes` text DEFAULT '[]' NOT NULL,
	`raw` text,
	`description` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`benefits` text DEFAULT '[]' NOT NULL,
	`apply_url` text,
	`closed` integer DEFAULT false NOT NULL,
	`detail_fetched_at` integer,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_source_external_id_idx` ON `jobs` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `search_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`search_id` integer NOT NULL,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`step` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`found` integer DEFAULT 0 NOT NULL,
	`added` integer DEFAULT 0 NOT NULL,
	`reached_end` integer,
	`warnings` text DEFAULT '[]' NOT NULL,
	`error` text,
	`artifacts` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`search_id`) REFERENCES `searches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `search_runs_search_id_idx` ON `search_runs` (`search_id`);--> statement-breakpoint
CREATE TABLE `searches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`source` text NOT NULL,
	`interval_hours` integer,
	`conditions` text,
	`conditions_read_at` integer,
	`last_run_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `searches_user_source_idx` ON `searches` (`user_id`,`source`);--> statement-breakpoint
CREATE TABLE `user_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`job_id` integer NOT NULL,
	`search_id` integer,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text,
	`applied_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`search_id`) REFERENCES `searches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_jobs_user_job_idx` ON `user_jobs` (`user_id`,`job_id`);--> statement-breakpoint
CREATE INDEX `user_jobs_user_status_idx` ON `user_jobs` (`user_id`,`status`);