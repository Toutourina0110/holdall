import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-routes";

describe("public routes allow list", () => {
  it.each(["/login", "/register", "/setup", "/demo", "/invite/abc123", "/reset/abc123", "/api/plugins/com.example.x/ui/abc.def/ui/page.html", "/api/auth/sign-in/email", "/api/health"])(
    "lets %s through without a session",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    },
  );

  it.each(["/", "/settings", "/admin", "/api/jobs", "/api/plugins", "/login/../admin", "/invite/../admin", "/reset/../admin", "/api/plugins/x/ui/page.html", "/api/plugins/x/rpc", "/api/plugins/x/ui/a.b/../../rpc", "/api/auth/../jobs", "/setupx", "/loginx"])(
    "requires a session for %s",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});
