CREATE TABLE `profiles` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`cv_filename` text,
	`cv_size_bytes` integer,
	`cv_pages` integer,
	`cv_text` text,
	`cv_uploaded_at` integer,
	`data` text,
	`generated_at` integer,
	`generated_provider` text,
	`generated_model` text,
	`edited` integer DEFAULT false NOT NULL,
	`updated_at` integer,
	`preferences` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
