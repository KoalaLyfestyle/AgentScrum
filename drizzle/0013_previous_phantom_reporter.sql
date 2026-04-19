ALTER TABLE `issues` ADD `claim_session_id` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `released_at` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `cost_usd` real;