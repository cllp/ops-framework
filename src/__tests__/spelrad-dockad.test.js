import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * CP 2026-10-29: spelaren ska ligga ihop med bottenmenyn runt mikrofonknappen, utan glapp. Klasserna läses ur källan,
 * för jsdom ritar inga lager eller bakgrunder.
 */
const kalla = readFileSync("src/components/OpsSpelare.jsx", "utf8");
const tokens = readFileSync("tokens/tokens.css", "utf8");

describe("spelraden dockad mot bottenmenyn", () => {
  it("rutan har bottenradens bakgrund under 768 px, även i överhänget", () => {
    const rad = kalla.split("\n").find((r) => r.includes("pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)"));
    expect(rad).toContain("bg-surface");
    expect(rad).toContain("pb-(--bottom-nav-overhang)");
  });
  it("rutan ligger under bottenraden så knappen syns i hacket", () => {
    expect(kalla).toContain("z-[calc(var(--z-chrome)-1)]");
    expect(kalla).toContain("md:z-(--z-chrome) md:bg-transparent");
  });
  it("bottenradens överkant tas bort medan spelraden syns", () => {
    expect(tokens).toMatch(/:root:has\(\[data-ops-spelrad\]\) \[data-ops-bottenrad\] \{\s*border-top-color: transparent;/);
  });
});
