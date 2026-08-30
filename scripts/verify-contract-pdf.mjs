import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Minimal smoke test: ensure compiled PDF source has no old layout strings.
const source = await import("node:fs/promises").then((fs) =>
  fs.readFile("src/lib/pdf/contract-pdf.tsx", "utf8"),
);

const bad = ["Foto real + marcas", "Diagrama CAD pickup", "diagramGrid", "CarDiagram"];
const good = ["2026-08-30-v3", "annexPhotos", "PanelMapSvg"];

for (const token of bad) {
  if (source.includes(token)) {
    console.error(`FAIL: old token still present: ${token}`);
    process.exit(1);
  }
}

for (const token of good) {
  if (!source.includes(token)) {
    console.error(`FAIL: expected token missing: ${token}`);
    process.exit(1);
  }
}

console.log("OK: contract-pdf.tsx uses new template only");
