---
title: Themes
description: Ship a color and size theme as a plugin.
---

A theme plugin has `"type": "theme"`, no `entry`, and names its theme file in the manifest:

```json
{
  "id": "com.example.solarized",
  "name": "Solarized",
  "version": "1.0.0",
  "type": "theme",
  "description": "Solarized colors for Holdall.",
  "author": { "name": "Example Dev" },
  "license": "MIT",
  "holdall": ">=0.0.1",
  "theme": "theme.json"
}
```

The theme file:

```json
{
  "name": "Solarized",
  "base": "light",
  "tokens": { "--color-ground": "#fdf6e3", "--color-accent": "#268bd2", "--radius-panel": "4px" },
  "css": ".some-class { letter-spacing: 0.01em; }"
}
```

- `name`: 1 to 60 characters.
- `base`: `light` or `dark`. Tokens you do not set keep the value of that base theme.
- `tokens`: only the tokens below are accepted. An unknown token or a wrong value refuses the whole theme, with a message naming it.
- `css`: optional, up to 20,000 characters. It cannot use `url()`, `@import`, `@font-face`, `@namespace`, `image-set()`, `expression()`, `javascript:`, backslash escapes or `</`, so a theme can never load anything from the internet. Comments are removed.

## Color tokens

Values: `#rgb`, `#rrggbb`, `#rrggbbaa`, or `rgb()` / `rgba()`.

| Token | Used for |
|---|---|
| `--color-ground` | Page background |
| `--color-surface` | Panels, top bar |
| `--color-raised` | Raised areas, table headers |
| `--color-ink` | Headings and strong text |
| `--color-text` | Body text |
| `--color-muted` | Secondary text |
| `--color-line`, `--color-line-strong` | Borders |
| `--color-accent` | Accent marks and links |
| `--color-accent-fill`, `--color-accent-fill-hover` | Primary buttons |
| `--color-accent-soft` | Selected rows, soft highlights |
| `--color-accent-text` | Accent text on light backgrounds |
| `--color-on-accent` | Text on primary buttons |
| `--color-done`, `--color-late`, `--color-late-soft`, `--color-warn` | Status colors |
| `--color-rail`, `--color-rail-text`, `--color-rail-muted`, `--color-rail-tile`, `--color-rail-line`, `--color-rail-focus` | Side bar |
| `--color-hatch` | Hatched empty areas |
| `--color-focus` | Keyboard focus ring |

## Size tokens

Values: a number with `px` or `rem`, like `12px` or `0.75rem`.

| Group | Tokens |
|---|---|
| Corners | `--radius-sm`, `--radius-md`, `--radius-control`, `--radius-field`, `--radius-panel` |
| Spacing | `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-8`, `--space-10` |
| Text sizes | `--text-xs`, `--text-sm`, `--text-ui`, `--text-read`, `--text-lg`, `--text-xl` |
| Density | `--size-control`, `--size-row`, `--size-header`, `--size-rail` |

Keep text readable: the **Contrast check** in the theme editor flags any text and background pair below the WCAG AA ratio of 4.5:1. Ship both a light and a dark theme if you can; people switch at night.

Installed theme plugins are listed in **Settings, Appearance**, where each person can pick one. The fastest way to design a theme is the **Theme editor** on that page: build it with live preview, check the contrast, then **Export theme** and use the file as your plugin's `theme`.

A complete example is `examples/plugins/paper-theme` in the Holdall repository.
