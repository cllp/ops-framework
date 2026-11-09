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
 * ══ ⛔ SNABBMENYN I SKALET (0.187.0, cllp/ops-framework#518) ═══════════════════════════════════════
 *
 * `OpsAppShell` importerade `OpsSnabbmeny` statiskt, och menyns kod (cirka 1,7 kB gzip i lifehub.app) låg då i varje apps startfil för en meny som ritas först vid ett tryck. Det lades inte märke till
 * eftersom delningen ovan mäter två sidor och inte skalet. Därför mäts nu också en app vars startfil importerar `OpsAppShell`: `OpsSnabbmeny` ska ligga i en egen bit (golv: någon bit innehåller den, annars har provet
 * inte mätt något) och inte i startfilen och det den laddar statiskt. Den mäts med funktionsdeklarationen, inte med ordet `lazy`: en statisk import som läggs tillbaka ska göra provet rött.
 *
 * ══ ⛔ TRÅDEN PÅ EN POST I BIBLIOTEKET (0.191.0, granskningen av PR 526) ═══════════════════════════════════
 *
 * `OpsBibliotek` importerade `BibliotekKommentarer` statiskt, och appens `check:jsstorlek` växte med 1 318 byte från ramverket ensamt, för en tråd som ritas först när en post öppnas och bara när
 * appen gett `kommentarer`. Samma mätning som för skalet, med `OpsBibliotek` som startfilens import: `BibliotekKommentarer` ska ligga i en egen bit (`BibliotekKommentarerLat`).
 *
 * (0.192.0, cllp/ops-framework#529) Zoomen i HTML-rutan växte samma startfil från 296 084 till 300 860 byte (95 548 till 97 216 gzip). Rutan (`OpsHtmlDokument`), zoomens tillstånd (`useHtmlZoom`)
 * och dess räkning (`anpassadSkala` i `lib/htmlruta.js`) ska ligga i en egen bit (`OpsHtmlDokumentLat`).
 *
 * ══ ⛔ PDF-VYN OCH PDF.JS (0.193.0, cllp/ops-framework#530) ═══════════════════════════════════════
 *
 * PDF-vyn (`OpsPdfVisning`) och pdf.js ritas bara i detaljen för en PDF. pdf.js är över en megabyte, och i en startfil hade den kostat varje app vid varje start för en fil som kanske aldrig öppnas.
 * Därför mäts tre saker med `OpsBibliotek` som startfilens import: `OpsPdfVisning` och `laddaPdfjs` ligger i en egen bit (`OpsPdfVisningLat`), importen av paketet `pdfjs-dist` står i en bit utanför startfilen
 * och aldrig i den (golv: någon bit har den), och i ett bygge där Vite får bunta pdf.js (inte externt) blir workern en egen fil som bara den lata biten pekar på. Det sista är beviset att workerns adress
 * (`new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url)` i `lib/pdfjs.js`) fungerar när en app bundlar ramverket med Vite.
 *
 * ══ ⛔ BILDEN I EN ANTECKNING (0.207.0, cllp/lifehub.app#696) ═══════════════════════════════════════
 *
 * 0.206.0 importerade rutan med "Lägg till bild" (`AnteckningsText`) och krympningen före uppladdningen (`forbered`) statiskt i `OpsBibliotek`. De ritas bara när en sparad anteckning
 * redigeras med appens uppladdning, och ska ligga i en egen bit (`BibliotekAnteckningsbildLat`).
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

/**
 * Komponenter som en startfil importerar, och det som INTE får följa med dem: skalet och snabbmenyn (0.187.0), biblioteket och tråden på en post (0.191.0). `paket` (0.193.0) är paket vars import inte får stå i startfilen.
 * @type {ReadonlyArray<{ skal: string, lata: readonly string[], via: string, paket?: readonly string[] }>}
 */
const SKALEN = [
  { skal: "OpsAppShell", lata: ["OpsSnabbmeny"], via: "OpsSnabbmenyLat" },
  { skal: "OpsBibliotek", lata: ["BibliotekKommentarer"], via: "BibliotekKommentarerLat" },
  // (0.192.0, #529) Rutan och zoomen ritas bara i detaljen för ett HTML-dokument. `htmlruta` står för rutans skript och räkning, som inte får följa med `htmldokument.js` in i startfilen.
  { skal: "OpsBibliotek", lata: ["OpsHtmlDokument", "useHtmlZoom", "anpassadSkala"], via: "OpsHtmlDokumentLat" },
  // (0.193.0, #530) PDF-vyn och pdf.js ritas bara i detaljen för en PDF.
  { skal: "OpsBibliotek", lata: ["OpsPdfVisning", "laddaPdfjs"], via: "OpsPdfVisningLat", paket: ["pdfjs-dist"] },
  // (0.207.0, lifehub.app#696) Bildknappen och krympningen ritas bara när en sparad anteckning redigeras, och bara när appen gett `onLaggBildIAnteckning`.
  { skal: "OpsBibliotek", lata: ["AnteckningsText", "forbered"], via: "BibliotekAnteckningsbildLat" },
];

/** En import av paketet (statisk eller dynamisk) i en bit. Ett namn i en kommentar eller en text räknas inte. @param {string} kod @param {string} paket */
const importerar = (kod, paket) => new RegExp(`(?:\\bimport\\s*\\(\\s*|\\bfrom\\s*)["']${paket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/[^"']*)?["']`).test(kod);

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

/**
 * Som `mat`, men appen har bara en startfil som importerar skalet (inga lata sidor av appens eget). Svarar vad startfilen och allt den laddar statiskt innehåller, och vad alla andra bitar innehåller.
 * @param {string} paketmapp
 * @param {string} namn
 * @param {string} SKAL Det startfilen importerar (0.191.0: skalet eller biblioteket).
 */
async function matSkal(paketmapp, namn, SKAL) {
  const app = path.join(arbete, namn);
  fs.mkdirSync(path.join(app, "node_modules"), { recursive: true });
  fs.symlinkSync(paketmapp, path.join(app, "node_modules", "ops-framework"), "dir");
  fs.writeFileSync(path.join(app, "start.js"), `import { ${SKAL} } from "ops-framework";\nglobalThis.__skal = ${SKAL};\n`);
  const ut = /** @type {import("rollup").RollupOutput} */ (
    await vite({
      root: app,
      configFile: false,
      logLevel: "silent",
      build: { write: false, minify: false, modulePreload: false, rollupOptions: { input: path.join(app, "start.js"), external: (id) => !id.startsWith(".") && !path.isAbsolute(id) && id !== "ops-framework" } },
    })
  );
  const bitar = ut.output.filter((o) => o.type === "chunk");
  const start = bitar.find((b) => b.isEntry);
  if (!start) throw new Error(`${namn}: bygget gav ${bitar.length} bitar, men ingen startfil.`);
  const iStart = new Set();
  const gaIgenom = (/** @type {string} */ fil) => {
    if (iStart.has(fil)) return;
    iStart.add(fil);
    for (const i of bitar.find((x) => x.fileName === fil)?.imports ?? []) gaIgenom(i);
  };
  gaIgenom(start.fileName);
  const kodStart = bitar.filter((b) => iStart.has(b.fileName)).map((b) => b.code).join("\n");
  const kodAndra = bitar.filter((b) => !iStart.has(b.fileName)).map((b) => b.code).join("\n");
  return { kodStart, kodAndra, bitarStart: iStart.size, bytesStart: kodStart.length };
}

/**
 * (0.193.0, #530) Workern i en app som bundlar ramverket med Vite. Samma tillfälliga app med `OpsBibliotek` i startfilen, men `pdfjs-dist` buntas (är inte externt), så som det blir hos appen.
 * Svarar brotten: workern ska vara en egen fil i bygget, den lata biten ska peka på den och på pdf.js (`getDocument`), och startfilen ska varken innehålla pdf.js eller workerns namn.
 * @returns {Promise<{ fel: string[], worker: string, lat: number }>}
 */
async function matWorker() {
  const app = path.join(arbete, "pdfworker");
  fs.mkdirSync(path.join(app, "node_modules"), { recursive: true });
  fs.symlinkSync(rot, path.join(app, "node_modules", "ops-framework"), "dir");
  fs.writeFileSync(path.join(app, "start.js"), `import { OpsBibliotek } from "ops-framework";\nglobalThis.__skal = OpsBibliotek;\n`);
  const ut = /** @type {import("rollup").RollupOutput} */ (
    await vite({
      root: app,
      configFile: false,
      logLevel: "silent",
      build: { write: false, minify: false, modulePreload: false, rollupOptions: { input: path.join(app, "start.js"), external: (id) => !id.startsWith(".") && !path.isAbsolute(id) && id !== "ops-framework" && !id.startsWith("pdfjs-dist") } },
    })
  );
  const bitar = ut.output.filter((o) => o.type === "chunk");
  const start = bitar.find((b) => b.isEntry);
  if (!start) throw new Error("pdfworker: ingen startfil i bygget.");
  const iStart = new Set();
  const gaIgenom = (/** @type {string} */ fil) => {
    if (iStart.has(fil)) return;
    iStart.add(fil);
    for (const i of bitar.find((x) => x.fileName === fil)?.imports ?? []) gaIgenom(i);
  };
  gaIgenom(start.fileName);
  const kodStart = bitar.filter((b) => iStart.has(b.fileName)).map((b) => b.code).join("\n");
  const andra = bitar.filter((b) => !iStart.has(b.fileName));
  const worker = ut.output.find((o) => o.type === "asset" && /pdf\.worker/.test(o.fileName));
  /** @type {string[]} */
  const fel = [];
  if (!worker) fel.push("Workern blev ingen egen fil i appens bygge. `new URL(\"pdfjs-dist/legacy/build/pdf.worker.min.mjs\", import.meta.url)` i lib/pdfjs.js löses inte av Vite, och pdf.js startar utan worker.");
  const pdfjsBit = andra.find((b) => b.code.includes("GlobalWorkerOptions") && b.code.includes("getDocument"));
  if (!pdfjsBit) fel.push("GOLV: ingen bit utanför startfilen innehåller pdf.js (getDocument). Provet har inte mätt pdf.js.");
  if (worker && !andra.some((b) => b.code.includes(path.basename(worker.fileName)))) fel.push(`Ingen lat bit pekar på workern (${worker.fileName}).`);
  if (kodStart.includes("getDocument") || /pdf\.worker/.test(kodStart)) fel.push("pdf.js eller workern ligger i startfilen.");
  return { fel, worker: worker?.fileName ?? "", lat: pdfjsBit?.code.length ?? 0 };
}

/** @param {Awaited<ReturnType<typeof matSkal>>} m @param {(typeof SKALEN)[number]} s @returns {string[]} */
function skalBrott(m, s) {
  /** @type {string[]} */
  const fel = [];
  if (!harFunktion(m.kodStart, s.skal)) fel.push(`GOLV: startfilen innehåller inte ${s.skal}, som den importerar. Provet har inte mätt den.`);
  for (const n of s.lata) {
    if (!harFunktion(m.kodAndra, n)) fel.push(`GOLV: ingen bit utanför startfilen innehåller ${n}. ${s.skal} har tappat sin dynamiska import, eller så ligger komponenten i startfilen, och "startfilen innehåller den inte" är då sant av fel skäl.`);
    if (harFunktion(m.kodStart, n)) fel.push(`${n} ligger i startfilen (${m.bitarStart} bit(ar), ${m.bytesStart} tecken) fast ${s.skal} ritar den först när den behövs. Läs in den då (${s.via}).`);
  }
  for (const p of s.paket ?? []) {
    if (!importerar(m.kodAndra, p)) fel.push(`GOLV: ingen bit utanför startfilen importerar ${p}. Provet har inte mätt paketet.`);
    if (importerar(m.kodStart, p)) fel.push(`${p} ligger i startfilen (${m.bitarStart} bit(ar), ${m.bytesStart} tecken) fast bara ${s.via} behöver det.`);
  }
  return fel;
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
  // (0.187.0) Skalet mot samma enda modul: menyn ligger i startfilen, och det är rött. Den enda modulen har ingen bit utanför startfilen, så golvet slår också till; kravet är att båda brotten finns.
  /** @type {string[]} */
  const felSkal = [];
  for (const [i, s] of SKALEN.entries()) {
    const ms = await matSkal(enkel, `enkel-${i}-${s.skal}`, s.skal);
    const f = skalBrott(ms, s);
    felSkal.push(...f);
    const alla = [...s.lata, ...(s.paket ?? [])];
    const forvantatSkal = alla.filter((n) => f.some((x) => x.startsWith(`${n} ligger i startfilen`)));
    if (forvantatSkal.length !== alla.length) {
      console.error(`check-delbarhet --bevisa: PROVET FÅNGAR INGET FÖR ${s.skal}. Mot samma paket som EN modul skulle ${alla.join(" och ")} ligga i startfilen, men det gjorde ${forvantatSkal.length ? forvantatSkal.join(" och ") : "ingen av dem"}. Då mäter provet ingenting.`);
      process.exit(1);
    }
  }
  console.log(`check-delbarhet --bevisa: RÖTT som väntat mot en enda modul (${fel.length + felSkal.length} brott, startfilen ${m.bytesStart} tecken), och det är beviset att provet biter.`);
  process.exit(0);
}

const m = await mat(rot, "delat");
/** @type {Array<{ s: (typeof SKALEN)[number], ms: Awaited<ReturnType<typeof matSkal>> }>} */
const matta = [];
for (const [i, s] of SKALEN.entries()) matta.push({ s, ms: await matSkal(rot, `delat-${i}-${s.skal}`, s.skal) });
const w = await matWorker();
const fel = [...brott(m), ...matta.flatMap(({ s, ms }) => skalBrott(ms, s)), ...w.fel];
if (fel.length) {
  console.error(`check-delbarhet: RÖTT. ${fel.length} brott:\n${fel.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log(`check-delbarhet: GRÖNT. ${LATA.join(" och ")} ligger i den lata sidans bit och inte i startfilen (${m.bitarStart} bit(ar), ${m.bytesStart} tecken före första vyn), och ${START} ligger i startfilen. ${matta.map(({ s, ms }) => `${s.skal} (${ms.bitarStart} bit(ar), ${ms.bytesStart} tecken före första vyn) har ${s.lata.join(" och ")}${s.paket ? ` och importen av ${s.paket.join(" och ")}` : ""} i en egen bit`).join(", och ")}. pdf.js-workern blir en egen fil i appens bygge (${w.worker}), och bara den lata biten pekar på den.`);
