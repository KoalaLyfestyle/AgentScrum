CREATE TABLE `project_dod` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`text` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `issues` ADD `description` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `story_points` integer;