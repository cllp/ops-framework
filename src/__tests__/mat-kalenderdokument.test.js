import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * `scripts/mat-kalenderdokument.mjs` som den körs: slutkoden och utskriften (cllp/ops-framework#467).
 *
 * ══ ⛔ VARFÖR SKRIPTET PROVAS SOM SKRIPT ═══════════════════════════════════════════════════════════════════════════
 *
 * `kalenderformSlutkod` och `kalenderformMatning` är rena funktioner och provas i `kalendrar-lasning.test.js`. Men det Grok körde i produktion var skriptet, och utskriften är det som läses: en rad som skrivs fel,
 * en grupp som utelämnas när den är tom eller en slutkod som inte följer funktionen syns bara om skriptet körs. Här körs det av en riktig Node-process, mot en LÅTSAS-`firebase-admin` som läser dokumenten ur en JSON-fil
 * (skriptet hittar `firebase-admin` under `functions/` i katalogen det körs ifrån, så en tillfällig katalog med ett eget `functions/node_modules/firebase-admin` räcker). Inget nät, ingen inloggning, ingen produktion.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (mätt mot 0.154.0:s skript): fall A (produktionens: 35 av 98 poster med fältet `id`) gav slutkod 1 och ingen rad om vad som redan var nekat; med ändringen 0 och en rad med antal och fältnamn.
 * Fallen B till D (en NY avvikelse) gav 1 både förut och nu, och ska göra det.
 */

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const skript = path.join(rot, "scripts", "mat-kalenderdokument.mjs");

const kal = (extra = {}) => ({ namn: "Privat", farg: 2, ikon: "hjarta", ordning: 0, forvald: false, iFlodet: true, arkiverad: false, ...extra });
const post = (extra = {}) => ({ kalenderId: "privat", titel: "Tandläkaren", beskrivning: "", plats: "", start: "2026-10-05T09:00", slut: "2026-10-05T10:00", heldag: false, blockerar: false, ...extra });
const uid = (/** @type {number} */ i) => `uid${String(i).padStart(8, "0")}`;
const kalendrar = Array.from({ length: 12 }, (_, i) => [`users/${uid(i)}/minaKalendrar/privat`, kal()]);
/** 98 poster, de första `n` med `extra(i)`. */
const poster = (/** @type {number} */ n, extra = (/** @type {number} */ _i) => ({})) => Array.from({ length: 98 }, (_, i) => [`users/${uid(i % 12)}/kalenderposter/p${i}`, post(i < n ? extra(i) : {})]);

/** @type {string} */
let mapp;

beforeAll(() => {
  mapp = fs.mkdtempSync(path.join(os.tmpdir(), "ops-mat-kalender-"));
  const admin = path.join(mapp, "functions", "node_modules", "firebase-admin");
  fs.mkdirSync(admin, { recursive: true });
  fs.writeFileSync(path.join(mapp, "functions", "package.json"), JSON.stringify({ name: "functions", type: "module" }));
  fs.writeFileSync(path.join(admin, "package.json"), JSON.stringify({ name: "firebase-admin", version: "0.0.0", type: "module", exports: { "./app": "./app.js", "./firestore": "./firestore.js" } }));
  fs.writeFileSync(path.join(admin, "app.js"), "export const initializeApp = () => {};\nexport const applicationDefault = () => ({});\n");
  fs.writeFileSync(
    path.join(admin, "firestore.js"),
    [
      'import fs from "node:fs";',
      'const dok = JSON.parse(fs.readFileSync(process.env.LATSAS_DOKUMENT, "utf8"));',
      "export const getFirestore = () => ({",
      "  collectionGroup: (samling) => ({",
      "    get: async () => ({ docs: (dok[samling] ?? []).map(([sokvag, data]) => ({ ref: { path: sokvag }, id: sokvag.split('/').pop(), data: () => data })) }),",
      "  }),",
      "});",
      "",
    ].join("\n"),
  );
});

afterAll(() => {
  fs.rmSync(mapp, { recursive: true, force: true });
});

/** @param {Record<string, any[]>} dokument @returns {{ kod: number | null, ut: string }} */
function mat(dokument) {
  const fil = path.join(mapp, "dokument.json");
  fs.writeFileSync(fil, JSON.stringify(dokument));
  const k = spawnSync(process.execPath, [skript, "--projekt", "prov", "--exempel", "2"], { cwd: mapp, encoding: "utf8", env: { ...process.env, LATSAS_DOKUMENT: fil } });
  return { kod: k.status, ut: `${k.stdout ?? ""}${k.stderr ?? ""}` };
}

describe("mat-kalenderdokument: nytt nekat mot redan nekat (#467)", () => {
  it("⛔ produktionens fall: 35 av 98 poster med fältet id ger slutkod 0, med antal och fältnamn och en rad om läkningen", () => {
    const { kod, ut } = mat({ minaKalendrar: kalendrar, kalenderposter: poster(35, (i) => ({ id: `hemligt-varde-${i}` })) });
    expect(kod).toBe(0);
    expect(ut).toContain("kalenderposter: 98 dokument lästa, 35 med avvikelse");
    expect(ut).toContain("REDAN NEKADE före 0.153.0 (reglerna i produktion nekade samma sak, ger inte slutkod 1): 35 dokument.");
    expect(ut).toContain("okant-falt: 35");
    expect(ut).toContain("Okända fält (bara namn, och i hur många dokument): id (35).");
    expect(ut).toContain("Läsvägen (lasMinKalender, lasKalenderpost) släpper de okända fälten");
    expect(ut).toContain("Sammanlagt: 0 dokument NYA med 0.153.0, 35 dokument REDAN NEKADE före 0.153.0.");
    expect(ut).toContain("Slutkod 0:");
    expect(ut).not.toContain("hemligt-varde");
  });

  it("⛔ raden för NYA skrivs alltid, också med noll (kalendersamlingen har inga avvikelser, och säger det)", () => {
    const { ut } = mat({ minaKalendrar: kalendrar, kalenderposter: poster(35, (i) => ({ id: `p${i}` })) });
    expect(ut).toContain("minaKalendrar: 12 dokument lästa, 0 med avvikelse");
    expect((ut.match(/NYA med 0\.153\.0 \(blir nekade av de nya reglerna, ger slutkod 1\): 0 dokument\./g) ?? []).length).toBe(2);
    expect(ut).toContain("Okända fält: inga.");
  });

  it("⛔ en NY avvikelse ger fortfarande slutkod 1 (en post med blockerar som text)", () => {
    const { kod, ut } = mat({ minaKalendrar: kalendrar, kalenderposter: poster(1, () => ({ blockerar: "ja" })) });
    expect(kod).toBe(1);
    expect(ut).toContain("NYA med 0.153.0 (blir nekade av de nya reglerna, ger slutkod 1): 1 dokument.");
    expect(ut).toContain("blockerar: 1");
    expect(ut).toContain("Slutkod 1:");
  });

  it("⛔ en ny avvikelse i kalendrarna ger 1 även när alla poster bara är redan nekade (ikon på 900 kB, och 35 poster med id)", () => {
    const med = [...kalendrar.slice(1), [kalendrar[0][0], kal({ ikon: "x".repeat(900_000) })]];
    const { kod, ut } = mat({ minaKalendrar: med, kalenderposter: poster(35, (i) => ({ id: `p${i}` })) });
    expect(kod).toBe(1);
    expect(ut).toContain("minaKalendrar: 12 dokument lästa, 1 med avvikelse, 1 över 20000 byte.");
    expect(ut).toContain("ikon: 1");
  });

  it("⛔ en ny avvikelse göms inte av de gamla: blandat dokument (id och en lista i beskrivning) ger 1", () => {
    const { kod, ut } = mat({ minaKalendrar: kalendrar, kalenderposter: poster(35, (i) => (i === 0 ? { id: "x", beskrivning: ["a"] } : { id: `p${i}` })) });
    expect(kod).toBe(1);
    expect(ut).toContain("NYA med 0.153.0 (blir nekade av de nya reglerna, ger slutkod 1): 1 dokument.");
    expect(ut).toContain("REDAN NEKADE före 0.153.0 (reglerna i produktion nekade samma sak, ger inte slutkod 1): 34 dokument.");
  });

  it("helt rent ger 0, och en tom samling ger 1: noll lästa är inte ett svar", () => {
    const rent = mat({ minaKalendrar: kalendrar, kalenderposter: poster(0) });
    expect(rent.kod).toBe(0);
    expect(rent.ut).toContain("Inga avvikelser: varje dokument klarar reglerna från 0.153.0.");
    expect(rent.ut).toContain("REDAN NEKADE före 0.153.0 (reglerna i produktion nekade samma sak, ger inte slutkod 1): 0 dokument.");
    const tom = mat({ minaKalendrar: kalendrar, kalenderposter: [] });
    expect(tom.kod).toBe(1);
    expect(tom.ut).toContain("NOLL dokument lästa");
  });
});
