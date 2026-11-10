import { z } from "zod";

export const colorTokens = [
  "ground", "surface", "raised", "ink", "text", "muted", "line", "line-strong",
  "accent", "accent-fill", "accent-fill-hover", "accent-soft", "accent-text", "on-accent",
  "done", "late", "late-soft", "warn", "rail", "rail-text", "rail-muted", "rail-tile", "rail-line", "rail-focus",
  "hatch", "focus",
].map((name) => `--color-${name}`);

export const lengthTokens = [
  "--radius-sm", "--radius-md", "--radius-control", "--radius-field", "--radius-panel",
  "--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-8", "--space-10",
  "--text-xs", "--text-sm", "--text-ui", "--text-read", "--text-lg", "--text-xl",
  "--size-control", "--size-row", "--size-header", "--size-rail",
];

export const allTokens = [...colorTokens, ...lengthTokens];

const colorValue = z.string().regex(/^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.\s,/%]+\))$/, "Use a hex or rgb() color.");
const lengthValue = z.string().regex(/^\d{1,4}(\.\d{1,3})?(px|rem)$/, "Use a size like 12px or 0.75rem.");

const forbiddenCss = [/@import/i, /url\s*\(/i, /expression\s*\(/i, /javascript:/i, /behavior\s*:/i, /-moz-binding/i, /@font-face/i, /<\//, /\x5c/, /@namespace/i, /image-set\s*\(/i, /src\s*\(/i];

export function sanitizeThemeCss(css: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const pattern of forbiddenCss) {
    if (pattern.test(withoutComments)) {
      throw new Error("Theme CSS cannot load files, import other styles, or use escapes and expressions.");
    }
  }
  return withoutComments.trim();
}

export const themeSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    base: z.enum(["light", "dark"]),
    tokens: z.record(z.string(), z.string()).superRefine((tokens, ctx) => {
      for (const [name, value] of Object.entries(tokens)) {
        if (!allTokens.includes(name)) {
          ctx.addIssue({ code: "custom", message: `Unknown token ${name}.`, path: [name] });
          continue;
        }
        const check = colorTokens.includes(name) ? colorValue : lengthValue;
        const result = check.safeParse(value);
        if (!result.success) ctx.addIssue({ code: "custom", message: `${name}: ${result.error.issues[0]?.message}`, path: [name] });
      }
    }),
    css: z
      .string()
      .max(20000)
      .optional()
      .superRefine((css, ctx) => {
        if (!css) return;
        try {
          sanitizeThemeCss(css);
        } catch (error) {
          ctx.addIssue({ code: "custom", message: (error as Error).message });
        }
      })
      .transform((css) => (css ? sanitizeThemeCss(css) : undefined)),
  })
  .strict();

export type Theme = z.infer<typeof themeSchema>;
export type ThemeMode = "system" | "light" | "dark" | "custom";
