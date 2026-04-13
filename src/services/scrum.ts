/**
 * Transport-agnostic Scrum service layer.
 * Used by CLI (Sprint 1) and MCP server (Sprint 2) — no Commander or HTTP here.
 */

import { eq, and, isNull } from "drizzle-orm";
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
  SprintVelocity,
  CostReport,
  CostReportIssue,
  Retrospective,
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

export function initProject(name: string, directory?: string): { project: Project; sprint: Sprint } {
  const db = getDb();
  const createdAt = now();

  const project = db
    .insert(schema.projects)
    .values({ name, directory: directory ?? null, createdAt })
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

export function findProjectByDirectory(directory: string): Project | undefined {
  const db = getDb();
  // Walk up from the given directory checking each level against stored project directories
  const projects = db.select().from(schema.projects).all() as Project[];
  // Exact match first
  const exact = projects.find((p) => p.directory === directory);
  if (exact) return exact;
  // Then check if the given directory is inside a registered project directory
  for (const p of projects) {
    if (p.directory && directory.startsWith(p.directory + "/")) return p;
  }
  return undefined;
}

export function listProjects(): Project[] {
  const db = getDb();
  return db.select().from(schema.projects).all() as Project[];
}

// --- Display key helpers ---

/** Returns the display key for an epic, e.g. "E01" */
export function epicKey(epicNumber: number): string {
  return `E${String(epicNumber).padStart(2, "0")}`;
}

/** Returns the display key for an issue, e.g. "E01-I05" */
export function issueKey(epicNumber: number, issueNumber: number): string {
  return `${epicKey(epicNumber)}-I${String(issueNumber).padStart(2, "0")}`;
}

// --- Epics ---

export function listEpics(projectId: number): Epic[] {
  const db = getDb();
  return db
    .select()
    .from(schema.epics)
    .where(eq(schema.epics.projectId, projectId))
    .orderBy(schema.epics.number)
    .all() as Epic[];
}

export function createEpic(projectId: number, title: string): Epic {
  const db = getDb();
  const rows = db.select({ maxNum: schema.epics.number }).from(schema.epics)
    .where(eq(schema.epics.projectId, projectId)).all();
  const nextNumber = rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.maxNum)) + 1;
  const epic = db
    .insert(schema.epics)
    .values({ projectId, number: nextNumber, title, status: "active", createdAt: now() })
    .returning()
    .get();
  if (!epic) throw new Error("Failed to create epic");
  return epic as Epic;
}

