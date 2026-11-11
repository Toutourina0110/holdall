import { describe, expect, it } from "vitest";
import { isForeignWrite } from "./origin";

describe("foreign writes", () => {
  it("refuses writes from sandboxed plugin frames and other sites", () => {
    expect(isForeignWrite("POST", "null", "holdall.example.com")).toBe(true);
    expect(isForeignWrite("POST", "https://evil.example", "holdall.example.com")).toBe(true);
    expect(isForeignWrite("DELETE", "not a url", "holdall.example.com")).toBe(true);
  });

  it("lets same-origin writes, reads and requests without Origin through", () => {
    expect(isForeignWrite("POST", "https://holdall.example.com", "holdall.example.com")).toBe(false);
    expect(isForeignWrite("GET", "null", "holdall.example.com")).toBe(false);
    expect(isForeignWrite("POST", null, "holdall.example.com")).toBe(false);
  });
});
