function channels(color: string): [number, number, number] | undefined {
  const value = color.trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    const digits = hex[1]!.length === 3 ? hex[1]!.split("").map((d) => d + d).join("") : hex[1]!;
    return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return undefined;
}

function luminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrastRatio(foreground: string, background: string): number | undefined {
  const fg = channels(foreground);
  const bg = channels(background);
  if (!fg || !bg) return undefined;
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export const contrastPairs: { foreground: string; background: string; label: string }[] = [
  { foreground: "--color-text", background: "--color-surface", label: "Body text on panels" },
  { foreground: "--color-muted", background: "--color-surface", label: "Secondary text on panels" },
  { foreground: "--color-ink", background: "--color-ground", label: "Headings on the page" },
  { foreground: "--color-muted", background: "--color-ground", label: "Secondary text on the page" },
  { foreground: "--color-on-accent", background: "--color-accent-fill", label: "Primary button text" },
  { foreground: "--color-accent-text", background: "--color-accent-soft", label: "Selected item text" },
  { foreground: "--color-rail-text", background: "--color-rail", label: "Navigation text" },
  { foreground: "--color-late", background: "--color-surface", label: "Error text" },
];
