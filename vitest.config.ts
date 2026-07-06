import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Load .env.local into the test process without an extra dependency.
// (dotenv-cli would work too, but this keeps the test runner self-contained.)
function loadEnvLocal(): Record<string, string> {
  const file = path.resolve(__dirname, ".env.local");
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    env: loadEnvLocal(),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
