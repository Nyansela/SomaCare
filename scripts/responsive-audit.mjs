// Dev-only tool: audits pages for horizontal overflow at mobile/tablet widths.
// Usage: node scripts/responsive-audit.mjs [baseUrl]
// Requires the dev server running (default http://localhost:8080).
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
const port = 9223;
const profile = mkdtempSync(join(tmpdir(), "soma-audit-"));
const proc = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-gpu",
    "--hide-scrollbars",
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

async function audit(url, width, height) {
  const wsUrl = await newPage("about:blank");
  const cdp = await connect(wsUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await cdp.send("Page.navigate", { url });
  await sleep(4500); // let the SPA render and settle
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const vw = document.documentElement.clientWidth;
      const sw = document.documentElement.scrollWidth;
      const list = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 2 || r.left < -2) {
          if (list.length < 12) {
            const cls = typeof el.className === 'string' ? '.' + el.className.slice(0, 90) : '';
            const txt = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50);
            list.push(el.tagName.toLowerCase() + cls + (txt ? ' "' + txt + '"' : '') + ' L' + Math.round(r.left) + ' R' + Math.round(r.right));
          }
        }
      });
      return JSON.stringify({ url: location.pathname, vw, sw, overflowPx: sw - vw, list });
    })()`,
    returnByValue: true,
  });
  cdp.close();
  return JSON.parse(result.value);
}

try {
  await waitForPort();
  const urls = ["/", "/auth", "/onboarding"];
  const viewports = [
    [390, 844],
    [768, 1024],
  ];
  for (const [w, h] of viewports) {
    for (const path of urls) {
      try {
        const r = await audit(baseUrl + path, w, h);
        console.log(`\n[${w}px] ${r.url}  overflow=${r.overflowPx}px (vw=${r.vw} sw=${r.sw})`);
        r.list.forEach((l) => console.log("   -", l));
      } catch (e) {
        console.log(`\n[${w}px] ${path} ERROR: ${e.message}`);
      }
    }
  }
} finally {
  proc.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* Chrome may still hold the profile dir on Windows; harmless. */
  }
}
