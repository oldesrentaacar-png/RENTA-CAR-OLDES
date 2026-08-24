const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = "D:\\CURSOR\\PROYECTO RENTA CAR";
const htmlPath = path.join(root, "docs", "MANUAL_USUARIO_OLDES.html");
const pdfPath = path.join(root, "docs", "MANUAL_USUARIO_OLDES_WEBBOOST.pdf");
const logoPath = path.join(root, "public", "brand", "oldes-logo.png");
const profilePath = path.join(root, ".pdf-browser-profile");

let html = fs.readFileSync(htmlPath, "utf8");
const logoDataUrl = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
html = html.replaceAll("../public/brand/oldes-logo.png", logoDataUrl);
html = html.replaceAll('src="../public/brand/oldes-logo.png"', `src="${logoDataUrl}"`);

const renderedHtmlPath = path.join(root, "docs", "_manual_usuario_render.html");
fs.writeFileSync(renderedHtmlPath, html, "utf8");
fs.mkdirSync(profilePath, { recursive: true });

const browserCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const browser = browserCandidates.find((candidate) => fs.existsSync(candidate));
if (!browser) throw new Error("No se encontró Edge o Chrome para generar el PDF.");

const fileUrl = `file:///${renderedHtmlPath.replaceAll("\\", "/").replaceAll(" ", "%20")}`;
const result = spawnSync(
  browser,
  [
    "--headless=new",
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
  },
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "PDF generation failed");
  process.exit(result.status || 1);
}

fs.unlinkSync(renderedHtmlPath);
console.log(`PDF_READY: ${pdfPath}`);
