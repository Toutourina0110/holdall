import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-routes";

describe("public routes allow list", () => {
  it.each(["/login", "/register", "/setup", "/demo", "/invite/abc123", "/api/auth/sign-in/email", "/api/health"])(
    "lets %s through without a session",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    },
  );

  it.each(["/", "/settings", "/admin", "/api/jobs", "/api/plugins", "/login/../admin", "/invite/../admin", "/api/auth/../jobs", "/setupx", "/loginx"])(
    "requires a session for %s",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});
