/**
 * Transport-agnostic Scrum service layer.
 * Used by CLI (Sprint 1) and MCP server (Sprint 2) — no Commander or HTTP here.
 */

import { eq, and } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type {
  Project,
  Epic,
  Sprint,
  Issue,
  AcceptanceCriterion,
  Session,
  Decision,
  Lesson,
  DodItem,
  IssueDetail,
  SprintSummary,
  WorkPackage,
  IssueStatus,
  IssueType,
  Priority,
  EpicStatus,
  AuditorVerdict,
} from "../schema/types.js";

function now(): string {
  return new Date().toISOString();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- Projects ---

export function initProject(name: string): { project: Project; sprint: Sprint } {
  const db = getDb();
  const createdAt = now();

  const project = db
    .insert(schema.projects)
    .values({ name, createdAt })
    .returning()
    .get();

  if (!project) throw new Error("Failed to create project");

  const sprint = db
    .insert(schema.sprints)
    .values({ projectId: project.id, number: 1, status: "planning" })
    .returning()
    .get();

  if (!sprint) throw new Error("Failed to create sprint");

  return { project: project as Project, sprint: sprint as Sprint };
}

export function getProject(projectId: number): Project {
  const db = getDb();
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .get();
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project as Project;
}

export function findProject(nameOrId: string): Project {
  const db = getDb();
  const asId = parseInt(nameOrId, 10);
  const project = isNaN(asId)
    ? db.select().from(schema.projects).where(eq(schema.projects.name, nameOrId)).get()
    : db.select().from(schema.projects).where(eq(schema.projects.id, asId)).get();
  if (!project) throw new Error(`Project "${nameOrId}" not found. Run 'scrum init <name>' to create it.`);
  return project as Project;
}

// --- Epics ---

export function createEpic(projectId: number, title: string): Epic {
  const db = getDb();
  const epic = db
    .insert(schema.epics)
    .values({ projectId, title, status: "active", createdAt: now() })
    .returning()
    .get();
  if (!epic) throw new Error("Failed to create epic");
  return epic as Epic;
}

export function updateEpicStatus(epicId: number, status: EpicStatus): Epic {
  const db = getDb();
  const epic = db
    .update(schema.epics)
    .set({ status })
    .where(eq(schema.epics.id, epicId))
    .returning()
    .get();
  if (!epic) throw new Error(`Epic ${epicId} not found`);
  return epic as Epic;
}

// --- Sprints ---

export function createSprint(projectId: number): Sprint {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.sprints)
    .where(eq(schema.sprints.projectId, projectId))
    .all();
  const nextNumber = existing.length + 1;

  const sprint = db
    .insert(schema.sprints)
    .values({ projectId, number: nextNumber, status: "planning" })
    .returning()
    .get();
  if (!sprint) throw new Error("Failed to create sprint");
  return sprint as Sprint;
}

export function getActiveSprint(projectId: number): Sprint {
  const db = getDb();

  const active = db
    .select()
    .from(schema.sprints)
    .where(
      and(
        eq(schema.sprints.projectId, projectId),
        eq(schema.sprints.status, "active")
      )
    )
    .get();

  if (active) return active as Sprint;

  // Fall back to planning sprint if no active one exists yet
  const planning = db
    .select()
    .from(schema.sprints)
    .where(
      and(
        eq(schema.sprints.projectId, projectId),
        eq(schema.sprints.status, "planning")
      )
    )
    .get();

  if (!planning) throw new Error(`No open sprint for project ${projectId}`);
  return planning as Sprint;
}

export function startSprint(sprintId: number, goal?: string): Sprint {
  const db = getDb();
  const sprint = db
    .update(schema.sprints)
    .set({ status: "active", goal: goal ?? null, startedAt: now() })
    .where(eq(schema.sprints.id, sprintId))
    .returning()
    .get();
  if (!sprint) throw new Error(`Sprint ${sprintId} not found`);
  return sprint as Sprint;
}

export function closeSprint(sprintId: number): Sprint {
  const db = getDb();
  const sprint = db
    .update(schema.sprints)
    .set({ status: "closed", closedAt: now() })
    .where(eq(schema.sprints.id, sprintId))
    .returning()
    .get();
  if (!sprint) throw new Error(`Sprint ${sprintId} not found`);
  return sprint as Sprint;
}

