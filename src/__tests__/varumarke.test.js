import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { OPS_HUB_VARUMARKE } from "../lib/varumarke.js";

/**
 * ⛔ #164, CP-beslut 2026-09-28 19:00: "Loggorna ska vara default för
 * ramverket." check-paket.mjs (ägs av en annan agent i detta pass, rör den
 * inte) bevisar redan att `varumarke/`-posten i `package.json` "files"
 * pekar på något som finns på disk, men den räknar inte FILERNA i katalogen.
 * Provet här är den kompletterande vakten CP bad om: RÖD om en av de fyra
 * PNG-filerna saknas, oavsett vad `check-paket` säger om katalogen som helhet.
 *
 * ⛔ MÄTER FILEN PÅ DISK, INTE BARA ATT `OPS_HUB_VARUMARKE` SVARAR EN STRÄNG.
 * En `new URL(...)`-konstruktion kastar aldrig för en sökväg som inte finns,
 * så ett prov som bara läser `.href` är grönt även om filen är borttagen.
 */

const paketrot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("varumarke.js: OPS Hub-bilderna finns faktiskt på disk (#164)", () => {
  it("varumarke/-katalogen har exakt de fyra filerna URL:erna pekar på", () => {
    const forvantade = [
      "ops-hub-ordmarke-ljus.png",
      "ops-hub-ordmarke-mork.png",
      "ops-hub-ikon-ljus.png",
      "ops-hub-ikon-mork.png",
    ];
    for (const fil of forvantade) {
      const sokvag = path.join(paketrot, "varumarke", fil);
      expect(fs.existsSync(sokvag), `varumarke/${fil} saknas på disk`).toBe(true);
    }
  });

  // ⛔ URL:ERNA JÄMFÖRS MOT FILNAMNET, INTE ÅTERUPPLÖSTA TILL DISK: vitests
  // egen modultransform ger `import.meta.url` ett annat värde än den riktiga
  // filens (ett dev-servervägs-liknande värde), så `fileURLToPath` på DEN
  // strängen pekar fel även när filen finns. Testet ovan ("varumarke/-
  // katalogen har exakt de fyra filerna") bevisar redan att filerna finns PÅ
  // DISK, via en sökväg räknad direkt från testfilen. Det här provet bevisar
  // den ANDRA halvan: att kartan pekar på RÄTT filnamn, inte ett påhittat.
  it("OPS_HUB_VARUMARKE.ordmarke pekar på rätt filnamn, ljus och mörk", () => {
    expect(OPS_HUB_VARUMARKE.ordmarke.ljus).toContain("ops-hub-ordmarke-ljus.png");
    expect(OPS_HUB_VARUMARKE.ordmarke.mork).toContain("ops-hub-ordmarke-mork.png");
  });

  it("OPS_HUB_VARUMARKE.ikon pekar på rätt filnamn, ljus och mörk", () => {
    expect(OPS_HUB_VARUMARKE.ikon.ljus).toContain("ops-hub-ikon-ljus.png");
    expect(OPS_HUB_VARUMARKE.ikon.mork).toContain("ops-hub-ikon-mork.png");
  });

  it("⛔ package.json \"files\" nämner varumarke, annars packas filerna aldrig med i en utgivning", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(paketrot, "package.json"), "utf8"));
    expect(pkg.files).toContain("varumarke");
  });
});
