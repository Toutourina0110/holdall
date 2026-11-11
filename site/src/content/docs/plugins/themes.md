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

- `base` is `light` or `dark`: tokens you do not set keep the value of that base theme.
- Only known tokens are accepted, with color or size values.
- The CSS cannot use `url()`, `@import`, `@font-face`, `expression()`, backslash escapes or `</`, so a theme can never load anything from the internet.

Installed theme plugins are listed in **Settings, Appearance**, where each person can pick one. The fastest way to design a theme is the **Theme editor** on that page: build it with live preview, check the contrast, then **Export theme** and use the file as your plugin's `theme`.

A complete example is `examples/plugins/paper-theme` in the Holdall repository.
