export async function readLimitedText(request: Request, maxBytes: number): Promise<string | undefined> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return undefined;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
