ALTER TABLE `profiles` ADD `confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `profiles` ADD `draft` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `draft_updated_at` integer;--> statement-breakpoint
ALTER TABLE `profiles` DROP COLUMN `edited`;