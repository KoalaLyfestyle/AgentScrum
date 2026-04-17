import { sqliteTable, integer, text, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  directory: text("directory"), // absolute path to project root; used for CWD-based auto-detection
  createdAt: text("created_at").notNull(),
});

export const epics = sqliteTable("epics", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectId: integer("project_id", { mode: "number" })
    .notNull()
    .references(() => projects.id),
  number: integer("number", { mode: "number" }).notNull().default(0), // sequential per project; set on insert
  title: text("title").notNull(),
  status: text("status", { enum: ["active", "complete", "paused"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at").notNull(),
});

export const sprints = sqliteTable("sprints", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectId: integer("project_id", { mode: "number" })
    .notNull()
    .references(() => projects.id),
  number: integer("number", { mode: "number" }).notNull(),
  status: text("status", { enum: ["planning", "active", "closed"] })
    .notNull()
    .default("planning"),
  title: text("title"),
  goal: text("goal"),
  prTitle: text("pr_title"),
  prDescription: text("pr_description"),
  startedAt: text("started_at"),
  closedAt: text("closed_at"),
});

export const issues = sqliteTable("issues", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  epicId: integer("epic_id", { mode: "number" })
    .notNull()
    .references(() => epics.id),
  sprintId: integer("sprint_id", { mode: "number" })
    .references(() => sprints.id),
  number: integer("number", { mode: "number" }).notNull().default(0), // sequential per epic; set on insert
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", {
    enum: ["feature", "bugfix", "refactor", "test", "docs"],
  })
    .notNull()
    .default("feature"),
  status: text("status", {
    enum: ["todo", "in_progress", "review", "done", "blocked"],
  })
    .notNull()
    .default("todo"),
  priority: text("priority", { enum: ["high", "medium", "low"] })
    .notNull()
    .default("medium"),
  assignedTo: text("assigned_to"),
  storyPoints: integer("story_points", { mode: "number" }),
  tokensUsed: real("tokens_used").notNull().default(0),
  blockerReason: text("blocker_reason"),
  claimedBy: text("claimed_by"),
  claimedAt: text("claimed_at"),
  createdAt: text("created_at").notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});

export const acceptanceCriteria = sqliteTable("acceptance_criteria", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id", { mode: "number" })
    .notNull()
    .references(() => issues.id),
  text: text("text").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id", { mode: "number" })
    .notNull()
    .references(() => issues.id),
  createdAt: text("created_at").notNull(),
  summary: text("summary").notNull(),
  tokensUsed: real("tokens_used").notNull().default(0),
  auditor: text("auditor", { enum: ["pass", "fail", "skipped"] }),
  model: text("model"),
});

// Architecture Decision Records (ADR-lite)
export const decisions = sqliteTable("decisions", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectId: integer("project_id", { mode: "number" })
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(),
  status: text("status", { enum: ["accepted", "superseded"] })
    .notNull()
    .default("accepted"),
  context: text("context").notNull(),
  decision: text("decision").notNull(),
  rejectedAlternatives: text("rejected_alternatives"), // plain text or JSON array
  consequences: text("consequences"),
  createdAt: text("created_at").notNull(),
});

// Project-level Definition of Done — checklist every agent must complete after each issue
export const projectDod = sqliteTable("project_dod", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectId: integer("project_id", { mode: "number" })
    .notNull()
    .references(() => projects.id),
  order: integer("order", { mode: "number" }).notNull().default(0),
  text: text("text").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

// Per-sprint DoD completion tracking (no FK on dod_item_id — setDod() hard-deletes project_dod rows)
export const sprintDodCompletions = sqliteTable(
  "sprint_dod_completions",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    sprintId: integer("sprint_id", { mode: "number" })
      .notNull()
      .references(() => sprints.id),
    dodItemId: integer("dod_item_id", { mode: "number" }).notNull(), // no FK — items may be hard-deleted
    dodText: text("dod_text").notNull(), // snapshot at completion time
    completedAt: text("completed_at").notNull(),
  },
  (t) => ({ uqSprintDod: uniqueIndex("uq_sprint_dod").on(t.sprintId, t.dodItemId) })
);

// Hard-learned lessons and failure post-mortems
export const lessons = sqliteTable("lessons", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectId: integer("project_id", { mode: "number" }).references(() => projects.id), // nullable = cross-project
  title: text("title").notNull(),
  whatFailed: text("what_failed").notNull(),
  dontRepeat: text("dont_repeat").notNull(), // concrete instruction for agents
  tags: text("tags"), // comma-separated, e.g. "db,drizzle,migration"
  createdAt: text("created_at").notNull(),
});
