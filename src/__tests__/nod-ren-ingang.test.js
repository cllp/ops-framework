import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import * as huvud from "../index.js";
import * as nod from "../node/index.js";

/**
 * `ops-framework/node` ska gå att läsa utan React (0.139.0, cllp/lifehub.app `docs/prestanda-strategi.md`).
 *
 * Mätt: appens 21 filer i `functions/` importerade huvudingången, som drar in React, Radix och en kalender, och det kostade 2,4 till 2,7 s och cirka 200 MB vid varje
 * kallstart. Nodingången läses på 60 ms. Provet har två halvor, och båda ska kunna falla:
 *
 *  1. Modulgrafen. En ren Node-process laddar `src/node/index.js` med en modulhook som skriver upp varje import. Röd om React, Radix, en komponent, huvudingången eller
 *     `dist/` kommer med. Hooken bevisas mot ett träd med en planterad import (se "planterat fel" nedan).
 *  2. Namnen. Varje namn appens funktioner hämtar finns som export, och är SAMMA värde som huvudingångens (ingen kopia, regel 2).
 */

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const register = path.join(rot, "scripts", "nod-graf-register.mjs");

/** Namnen som lifehub.app:s `functions/` hämtar ur huvudingången, mätt mot lifehub.app main 2026-10-22. */
const APPENS_NAMN = [
  "AGENTMODELLER", "FORVALD_AGENTMODELL", "GRUPPIKONKATALOG", "KALENDERFARGER", "KALENDERIKONER", "MAX_BIBLIOTEKURL", "MAX_BIBLIOTEKUTSKRIFT", "UTSKRIFT_FALT",
  "arGastId", "arLjudpost", "arMittBibliotek", "arObjektbibliotek", "arendedelar", "byggGrupp", "byggMeddelande", "byggMedlemskap", "byggPost", "byggSamtal", "byggTrad",
  "epostFel", "foreVillkor", "gruppForPlats", "handelseBibliotek", "handelsedelar", "laesSkapare", "lankKalla", "ljudRubrik", "medlemskapsId", "samtalsnyckel",
  "utskriftFel", "utskriftLage",
];

/**
 * Det som aldrig får finnas i nodingångens modulgraf. Prövas mot både det som stod i importen och det den löstes till.
 * @param {{ spec: string, url?: string }} rad
 */
function webbfynd(rad) {
  const { spec, url = "" } = rad;
  if (spec === "react" || spec === "react-dom" || spec.startsWith("react/") || spec.startsWith("react-dom/") || spec.startsWith("@radix-ui/")) return "webbpaket";
  if (/\/node_modules\/(react|react-dom|@radix-ui)\//.test(url)) return "webbpaket";
  if (/(^|\/)dist\/index\.js$/.test(spec) || /\/dist\/index\.js$/.test(url)) return "dist/index.js";
  if (/\/src\/components\//.test(url) || /(^|\/)components\//.test(spec)) return "komponent";
  if (/\/src\/index\.js$/.test(url)) return "huvudingången";
  return null;
}

/**
 * Laddar `ingang` i en ren Node-process och ger tillbaka varje import som löstes upp.
 * @param {string} ingang absolut sökväg
 * @param {string} [cwd]
 */
function lasIRenProcess(ingang, cwd = os.tmpdir()) {
  const logg = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nodgraf-")), "logg.jsonl");
  fs.writeFileSync(logg, "");
  const kor = spawnSync(process.execPath, ["--import", pathToFileURL(register).href, "--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(ingang).href)})`], {
    cwd,
    env: { ...process.env, NOD_GRAF_LOGG: logg },
    encoding: "utf8",
  });
  const rader = fs
    .readFileSync(logg, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((r) => JSON.parse(r));
  return { kor, rader, fynd: rader.map((r) => ({ ...r, orsak: webbfynd(r) })).filter((r) => r.orsak) };
}

describe("nodingången är ren", () => {
  it("laddas i en ren Node-process utan React, Radix, komponenter, huvudingången eller dist", () => {
    const { kor, rader, fynd } = lasIRenProcess(path.join(rot, "src", "node", "index.js"));
    expect(kor.stderr, "processen ska ladda utan fel").toBe("");
    expect(kor.status).toBe(0);
    // Golv: ett prov som blir grönt av att ingenting lästes är ingen vakt. Mätt: hundratals uppslag.
    const lib = rader.filter((r) => /\/src\/lib\/[^/]+\.js$/.test(r.url ?? ""));
    expect(lib.length, "färre moduler i src/lib än väntat: lästes grafen alls?").toBeGreaterThanOrEqual(20);
    expect(rader.length).toBeGreaterThanOrEqual(40);
    expect(fynd.map((f) => `${f.orsak}: ${f.spec} (från ${f.foralder})`)).toEqual([]);
  });

  describe("planterat fel: hooken ser en import som en källtextsökning missar", () => {
    /** Kopierar `src/` till en tillfällig katalog, planterar en rad i en ren modul och laddar kopian. */
    function plantera(rad) {
      const mapp = fs.mkdtempSync(path.join(os.tmpdir(), "nodplant-"));
      fs.cpSync(path.join(rot, "src"), path.join(mapp, "src"), { recursive: true, filter: (k) => !k.includes(`${path.sep}__tests__`) });
      fs.writeFileSync(path.join(mapp, "package.json"), '{"type":"module"}');
      fs.symlinkSync(path.join(rot, "node_modules"), path.join(mapp, "node_modules"));
      const mal = path.join(mapp, "src", "lib", "katalog.js");
      fs.writeFileSync(mal, `${rad}\n${fs.readFileSync(mal, "utf8")}`);
      return lasIRenProcess(path.join(mapp, "src", "node", "index.js"), mapp);
    }

    it("orörd kopia är grön (kontroll att kopieringen i sig inte är det som fäller)", () => {
      const { kor, fynd } = plantera("");
      expect(kor.status, kor.stderr).toBe(0);
      expect(fynd).toEqual([]);
    });

    it("import av react i en ren modul fäller", () => {
      const { fynd } = plantera('import "react";');
      expect(fynd.map((f) => f.orsak)).toContain("webbpaket");
    });

    it("en dynamisk import med sammansatt sökväg, som en regex inte ser, fäller", () => {
      const { fynd } = plantera('await import("rea" + "ct-dom");');
      expect(fynd.map((f) => f.spec)).toContain("react-dom");
    });

    it("en import av en komponent fäller", () => {
      const { fynd } = plantera('import "../components/BilagaVisning.jsx";');
      expect(fynd.map((f) => f.orsak)).toContain("komponent");
    });

    it("en import av huvudingången fäller", () => {
      const { fynd } = plantera('import "../index.js";');
      expect(fynd.map((f) => f.orsak)).toContain("huvudingången");
    });
  });
});

describe("nodingången har allt appens funktioner hämtar", () => {
  it("listan har golv", () => {
    expect(APPENS_NAMN.length).toBeGreaterThanOrEqual(30);
  });

  it.each(APPENS_NAMN)("%s finns, och är samma värde som huvudingångens", (namn) => {
    expect(nod[namn], `${namn} saknas i ops-framework/node`).toBeDefined();
    expect(nod[namn]).toBe(huvud[namn]);
  });
});
