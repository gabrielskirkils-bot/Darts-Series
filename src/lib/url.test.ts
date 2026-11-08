import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./url";

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/settings")).toBe("/settings");
    expect(safeRedirectPath("/t/abc/board/1?x=1")).toBe("/t/abc/board/1?x=1");
  });

  it("rejects other sites and junk", () => {
    for (const v of [null, undefined, "", "settings", "//evil.com", "/\\evil.com", "https://evil.com"]) {
      expect(safeRedirectPath(v)).toBe("/");
    }
  });

  it("uses the given fallback", () => {
    expect(safeRedirectPath(null, "/players")).toBe("/players");
  });
});
