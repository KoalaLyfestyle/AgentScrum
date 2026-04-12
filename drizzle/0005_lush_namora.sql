ALTER TABLE `epics` ADD `number` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `issues` ADD `number` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `epics` SET `number` = (SELECT COUNT(*) FROM `epics` e2 WHERE e2.project_id = `epics`.project_id AND e2.id <= `epics`.id);--> statement-breakpoint
UPDATE `issues` SET `number` = (SELECT COUNT(*) FROM `issues` i2 WHERE i2.epic_id = `issues`.epic_id AND i2.id <= `issues`.id);