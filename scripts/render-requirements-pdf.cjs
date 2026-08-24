const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = "D:\\CURSOR\\PROYECTO RENTA CAR";
const sourcePath = path.join(root, "docs", "ESPECIFICACION_REQUISITOS_OLDES.md");
const htmlPath = path.join(root, "docs", "ESPECIFICACION_REQUISITOS_OLDES.html");
const pdfPath = path.join(root, "docs", "ESPECIFICACION_REQUISITOS_OLDES.pdf");
const profilePath = path.join(root, ".pdf-browser-profile");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inline(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const output = [];
  let list = null;

  function closeList() {
    if (list) output.push(`</${list}>`);
    list = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      closeList();
      output.push("<hr>");
      continue;
    }

    if (line.startsWith("> ")) {
      closeList();
      output.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    const unordered = /^-\s+(.+)$/.exec(line);
    if (unordered) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        output.push("<ul>");
      }
      output.push(`<li>${inline(unordered[1])}</li>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        output.push("<ol>");
      }
      output.push(`<li>${inline(ordered[1])}</li>`);
      continue;
    }

    closeList();
    output.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return output.join("\n");
}

const markdown = fs.readFileSync(sourcePath, "utf8");
const body = markdownToHtml(markdown);
const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Especificación de requisitos OLDES</title>
  <style>
    @page { size: Letter; margin: 18mm 16mm 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1f2937;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.3pt;
      line-height: 1.48;
    }
    h1 {
      margin: 0 0 6px;
      color: #12396b;
      font-size: 24pt;
      line-height: 1.08;
      letter-spacing: -.4px;
    }
    h2 {
      margin: 7px 0 18px;
      color: #315a8a;
      font-size: 15pt;
      line-height: 1.2;
    }
    h2:not(:first-of-type) {
      margin: 25px 0 9px;
      padding-bottom: 4px;
      border-bottom: 1px solid #b7c5d8;
      break-after: avoid;
    }
    h3 {
      margin: 16px 0 6px;
      color: #12396b;
      font-size: 11.5pt;
      break-after: avoid;
    }
    p { margin: 5px 0 8px; orphans: 3; widows: 3; }
    ul, ol { margin: 5px 0 10px 20px; padding: 0; }
    li { margin: 3px 0; break-inside: avoid; }
    strong { color: #172b4d; }
    code {
      padding: 1px 4px;
      background: #eef2f7;
      border-radius: 3px;
      font-size: 9pt;
    }
    blockquote {
      margin: 10px 0 14px;
      padding: 9px 12px;
      border-left: 4px solid #315a8a;
      background: #f3f6fa;
      color: #334155;
    }
    hr {
      margin: 17px 0;
      border: 0;
      border-top: 2px solid #12396b;
    }
    h1 + h2 + p, h1 + h2 + p + p, h1 + h2 + p + p + p, h1 + h2 + p + p + p + p {
      color: #475569;
    }
    body::after {
      content: "OLDES Rent a Car El Salvador · Especificación de requisitos · 8 de agosto de 2026";
      position: fixed;
      right: 0;
      bottom: -11mm;
      left: 0;
      color: #64748b;
      font-size: 8pt;
      text-align: center;
    }
  </style>
</head>
<body>${body}</body>
</html>`;

fs.writeFileSync(htmlPath, html, "utf8");
fs.mkdirSync(profilePath, { recursive: true });

const browserCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const browser = browserCandidates.find((candidate) => fs.existsSync(candidate));
if (!browser) throw new Error("No se encontró Edge o Chrome para generar el PDF.");

const fileUrl = `file:///${htmlPath.replaceAll("\\", "/").replaceAll(" ", "%20")}`;
const result = spawnSync(
  browser,
  [
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--user-data-dir=${profilePath}`,
    `--print-to-pdf=${pdfPath}`,
    fileUrl,
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      TEMP: path.join(root, ".npm-transcription-cache"),
      TMP: path.join(root, ".npm-transcription-cache"),
    },
    encoding: "utf8",
    timeout: 120000,
  },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(result.stderr || `El navegador terminó con código ${result.status}.`);
}
if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size < 1000) {
  throw new Error("El PDF no se generó correctamente.");
}

console.log(`PDF_READY: ${pdfPath}`);
