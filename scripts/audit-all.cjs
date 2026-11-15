/**
 * Runs every production gate in sequence. Windows-safe (no shell &&).
 * npm run audit:all
 */
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const node = process.execPath;

const steps = [
  ["scripts/audit-money-cents.cjs"],
  ["scripts/audit-sep30-regressions.cjs"],
  ["scripts/audit-production-locks.cjs"],
  ["scripts/audit-close-and-observations.mjs"],
  [
    path.join(root, "node_modules", "typescript", "bin", "tsc"),
    "--noEmit",
    "-p",
    "tsconfig.json",
  ],
];

for (const args of steps) {
  const label = args.join(" ");
  console.log(`\n>>> ${label}`);
  const result = spawnSync(node, args, {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      TEMP: "D:\\MELVIN\\Temp",
      TMP: "D:\\MELVIN\\Temp",
    },
  });
  if (result.status !== 0) {
    console.error(`\nFAIL: ${label} (exit ${result.status})`);
    process.exit(result.status || 1);
  }
}

console.log("\n=== audit:all PASSED ===\n");
