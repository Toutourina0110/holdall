import { strToU8, zipSync } from "fflate";
import { apiSession, unauthorized } from "@/core/auth/session";
import { UserFacingError } from "@/core/errors";
import { exportFiles, getNote } from "@/modules/notes/store";

function attachment(name: string): string {
  const ascii = name.replace(/[^A-Za-z0-9 ._-]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request) {
  const session = await apiSession(request);
  if (!session) return unauthorized();
  const params = new URL(request.url).searchParams;
  try {
    const id = params.get("id");
    if (id) {
      const note = getNote(session.user.id, id);
      return new Response(note.content, {
        headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": attachment(`${note.fileName}.md`) },
      });
    }
    const folder = params.get("folder") ?? "";
    const files = exportFiles(session.user.id, folder);
    const archive = zipSync(Object.fromEntries(files.map((file) => [file.path, strToU8(file.content)])));
    const name = `${folder ? folder.split("/").pop() : "notes"}.zip`;
    return new Response(Buffer.from(archive), { headers: { "Content-Type": "application/zip", "Content-Disposition": attachment(name) } });
  } catch (error) {
    if (error instanceof UserFacingError) return Response.json({ error: error.message }, { status: 404 });
    return Response.json({ error: "The export failed. Try again." }, { status: 500 });
  }
}
