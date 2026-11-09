// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { describe, expect, it } from "vitest";

/*
 * ⛔ PAPPRET MÄTS I DEN BYGGDA CSS:EN, INTE I KLASSNAMNET (granskningen av bf82a99, CP 2026-11-09).
 *
 * Första rättelsen för svart text på mörk botten i HTML-rutan satte `bg-white`, och proven sökte efter klassnamnet. De var gröna, men
 * `tokens.css` nollställer Tailwinds palett (`--color-*: initial`), så klassen fanns aldrig i appens CSS och ramen förblev genomskinlig.
 * Provet bygger därför CSS på samma sätt som appen (Tailwind med tokens.css) och kräver att `bg-papper` finns, att den läser
 * `--color-papper`, att tokenet är vitt, och att inget mörkt tema definierar om det. Utan tokenet blir det rött, och det blir det också
 * med `bg-white` i stället.
 */
const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tokens = path.join(rot, "tokens", "tokens.css").replace(/\\/g, "/");

/** @param {string} klass */
async function bygg(klass) {
  const ut = await postcss([tailwind()]).process(`@import "tailwindcss" source(none);\n@import "${tokens}";\n@source inline("${klass}");\n`, { from: path.join(rot, "app.css") });
  return ut.css;
}

describe("papper: botten under ett dokument", () => {
  it("⛔ bg-papper finns i CSS byggd med ramverkets tokens och är vit", async () => {
    const css = await bygg("bg-papper");
    expect(css).toMatch(/\.bg-papper\s*\{[^}]*background-color:\s*var\(--color-papper\)/);
    expect(css).toMatch(/--color-papper:\s*#ffffff/);
  }, 30000);

  it("⛔ bg-white finns inte: paletten är nollställd, så den klassen hade inte gjort något", async () => {
    const css = await bygg("bg-white");
    expect(css).not.toMatch(/\.bg-white\s*\{/);
  }, 30000);

  it("⛔ inget tema definierar om pappret: det är vitt i ljust och mörkt läge", () => {
    const text = fs.readFileSync(path.join(rot, "tokens", "tokens.css"), "utf8");
    expect(text.match(/--color-papper\s*:/g)).toHaveLength(1);
  });
});
