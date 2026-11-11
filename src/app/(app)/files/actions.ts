"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { enqueueJob } from "@/core/jobs/queue";
import { targetsFor } from "@/modules/converter/formats";
import { deleteEntry, fileInfo, makeFolder, moveEntry, parseRoot, renameEntry } from "@/modules/files/store";

type Result<T = object> = T | { error: string };

async function run<T extends object>(work: (userId: string) => T): Promise<Result<T>> {
  const session = await requireSession();
  try {
    const value = work(session.user.id);
    revalidatePath("/files");
    return value;
  } catch (error) {
    return { error: error instanceof UserFacingError ? error.message : "Something went wrong. Try again in a moment." };
  }
}

export async function makeFolderAction(root: string, parent: string, name: string) {
  return run((userId) => ({ path: makeFolder(userId, parseRoot(root), String(parent), String(name)) }));
}

export async function renameAction(root: string, path: string, name: string) {
  return run((userId) => ({ path: renameEntry(userId, parseRoot(root), String(path), String(name)) }));
}

export async function moveAction(root: string, path: string, destination: string) {
  return run((userId) => ({ path: moveEntry(userId, parseRoot(root), String(path), String(destination)) }));
}

export async function deleteAction(root: string, path: string) {
  return run((userId) => {
    deleteEntry(userId, parseRoot(root), String(path));
    return {};
  });
}

export async function convertAction(root: string, path: string, target: string) {
  return run((userId) => {
    const parsedRoot = parseRoot(root);
    const info = fileInfo(userId, parsedRoot, String(path));
    if (!targetsFor(info.name).includes(String(target))) throw new UserFacingError(`This file cannot be converted to ${target}.`);
    return { id: enqueueJob({ userId, type: "converter.convert", payload: { root: parsedRoot, path: String(path), target: String(target) }, maxAttempts: 1 }) };
  });
}
