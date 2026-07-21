import { describe, it, expect } from "vitest";
import { isNewerVersion } from "../src/util/update-check.js";

describe("isNewerVersion", () => {
  it("returns true when major is higher", () => {
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true);
  });

  it("returns true when minor is higher", () => {
    expect(isNewerVersion("1.2.0", "1.1.9")).toBe(true);
  });

  it("returns true when patch is higher", () => {
    expect(isNewerVersion("0.1.7", "0.1.6")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
  });

  it("returns false when current is newer", () => {
    expect(isNewerVersion("0.1.6", "0.1.7")).toBe(false);
  });

  it("returns false when major is lower", () => {
    expect(isNewerVersion("1.0.0", "2.0.0")).toBe(false);
  });

  it("handles missing patch segment", () => {
    expect(isNewerVersion("1.1", "1.0")).toBe(true);
    expect(isNewerVersion("1.0", "1.0")).toBe(false);
  });

  it("handles multi-digit versions", () => {
    expect(isNewerVersion("0.10.0", "0.9.0")).toBe(true);
    expect(isNewerVersion("1.0.12", "1.0.9")).toBe(true);
  });
});
