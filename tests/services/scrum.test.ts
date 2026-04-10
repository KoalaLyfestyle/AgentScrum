/**
 * Integration tests for the scrum service layer.
 * Each test gets an isolated in-memory SQLite DB via _resetDb() + fresh migrations.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import path from "path";
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

process.env["SCRUM_DB_PATH"] = ":memory:";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

const db = await import("../../src/db/index.js");
const scrum = await import("../../src/services/scrum.js");

beforeEach(() => {
  db._resetDb();
  migrate(db.getDb(), { migrationsFolder });
});

describe("initProject", () => {
  it("creates a project and Sprint 1 in planning status", () => {
    const { project, sprint } = scrum.initProject("testproject");
    expect(project.name).toBe("testproject");
    expect(project.id).toBeGreaterThan(0);
    expect(sprint.number).toBe(1);
    expect(sprint.status).toBe("planning");
    expect(sprint.projectId).toBe(project.id);
  });
});

describe("createEpic", () => {
  it("creates an epic linked to a project", () => {
    const { project } = scrum.initProject("ep-test");
    const epic = scrum.createEpic(project.id, "My Epic");
    expect(epic.title).toBe("My Epic");
    expect(epic.projectId).toBe(project.id);
    expect(epic.status).toBe("active");
  });
});

describe("createIssue / listIssues", () => {
  it("creates and lists issues in a sprint", () => {
    const { project, sprint } = scrum.initProject("issue-test");
    const epic = scrum.createEpic(project.id, "E1");

    const i1 = scrum.createIssue(epic.id, sprint.id, "Issue one", "feature", "high");
    const i2 = scrum.createIssue(epic.id, sprint.id, "Issue two", "bugfix", "low");

    expect(i1.status).toBe("todo");
    expect(i1.type).toBe("feature");
    expect(i2.priority).toBe("low");

    const issues = scrum.listIssues(sprint.id);
    expect(issues).toHaveLength(2);
  });
});

describe("updateIssueStatus", () => {
  it("transitions issue status correctly", () => {
    const { project, sprint } = scrum.initProject("status-test");
    const epic = scrum.createEpic(project.id, "E1");
    const issue = scrum.createIssue(epic.id, sprint.id, "Do work");

    const updated = scrum.updateIssueStatus(issue.id, "in_progress");
    expect(updated.status).toBe("in_progress");

    const done = scrum.updateIssueStatus(issue.id, "done");
    expect(done.status).toBe("done");
  });
});

describe("addAc / completeAc", () => {
  it("adds and completes acceptance criteria", () => {
    const { project, sprint } = scrum.initProject("ac-test");
    const epic = scrum.createEpic(project.id, "E1");
    const issue = scrum.createIssue(epic.id, sprint.id, "AC issue");

    const ac = scrum.addAc(issue.id, "Must do X");
    expect(ac.completed).toBe(false);
    expect(ac.text).toBe("Must do X");

    const completed = scrum.completeAc(ac.id);
    expect(completed.completed).toBe(true);
  });
});

describe("logSession", () => {
  it("logs a session and increments tokensUsed on issue", () => {
    const { project, sprint } = scrum.initProject("log-test");
    const epic = scrum.createEpic(project.id, "E1");
    const issue = scrum.createIssue(epic.id, sprint.id, "Log issue");

    const session = scrum.logSession(issue.id, "Did some work", 500, "pass");
    expect(session.summary).toBe("Did some work");
    expect(session.tokensUsed).toBe(500);
    expect(session.auditor).toBe("pass");

    const detail = scrum.getIssueDetail(issue.id);
    expect(detail.tokensUsed).toBe(500);
    expect(detail.sessions).toHaveLength(1);
  });
});

describe("getSprintSummary", () => {
  it("returns correct counts by status", () => {
    const { project, sprint } = scrum.initProject("summary-test");
    const epic = scrum.createEpic(project.id, "E1");

    scrum.createIssue(epic.id, sprint.id, "I1");
    scrum.createIssue(epic.id, sprint.id, "I2");
    const i3 = scrum.createIssue(epic.id, sprint.id, "I3");
    scrum.updateIssueStatus(i3.id, "done");

    const summary = scrum.getSprintSummary(sprint.id);
    expect(summary.total).toBe(3);
    expect(summary.byStatus.todo).toBe(2);
    expect(summary.byStatus.done).toBe(1);
    expect(summary.activeIssue).toBeUndefined();
  });
});

describe("getActiveSprint fallback", () => {
  it("returns planning sprint when no active sprint exists", () => {
    const { project, sprint } = scrum.initProject("fallback-test");
    const found = scrum.getActiveSprint(project.id);
    expect(found.id).toBe(sprint.id);
    expect(found.status).toBe("planning");
  });
});

describe("estimateIssue", () => {
  it("sets story points on an issue", () => {
    const { project, sprint } = scrum.initProject("est-test");
    const epic = scrum.createEpic(project.id, "E1");
    const issue = scrum.createIssue(epic.id, sprint.id, "Estimate me");
    expect(issue.storyPoints).toBeNull();

    const updated = scrum.estimateIssue(issue.id, 5);
    expect(updated.storyPoints).toBe(5);
  });
});

describe("DoD management", () => {
  it("adds, lists, and removes DoD items", () => {
    const { project } = scrum.initProject("dod-test");

    const item1 = scrum.addDodItem(project.id, "Run npm test");
    const item2 = scrum.addDodItem(project.id, "Commit changes");
    expect(item1.text).toBe("Run npm test");
    expect(item2.text).toBe("Commit changes");

    const list = scrum.listDod(project.id);
    expect(list).toHaveLength(2);
    expect(list[0]!.text).toBe("Run npm test");

    scrum.removeDodItem(item1.id);
    const listAfter = scrum.listDod(project.id);
    expect(listAfter).toHaveLength(1);
    expect(listAfter[0]!.text).toBe("Commit changes");
  });

  it("setDod replaces entire list", () => {
    const { project } = scrum.initProject("dod-set-test");
    scrum.addDodItem(project.id, "Old item");

    scrum.setDod(project.id, ["Run tests", "Commit", "Push"]);
    const list = scrum.listDod(project.id);
    expect(list).toHaveLength(3);
    expect(list.map((d) => d.text)).toEqual(["Run tests", "Commit", "Push"]);
  });
});

describe("getWorkPackage", () => {
  it("returns issues up to capacity with ACs and DoD embedded", () => {
    const { project, sprint } = scrum.initProject("wp-test");
    const epic = scrum.createEpic(project.id, "E1");
    scrum.startSprint(sprint.id, "Test sprint");
    scrum.setDod(project.id, ["Run npm test", "Commit"]);

    const i1 = scrum.createIssue(epic.id, sprint.id, "High priority", "feature", "high");
    scrum.estimateIssue(i1.id, 3);
    scrum.addAc(i1.id, "AC for high");

    const i2 = scrum.createIssue(epic.id, sprint.id, "Low priority", "feature", "low");
    scrum.estimateIssue(i2.id, 5);

    // capacity 4 — fits i1 (3pts), skips i2 (5pts)
    const pkg = scrum.getWorkPackage(project.id, 4);
    expect(pkg.dod).toEqual(["Run npm test", "Commit"]);
    expect(pkg.capacityRequested).toBe(4);
    expect(pkg.capacityUsed).toBe(3);
    expect(pkg.issues).toHaveLength(1);
    expect(pkg.issues[0]!.title).toBe("High priority");
    expect(pkg.issues[0]!.acs).toHaveLength(1);
    expect(pkg.issues[0]!.acs[0]!.text).toBe("AC for high");
  });

  it("packs multiple issues greedily by priority", () => {
    const { project, sprint } = scrum.initProject("wp-pack-test");
    const epic = scrum.createEpic(project.id, "E1");
    scrum.startSprint(sprint.id);

    const i1 = scrum.createIssue(epic.id, sprint.id, "A", "feature", "high");
    scrum.estimateIssue(i1.id, 2);
    const i2 = scrum.createIssue(epic.id, sprint.id, "B", "feature", "medium");
    scrum.estimateIssue(i2.id, 3);
    const i3 = scrum.createIssue(epic.id, sprint.id, "C", "feature", "low");
    scrum.estimateIssue(i3.id, 8);

    // capacity 5 — fits A(2) + B(3), not C(8)
    const pkg = scrum.getWorkPackage(project.id, 5);
    expect(pkg.issues.map((i) => i.title)).toEqual(["A", "B"]);
    expect(pkg.capacityUsed).toBe(5);
  });
});
