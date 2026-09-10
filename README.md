# paseo-theme-wye

[Wye](https://github.com/phyzess/vscode-theme-wye) themes for
[Paseo](https://paseo.sh) — five themes contributed to **Settings → Appearance**.

| Theme            | Appearance | Background |
| ---------------- | ---------- | ---------- |
| Wye Dark         | dark       | `#151515`  |
| Wye Dark Soft    | dark       | `#222222`  |
| Wye Black        | dark       | `#000000`  |
| Wye Light        | light      | `#ffffff`  |
| Wye Light Soft   | light      | `#f1f0e9`  |

The VS Code `*-italic` variants have no Paseo equivalent — a Paseo theme carries
no typography axis — so they are not ported.

## Install

```bash
paseo plugin add phyzess/paseo-theme-wye            # from GitHub
paseo plugin install /path/to/paseo-theme-wye       # from a local checkout
paseo plugin reload paseo-theme-wye
```

Requires the daemon-wide **Enable plugins** switch (Settings → Plugins) and a
client that supports `addTheme` — Paseo 0.8 or later, including `0.8.0-beta.1`.
Pick a theme in **Settings → Appearance**.

## Why only eight colors

A Paseo theme is data, not code. `addTheme` takes eight seed colors and Paseo
derives the full token set from them — panels, menus, diffs, status colors,
syntax highlighting and terminal colors. Wye's exact syntax mapping (lime
strings, cyan keywords, orange variables) therefore does **not** carry over 1:1;
what carries over is the surface identity: near-black backgrounds and the lime
primary `#bde46f`.

## Syncing with upstream

`index.client.ts` is generated. Do not edit its palette by hand.

```bash
node scripts/sync-theme.mjs                      # fetch upstream (ref: next)
node scripts/sync-theme.mjs --ref main           # another branch or tag
node scripts/sync-theme.mjs --from ../vscode-theme-wye
                                                 # read a local checkout
node scripts/sync-theme.mjs --check              # exit 1 when the file is stale
```

The script reads two sources from upstream and resolves every seed through an
explicit table (see `VARIANTS`:
explicit table (`VARIANTS` in the script):
- `src/colors.ts` → `WyeThemes` seed pairs indexed `[dark, light]`, plus scalar
  entries such as `colors.black`
- `vscode-themes/wye-*.json` → workbench colors (`editor`, `list`, `button`, `focusBorder`)

It never executes upstream code, and it refuses any value that is not an opaque
six-digit hex color. That matters here: two upstream palette entries are
translucent (`secondaryForeground` `#393a3490`, `comment` `#758575dd`), so the
light variants take `comment` as their muted foreground instead.

`.github/workflows/sync-wye-palette.yml` runs the script weekly and opens a pull
request when upstream moves a color. It needs no secrets — only the workflow
token.

## Mapping

| Paseo seed        | Upstream                                            |
| ----------------- | --------------------------------------------------- |
| `background`      | `editor.background`                                 |
| `foreground`      | `editor.foreground`                                 |
| `raised`          | `list.hoverBackground` / `WyeThemes.activeBackground` |
| `control`         | `WyeThemes.lowBackground` / `lowActiveBackground` / `colors.black` |
| `border`          | `WyeThemes.lowBorder` / `border`, `WyeThemes.background` |
| `accent`          | `WyeThemes.primary` (`button.background`)           |
| `mutedForeground` | `WyeThemes.secondaryForeground`, or `comment` for light |
| `ring`            | `terminal.ansiBrightBlack` (Wye's dim chrome gray)   |

Two deliberate deviations:

1. VS Code keeps Wye's borders background-colored, which would collapse Paseo's
   panel boundaries. The port uses the theme's own subtle `lowBorder` value so
   surfaces stay readable.
2. Wye's pink `focusBorder` is *not* used. A contributed theme's `ring` seed
   becomes `foregroundExtraMuted` — composer placeholders and other dimmed
   chrome — plus the highest surface tint, the terminal's bright black and the
   focus ring. A saturated pink there paints placeholders and small controls
   pink. The built-in Paseo themes use a dim gray, and so does this port: Wye's
   own `terminal.ansiBrightBlack` (`#777777` dark, `#aaaaaa` light).

## Layout

```
paseo-plugin.json                        manifest (id + requirements)
index.client.ts                          generated themes — the plugin entry
scripts/sync-theme.mjs                   palette generator
.github/workflows/sync-wye-palette.yml   weekly upstream check
```

## License

MIT — see [LICENSE](LICENSE). The palette is derived from
[phyzess/vscode-theme-wye](https://github.com/phyzess/vscode-theme-wye),
also MIT, Copyright (c) 2026 phyzess.
