-- Rename sessions.date to sessions.created_at and upgrade to full ISO timestamp.
-- SQLite cannot rename columns via ALTER TABLE, so we recreate the table.
-- Existing rows are backfilled with date || 'T00:00:00.000Z'.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `sessions_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `issue_id` integer NOT NULL REFERENCES `issues`(`id`),
  `created_at` text NOT NULL,
  `summary` text NOT NULL,
  `tokens_used` real DEFAULT 0 NOT NULL,
  `auditor` text
);--> statement-breakpoint
INSERT INTO `sessions_new` (`id`, `issue_id`, `created_at`, `summary`, `tokens_used`, `auditor`)
  SELECT `id`, `issue_id`, `date` || 'T00:00:00.000Z', `summary`, `tokens_used`, `auditor` FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `sessions_new` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
