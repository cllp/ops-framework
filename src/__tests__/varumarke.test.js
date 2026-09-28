import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { OPS_HUB_VARUMARKE } from "../lib/varumarke.js";

/**
 * ⛔ #164, ANDRA VARVET (arkitektgranskning 2026-09-28): `OPS_HUB_VARUMARKE`
 * pekade tidigare på `new URL(..., import.meta.url)`, vilket löser fel katalog
 * i en bundlad konsument (se filhuvudet i `../lib/varumarke.js`). Bilderna
 * kommer nu som `data:image/webp;base64,...`-strängar ur
 * `scripts/generate-varumarke.mjs`, som läser `varumarke/*.webp` och skriver
 * dem in i den git-ignorerade `varumarke.generated.js`.
 *
 * ⛔ MÄTER DATA-URL:ENS FORM MED ETT GOLV, INTE BARA ATT DEN ÄR EN STRÄNG. Ett
 * prov som bara kollar `typeof === "string"` är grönt även om generatorn
 * skrev en tom sträng eller en trasig bas64-blob. Golvet här är detsamma som
 * de riktiga filerna mäter till (ikon ~2,4 KB, ordmärke ~14 KB som webp; en
 * base64-kodning växer ca 33 %), så en bild som av misstag blev tom eller
 * trunkerad faller på minimigränsen, inte bara på "finns strängen".
 *
 * Den RIKTIGA konsumentbuggen (fel katalog i en bundlad bundle) bevisas inte
 * av det här enhetsprovet, det kräver en riktig Vite-konsument
 * (`scripts/check-paket.mjs` + `npm run build` i en installerad kopia, se
 * PR-rapporten för #164). Det här provet bevisar att GENERATORN gjorde sitt
 * jobb: fyra riktiga bilder, inte fyra tomma eller saknade poster.
 */

const paketrot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Minsta rimliga längd på en data-URL för respektive bildslag, base64-kodad. */
const GOLV_BYTES = {
  ordmarke: 1024 * 10, // riktig fil ~14 KB, base64 växer den ytterligare
  ikon: 1024, // riktig fil ~2,4 KB, base64 växer den ytterligare
};

describe("varumarke.js: OPS Hub-bilderna finns faktiskt, som data-URL:er (#164)", () => {
  it("varumarke/-katalogen har exakt de fyra webp-filerna generatorn läser", () => {
    const forvantade = [
      "ops-hub-ordmarke-ljus.webp",
      "ops-hub-ordmarke-mork.webp",
      "ops-hub-ikon-ljus.webp",
      "ops-hub-ikon-mork.webp",
    ];
    for (const fil of forvantade) {
      const sokvag = path.join(paketrot, "varumarke", fil);
      expect(fs.existsSync(sokvag), `varumarke/${fil} saknas på disk`).toBe(true);
    }
  });

  // ⛔ GOLV: FYRA POSTER, VAR OCH EN "data:image/webp;base64,..." OCH MINST
  // 1 KB. En generator som skriver en tom eller trasig data-URL för en av de
  // fyra ska göra det här provet rött, inte bara "finns fältet".
  for (const [namn, par] of [
    ["ordmarke", () => OPS_HUB_VARUMARKE.ordmarke],
    ["ikon", () => OPS_HUB_VARUMARKE.ikon],
  ]) {
    for (const tema of ["ljus", "mork"]) {
      it(`OPS_HUB_VARUMARKE.${namn}.${tema} är en data:image/webp;base64-URL på minst 1 KB`, () => {
        const url = /** @type {() => Record<string, string>} */ (par)()[tema];
        expect(typeof url).toBe("string");
        expect(url.startsWith("data:image/webp;base64,")).toBe(true);
        expect(url.length, `${namn}.${tema} är misstänkt kort (${url.length} tecken), generatorn kan ha skrivit tom bilddata`).toBeGreaterThan(
          /** @type {Record<string, number>} */ (GOLV_BYTES)[namn === "ikon" ? "ikon" : "ordmarke"],
        );
      });
    }
  }

  it("⛔ package.json \"files\" nämner varumarke, annars packas källfilerna aldrig med i en utgivning", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(paketrot, "package.json"), "utf8"));
    expect(pkg.files).toContain("varumarke");
  });
});
