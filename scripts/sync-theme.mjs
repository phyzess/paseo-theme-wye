#!/usr/bin/env node
/**
 * Regenerates index.client.ts from the upstream Wye palette.
 *
 *   node scripts/sync-theme.mjs                      fetch from GitHub (ref: next)
 *   node scripts/sync-theme.mjs --ref main           fetch a different branch or tag
 *   node scripts/sync-theme.mjs --from ../vscode-theme-wye
 *                                                    read a local checkout instead
 *   node scripts/sync-theme.mjs --check              exit 1 when regeneration would
 *                                                    change the file (used by CI)
 *
 * Sources
 *   src/colors.ts              `colors`     — flat ramps and scalars such as black
 *                              `WyeThemes`  — seed pairs indexed [dark, light]
 *   vscode-themes/wye-*.json   workbench colors — editor, sidebar, input, button, focus
 *
 * The upstream palette contains translucent values (secondaryForeground
 * "#393a3490", comment "#758575dd"). Paseo needs a plain six-digit hex string per
 * seed, so this generator rejects anything that is not opaque; the variant table
 * below selects opaque substitutes from the same palette instead.
 *
 * Only single-line entries are parsed out of src/colors.ts — the multi-line ramps
 * (colors.gray, colors.blue, …) are not seeds and are skipped. A seed that cannot
 * be resolved throws instead of silently falling back.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UPSTREAM_REPO = "phyzess/vscode-theme-wye";
const DEFAULT_REF = "next";
const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = path.join(ROOT, "index.client.ts");

/**
 * One row per contributed theme.
 *
 * Each seed is one of:
 *   ['workbench', '<vscode color id>']        a vscode-themes/wye-*.json color
 *   ['palette', '<WyeThemes key>', 0 | 1]     0 is the dark value, 1 the light one
 *   ['colors', '<colors key>']                a scalar from the colors map (black)
 */
const VARIANTS = [
  {
    id: "wye-dark",
    name: "Wye Dark",
    appearance: "dark",
    file: "wye-dark.json",
    seeds: {
      background: ["workbench", "editor.background"],
      foreground: ["workbench", "editor.foreground"],
      raised: ["workbench", "list.hoverBackground"],
      control: ["palette", "lowActiveBackground", 0],
      border: ["palette", "lowBorder", 0],
      accent: ["palette", "primary", 0],
      mutedForeground: ["palette", "secondaryForeground", 0],
      ring: ["palette", "pink", 0],
    },
  },
  {
    id: "wye-dark-soft",
    name: "Wye Dark Soft",
    appearance: "dark",
    file: "wye-dark-soft.json",
    seeds: {
      background: ["palette", "lowBackground", 0],
      foreground: ["workbench", "editor.foreground"],
      raised: ["palette", "lowActiveBackground", 0],
      control: ["palette", "activeBackground", 0],
      border: ["palette", "lowActiveBackground", 0],
      accent: ["palette", "primary", 0],
      mutedForeground: ["palette", "secondaryForeground", 0],
      ring: ["palette", "pink", 0],
    },
  },
  {
    id: "wye-black",
    name: "Wye Black",
    appearance: "dark",
    file: "wye-black.json",
    seeds: {
      background: ["workbench", "editor.background"],
      foreground: ["workbench", "editor.foreground"],
      raised: ["workbench", "list.hoverBackground"],
      control: ["colors", "black"],
      border: ["palette", "background", 0],
      accent: ["palette", "primary", 0],
      mutedForeground: ["palette", "secondaryForeground", 0],
      ring: ["palette", "pink", 0],
    },
  },
  {
    id: "wye-light",
    name: "Wye Light",
    appearance: "light",
    file: "wye-light.json",
    seeds: {
      background: ["workbench", "editor.background"],
      foreground: ["workbench", "editor.foreground"],
      raised: ["palette", "activeBackground", 1],
      control: ["palette", "lowBackground", 1],
      border: ["palette", "border", 1],
      accent: ["palette", "primary", 1],
      mutedForeground: ["palette", "comment", 1],
      ring: ["palette", "pink", 1],
    },
  },
  {
    id: "wye-light-soft",
    name: "Wye Light Soft",
    appearance: "light",
    file: "wye-light-soft.json",
    seeds: {
      background: ["palette", "lowBackground", 1],
      foreground: ["workbench", "editor.foreground"],
      raised: ["palette", "lowActiveBackground", 1],
      control: ["palette", "lowActiveBackground", 1],
      border: ["palette", "lowBorder", 1],
      accent: ["palette", "primary", 1],
      mutedForeground: ["palette", "comment", 1],
      ring: ["palette", "pink", 1],
    },
  },
];

