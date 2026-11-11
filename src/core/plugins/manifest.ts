import { z } from "zod";
import { isKnownPermission } from "./permissions";

const semver = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;
const relativeFile = z
  .string()
  .max(200)
  .regex(/^[A-Za-z0-9_./-]+$/, "Use a simple relative path.")
  .refine((value) => !value.startsWith("/") && !value.split("/").includes(".."), "Paths must stay inside the plugin.");

const settingKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/, "Use a key like apiKey or city.");

export const settingFieldSchema = z
  .object({
    key: settingKey,
    label: z.string().trim().min(1).max(60),
    description: z.string().max(300).optional(),
    type: z.enum(["text", "textarea", "number", "boolean", "select", "url", "secret"]),
    scope: z.enum(["global", "personal"]).default("personal"),
    default: z.union([z.string().max(2000), z.number(), z.boolean()]).optional(),
    options: z.array(z.object({ value: z.string().max(100), label: z.string().max(60) }).strict()).max(50).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    required: z.boolean().default(false),
  })
  .strict();

export type SettingField = z.infer<typeof settingFieldSchema>;

export const pluginIdSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, "Use a reverse domain id like com.example.my-plugin.");

const hostname = z
  .string()
  .max(253)
  .regex(/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "List plain host names like api.example.com.");

export const manifestSchema = z
  .object({
    id: pluginIdSchema,
    name: z.string().trim().min(1).max(60),
    version: z.string().regex(semver, "Use a version like 1.2.0."),
    type: z.enum(["module", "extension", "library", "theme"]),
    description: z.string().max(300).optional(),
    author: z.object({ name: z.string().trim().min(1).max(80), url: z.url().optional() }).strict(),
    license: z.string().max(40),
    holdall: z.string().max(40),
    permissions: z.array(z.string().refine(isKnownPermission, "Unknown permission.")).max(40).default([]),
    optionalPermissions: z.array(z.string().refine(isKnownPermission, "Unknown permission.")).max(40).default([]),
    network: z.array(hostname).max(20).default([]),
    dependencies: z.record(pluginIdSchema, z.string().max(40)).default({}),
    entry: z.object({ server: relativeFile.optional(), ui: relativeFile.optional() }).strict().default({}),
    theme: relativeFile.optional(),
    contributes: z
      .object({
        hooks: z.array(z.string()).max(40).default([]),
        slots: z.array(z.string()).max(20).default([]),
        widgets: z
          .array(
            z
              .object({
                id: z.string().regex(/^[a-z0-9-]{1,40}$/),
                title: z.string().trim().min(1).max(60),
                entry: relativeFile,
                width: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
              })
              .strict(),
          )
          .max(10)
          .default([]),
        page: z.object({ title: z.string().trim().min(1).max(40), entry: relativeFile }).strict().optional(),
        settings: z.array(settingFieldSchema).max(40).default([]),
      })
      .strict()
      .default({ hooks: [], slots: [], widgets: [], settings: [] }),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const all = [...manifest.permissions, ...manifest.optionalPermissions];
    if (manifest.network.length > 0 && !["network", "network:any", "network:local"].some((permission) => all.includes(permission))) {
      ctx.addIssue({ code: "custom", message: "Declare the network permission to use network domains.", path: ["network"] });
    }
    for (const hook of manifest.contributes.hooks) {
      const permission = `hooks:${hook}`;
      if (!manifest.permissions.includes(permission) && !manifest.optionalPermissions.includes(permission)) {
        ctx.addIssue({ code: "custom", message: `Declare the ${permission} permission to use this hook.`, path: ["contributes", "hooks"] });
      }
    }
    const keys = new Set<string>();
    for (const field of manifest.contributes.settings) {
      if (keys.has(field.key)) ctx.addIssue({ code: "custom", message: `The setting ${field.key} is declared twice.`, path: ["contributes", "settings"] });
      keys.add(field.key);
      if (field.type === "select" && !field.options?.length) {
        ctx.addIssue({ code: "custom", message: `The setting ${field.key} needs options.`, path: ["contributes", "settings"] });
      }
    }
    if (manifest.type === "theme" && (manifest.entry.server || manifest.entry.ui)) {
      ctx.addIssue({ code: "custom", message: "Themes cannot contain code.", path: ["entry"] });
    }
    if (manifest.type === "theme" && !manifest.theme) {
      ctx.addIssue({ code: "custom", message: "A theme plugin needs a theme file.", path: ["theme"] });
    }
  });

export type PluginManifest = z.infer<typeof manifestSchema>;

function parts(version: string): [number, number, number] {
  const match = version.match(semver);
  if (!match) throw new Error(`Invalid version ${version}.`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}

export function satisfies(version: string, range: string): boolean {
  const current = parts(version);
  const trimmed = range.trim();
  if (trimmed === "*") return true;
  const match = trimmed.match(/^(>=|\^|~)?\s*(\d+\.\d+\.\d+)$/);
  if (!match) return false;
  const target = parts(match[2]!);
  const operator = match[1] ?? "=";
  if (operator === "=") return compare(current, target) === 0;
  if (compare(current, target) < 0) return false;
  if (operator === ">=") return true;
  if (operator === "~") return current[0] === target[0] && current[1] === target[1];
  if (target[0] > 0) return current[0] === target[0];
  if (target[1] > 0) return current[0] === 0 && current[1] === target[1];
  return current[0] === 0 && current[1] === 0 && current[2] === target[2];
}
