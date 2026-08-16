#!/usr/bin/env node
// Copies pdf.js's main module and worker into public/ so the browser can load
// them same-origin: the library imports pdf.js at runtime with webpackIgnore
// (webpack's ESM interop mangles pdf.js), and the CSP allows no external scripts.
//
// Runs from predev/prebuild rather than being committed, so neither file can
// drift out of step with the installed pdfjs-dist — a mismatch between the main
// module and its worker makes pdf.js refuse to render.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = path.join(repoRoot, "node_modules");

const files = [
  { out: "pdf.min.mjs", from: ["pdfjs-dist/build/pdf.min.mjs", "pdfjs-dist/legacy/build/pdf.min.mjs"] },
  { out: "pdf.worker.min.mjs", from: ["pdfjs-dist/build/pdf.worker.min.mjs", "pdfjs-dist/legacy/build/pdf.worker.min.mjs"] },
];

fs.mkdirSync(path.join(repoRoot, "public"), { recursive: true });
for (const f of files) {
  const src = f.from.map((r) => path.join(nm, r)).find((p) => fs.existsSync(p));
  if (!src) {
    console.warn(`[copy-pdf-worker] ${f.out} not found in pdfjs-dist — importing PDFs will not work.`);
    continue;
  }
  fs.copyFileSync(src, path.join(repoRoot, "public", f.out));
  console.log(`[copy-pdf-worker] ${path.relative(repoRoot, src)} → public/${f.out}`);
}
