// Dev-only tool: verifies the landing page is gone and `/` redirects to `/auth`.
// Usage: node scripts/verify-redirect.mjs [baseUrl]  (dev server must be running)
import { spawn } from "node:child_process";
import { accessSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find((p) => {
    try {
      accessSync(p);
      return true;
    } catch {
      return false;
    }
  });

if (!CHROME) {
  console.error("Chrome not found. Set CHROME_PATH.");
  process.exit(1);
}

const baseUrl = process.argv[2] || "http://localhost:8080";
const port = 9224;
const profile = mkdtempSync(join(tmpdir(), "soma-redirect-"));
const proc = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-gpu",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPort() {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error("Chrome debugging port not ready");
}

async function newPage(url) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?url=${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  return (await res.json()).webSocketDebuggerUrl;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            const mid = ++id;
            pending.set(mid, { res, rej });
            ws.send(JSON.stringify({ id: mid, method, params }));
          });
        },
        close() {
          ws.close();
        },
      });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    };
    ws.onerror = reject;
  });
}

async function check(path, expectPath) {
  const wsUrl = await newPage("about:blank");
  const cdp = await connect(wsUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.send("Page.navigate", { url: baseUrl + path });
  // Poll until the SPA settles (fresh profiles boot slowly), up to ~20s.
  let data;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const body = document.body ? document.body.innerText : '';
        const html = document.documentElement.outerHTML;
        return JSON.stringify({
          path: location.pathname,
          title: document.title,
          body,
          html,
          landingTraces: [
            'simplified & secure', 'Get Started', 'Testimonials', 'Discover Features',
            'Intelligent Health Platform', 'trusted by our community', 'flowing-menu', 'magic-bento'
          ].filter((s) => html.toLowerCase().includes(s.toLowerCase())),
        });
      })()`,
      returnByValue: true,
    });
    data = JSON.parse(result.value);
    const settled =
      data.path === expectPath &&
      (expectPath !== "/auth" ||
        (/create your account/i.test(data.body) && /Start your SomaCare journey/i.test(data.body)));
    if (settled) break;
  }
  cdp.close();
  const okPath = data.path === expectPath;
  console.log(`[${path}] -> ${data.path}  ${okPath ? "OK" : "FAIL (expected " + expectPath + ")"}`);
  console.log(`   title: ${data.title}`);
  console.log(
    `   landing traces: ${data.landingTraces.length ? data.landingTraces.join(", ") : "none"}`,
  );
  const signupDefault =
    /create your account/i.test(data.body) && /Start your SomaCare journey/i.test(data.body);
  console.log(`   sign-up form visible: ${signupDefault ? "yes" : "NO"}`);
  return okPath && !data.landingTraces.length && signupDefault;
}

try {
  await waitForPort();
  const okRoot = await check("/", "/auth");
  const okAuth = await check("/auth", "/auth");
  const pass = okRoot && okAuth;
  console.log(pass ? "\nPASS: landing page gone, / redirects to sign-up" : "\nFAIL");
  process.exit(pass ? 0 : 1);
} finally {
  proc.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* Chrome may still hold the profile dir on Windows; harmless. */
  }
}
