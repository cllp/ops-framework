import { describe, it, expect } from "vitest";
import { attachmentSize, dataUrlBytes } from "../lib/file.js";

describe("#524 bilagans storlek", () => {
  it("40 B visas som 40 B, inte 56 B", () => {
    const text = "QA 2026-10-27 testfil för Biblioteket.\n";
    const url = "data:text/plain;base64," + Buffer.from(text).toString("base64");
    expect(dataUrlBytes(url)).toBe(40);
    expect(attachmentSize(url.length, url)).toBe("40 B");
  });
  it("utan dataUrl gäller den ungefärliga vägen", () => {
    expect(dataUrlBytes(undefined)).toBe(null);
    expect(attachmentSize(140)).toBe("100 B");
  });
});
