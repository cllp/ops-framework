#!/usr/bin/env node
/**
 * Vakt: en lat sida i en app drar in sin del av ramverket först när sidan laddas, och inte i startfilen (cllp/ops-framework#465, 0.156.0).
 *
 * ══ ⛔ VARFÖR ═════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Före 0.156.0 var `dist` EN modul (`dist/index.js`, 2,4 MB). En bundler delar kod på modulgränser, så allt en app importerade ur ramverket
 * hamnade i startfilen, också komponenter som bara en lat sida använder (Meddelanden, Biblioteket). Mätt i lifehub.app 2026-10-29:
 * ramverkets enda fil var cirka 450 kB av 799 kB gzip före första vyn, och appen kunde inte dela den.
 *
 * Nu skriver `scripts/build.mjs` EN FIL PER KÄLLMODUL med samma sökvägar som `src/`, och `dist/index.js` är bara listan över namn.
 * `package.json` säger `sideEffects: ["*.css"]`, så bundlern får släppa en modul som ingen i startfilen använder.
 *
 * ══ ⛔ VAD SOM MÄTS ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Det mäts med den bundlare apparna använder (Vite, alltså Rollup), mot paketet INSTALLERAT SOM EN APP GÖR DET: en tillfällig app
 * där `node_modules/ops-framework` är en länk till paketet, så att `exports` och `sideEffects` i den riktiga `package.json` är det som styr.
 * Appen har en startfil som importerar `OpsButton` ur "ops-framework" och en lat sida (`import("./sida.js")`) som importerar `OpsMeddelanden` och
 * `OpsBibliotek`, de två stora komponenter som ärendet nämner.
 *
 *   1. GOLV: den lata sidans bit innehåller båda komponenterna. Annars har provet inte mätt något: sidan kan ha tappat sina importer, och
 *      "startfilen innehåller dem inte" är då sant av fel skäl.
 *   2. Startfilen och allt den laddar statiskt innehåller INGEN av dem.
 *   3. GOLV: startfilen innehåller `OpsButton`, så att "ingenting" inte räknas som ett lyckat utfall.
 *
 * ⛔ Komponenterna känns igen på sin funktionsdeklaration (`function OpsMeddelanden(`), som är identisk om koden ligger i en egen modul eller i en
 * samlad fil. Ett namn i en kommentar räknas alltså inte.
 *
 * ⛔ RÖTT UTAN DELNINGEN, GRÖNT MED DEN (arbetsreglernas punkt 4): `--bevisa` slår ihop samma `dist` till en enda fil (som före 0.156.0) och kör
 * samma mätning. Den ska ge rött på punkt 2 för båda komponenterna. Är den grön mäter provet ingenting.
 *
 * Kör:  npm run build && node scripts/check-delbarhet.mjs
 *       node scripts/check-delbarhet.mjs --bevisa      slår ihop dist till en fil och kräver rött
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { build as vite } from "vite";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bevisa = process.argv.includes("--bevisa");

/** De lata komponenterna, och den som startfilen får. */
const LATA = ["OpsMeddelanden", "OpsBibliotek"];
const START = "OpsButton";

const distIndex = path.join(rot, "dist", "index.js");
if (!fs.existsSync(distIndex)) {
  console.error("check-delbarhet: dist/index.js saknas. Kör `npm run build` först. Ett överhoppat mått räknas aldrig som grönt.");
  process.exit(1);
}

const arbete = fs.mkdtempSync(path.join(os.tmpdir(), "ops-delbarhet-"));
process.on("exit", () => fs.rmSync(arbete, { recursive: true, force: true }));

/**
 * Bygger en tillfällig app mot ett paket och svarar vad startfilen respektive den lata sidan innehåller.
 * @param {string} paketmapp mappen som `node_modules/ops-framework` länkas till
 * @param {string} namn arbetsmapp för just det här utfallet
 */