export function getSprintSummary(sprintId: number): SprintSummary {
  const db = getDb();
  const sprint = db
    .select()
    .from(schema.sprints)
    .where(eq(schema.sprints.id, sprintId))
    .get();
  if (!sprint) throw new Error(`Sprint ${sprintId} not found`);

  const issueRows = db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.sprintId, sprintId))
    .all();

  const byStatus: Record<IssueStatus, number> = {
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
    blocked: 0,
  };
  for (const issue of issueRows) {
    byStatus[issue.status as IssueStatus]++;
  }

  const activeIssue = issueRows.find((i) => i.status === "in_progress") as
    | Issue
    | undefined;

  return {
    sprint: sprint as Sprint,
    total: issueRows.length,
    byStatus,
    activeIssue,
  };
}

// --- Issues ---

export function createIssue(
  epicId: number,
  sprintId: number,
  title: string,
  type: IssueType = "feature",
  priority: Priority = "medium",
  description?: string,
  storyPoints?: number
): Issue {
  const db = getDb();
  const issue = db
    .insert(schema.issues)
    .values({
      epicId,
      sprintId,
      title,
      description: description ?? null,
      type,
      priority,
      storyPoints: storyPoints ?? null,
      tokensUsed: 0,
      createdAt: now(),
    })
    .returning()
    .get();
  if (!issue) throw new Error("Failed to create issue");
  return issue as Issue;
}

export function estimateIssue(issueId: number, storyPoints: number): Issue {
  const db = getDb();
  const issue = db
    .update(schema.issues)
    .set({ storyPoints })
    .where(eq(schema.issues.id, issueId))
    .returning()
    .get();
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  return issue as Issue;
}

export function listIssues(sprintId: number): Issue[] {
  const db = getDb();
  return db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.sprintId, sprintId))
    .all() as Issue[];
}

export function updateIssueStatus(issueId: number, status: IssueStatus): Issue {
  const db = getDb();
  const issue = db
    .update(schema.issues)
    .set({ status })
    .where(eq(schema.issues.id, issueId))
    .returning()
    .get();
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  return issue as Issue;
}

export function assignIssue(issueId: number, agentId: string): Issue {
  const db = getDb();
  const issue = db
    .update(schema.issues)
    .set({ assignedTo: agentId })
    .where(eq(schema.issues.id, issueId))
    .returning()
    .get();
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  return issue as Issue;
}

export function getIssuesByAgent(sprintId: number, agentId: string): Issue[] {
  const db = getDb();
  return db
    .select()
    .from(schema.issues)
    .where(
      and(
        eq(schema.issues.sprintId, sprintId),
        eq(schema.issues.assignedTo, agentId)
      )
    )
    .all() as Issue[];
}

export function getIssueDetail(issueId: number): IssueDetail {
  const db = getDb();
  const issue = db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.id, issueId))
    .get();
  if (!issue) throw new Error(`Issue ${issueId} not found`);

  const acs = db
    .select()
    .from(schema.acceptanceCriteria)
    .where(eq(schema.acceptanceCriteria.issueId, issueId))
    .all() as AcceptanceCriterion[];

  const sessionRows = db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.issueId, issueId))
    .all() as Session[];

  return { ...(issue as Issue), acs, sessions: sessionRows };
}

// --- Acceptance Criteria ---

export function addAc(issueId: number, text: string): AcceptanceCriterion {
  const db = getDb();
  const ac = db
    .insert(schema.acceptanceCriteria)
    .values({ issueId, text, completed: false, createdAt: now() })
    .returning()
    .get();
  if (!ac) throw new Error("Failed to create AC");
  return ac as AcceptanceCriterion;
}

export function completeAc(acId: number): AcceptanceCriterion {
  const db = getDb();
  const ac = db
    .update(schema.acceptanceCriteria)
    .set({ completed: true })
    .where(eq(schema.acceptanceCriteria.id, acId))
    .returning()
    .get();
  if (!ac) throw new Error(`AC ${acId} not found`);
  return ac as AcceptanceCriterion;
}

// --- Sessions ---

