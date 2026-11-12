import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getEnv } from "@/core/env";
import { UserFacingError } from "@/core/errors";
import { registerSlotContributor } from "@/core/layout/registry";
import { registerPluginApi } from "@/core/plugins/api";
import { cleanName, cleanRelative, deleteEntry, fileInfo, listFolder, makeFolder, moveEntry, renameEntry, resolve, rootDir, uniqueTarget } from "./store";
import "@/modules/converter/jobs";

registerSlotContributor("files", () => [
  { id: "files.page", slot: "rail.media", label: "Files", icon: "files", href: "/files", order: 20, source: "files" },
  { id: "converter.page", slot: "rail.media", label: "Converter", icon: "converter", href: "/converter", order: 30, source: "converter" },
]);

const maxBytes = () => getEnv().maxUploadMb * 1024 * 1024;
const root = z.enum(["files", "downloads"]).default("files");
const relativePath = z.string().max(1000);
const encoding = z.enum(["utf8", "base64"]).default("utf8");

registerPluginApi("files.list", "files:read", z.object({ root, path: relativePath.default("") }), ({ root, path: relative }, { userId }) =>
  listFolder(userId, root, relative),
);

registerPluginApi("files.read", "files:read", z.object({ root, path: relativePath, encoding }), ({ root, path: relative, encoding }, { userId }) => {
  const { full, stat } = fileInfo(userId, root, relative);
  if (!stat.isFile()) throw new UserFacingError("This is a folder, not a file.");
  if (stat.size > maxBytes()) throw new UserFacingError(`Plugins can read files up to ${getEnv().maxUploadMb} MB.`);
  return { content: fs.readFileSync(full).toString(encoding), size: stat.size };
});

registerPluginApi(
  "files.write",
  "files:write",
  z.object({ path: relativePath, content: z.string(), encoding, overwrite: z.boolean().default(false) }),
  ({ path: relative, content, encoding, overwrite }, { userId }) => {
    const parts = cleanRelative(relative);
    const name = cleanName(parts.pop() ?? "");
    const data = Buffer.from(content, encoding);
    if (data.length > maxBytes()) throw new UserFacingError(`Plugins can write files up to ${getEnv().maxUploadMb} MB.`);
    rootDir(userId, "files");
    const dir = resolve(userId, "files", parts.join("/"));
    fs.mkdirSync(dir, { recursive: true });
    const wanted = path.join(dir, name);
    if (overwrite && fs.existsSync(wanted) && !fs.lstatSync(wanted).isFile()) throw new UserFacingError("A folder already has this name.");
    const target = overwrite ? wanted : uniqueTarget(dir, name);
    fs.writeFileSync(target, data);
    return { path: path.relative(rootDir(userId, "files"), target).split(path.sep).join("/"), size: data.length };
  },
);

registerPluginApi("files.delete", "files:write", z.object({ path: relativePath.min(1) }), ({ path: relative }, { userId }) => {
  deleteEntry(userId, "files", relative);
  return true;
});

registerPluginApi("files.mkdir", "files:write", z.object({ path: relativePath.min(1) }), ({ path: relative }, { userId }) => {
  const parts = cleanRelative(relative);
  const name = parts.pop() ?? "";
  rootDir(userId, "files");
  return { path: makeFolder(userId, "files", parts.join("/"), name) };
});

registerPluginApi("files.rename", "files:write", z.object({ path: relativePath.min(1), name: z.string().max(200) }), ({ path: relative, name }, { userId }) => ({
  path: renameEntry(userId, "files", relative, name),
}));

registerPluginApi("files.move", "files:write", z.object({ path: relativePath.min(1), to: relativePath }), ({ path: relative, to }, { userId }) => ({
  path: moveEntry(userId, "files", relative, to),
}));
