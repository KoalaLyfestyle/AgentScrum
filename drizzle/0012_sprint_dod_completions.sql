CREATE TABLE `sprint_dod_completions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sprint_id` integer NOT NULL REFERENCES `sprints`(`id`),
  `dod_item_id` integer NOT NULL,
  `dod_text` text NOT NULL,
  `completed_at` text NOT NULL
);