export function logSession(
  issueId: number,
  summary: string,
  tokensUsed: number = 0,
  auditor?: AuditorVerdict
): Session {
  const db = getDb();

  const session = db
    .insert(schema.sessions)
    .values({
      issueId,
      date: today(),
      summary,
      tokensUsed,
      auditor: auditor ?? null,
    })
    .returning()
    .get();
  if (!session) throw new Error("Failed to log session");

  // Increment tokens on the issue
  const issueRow = db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.id, issueId))
    .get();
  if (issueRow) {
    db.update(schema.issues)
      .set({ tokensUsed: issueRow.tokensUsed + tokensUsed })
      .where(eq(schema.issues.id, issueId))
      .run();
  }

  return session as Session;
}

// --- Work package ---

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function getWorkPackage(projectId: number, capacity: number): WorkPackage {
  const sprint = getActiveSprint(projectId);
  const dod = listDod(projectId);

  const db = getDb();
  const todoIssues = db
    .select()
    .from(schema.issues)
    .where(and(eq(schema.issues.sprintId, sprint.id), eq(schema.issues.status, "todo")))
    .all() as Issue[];

  todoIssues.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority as Priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority as Priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return a.id - b.id;
  });

  const selected: IssueDetail[] = [];
  let capacityUsed = 0;

  for (const issue of todoIssues) {
    const pts = issue.storyPoints ?? 1;
    if (capacityUsed + pts > capacity) continue;
    selected.push(getIssueDetail(issue.id));
    capacityUsed += pts;
  }

  return {
    sprint,
    dod: dod.map((d) => d.text),
    capacityRequested: capacity,
    capacityUsed,
    issues: selected,
  };
}

// --- Definition of Done ---

export function addDodItem(projectId: number, text: string, order?: number): DodItem {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.projectDod)
    .where(and(eq(schema.projectDod.projectId, projectId), eq(schema.projectDod.active, true)))
    .all();
  const nextOrder = order ?? existing.length;
  const item = db
    .insert(schema.projectDod)
    .values({ projectId, text, order: nextOrder, active: true, createdAt: now() })
    .returning()
    .get();
  if (!item) throw new Error("Failed to add DoD item");
  return item as DodItem;
}

export function listDod(projectId: number): DodItem[] {
  const db = getDb();
  return db
    .select()
    .from(schema.projectDod)
    .where(and(eq(schema.projectDod.projectId, projectId), eq(schema.projectDod.active, true)))
    .all()
    .sort((a, b) => (a as DodItem).order - (b as DodItem).order) as DodItem[];
}

export function removeDodItem(id: number): void {
  const db = getDb();
  db.update(schema.projectDod).set({ active: false }).where(eq(schema.projectDod.id, id)).run();
}

export function setDod(projectId: number, items: string[]): DodItem[] {
  const db = getDb();
  db.delete(schema.projectDod).where(eq(schema.projectDod.projectId, projectId)).run();
  return items.map((text, i) => addDodItem(projectId, text, i));
}

// --- Knowledge layer ---

export function logDecision(args: {
  projectId: number;
  title: string;
  context: string;
  decision: string;
  rejectedAlternatives?: string;
  consequences?: string;
}): Decision {
  const db = getDb();
  const record = db
    .insert(schema.decisions)
    .values({
      projectId: args.projectId,
      title: args.title,
      status: "accepted",
      context: args.context,
      decision: args.decision,
      rejectedAlternatives: args.rejectedAlternatives ?? null,
      consequences: args.consequences ?? null,
      createdAt: now(),
    })
    .returning()
    .get();
  if (!record) throw new Error("Failed to log decision");
  return record as Decision;
}

export function logLesson(args: {
  projectId?: number;
  title: string;
  whatFailed: string;
  dontRepeat: string;
  tags?: string;
}): Lesson {
  const db = getDb();
  const record = db
    .insert(schema.lessons)
    .values({
      projectId: args.projectId ?? null,
      title: args.title,
      whatFailed: args.whatFailed,
      dontRepeat: args.dontRepeat,
      tags: args.tags ?? null,
      createdAt: now(),
    })
    .returning()
    .get();
  if (!record) throw new Error("Failed to log lesson");
  return record as Lesson;
}

export function getDecisions(projectId: number): Decision[] {
  const db = getDb();
  return db
    .select()
    .from(schema.decisions)
    .where(eq(schema.decisions.projectId, projectId))
    .all() as Decision[];
}

export function getLessons(projectId?: number): Lesson[] {
  const db = getDb();
  if (projectId !== undefined) {
    return db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.projectId, projectId))
      .all() as Lesson[];
  }
  return db.select().from(schema.lessons).all() as Lesson[];
}
