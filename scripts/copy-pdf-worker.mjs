#!/usr/bin/env node
// Copies pdf.js's main module and worker into public/ so the browser can load
// them same-origin: the library imports pdf.js at runtime with webpackIgnore
// (webpack's ESM interop mangles pdf.js), and the CSP allows no external scripts.
//
// Generated rather than committed, so neither file can drift out of step with the
// installed pdfjs-dist — a mismatch between the main module and its worker makes
// pdf.js refuse to render.
//
// It runs as the first step of `npm run build` (and of `predev`), *not* as a
// `prebuild` hook: Vercel's build command calls `npm run build`, but a deploy that
// overrode it with `next build` skipped the hook silently, and importing a PDF in
// production died on a 404 for /pdf.min.mjs. Being part of the build command is what
// makes that impossible — and a missing source file now fails the build rather than
// warning into a log nobody reads.

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
    console.error(
      `[copy-pdf-worker] ${f.out} not found in pdfjs-dist — importing PDFs would fail at runtime.\n` +
        `  Looked in: ${f.from.join(", ")}\n` +
        `  Run \`npm install\`, or check whether pdfjs-dist moved its build output.`,
    );
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(repoRoot, "public", f.out));
  console.log(`[copy-pdf-worker] ${path.relative(repoRoot, src)} → public/${f.out}`);
}