export function updateEpic(
  epicId: number,
  patch: { title?: string; status?: EpicStatus }
): Epic {
  const db = getDb();
  const epic = db
    .update(schema.epics)
    .set(patch)
    .where(eq(schema.epics.id, epicId))
    .returning()
    .get();
  if (!epic) throw new Error(`Epic ${epicId} not found`);
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

export function listSprints(projectId: number): Sprint[] {
  const db = getDb();
  return db
    .select()
    .from(schema.sprints)
    .where(eq(schema.sprints.projectId, projectId))
    .orderBy(schema.sprints.number)
    .all() as Sprint[];
}

export function updateSprint(
  sprintId: number,
  patch: { title?: string; goal?: string; prTitle?: string; prDescription?: string }
): Sprint {
  const db = getDb();
  const sprint = db
    .update(schema.sprints)
    .set(patch)
    .where(eq(schema.sprints.id, sprintId))
    .returning()
    .get();
  if (!sprint) throw new Error(`Sprint ${sprintId} not found`);
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
  sprintId: number | null,
  title: string,
  type: IssueType = "feature",
  priority: Priority = "medium",
  description?: string,
  storyPoints?: number
): Issue {
  const db = getDb();
  const rows = db.select({ maxNum: schema.issues.number }).from(schema.issues)
    .where(eq(schema.issues.epicId, epicId)).all();
  const nextNumber = rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.maxNum)) + 1;
  const issue = db
    .insert(schema.issues)
    .values({
      epicId,
      sprintId: sprintId ?? null,
      number: nextNumber,
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

export function updateIssue(
  issueId: number,
  patch: {
    title?: string;
    description?: string;
    priority?: Priority;
    type?: IssueType;
    storyPoints?: number;
  }
): Issue {
  const db = getDb();
  const issue = db
    .update(schema.issues)
    .set(patch)
    .where(eq(schema.issues.id, issueId))
    .returning()
    .get();
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  return issue as Issue;
}

export function getBacklog(projectId: number): Issue[] {
  // Backlog = unassigned issues (no sprint) + issues in planning sprints
  const db = getDb();

  // Unassigned issues: sprint_id IS NULL within this project's epics
  const unassignedRows = db
    .select()
    .from(schema.issues)
    .innerJoin(schema.epics, eq(schema.issues.epicId, schema.epics.id))
    .where(
      and(
        eq(schema.epics.projectId, projectId),
        isNull(schema.issues.sprintId)
      )
    )
    .all();
  const unassigned = (unassignedRows as Array<{ issues: Issue }>).map((r) => r.issues);

  // Planning-sprint issues
  const planningRows = db
    .select()
    .from(schema.issues)
    .innerJoin(schema.sprints, eq(schema.issues.sprintId, schema.sprints.id))
    .where(and(eq(schema.sprints.projectId, projectId), eq(schema.sprints.status, "planning")))
    .all();
  const planning = (planningRows as Array<{ issues: Issue }>).map((r) => r.issues);

  return [...unassigned, ...planning];
}

export function getVelocity(projectId: number): SprintVelocity[] {
  const db = getDb();
  const closedSprints = db
    .select()
    .from(schema.sprints)
    .where(and(eq(schema.sprints.projectId, projectId), eq(schema.sprints.status, "closed")))
    .all() as Sprint[];

  return closedSprints.map((sprint) => {
    const allIssues = db
      .select()
      .from(schema.issues)
      .where(eq(schema.issues.sprintId, sprint.id))
      .all() as Issue[];

    const doneIssues = allIssues.filter((i) => i.status === "done");
    const pointsCompleted = doneIssues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
    const tokensUsed = allIssues.reduce((sum, i) => sum + i.tokensUsed, 0);

    const tokensByAgent: Record<string, number> = {};
    for (const issue of allIssues) {
      if (issue.assignedTo && issue.tokensUsed > 0) {
        tokensByAgent[issue.assignedTo] = (tokensByAgent[issue.assignedTo] ?? 0) + issue.tokensUsed;
      }
    }

    const result: SprintVelocity = {
      sprintNumber: sprint.number,
      sprintTitle: sprint.title ?? undefined,
      pointsCompleted,
      issuesCompleted: doneIssues.length,
      tokensUsed,
    };
    if (Object.keys(tokensByAgent).length > 0) {
      result.tokensByAgent = tokensByAgent;
    }
    return result;
  });
}

function parseModelPrices(): Record<string, number> | null {
  const raw = process.env["SCRUM_MODEL_PRICES"];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, number>;
  } catch {
    return null;
  }
}

export function getCostReport(projectId: number, sprintNumber?: number): CostReport {
  const db = getDb();

  // Resolve target sprint — default to active, fall back to most recent planning sprint
  let sprint: Sprint;
  if (sprintNumber !== undefined) {
    sprint = getSprintByNumber(projectId, sprintNumber);
  } else {
    sprint = getActiveSprint(projectId);
  }

  const allIssues = db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.sprintId, sprint.id))
    .all() as Issue[];

  // Build epic number lookup (epicId → epicNumber)
  const epicIds = [...new Set(allIssues.map((i) => i.epicId))];
  const epicNumberMap: Record<number, number> = {};
  for (const epicId of epicIds) {
    const epic = db.select().from(schema.epics).where(eq(schema.epics.id, epicId)).get() as { number: number } | undefined;
    if (epic) epicNumberMap[epicId] = epic.number;
  }

  const modelPrices = parseModelPrices();
  // Apply the first configured price uniformly (no per-issue model tracking yet)
  const priceValues = modelPrices ? Object.values(modelPrices) : [];
  const ratePerMillion = priceValues.length > 0 ? priceValues[0] : undefined;

  const issues: CostReportIssue[] = allIssues.map((issue) => {
    const epicNum = epicNumberMap[issue.epicId] ?? issue.epicId;
    const key = issueKey(epicNum, issue.number);
    const entry: CostReportIssue = {
      issueId: issue.id,
      issueKey: key,
      title: issue.title,
      tokensUsed: issue.tokensUsed,
    };
    if (issue.assignedTo) entry.assignedTo = issue.assignedTo;
    if (ratePerMillion !== undefined) {
      entry.estimatedCost = (issue.tokensUsed * ratePerMillion) / 1_000_000;
    }
    return entry;
  });

  const totalTokens = issues.reduce((sum, i) => sum + i.tokensUsed, 0);
  const report: CostReport = {
    sprintNumber: sprint.number,
    sprintTitle: sprint.title ?? undefined,
    issues,
    totalTokens,
  };
  if (ratePerMillion !== undefined) {
    report.totalCost = (totalTokens * ratePerMillion) / 1_000_000;
  }
  if (modelPrices) {
    report.modelPrices = modelPrices;
  }
  return report;
}

