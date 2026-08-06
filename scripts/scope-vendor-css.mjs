// Scopes a third-party stylesheet under a wrapper class so its global resets
// (*, html, body, :root, preflight) can't leak into the rest of the app.
//
// Usage: node scripts/scope-vendor-css.mjs <input.css> <output.css> <.scopeClass>
// Example: node scripts/scope-vendor-css.mjs \
//   node_modules/@dayflow/core/dist/styles.css \
//   src/components/calendar/engines/dayflow.scoped.css .dayflow-scope

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postcss from "postcss";

const [, , input, output, scopeRaw] = process.argv;
if (!input || !output || !scopeRaw) {
  console.error("Usage: scope-vendor-css.mjs <input.css> <output.css> <.scopeClass>");
  process.exit(1);
}
const scope = scopeRaw.startsWith(".") ? scopeRaw : `.${scopeRaw}`;

const css = readFileSync(input, "utf8");

// Selectors that reset the whole document — rewrite them to target the scope itself
// instead of the global document, so typography/box-model resets stay contained.
const GLOBAL_RE = /^(\*|:root|:host|html|body)$/;

const scoper = {
  postcssPlugin: "scoper",
  Rule(rule) {
    // Skip rules already inside @keyframes / @font-face etc.
    const parentName = rule.parent?.name || "";
    if (["keyframes", "font-face", "-webkit-keyframes"].includes(parentName)) return;

    rule.selectors = rule.selectors.map((sel) => {
      const trimmed = sel.trim();
      // Universal + document-root selectors → bind them to the scope container.
      if (GLOBAL_RE.test(trimmed)) return scope;
      if (trimmed.startsWith("*")) return `${scope} ${trimmed}`;
      // Combinations like `html.dark` / `:root.light` → scope + remainder.
      const m = trimmed.match(/^(?:\*|:root|:host|html|body)([.:#\[].*)$/);
      if (m) return `${scope}${m[1]}`;
      // Everything else: nest under the scope class.
      return `${scope} ${trimmed}`;
    });
  },
};

postcss([scoper])
  .process(css, { from: input, to: output })
  .then((result) => {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `/* AUTO-GENERATED from ${input} — do not edit. Regenerate via scripts/scope-vendor-css.mjs */\n${result.css}`);
    console.log(`Scoped ${input} -> ${output} under ${scope}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