async function mat(paketmapp, namn) {
  const app = path.join(arbete, namn);
  fs.mkdirSync(path.join(app, "node_modules"), { recursive: true });
  fs.symlinkSync(paketmapp, path.join(app, "node_modules", "ops-framework"), "dir");
  fs.writeFileSync(path.join(app, "start.js"), `import { ${START} } from "ops-framework";\nglobalThis.__start = ${START};\nglobalThis.__laddaSidan = () => import("./sida.js");\n`);
  fs.writeFileSync(path.join(app, "sida.js"), `import { ${LATA.join(", ")} } from "ops-framework";\nexport default { ${LATA.join(", ")} };\n`);
  const ut = /** @type {import("rollup").RollupOutput} */ (
    await vite({
      root: app,
      configFile: false,
      logLevel: "silent",
      // Paketets egna beroenden (React, Radix, kalendern) är appens att lösa och inte det som mäts.
      build: { write: false, minify: false, modulePreload: false, rollupOptions: { input: path.join(app, "start.js"), external: (id) => !id.startsWith(".") && !path.isAbsolute(id) && id !== "ops-framework" } },
    })
  );
  const bitar = ut.output.filter((o) => o.type === "chunk");
  const start = bitar.find((b) => b.isEntry);
  const lat = bitar.find((b) => b.isDynamicEntry);
  if (!start || !lat) throw new Error(`${namn}: bygget gav ${bitar.length} bitar, men ingen ${start ? "lat sida" : "startfil"}.`);
  // Startfilen och allt den laddar statiskt, rekursivt.
  const iStart = new Set();
  const gaIgenom = (/** @type {string} */ fil) => {
    if (iStart.has(fil)) return;
    iStart.add(fil);
    const b = bitar.find((x) => x.fileName === fil);
    for (const i of b?.imports ?? []) gaIgenom(i);
  };
  gaIgenom(start.fileName);
  const kodStart = bitar.filter((b) => iStart.has(b.fileName)).map((b) => b.code).join("\n");
  return { kodStart, kodLat: lat.code, bitarStart: iStart.size, bytesStart: kodStart.length };
}

/** @param {string} kod @param {string} namn */
const harFunktion = (kod, namn) => kod.includes(`function ${namn}(`);

/** @param {Awaited<ReturnType<typeof mat>>} m @returns {string[]} */
function brott(m) {
  /** @type {string[]} */
  const fel = [];
  for (const n of LATA) {
    if (!harFunktion(m.kodLat, n)) fel.push(`GOLV: den lata sidan innehåller inte ${n}. Sidan har tappat sin import, eller så fanns komponenten i en annan bit, och provet har då inte mätt något.`);
    if (harFunktion(m.kodStart, n)) fel.push(`${n} ligger i startfilen (${m.bitarStart} bit(ar), ${m.bytesStart} tecken) fast bara den lata sidan importerar den. Paketet går inte att dela på modulgränsen.`);
  }
  if (!harFunktion(m.kodStart, START)) fel.push(`GOLV: startfilen innehåller inte ${START}, som den importerar. Provet har inte mätt startfilen.`);
  return fel;
}

if (bevisa) {
  // Samma paket som en enda modul, som före 0.156.0: dist/index.js buntad med alla sina egna moduler.
  const enkel = path.join(arbete, "enkel-paket");
  fs.mkdirSync(path.join(enkel, "dist"), { recursive: true });
  const pkg = JSON.parse(fs.readFileSync(path.join(rot, "package.json"), "utf8"));
  fs.writeFileSync(path.join(enkel, "package.json"), JSON.stringify({ name: pkg.name, version: pkg.version, type: "module", exports: { ".": "./dist/index.js" }, sideEffects: pkg.sideEffects }, null, 2));
  await esbuild({ entryPoints: [distIndex], bundle: true, format: "esm", outfile: path.join(enkel, "dist", "index.js"), packages: "external", logLevel: "silent" });
  const m = await mat(enkel, "enkel");
  const fel = brott(m);
  const forvantat = LATA.filter((n) => fel.some((f) => f.startsWith(`${n} ligger i startfilen`)));
  if (forvantat.length !== LATA.length) {
    console.error(`check-delbarhet --bevisa: PROVET FÅNGAR INGET. Mot samma paket som EN modul skulle ${LATA.join(" och ")} ligga i startfilen, men det gjorde ${forvantat.length ? forvantat.join(" och ") : "ingen av dem"}.\n${fel.join("\n") || "(inga brott alls)"}`);
    process.exit(1);
  }
  console.log(`check-delbarhet --bevisa: RÖTT som väntat mot en enda modul (${fel.length} brott, startfilen ${m.bytesStart} tecken), och det är beviset att provet biter.`);
  process.exit(0);
}

const m = await mat(rot, "delat");
const fel = brott(m);
if (fel.length) {
  console.error(`check-delbarhet: RÖTT. ${fel.length} brott:\n${fel.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log(`check-delbarhet: GRÖNT. ${LATA.join(" och ")} ligger i den lata sidans bit och inte i startfilen (${m.bitarStart} bit(ar), ${m.bytesStart} tecken före första vyn), och ${START} ligger i startfilen.`);
