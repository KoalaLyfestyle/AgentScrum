"""Seed a demo sprint through the real MCP server, then capture the dashboard.

Draws docs/media/dashboard-overview.jpg and docs/media/agent-claims-issue.gif.

    npm ci && npm run build && (cd dashboard && npm ci && npm run build)
    pip install playwright pillow    # plus a Chromium that Playwright can find
    python docs/media/capture_demo.py "$PWD" /tmp/agentscrum-demo

It runs docker/entrypoint.sh natively (migrate, dashboard on 127.0.0.1:5180,
and MCP server processes) against a new demo.db in the output folder, never
your real database. Stop anything else on port 5180 first. All data is made
up; every write goes through the MCP tools an agent would call.
"""
import json, os, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

app, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
db = out / "demo.db"
for p in out.glob("demo.db*"):
    p.unlink()
env = {**os.environ, "SCRUM_DB_PATH": str(db), "AGENTSCRUM_APP": str(app), "COST_SOURCE": "manual",
       "SCRUM_MIGRATE_ON_OPEN": "0", "PORT": "5180", "HOST": "127.0.0.1"}
entry = str(app / "docker" / "entrypoint.sh")
print(subprocess.run(["sh", entry, "migrate"], env=env, capture_output=True, text=True).stderr[-300:])


class MCP:
    def __init__(self):
        self.p = subprocess.Popen(["sh", entry, "mcp"], env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.DEVNULL, text=True, bufsize=1)
        self.n = 0
        self.req("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "demo", "version": "1"}})
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")

    def req(self, method, params):
        self.n += 1
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": self.n, "method": method, "params": params}) + "\n")
        while True:
            m = json.loads(self.p.stdout.readline())
            if m.get("id") == self.n:
                return m

    def call(self, tool, **args):
        m = self.req("tools/call", {"name": tool, "arguments": args})
        text = m["result"]["content"][0]["text"]
        if m["result"].get("isError"):
            raise RuntimeError(f"{tool}: {text}")
        try:
            return json.loads(text)
        except ValueError:
            return text


lead = MCP()
r = lead.call("scrum_init_project", name="demo-shop")
pid, s1 = r["project"]["id"], r["sprint"]["id"]
lead.call("scrum_start_sprint", sprint_id=s1, goal="Checkout flow works end to end")
lead.call("scrum_update_sprint", sprint_id=s1, title="Sprint 1 — Checkout")
e_cart = lead.call("scrum_create_epic", project_id=pid, title="Cart and checkout")["id"]
e_acct = lead.call("scrum_create_epic", project_id=pid, title="Accounts")["id"]
plan = [
    (e_cart, "Add items to the cart", ["Cart keeps items across reloads", "Quantity can be changed"], "done", 41000, 3),
    (e_cart, "Show the order total with tax", ["Total includes tax", "Total updates when the cart changes"], "done", 28000, 2),
    (e_acct, "Sign up with email", ["Email is verified", "Duplicate emails are refused"], "done", 52000, 5),
    (e_cart, "Pay with a saved card", ["Saved card is masked", "Failed payment shows a reason"], "in_progress", 17000, 5),
    (e_acct, "Reset a forgotten password", ["Reset link expires after one hour"], "todo", 0, 3),
    (e_cart, "Send an order confirmation email", ["Email lists items and total", "Email is sent once"], "todo", 0, 2),
]
ids = []
for epic, title, acs, status, tokens, pts in plan:
    iid = lead.call("scrum_create_issue", epic_id=epic, sprint_id=s1, title=title, story_points=pts)["id"]
    ac_ids = [lead.call("scrum_add_ac", issue_id=iid, text=t)["id"] for t in acs]
    ids.append((iid, title, ac_ids))
    if status != "todo":
        agent = "agent-a" if len(ids) % 2 else "agent-b"
        lead.call("scrum_assign_issue", issue_id=iid, agent_id=agent)
        lead.call("scrum_update_issue_status", issue_id=iid, status="in_progress")
        lead.call("scrum_log_session", issue_id=iid, summary=f"Worked on: {title}", tokens_used=tokens, model="claude-sonnet-4-6")
    if status == "done":
        for a in ac_ids:
            lead.call("scrum_complete_ac", ac_id=a)
        lead.call("scrum_update_issue_status", issue_id=iid, status="done")
lead.p.stdin.close()

dash = subprocess.Popen(["sh", entry, "dashboard"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    try:
        urllib.request.urlopen("http://127.0.0.1:5180/healthz", timeout=1)
        break
    except Exception:
        time.sleep(0.5)

target_id, target_title, target_acs = ids[5]
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22) if Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf").exists() else ImageFont.load_default()
frames = []

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
    base = f"http://127.0.0.1:5180/?project={pid}"
    pg.goto(base + "&view=overview", wait_until="networkidle")
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(out / "dashboard-overview.png"))
    board = f"{base}&view=sprint&sprint={s1}"

    def shot(caption):
        pg.goto(board, wait_until="networkidle")
        pg.wait_for_timeout(600)
        path = out / f"frame-{len(frames)}.png"
        pg.screenshot(path=str(path))
        img = Image.open(path).convert("RGB")
        bar = Image.new("RGB", (img.width, 44), (17, 17, 17))
        ImageDraw.Draw(bar).text((16, 9), caption, fill=(240, 240, 240), font=font)
        both = Image.new("RGB", (img.width, img.height + 44))
        both.paste(bar, (0, 0)); both.paste(img, (0, 44))
        frames.append(both)

    a, bb = MCP(), MCP()
    shot(f"Sprint board before: '{target_title}' is in To do")
    # Two agents claim the same issue at once, from separate processes: one wins.
    ra = a.call("scrum_assign_issue", issue_id=target_id, agent_id="agent-a")
    try:
        bb.call("scrum_assign_issue", issue_id=target_id, agent_id="agent-b")
        lost = "agent-b also won (unexpected)"
    except RuntimeError as exc:
        lost = "agent-b is refused: already claimed"
    print("claim:", lost)
    a.call("scrum_update_issue_status", issue_id=target_id, status="in_progress")
    shot(f"agent-a claims it and starts; {lost}")
    for ac in target_acs:
        a.call("scrum_complete_ac", ac_id=ac)
    a.call("scrum_update_issue_status", issue_id=target_id, status="review")
    shot("agent-a ticks both acceptance criteria and moves it to Review")
    a.call("scrum_log_session", issue_id=target_id, summary="Confirmation email sent once per order", tokens_used=23000, model="claude-sonnet-4-6")
    a.call("scrum_update_issue_status", issue_id=target_id, status="done")
    shot("agent-a logs its session and marks it Done")
    a.p.stdin.close(); bb.p.stdin.close()
    b.close()

dash.terminate()
ov = Image.open(out / "dashboard-overview.png").convert("RGB")
ov.save(out / "dashboard-overview.jpg", quality=86, optimize=True, progressive=True)
# Crop to the board (right of the sidebar, above the empty space), then shrink.
crop = [f.crop((236, 0, 1280, 44 + 620)) for f in frames]
for f, raw in zip(crop, frames):
    f.paste(raw.crop((0, 0, 1044, 44)), (0, 0))
small = [f.resize((760, int(f.height * 760 / f.width)), Image.LANCZOS) for f in crop]
pal = [f.quantize(colors=128, method=Image.MEDIANCUT, dither=Image.Dither.NONE) for f in small]
pal[0].save(out / "agent-claims-issue.gif", save_all=True, append_images=pal[1:], duration=[2200, 2600, 2600, 3200], loop=0, optimize=True)
print(json.dumps({"project": pid, "sprint": s1, "issue": target_id}))