export function getRetrospective(projectId: number, sprintNumber?: number): Retrospective {
  const db = getDb();

  // Resolve target sprint
  let sprint: Sprint;
  if (sprintNumber !== undefined) {
    const s = db
      .select()
      .from(schema.sprints)
      .where(and(eq(schema.sprints.projectId, projectId), eq(schema.sprints.number, sprintNumber)))
      .get();
    if (!s) throw new Error(`Sprint ${sprintNumber} not found`);
    sprint = s as Sprint;
  } else {
    const all = db
      .select()
      .from(schema.sprints)
      .where(and(eq(schema.sprints.projectId, projectId), eq(schema.sprints.status, "closed")))
      .orderBy(schema.sprints.number)
      .all() as Sprint[];
    if (all.length === 0) throw new Error("No closed sprints found for this project");
    sprint = all[all.length - 1]!;
  }

  const issues = db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.sprintId, sprint.id))
    .all() as Issue[];

  // Blocked issues: any issue that has a blockerReason (was blocked during the sprint)
  const blockedIssues = issues.filter((i) => i.blockerReason);

  // Incomplete AC issues: done issues with at least one uncompleted AC
  const incompleteAcIssues: Issue[] = [];
  for (const issue of issues.filter((i) => i.status === "done")) {
    const uncomplete = db
      .select()
      .from(schema.acceptanceCriteria)
      .where(and(eq(schema.acceptanceCriteria.issueId, issue.id), eq(schema.acceptanceCriteria.completed, false)))
      .all();
    if (uncomplete.length > 0) incompleteAcIssues.push(issue);
  }

  // Expensive issues: tokensUsed > 2× sprint median (excluding zero-token issues)
  const tokenValues = issues.map((i) => i.tokensUsed).filter((t) => t > 0);
  let expensiveIssues: Issue[] = [];
  if (tokenValues.length > 0) {
    const sorted = [...tokenValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
        : (sorted[mid] ?? 0);
    const threshold = median * 2;
    expensiveIssues = issues.filter((i) => i.tokensUsed > threshold);
  }

  return {
    sprintNumber: sprint.number,
    sprintTitle: sprint.title ?? undefined,
    blockedIssues,
    incompleteAcIssues,
    expensiveIssues,
  };
}

export function listIssues(sprintId: number): Issue[] {
  const db = getDb();
  return db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.sprintId, sprintId))
    .all() as Issue[];
}

/** All issues in a project, sorted by epic number then issue number. */
export function getIssuesByProject(projectId: number): Issue[] {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.issues)
    .innerJoin(schema.epics, eq(schema.issues.epicId, schema.epics.id))
    .where(eq(schema.epics.projectId, projectId))
    .orderBy(schema.epics.number, schema.issues.number)
    .all();
  return rows.map((row) => row.issues as Issue);
}

/** All issues in a specific epic, sorted by sprint number then issue number. */
export function getIssuesByEpic(epicId: number): Issue[] {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.issues)
    .leftJoin(schema.sprints, eq(schema.issues.sprintId, schema.sprints.id))
    .where(eq(schema.issues.epicId, epicId))
    .orderBy(schema.sprints.number, schema.issues.number)
    .all();
  return rows.map((row) => row.issues as Issue);
}

export function getSprintByNumber(projectId: number, sprintNumber: number): Sprint {
  const db = getDb();
  const sprint = db
    .select()
    .from(schema.sprints)
    .where(and(eq(schema.sprints.projectId, projectId), eq(schema.sprints.number, sprintNumber)))
    .get();
  if (!sprint) throw new Error(`Sprint ${sprintNumber} not found for this project`);
  return sprint as Sprint;
}

