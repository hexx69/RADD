const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const engineDir = path.join(publicDir, "engine");
const requiredEngineFiles = [
  "index.js",
  "index.wasm",
  "index.data",
  "game_baseq2.wasm",
  "ref_soft.wasm",
  "ref_gl1.wasm",
  "ref_gles3.wasm",
  "jszip.min.js",
  "oly.js",
  "license.txt"
];

const missing = requiredEngineFiles.filter((file) => !fs.existsSync(path.join(engineDir, file)));

if (missing.length) {
  console.error("RADD is missing WebAssembly engine files:");
  for (const file of missing) console.error(`- public/engine/${file}`);
  console.error("");
  console.error("Build Qwasm2 with Emscripten and run `npm run sync:engine`, or restore the committed engine bundle.");
  process.exit(1);
}

const info = {
  name: "RADD",
  engineFiles: requiredEngineFiles
};

fs.writeFileSync(path.join(publicDir, "build-info.json"), `${JSON.stringify(info, null, 2)}\n`);
console.log("RADD static bundle is ready for Vercel.");
