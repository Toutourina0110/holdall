import path from "node:path";

export type UserArea = "notes" | "files" | "downloads";

const userIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

function inside(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function safeJoin(base: string, ...segments: string[]): string {
  for (const segment of segments) {
    if (path.isAbsolute(segment) || path.win32.isAbsolute(segment)) {
      throw new Error(`Path "${segment}" points outside the allowed folder.`);
    }
  }
  const target = path.resolve(base, ...segments);
  if (!inside(path.resolve(base), target)) {
    throw new Error(`Path "${segments.join("/")}" points outside the allowed folder.`);
  }
  return target;
}

export function userPath(dataDir: string, area: UserArea, userId: string, ...segments: string[]): string {
  if (!userIdPattern.test(userId)) throw new Error("Invalid user id for a file path.");
  return safeJoin(path.join(dataDir, area, userId), ...segments);
}

export function pluginPath(dataDir: string, pluginId: string, ...segments: string[]): string {
  if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(pluginId)) throw new Error("Invalid plugin id for a file path.");
  return safeJoin(path.join(dataDir, "plugins", pluginId), ...segments);
}

export function pluginDataPath(dataDir: string, pluginId: string, ...segments: string[]): string {
  if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(pluginId)) throw new Error("Invalid plugin id for a file path.");
  return safeJoin(path.join(dataDir, "plugin-data", pluginId), ...segments);
}
