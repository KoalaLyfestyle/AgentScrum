// Core domain types for AgentScrum.
// These are the source of truth for both the Drizzle schema and MCP tool signatures.

export type IssueStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type IssueType = "feature" | "bugfix" | "refactor" | "test" | "docs";
export type EpicStatus = "active" | "complete" | "paused";
export type SprintStatus = "planning" | "active" | "closed";
export type Priority = "high" | "medium" | "low";
export type AuditorVerdict = "pass" | "fail" | "skipped";

export interface Project {
  id: number;
  name: string;
  directory?: string | null; // absolute path set at init time; used for CWD-based auto-detection
  createdAt: string; // ISO 8601
}

export interface Epic {
  id: number;
  projectId: number;
  number: number; // sequential per project; display as E01, E02, ...
  title: string;
  status: EpicStatus;
  createdAt: string;
}

export interface Sprint {
  id: number;
  projectId: number;
  number: number;
  status: SprintStatus;
  title?: string;
  goal?: string;
  prTitle?: string;
  prDescription?: string;
  startedAt?: string;
  closedAt?: string;
}

export interface SprintVelocity {
  sprintNumber: number;
  sprintTitle?: string;
  pointsCompleted: number;
  issuesCompleted: number;
  tokensUsed: number;
  tokensByAgent?: Record<string, number>;
}

export interface Issue {
  id: number;
  epicId: number;
  sprintId: number | null; // null = unassigned (not yet added to any sprint)
  number: number; // sequential per epic; display as E01-I01, E01-I02, ...
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  priority: Priority;
  assignedTo?: string; // agent identifier
  storyPoints?: number;
  tokensUsed: number;
  blockerReason?: string | null;
  claimedBy?: string | null;
  claimedAt?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AcceptanceCriterion {
  id: number;
  issueId: number;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface Session {
  id: number;
  issueId: number;
  createdAt: string; // ISO 8601 full timestamp
  summary: string;
  tokensUsed: number;
  auditor?: AuditorVerdict;
  model?: string | null;
}

export interface Decision {
  id: number;
  projectId: number;
  title: string;
  status: "accepted" | "superseded";
  context: string;
  decision: string;
  rejectedAlternatives?: string;
  consequences?: string;
  createdAt: string;
}

export interface Lesson {
  id: number;
  projectId?: number;
  title: string;
  whatFailed: string;
  dontRepeat: string;
  tags?: string;
  createdAt: string;
}

export interface DodItem {
  id: number;
  projectId: number;
  order: number;
  text: string;
  active: boolean;
  createdAt: string;
}

// Composite types returned by service layer
export interface IssueDetail extends Issue {
  acs: AcceptanceCriterion[];
  sessions: Session[];
}

export interface SprintSummary {
  sprint: Sprint;
  total: number;
  byStatus: Record<IssueStatus, number>;
  activeIssue?: Issue;
}

export interface RetroIssue extends Issue {
  cycleTimeHours?: number; // hours from first in_progress to done; undefined if timestamps missing
}

export interface Retrospective {
  sprintNumber: number;
  sprintTitle?: string;
  /** Issues that were or are currently blocked (have a blockerReason set). */
  blockedIssues: RetroIssue[];
  /** Done issues that still have uncompleted acceptance criteria. */
  incompleteAcIssues: RetroIssue[];
  /** Issues whose token usage exceeds 2× the sprint median. */
  expensiveIssues: RetroIssue[];
  /** Cycle time summary for done issues with both timestamps. */
  cycleTimeSummary?: { avgHours: number; minHours: number; maxHours: number; issueCount: number };
}

export interface CostReportIssue {
  issueId: number;
  issueKey: string; // e.g. "E03-I12"
  title: string;
  assignedTo?: string;
  tokensUsed: number;
  estimatedCost?: number; // USD; omitted when no price config
}

export interface CostReport {
  sprintNumber: number;
  sprintTitle?: string;
  issues: CostReportIssue[];
  totalTokens: number;
  totalCost?: number; // USD; omitted when no price config
  modelPrices?: Record<string, number>; // model → $/1M tokens used for calculation
}

export interface DodCompletion {
  id: number;
  sprintId: number;
  dodItemId: number;
  dodText: string;
  completedAt: string;
}

export interface WorkPackageDodItem {
  id: number;
  text: string;
  completed: boolean;
}

export interface WorkPackage {
  sprint: Sprint;
  dod: WorkPackageDodItem[];
  capacityRequested: number;
  capacityUsed: number;
  issues: IssueDetail[];
}