function parseArgs(argv) {
  const options = { ref: DEFAULT_REF, from: null, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") options.check = true;
    else if (arg === "--ref") options.ref = argv[++i];
    else if (arg === "--from") options.from = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

async function readSource(relativePath, options) {
  if (options.from) return readFile(path.join(options.from, relativePath), "utf8");
  const url = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${options.ref}/${relativePath}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.text();
}

/**
 * Extracts one top-level block of src/colors.ts without executing upstream code.
 * Every entry becomes an array, so a scalar and a [dark, light] pair resolve the
 * same way through a seed spec.
 */
function parseBlock(source, blockName) {
  const pattern = new RegExp(`${blockName}\\s*(?::[^=]+)?=\\s*\\{([\\s\\S]*?)\\n\\}`);
  const block = pattern.exec(source);
  if (!block) throw new Error(`could not find ${blockName} in src/colors.ts`);

  const entries = {};
  for (const line of block[1].split("\n")) {
    const array = /^\s*([A-Za-z][\w]*)\s*:\s*\[([^\]]*)\]/.exec(line);
    if (array) {
      entries[array[1]] = array[2]
        .split(",")
        .map((value) => value.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }
    const scalar = /^\s*([A-Za-z][\w]*)\s*:\s*["']([^"']+)["']/.exec(line);
    if (scalar) entries[scalar[1]] = [scalar[2]];
  }
  return entries;
}

function toHex6(value, where) {
  const normalized = String(value).trim().toLowerCase();
  const expanded = /^#[0-9a-f]{3}$/.test(normalized)
    ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
    : normalized;
  if (!/^#[0-9a-f]{6}$/.test(expanded)) {
    throw new Error(`${where}: Paseo seeds must be opaque six-digit hex, got "${value}"`);
  }
  return expanded;
}

function resolveColors(variant, sources) {
  const colors = {};
  for (const [token, spec] of Object.entries(variant.seeds)) {
    const where = `${variant.id}.${token}`;
    const [kind, key, index] = spec;

    let raw;
    if (kind === "workbench") raw = sources.workbench[key];
    else if (kind === "colors") raw = sources.colors[key]?.[0];
    else if (kind === "palette") raw = sources.palette[key]?.[index];
    else throw new Error(`${where}: unknown seed source "${kind}"`);

    if (raw === undefined) {
      throw new Error(`${where}: ${spec.join(" ")} resolved to nothing`);
    }
    colors[token] = toHex6(raw, where);
  }
  return colors;
}

function render(variants) {
  const header = `import type { PluginClientContext } from "@getpaseo/plugin/client";

/**
 * Wye themes for Paseo — ported from phyzess/vscode-theme-wye.
 *
 * Generated by scripts/sync-theme.mjs. Do not edit the palette by hand: run
 * \`node scripts/sync-theme.mjs\` after upstream changes a color.
 *
 * Paseo takes eight seed colors per theme and derives surfaces, panels, menus,
 * diffs, status colors, syntax highlighting and terminal colors from them, so
 * Wye's exact syntax mapping (green strings, cyan keywords, orange variables) is
 * intentionally not reproduced here — only the surface identity is: near-black
 * backgrounds, the lime primary, the pink focus ring.
 *
 * The VS Code *-italic variants have no Paseo equivalent (a Paseo theme carries
 * no typography axis) and are not ported.
 *
 * Each seed maps onto the upstream theme like this:
 *   background      <- editor.background
 *   foreground      <- editor.foreground
 *   raised          <- list.hoverBackground / activeBackground (cards, popovers, hovered rows)
 *   control         <- lowBackground / lowActiveBackground (inputs, secondary fills)
 *   border          <- lowBorder or WyeThemes.border (VS Code keeps borders background-colored;
 *                      Paseo needs a visible surface boundary, so the theme's own value is used)
 *   accent          <- WyeThemes.primary (button.background)
 *   mutedForeground <- WyeThemes.secondaryForeground, or comment for the light variants
 *                      (secondaryForeground is translucent there, and Paseo requires opaque hex)
 *   ring            <- WyeThemes.pink (focusBorder)
 */
export default function contribute(client: PluginClientContext) {`;

  const themes = variants.map(({ id, name, appearance, colors }) => {
    const entries = Object.entries(colors)
      .map(([token, value]) => `      ${token}: "${value}",`)
      .join("\n");
    return `  client.addTheme({
    id: "${id}",
    name: "${name}",
    appearance: "${appearance}",
    colors: {
${entries}
    },
  });`;
  });

  return `${header}\n${themes.join("\n\n")}\n\n  return () => {};\n}\n`;
}

function report(variants) {
  for (const { id, appearance, colors } of variants) {
    console.log(`${id} (${appearance})`);
    for (const [token, value] of Object.entries(colors)) {
      console.log(`  ${token.padEnd(16)} ${value}`);
    }
  }
}

const options = parseArgs(process.argv.slice(2));
const upstreamSource = await readSource("src/colors.ts", options);
const sources = {
  palette: parseBlock(upstreamSource, "WyeThemes"),
  colors: parseBlock(upstreamSource, "colors"),
};

const variants = [];
for (const variant of VARIANTS) {
  const theme = JSON.parse(await readSource(`vscode-themes/${variant.file}`, options));
  variants.push({
    id: variant.id,
    name: variant.name,
    appearance: variant.appearance,
    colors: resolveColors(variant, { ...sources, workbench: theme.colors ?? {} }),
  });
}

const next = render(variants);

if (options.check) {
  report(variants);
  const current = await readFile(OUT, "utf8").catch(() => "");
  if (current === next) {
    console.log("\nindex.client.ts is up to date with upstream.");
  } else {
    console.error("\nindex.client.ts is out of date — run: node scripts/sync-theme.mjs");
    process.exitCode = 1;
  }
} else {
  await writeFile(OUT, next);
  report(variants);
  console.log(`\nwrote ${path.relative(process.cwd(), OUT)}`);
}
