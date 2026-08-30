import { readFileSync } from "fs";

const html = readFileSync("public/landing/faq.html", "utf8");
const m = html.match(/<script>\s*([\s\S]*?)<\/script>/);
if (!m) {
  console.error("No script found");
  process.exit(1);
}
try {
  new Function(m[1]);
  console.log("JS syntax OK");
} catch (e) {
  console.error("JS ERROR:", e.message);
  process.exit(1);
}
