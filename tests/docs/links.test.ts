// Relative links in the README, docs/, and the agent skill must resolve (#25).
// The README now points to these pages for everything it used to hold, so a
// broken link or anchor means content a reader cannot reach.
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const pages = [
  "README.md",
  "skills/agentscrum/SKILL.md",
  ...fs
    .readdirSync(path.join(root, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
];

/** GitHub's heading anchor: lowercase, drop punctuation, spaces become hyphens. */
function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");
}

function anchors(file: string): Set<string> {
  const text = fs.readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  const seen = new Map<string, number>();
  const out = new Set<string>();
  for (const m of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = slug(m[1] ?? "");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

function links(file: string): string[] {
  const text = fs.readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1] ?? "");
}

describe("documentation links", () => {
  it.each(pages)("every relative link in %s resolves", (page) => {
    const file = path.join(root, page);
    const broken: string[] = [];
    for (const link of links(file)) {
      if (/^[a-z]+:/i.test(link)) continue; // http:, https:, mailto:
      const [target, anchor] = link.split("#");
      const dest = target ? path.resolve(path.dirname(file), target) : file;
      if (!fs.existsSync(dest)) {
        broken.push(`${link} (no such file)`);
        continue;
      }
      if (anchor && dest.endsWith(".md") && !anchors(dest).has(anchor)) {
        broken.push(`${link} (no such heading)`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("the skill's links resolve where the skill is installed", () => {
    // Every documented install puts the skill at ~/.claude/skills/agentscrum as
    // a symlink. Claude Code resolves ".." in a link without following that
    // symlink, so check the links from the installed path, not from the repo.
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "agentscrum-skill-"));
    try {
      const installed = path.join(home, ".claude", "skills", "agentscrum");
      fs.mkdirSync(path.dirname(installed), { recursive: true });
      fs.symlinkSync(path.join(root, "skills", "agentscrum"), installed);
      const broken: string[] = [];
      for (const link of links(path.join(installed, "SKILL.md"))) {
        if (/^[a-z]+:/i.test(link)) continue;
        if (link.startsWith("../")) {
          broken.push(`${link} (leaves the skill folder)`);
          continue;
        }
        const [target, anchor] = link.split("#");
        const dest = target ? path.resolve(installed, target) : path.join(installed, "SKILL.md");
        if (!fs.existsSync(dest)) {
          broken.push(`${link} (no such file at ${dest})`);
          continue;
        }
        if (anchor && dest.endsWith(".md") && !anchors(dest).has(anchor)) {
          broken.push(`${link} (no such heading)`);
        }
      }
      expect(broken).toEqual([]);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it("README stays under 120 lines", () => {
    const lines = fs.readFileSync(path.join(root, "README.md"), "utf8").split("\n").length;
    expect(lines).toBeLessThan(120);
  });

  it("the skill has the name and a description that triggers on AgentScrum work", () => {
    const text = fs.readFileSync(path.join(root, "skills/agentscrum/SKILL.md"), "utf8");
    const front = text.match(/^---\n([\s\S]*?)\n---\n/);
    expect(front).not.toBeNull();
    expect(front?.[1] ?? "").toMatch(/^name: agentscrum$/m);
    const description = (front?.[1] ?? "").match(/^description: (.+)$/m)?.[1] ?? "";
    for (const word of ["AgentScrum", "sprint", "issue", "work package", "scrum_"]) {
      expect(description).toContain(word);
    }
  });
});
