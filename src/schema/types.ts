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
  createdAt: string; // ISO 8601
}

export interface Epic {
  id: number;
  projectId: number;
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
}

export interface Issue {
  id: number;
  epicId: number;
  sprintId: number;
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  priority: Priority;
  assignedTo?: string; // agent identifier
  storyPoints?: number;
  tokensUsed: number;
  createdAt: string;
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
  date: string; // ISO 8601 date
  summary: string;
  tokensUsed: number;
  auditor?: AuditorVerdict;
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

export interface WorkPackage {
  sprint: Sprint;
  dod: string[];
  capacityRequested: number;
  capacityUsed: number;
  issues: IssueDetail[];
}
