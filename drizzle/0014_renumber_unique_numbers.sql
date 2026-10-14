-- #20: concurrent writers could give two epics, sprints, or issues the same
-- number. Renumber any existing duplicates (recorded in renumber_log), then add
-- unique indexes so it cannot happen again.
CREATE TABLE `renumber_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`row_id` integer NOT NULL,
	`scope_id` integer NOT NULL,
	`old_number` integer NOT NULL,
	`new_number` integer NOT NULL,
	`renumbered_at` text NOT NULL
);
--> statement-breakpoint
-- epics: a row whose (project_id, number) repeats an earlier row (lower id) gets the
-- next free number in its project_id, in id order. The lowest id keeps its number.
INSERT INTO `renumber_log` (`table_name`, `row_id`, `scope_id`, `old_number`, `new_number`, `renumbered_at`)
SELECT 'epics', d.`id`, d.`project_id`, d.`number`, m.`max_number` + d.`rn`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT t.`id`, t.`project_id`, t.`number`,
         ROW_NUMBER() OVER (PARTITION BY t.`project_id` ORDER BY t.`id`) AS `rn`
  FROM `epics` t
  WHERE EXISTS (
    SELECT 1 FROM `epics` e
    WHERE e.`project_id` = t.`project_id` AND e.`number` = t.`number` AND e.`id` < t.`id`
  )
) d
JOIN (SELECT `project_id`, MAX(`number`) AS `max_number` FROM `epics` GROUP BY `project_id`) m
  ON m.`project_id` = d.`project_id`;
--> statement-breakpoint
UPDATE `epics`
SET `number` = (
  SELECT l.`new_number` FROM `renumber_log` l
  WHERE l.`table_name` = 'epics' AND l.`row_id` = `epics`.`id`
)
WHERE `id` IN (SELECT `row_id` FROM `renumber_log` WHERE `table_name` = 'epics');
--> statement-breakpoint
-- sprints: a row whose (project_id, number) repeats an earlier row (lower id) gets the
-- next free number in its project_id, in id order. The lowest id keeps its number.
INSERT INTO `renumber_log` (`table_name`, `row_id`, `scope_id`, `old_number`, `new_number`, `renumbered_at`)
SELECT 'sprints', d.`id`, d.`project_id`, d.`number`, m.`max_number` + d.`rn`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT t.`id`, t.`project_id`, t.`number`,
         ROW_NUMBER() OVER (PARTITION BY t.`project_id` ORDER BY t.`id`) AS `rn`
  FROM `sprints` t
  WHERE EXISTS (
    SELECT 1 FROM `sprints` e
    WHERE e.`project_id` = t.`project_id` AND e.`number` = t.`number` AND e.`id` < t.`id`
  )
) d
JOIN (SELECT `project_id`, MAX(`number`) AS `max_number` FROM `sprints` GROUP BY `project_id`) m
  ON m.`project_id` = d.`project_id`;
--> statement-breakpoint
UPDATE `sprints`
SET `number` = (
  SELECT l.`new_number` FROM `renumber_log` l
  WHERE l.`table_name` = 'sprints' AND l.`row_id` = `sprints`.`id`
)
WHERE `id` IN (SELECT `row_id` FROM `renumber_log` WHERE `table_name` = 'sprints');
--> statement-breakpoint
-- issues: a row whose (epic_id, number) repeats an earlier row (lower id) gets the
-- next free number in its epic_id, in id order. The lowest id keeps its number.
INSERT INTO `renumber_log` (`table_name`, `row_id`, `scope_id`, `old_number`, `new_number`, `renumbered_at`)
SELECT 'issues', d.`id`, d.`epic_id`, d.`number`, m.`max_number` + d.`rn`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT t.`id`, t.`epic_id`, t.`number`,
         ROW_NUMBER() OVER (PARTITION BY t.`epic_id` ORDER BY t.`id`) AS `rn`
  FROM `issues` t
  WHERE EXISTS (
    SELECT 1 FROM `issues` e
    WHERE e.`epic_id` = t.`epic_id` AND e.`number` = t.`number` AND e.`id` < t.`id`
  )
) d
JOIN (SELECT `epic_id`, MAX(`number`) AS `max_number` FROM `issues` GROUP BY `epic_id`) m
  ON m.`epic_id` = d.`epic_id`;
--> statement-breakpoint
UPDATE `issues`
SET `number` = (
  SELECT l.`new_number` FROM `renumber_log` l
  WHERE l.`table_name` = 'issues' AND l.`row_id` = `issues`.`id`
)
WHERE `id` IN (SELECT `row_id` FROM `renumber_log` WHERE `table_name` = 'issues');
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_epics_project_number` ON `epics` (`project_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_issues_epic_number` ON `issues` (`epic_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sprints_project_number` ON `sprints` (`project_id`,`number`);