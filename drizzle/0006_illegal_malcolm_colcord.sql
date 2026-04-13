-- SQLite cannot drop NOT NULL from a column via ALTER TABLE.
-- Recreate the issues table with sprint_id nullable to support unassigned issues.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `issues_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `epic_id` integer NOT NULL REFERENCES `epics`(`id`),
  `sprint_id` integer REFERENCES `sprints`(`id`),
  `number` integer DEFAULT 0 NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `type` text DEFAULT 'feature' NOT NULL,
  `status` text DEFAULT 'todo' NOT NULL,
  `priority` text DEFAULT 'medium' NOT NULL,
  `assigned_to` text,
  `story_points` integer,
  `tokens_used` real DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL
);--> statement-breakpoint
INSERT INTO `issues_new` (`id`, `epic_id`, `sprint_id`, `number`, `title`, `description`, `type`, `status`, `priority`, `assigned_to`, `story_points`, `tokens_used`, `created_at`)
  SELECT `id`, `epic_id`, `sprint_id`, `number`, `title`, `description`, `type`, `status`, `priority`, `assigned_to`, `story_points`, `tokens_used`, `created_at` FROM `issues`;--> statement-breakpoint
DROP TABLE `issues`;--> statement-breakpoint
ALTER TABLE `issues_new` RENAME TO `issues`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
