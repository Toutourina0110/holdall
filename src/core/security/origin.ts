const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function isForeignWrite(method: string, origin: string | null, host: string | null): boolean {
  if (safeMethods.has(method.toUpperCase()) || !origin) return false;
  if (origin === "null" || !host) return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
