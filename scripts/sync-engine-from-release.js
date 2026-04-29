const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const releaseDir = path.join(root, "release");
const engineDir = path.join(root, "public", "engine");

const files = [
  "index.js",
  "index.wasm",
  "index.data",
  "game_baseq2.wasm",
  "ref_soft.wasm",
  "ref_gl1.wasm",
  "ref_gles3.wasm"
];

if (!fs.existsSync(releaseDir)) {
  console.error("No release/ directory found. Build the WebAssembly target first.");
  process.exit(1);
}

fs.mkdirSync(engineDir, { recursive: true });

for (const file of files) {
  const source = path.join(releaseDir, file);
  const dest = path.join(engineDir, file);
  if (!fs.existsSync(source)) {
    console.error(`Missing ${source}`);
    process.exit(1);
  }
  fs.copyFileSync(source, dest);
  console.log(`Copied ${file}`);
}