export function updateIssueStatus(issueId: number, status: IssueStatus, blockerReason?: string): Issue {
  const db = getDb();
  // blockerReason is required when transitioning to blocked and preserved on all other transitions
  // so retrospectives can see which issues were blocked even after they were unblocked.
  if (status === "blocked") {
    const reason = blockerReason?.trim();
    if (!reason) throw new Error("blockerReason is required when status is blocked");
    blockerReason = reason;
  }
  const patch: { status: IssueStatus; blockerReason?: string } = { status };
  if (status === "blocked") {
    patch.blockerReason = blockerReason;
  }
  const issue = db
    .update(schema.issues)
    .set(patch)
    .where(eq(schema.issues.id, issueId))
    .returning()
    .get();
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  return issue as Issue;
}

const CLAIM_TTL_MINUTES = 30;

function isClaimStale(claimedAt: string | null | undefined): boolean {
  if (!claimedAt) return false;
  const ageMs = Date.now() - new Date(claimedAt).getTime();
  return ageMs > CLAIM_TTL_MINUTES * 60_000;
}

export function assignIssue(issueId: number, agentId: string): Issue {
  const db = getDb();
  return db.transaction((tx) => {
    const current = tx
      .select()
      .from(schema.issues)
      .where(eq(schema.issues.id, issueId))
      .get() as Issue | undefined;
    if (!current) throw new Error(`Issue ${issueId} not found`);

    // Reject if already claimed by a different agent and claim is still fresh
    if (current.claimedBy && current.claimedBy !== agentId && !isClaimStale(current.claimedAt)) {
      throw new Error(
        `Issue ${issueId} is already claimed by "${current.claimedBy}" (claimed ${current.claimedAt}). Use scrum_release_issue to release it first.`
      );
    }

    const updated = tx
      .update(schema.issues)
      .set({ assignedTo: agentId, claimedBy: agentId, claimedAt: now() })
      .where(eq(schema.issues.id, issueId))
      .returning()
      .get();
    if (!updated) throw new Error(`Issue ${issueId} not found`);
    return updated as Issue;
  });
}

export function releaseIssue(issueId: number, agentId?: string): Issue {
  const db = getDb();
  const current = db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.id, issueId))
    .get() as Issue | undefined;
  if (!current) throw new Error(`Issue ${issueId} not found`);

  if (agentId && current.claimedBy && current.claimedBy !== agentId) {
    throw new Error(
      `Issue ${issueId} is claimed by "${current.claimedBy}", not "${agentId}". Only the claiming agent can release it.`
    );
  }

  const updated = db
    .update(schema.issues)
    .set({ claimedBy: null, claimedAt: null })
    .where(eq(schema.issues.id, issueId))
    .returning()
    .get();
  if (!updated) throw new Error(`Issue ${issueId} not found`);
  return updated as Issue;
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

  return db.transaction((tx) => {
    const session = tx
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

    // Atomically increment tokens on the issue
    const issueRow = tx
      .select()
      .from(schema.issues)
      .where(eq(schema.issues.id, issueId))
      .get();
    if (issueRow) {
      tx.update(schema.issues)
        .set({ tokensUsed: issueRow.tokensUsed + tokensUsed })
        .where(eq(schema.issues.id, issueId))
        .run();
    }

    return session as Session;
  });
}

// --- Work package ---

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function getWorkPackage(projectId: number, capacity: number, agentId?: string): WorkPackage {
  const sprint = getActiveSprint(projectId);
  const dod = listDod(projectId);

  const db = getDb();

  // Auto-release stale claims before pulling work
  const allTodo = db
    .select()
    .from(schema.issues)
    .where(and(eq(schema.issues.sprintId, sprint.id), eq(schema.issues.status, "todo")))
    .all() as Issue[];

  for (const issue of allTodo) {
    if (issue.claimedBy && isClaimStale(issue.claimedAt)) {
      db.update(schema.issues)
        .set({ claimedBy: null, claimedAt: null })
        .where(eq(schema.issues.id, issue.id))
        .run();
      issue.claimedBy = null;
      issue.claimedAt = null;
    }
  }

  // Filter: only unclaimed or self-claimed issues
  const todoIssues = allTodo.filter((i) => {
    if (!i.claimedBy) return true;
    if (agentId && i.claimedBy === agentId) return true;
    return false;
  });

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
  return db.transaction((tx) => {
    tx.delete(schema.projectDod).where(eq(schema.projectDod.projectId, projectId)).run();
    return items.map((text, i) => addDodItem(projectId, text, i));
  });
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
