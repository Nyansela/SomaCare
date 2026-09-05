import fs from "node:fs";
import path from "node:path";

let loaded = false;

export function loadDevVars() {
  if (loaded) return;
  loaded = true;
  try {
    const devVarsPath = path.resolve(process.cwd(), ".dev.vars");
    if (fs.existsSync(devVarsPath)) {
      const content = fs.readFileSync(devVarsPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          const val = trimmed
            .slice(eqIndex + 1)
            .trim()
            .replace(/^["'](.*)["']$/, "$1");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to load .dev.vars:", e);
  }
}
