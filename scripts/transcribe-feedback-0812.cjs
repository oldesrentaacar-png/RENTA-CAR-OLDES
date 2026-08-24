const fs = require("fs");
const path = require("path");
const { whisper } = require("@lumen-labs-dev/whisper-node");

process.env.WHISPER_WIN_BIN_DIR = "Win64\\Release";

async function main() {
  const modelPath = path.join(
    process.cwd(),
    "node_modules",
    "@lumen-labs-dev",
    "whisper-node",
    "lib",
    "whisper.cpp",
    "models",
    "ggml-base.bin",
  );
  const file =
    "D:\\CURSOR\\PROYECTO RENTA CAR\\.npm-transcription-cache\\client-feedback-2026-08-12.wav";
  const segments = await whisper(file, {
    modelPath,
    whisperOptions: { language: "es", word_timestamps: false },
    shellOptions: { silent: true, async: false },
  });
  const text = segments
    .map((s) => `- **${s.start}–${s.end}:** ${String(s.speech).trim()}`)
    .join("\n");
  const out = path.join(
    process.cwd(),
    "docs",
    "CLIENT_FEEDBACK_2026-08-12_TRANSCRIPT.md",
  );
  fs.writeFileSync(
    out,
    `# Transcripción video 2026-08-12\n\n${text}\n`,
    "utf8",
  );
  console.log(`SEGMENTS=${segments.length}`);
  console.log(text.slice(0, 4000));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
