#!/usr/bin/env node
// Add a PDF planner to /planner.
//
//   node scripts/add-planner.mjs <pdf-path> <id> "<Display Name>" ["Description"]
//
// e.g. node scripts/add-planner.mjs ~/Downloads/StudyPlanner.pdf study-2026 "Study Planner 2026"
//
// What it does:
//   1. Renders every page to public/planner/<id>/pNNN.webp (needs `pdftoppm`
//      from poppler and `cwebp` from webp — brew install poppler webp)
//   2. Extracts the PDF's internal hyperlinks (month tabs, day links, …) into
//      public/planner/<id>/manifest.json so tap-navigation works in the app.
//      PDFs exported without links still work — pages just navigate via the
//      toolbar arrows.
//   3. Registers the planner in public/planner/index.json
//
// The id must be lowercase letters/digits/hyphens (it becomes the folder name
// and the ink-storage key).

import { execFileSync, execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const [, , pdfPath, id, name, description = "", category = "Other Planners", credit = ""] = process.argv;

if (!pdfPath || !id || !name) {
  console.error('Usage: node scripts/add-planner.mjs <pdf-path> <id> "<Display Name>" ["Description"] ["Category"] ["Credit"]');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) {
  console.error("id must be lowercase letters, digits and hyphens (max 40 chars)");
  process.exit(1);
}
if (!fs.existsSync(pdfPath)) {
  console.error("PDF not found:", pdfPath);
  process.exit(1);
}
for (const tool of ["pdftoppm", "pdfinfo", "cwebp"]) {
  try { execSync(`command -v ${tool}`, { stdio: "ignore", shell: "/bin/sh" }); }
  catch { console.error(`Missing '${tool}'. Install with: brew install poppler webp`); process.exit(1); }
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "public", "planner", id);
const indexPath = path.join(repoRoot, "public", "planner", "index.json");

// --- 1. inspect ---------------------------------------------------------------
const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
const pages = parseInt(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? "0", 10);
const sizeMatch = info.match(/^Page size:\s+([\d.]+) x ([\d.]+)/m);
if (!pages || !sizeMatch) {
  console.error("Couldn't read page count / size from the PDF.");
  process.exit(1);
}
const aspect = parseFloat(sizeMatch[1]) / parseFloat(sizeMatch[2]);
const pad = Math.max(3, String(pages).length);
console.log(`${name}: ${pages} pages, aspect ${aspect.toFixed(4)}`);

// --- 2. render pages ----------------------------------------------------------
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "planner-"));
// ~2750px wide for a landscape A4-ish spread; scales with page size.
const dpi = Math.max(40, Math.min(120, Math.round((2750 * 72) / parseFloat(sizeMatch[1]))));
console.log(`Rendering at ${dpi} dpi …`);
// Planner pages are either illustration-heavy (lossy wins) or flat line art
// like dot grids and rules (lossless wins, often by 4x). Encode both and keep
// the smaller file — line-art planners shrink dramatically and look sharper.
for (let p = 1; p <= pages; p++) {
  const stem = path.join(tmp, `pg-${p}`);
  execFileSync("pdftoppm", ["-png", "-r", String(dpi), "-f", String(p), "-l", String(p), pdfPath, stem]);
  const png = fs.readdirSync(tmp).find((f) => f.startsWith(`pg-${p}-`) && f.endsWith(".png"));
  const src = path.join(tmp, png);
  const out = path.join(outDir, `p${String(p).padStart(pad, "0")}.webp`);
  const lossy = path.join(tmp, "lossy.webp");
  const lossless = path.join(tmp, "lossless.webp");
  execFileSync("cwebp", ["-quiet", "-q", "78", src, "-o", lossy]);
  execFileSync("cwebp", ["-quiet", "-lossless", "-z", "9", src, "-o", lossless]);
  const pick = fs.statSync(lossless).size <= fs.statSync(lossy).size ? lossless : lossy;
  fs.copyFileSync(pick, out);
  for (const f of [src, lossy, lossless]) fs.rmSync(f, { force: true });
  if (p % 50 === 0 || p === pages) console.log(`  ${p}/${pages}`);
}
fs.rmSync(tmp, { recursive: true, force: true });

// --- 3. extract link annotations ----------------------------------------------
console.log("Extracting internal links …");
const links = {};
let linkCount = 0;
try {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ url: pdfPath, useSystemFonts: true }).promise;
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const [, , W, H] = page.view;
    const annots = await page.getAnnotations();
    const spots = [];
    for (const a of annots) {
      if (a.subtype !== "Link" || !a.rect) continue;
      let target = null;
      try {
        const dest = a.dest
          ? (typeof a.dest === "string" ? await doc.getDestination(a.dest) : a.dest)
          : null;
        if (dest?.[0]) target = (await doc.getPageIndex(dest[0])) + 1;
      } catch {}
      if (!target) continue;
      const [x1, y1, x2, y2] = a.rect; // PDF coords: origin bottom-left
      spots.push({
        x: Math.min(x1, x2) / W,
        y: 1 - Math.max(y1, y2) / H,
        w: Math.abs(x2 - x1) / W,
        h: Math.abs(y2 - y1) / H,
        page: target,
        label: `p${target}`,
      });
    }
    if (spots.length) { links[String(p)] = spots; linkCount += spots.length; }
  }
} catch (e) {
  console.warn("Link extraction skipped (install pdfjs-dist: npm i -D pdfjs-dist):", e.message);
}
console.log(linkCount
  ? `Found ${linkCount} internal links — tap navigation will work.`
  : "No internal links in this PDF — pages will navigate via the toolbar only.");

// --- 4. write manifest + registry ----------------------------------------------
const bytes = fs.readdirSync(outDir)
  .filter((f) => f.endsWith(".webp"))
  .reduce((n, f) => n + fs.statSync(path.join(outDir, f)).size, 0);
const sizeMb = Number((bytes / 1024 / 1024).toFixed(1));

const entry = { id, name, description, category, pages, aspect: Number(aspect.toFixed(5)), sizeMb };
if (credit) entry.credit = credit;
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ ...entry, links }, null, 1));

// Preserve any hand-authored fields already in the index (e.g. `template`).
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : { planners: [] };
const existing = index.planners.find((x) => x.id === id);
index.planners = index.planners.filter((x) => x.id !== id);
index.planners.push({ ...existing, ...entry });
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

console.log(`\nDone. ${pages} pages (${sizeMb} MB) in public/planner/${id}/ — it now appears in the planner library.`);
