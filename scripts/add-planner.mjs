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

const [, , pdfPath, id, name, description = ""] = process.argv;

if (!pdfPath || !id || !name) {
  console.error('Usage: node scripts/add-planner.mjs <pdf-path> <id> "<Display Name>" ["Description"]');
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
for (let p = 1; p <= pages; p++) {
  const stem = path.join(tmp, `pg-${p}`);
  execFileSync("pdftoppm", ["-jpeg", "-r", String(dpi), "-f", String(p), "-l", String(p), pdfPath, stem]);
  const jpg = fs.readdirSync(tmp).find((f) => f.startsWith(`pg-${p}-`) && f.endsWith(".jpg"));
  const out = path.join(outDir, `p${String(p).padStart(pad, "0")}.webp`);
  execFileSync("cwebp", ["-quiet", "-q", "75", path.join(tmp, jpg), "-o", out]);
  fs.unlinkSync(path.join(tmp, jpg));
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
const entry = { id, name, description, pages, aspect: Number(aspect.toFixed(5)) };
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ ...entry, links }, null, 1));

const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : { planners: [] };
index.planners = index.planners.filter((x) => x.id !== id);
index.planners.push(entry);
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

const mb = (execFileSync("du", ["-sm", outDir], { encoding: "utf8" }).split("\t")[0] || "?").trim();
console.log(`\nDone. ${pages} pages (${mb} MB) in public/planner/${id}/ — it now appears in the planner library.`);
