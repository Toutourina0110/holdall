import { describe, expect, it } from "vitest";
import { readLimitedText } from "./read-body";

describe("limited request bodies", () => {
  it("reads small bodies and stops large ones, even without Content-Length", async () => {
    expect(await readLimitedText(new Request("http://x/", { method: "POST", body: "hello" }), 10)).toBe("hello");
    expect(await readLimitedText(new Request("http://x/", { method: "POST", body: "x".repeat(20) }), 10)).toBeUndefined();
    const stream = new ReadableStream({
      start(controller) {
        for (let index = 0; index < 5; index++) controller.enqueue(new TextEncoder().encode("x".repeat(8)));
        controller.close();
      },
    });
    expect(await readLimitedText(new Request("http://x/", { method: "POST", body: stream, duplex: "half" } as RequestInit), 10)).toBeUndefined();
  });
});
