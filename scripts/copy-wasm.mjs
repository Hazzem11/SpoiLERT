import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "node_modules", "onnxruntime-web", "dist");
const targetDir = join(root, "public", "wasm");

// Transformers.js / ORT expects both the .mjs loaders and matching .wasm binaries.
const files = [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm"
];

mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  const source = join(sourceDir, file);
  if (!existsSync(source)) {
    console.warn(`SpoilERT: missing WASM source ${source}`);
    continue;
  }
  copyFileSync(source, join(targetDir, file));
}
console.info(`SpoilERT: copied ${files.length} ONNX Runtime WASM assets into public/wasm`);
