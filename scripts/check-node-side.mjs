#!/usr/bin/env node
/**
 * Vakt: nodsidan når inte webbläsaren, och den är dokumenterad.
 *
 * ══ ⛔ VARFÖR VAKTEN FINNS ═══════════════════════════════════════════════
 *
 * `src/node/` innehåller kod som hanterar en token. En token i webbundeln är en
 * token i varje besökares JS-fil, och det finns ingen variant av det som är
 * säker.
 *
 * Gränsen upprätthålls i dag av att `scripts/build.mjs` bara buntar vad
 * `src/index.js` NÅR. Det är en sann mekanism och ett svagt skydd: en enda
 * `import` någonstans i `src/` drar in filen, bundlen växer med ett API-anrop mot
 * GitHub, och ingenting säger till.
 *
 * ⛔ EN GRÄNS SOM BARA STÅR I EN KOMMENTAR ÄR ETT LÖFTE. Ett löfte om att en
 * hemlighet inte läcker är värt exakt vad den som råkar bryta det råkar minnas.
 *
 * ══ ⛔ DEN ANDRA HALVAN: DOKUMENTATIONSHÅLET ═════════════════════════════
 *
 * `check-docs.mjs` läser exporterna ur `src/index.js` och kräver att varje namn
 * nämns i README. Nodsidan exporteras inte därifrån, alltså hade den blivit en
 * publik yta som dokumentationsvakten inte ser.
 *
 * Det är samma hål som `check-docs` finns för: dokumentation ruttnar tyst, och ett
 * dokument som beskriver ett ramverk som inte längre är det som finns är sämre än
 * inget dokument. Därför kräver den här vakten samma sak för `src/node/index.js`.
 *
 * Kör: node scripts/check-node-side.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/*
 * ⛔ ROTEN GÅR ATT PEKA OM, OCH DET ÄR INTE EN BEKVÄMLIGHET.
 *
 * Utan argumentet kan vakten bara köras mot repot som det råkar se ut, alltså
 * grönt. Då går det inte att PLANTERA ett brott och se den falla, och en vakt
 * ingen sett falla är en förhoppning. `scripts/test-guards.mjs` kör den mot
 * kopierade träd med inplanterade fel, precis som `check-data-layer`.
 */
const bas = process.argv[2] ? path.resolve(process.argv[2]) : rot;
const src = path.join(bas, "src");
const nodeDir = path.join(src, "node");

if (!fs.existsSync(src)) {
  console.error(`check-node-side: ${path.relative(rot, src) || src} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

if (!fs.existsSync(nodeDir)) {
  console.error("check-node-side: src/node/ finns inte. Är vakten kvar efter att katalogen togs bort?");
  process.exit(1);
}

/** @param {string} katalog @returns {string[]} */
function filer(katalog) {
  const ut = [];
  for (const post of fs.readdirSync(katalog, { withFileTypes: true })) {
    const full = path.join(katalog, post.name);
    if (post.isDirectory()) ut.push(...filer(full));
    else if (/\.(js|jsx)$/.test(post.name)) ut.push(full);
  }
  return ut;
}

const alla = filer(src);

/**
 * ⛔ PROVEN ÄR UNDANTAGNA, OCH UNDANTAGET ÄR DÄR HÅL GÖMMER SIG.
 *
 * Ett prov måste nå koden det provar, och prov når aldrig bundlen: `build.mjs`
 * buntar bara vad `src/index.js` når, och `tsconfig` utesluter katalogen. Samma
 * sorts undantag som `check-data-layer` ger en adapter att importera sin SDK.
 *
 * ⛔ MEN UNDANTAGET ÖPPNAR EN OMVÄG, och den stängs längre ned: importerade en
 * komponent en fil ur `__tests__`, som i sin tur importerar nodsidan, hade
 * nodsidan nått bundlen utan att den här kontrollen sagt något. Omvägen är absurd
 * och det är just därför ingen hade letat efter den.
 */
const provkatalog = path.join(src, "__tests__");
const arProv = (/** @type {string} */ f) => f.startsWith(provkatalog + path.sep);

const utanfor = alla.filter((f) => !f.startsWith(nodeDir + path.sep) && !arProv(f));

/*
 * ⛔ MÖNSTRET MATCHAR `from "..."` OCH `import("...")`, inte bara det första.
 * En dynamisk import drar in filen i bundlen precis som en statisk, bara i en egen
 * bit. Att missa den formen hade gjort vakten grön för exakt det sätt någon skulle
 * ta sig runt den på.
 */
/*
 * ⛔ SIDOEFFEKTIMPORTEN SAKNADES, OCH DET VAR ETT HÅL I VAKTEN.
 *
 * Mönstret matchade `from "x"` och `import("x")`, men INTE `import "x";`, alltså
 * den form som inte binder något namn. Mätt 2026-09-25: en planterad
 * `import "react";` i `src/node/index.js` lämnade vakten grön.
 *
 * Just den formen är dessutom den mest sannolika i ett läckage, eftersom man
 * skriver den när man vill åt en bieffekt och inte åt en export, alltså precis
 * när man inte tänker på vad filen drar med sig.
 */
const IMPORTMONSTER = /(?:^|[^\w$.])(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

/**
 * ⛔ TVÅ OLIKA PROBLEM MED SAMMA UTFALL, OCH BESKEDET MÅSTE SKILJA DEM.
 *
 * En körimport drar filen in i bundlen. Det är ett säkerhetsläckage.
 *
 * En JSDoc-typimport når aldrig bundlen, så det är det INTE. Den är ändå fel, av
 * ett skäl som upptäcktes när vakten först blev röd på just den formen: en
 * typberoende säger "det här modulens kontrakt är definierat där borta", och nästa
 * person följer typen till sitt hem och lägger körkod intill den. Då blir
 * läckaget verkligt.
 *
 * Båda stoppar bygget. Men den som får beskedet ska veta vilket av de två hen har,
 * eftersom åtgärderna skiljer sig: flytta koden, eller vänd typriktningen.
 *
 * @param {string} text @param {number} index
 */
function arTypimport(text, index) {
  // Inuti en blockkommentar? Leta bakåt efter det närmaste kommentartecknet.
  const fore = text.slice(0, index);
  const oppen = fore.lastIndexOf("/*");
  const stangd = fore.lastIndexOf("*/");
  return oppen > stangd;
}

const korimporter = [];
const typimporter = [];
for (const fil of utanfor) {
  const text = fs.readFileSync(fil, "utf8");
  for (const m of text.matchAll(IMPORTMONSTER)) {
    const mal = m[1];
    if (!mal.startsWith(".")) continue;
    const lost = path.resolve(path.dirname(fil), mal);
    if (lost !== nodeDir && !lost.startsWith(nodeDir + path.sep)) continue;
    const rad = text.slice(0, m.index).split("\n").length;
    const post = { fil: path.relative(bas, fil), mal, rad };
    if (arTypimport(text, /** @type {number} */ (m.index))) typimporter.push(post);
    else korimporter.push(post);
  }
}

if (korimporter.length > 0) {
  console.error("check-node-side: webbsidan importerar nodsidan i KÖRKOD\n");
  for (const t of korimporter) console.error(`  ${t.fil}:${t.rad}  ->  ${t.mal}`);
  console.error(
    "\n  Det här hamnar i webbundeln. src/node/ hanterar tokens, och en token i bundlen är\n" +
      "  en token i varje besökares JS-fil.\n\n" +
      "  Behöver webbsidan något som ligger där: flytta den delen som INTE rör hemligheter\n" +
      "  till src/lib/ och låt nodsidan importera den, aldrig andra vägen.",
  );
}

if (typimporter.length > 0) {
  console.error(`${korimporter.length > 0 ? "\n" : ""}check-node-side: webbsidan importerar nodsidans TYPER\n`);
  for (const t of typimporter) console.error(`  ${t.fil}:${t.rad}  ->  ${t.mal}`);
  console.error(
    "\n  Det här når INTE bundlen, så det är inget läckage. Men riktningen är fel: en\n" +
      "  typberoende säger att modulens kontrakt bor på nodsidan, och nästa person följer\n" +
      "  typen dit och lägger körkod intill den.\n\n" +
      "  Flytta typedefen till src/lib/ och låt nodsidan importera den därifrån.",
  );
}

/*
 * ⛔ OMVÄGEN GENOM PROVEN STÄNGS HÄR.
 *
 * Provkatalogen får importera nodsidan. Alltså måste ingen ANNAN fil få importera
 * provkatalogen, annars går nodsidan in i bundlen i två hopp och den första
 * kontrollen ser ingenting.
 *
 * Det är inget någon skulle göra med flit, och det är precis skälet att kontrollera
 * det: ingen letar efter en väg ingen skulle ta.
 */
const provimporter = [];
for (const fil of utanfor) {
  const text = fs.readFileSync(fil, "utf8");
  for (const m of text.matchAll(IMPORTMONSTER)) {
    const mal = m[1];
    if (!mal.startsWith(".")) continue;
    const lost = path.resolve(path.dirname(fil), mal);
    if (lost === provkatalog || lost.startsWith(provkatalog + path.sep)) {
      provimporter.push({ fil: path.relative(bas, fil), mal, rad: text.slice(0, m.index).split("\n").length });
    }
  }
}

if (provimporter.length > 0) {
  console.error(`${korimporter.length + typimporter.length > 0 ? "\n" : ""}check-node-side: en fil utanför proven importerar provkatalogen\n`);
  for (const t of provimporter) console.error(`  ${t.fil}:${t.rad}  ->  ${t.mal}`);
  console.error(
    "\n  Proven får importera src/node/. Därför får ingen annan importera proven: annars når\n" +
      "  nodsidan bundlen i två hopp, och kontrollen ovan ser ingenting.\n\n" +
      "  Behöver körkod något som ligger i ett prov är det inte ett prov. Flytta det till src/lib/.",
  );
}

if (korimporter.length > 0 || typimporter.length > 0 || provimporter.length > 0) process.exit(1);

// ── Nodsidan får inte dra in webben bakvägen ───────────────────────────────
//
// ⛔ MÄTT, INTE ANTAGET. cllp/ops-framework#93: ett Cloud Function som vill
// skriva en rad i aktivitetsloggen ska importera nodsidan och ingenting mer.
//
//   import("@staiger/ops-framework/node")   ->     8 ms
//   import("@staiger/ops-framework")        ->  1946 ms
//
// Skillnaden är React, Radix och en kalender. Nästan två sekunder per
// kallstart för en funktion som skriver ETT dokument.
//
// ⛔ REGELN UTAN VAKTEN HÅLLER INTE. Nodsidan återexporterar `createActivityLog`
// ur `src/lib/`, alltså finns det redan en kant där en framtida import kan dra
// in webben utan att någon märker det. Symptomet vore inte ett fel utan en
// långsammare kallstart, alltså något ingen felsöker.
//
// Vakten följer grafen från `src/node/index.js` och kräver att ingenting i den
// når React eller en komponent.
{
  const start = path.join(nodeDir, "index.js");
  /** @type {Set<string>} */
  const besokta = new Set();
  /** @type {{ fil: string, spec: string }[]} */
  const webbfynd = [];
  const kokatalog = [start];

  while (kokatalog.length > 0) {
    const fil = /** @type {string} */ (kokatalog.pop());
    if (besokta.has(fil) || !fs.existsSync(fil)) continue;
    besokta.add(fil);
    const text = fs.readFileSync(fil, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const m of text.matchAll(IMPORTMONSTER)) {
      const spec = m[1];
      if (spec.startsWith(".")) {
        const mal = path.resolve(path.dirname(fil), spec);
        kokatalog.push(mal);
        // ⛔ En komponent är webben även om den inte själv skriver `react`.
        if (mal.startsWith(path.join(src, "components") + path.sep)) webbfynd.push({ fil, spec });
        continue;
      }
      if (spec === "react" || spec === "react-dom" || spec.startsWith("react/") || spec.startsWith("react-dom/") || spec.startsWith("@radix-ui/")) {
        webbfynd.push({ fil, spec });
      }
    }
  }

  if (webbfynd.length > 0) {
    console.error("check-node-side: nodsidan drar in webben, alltså React eller en komponent.");
    for (const f of webbfynd) console.error(`  ${path.relative(bas, f.fil)} importerar "${f.spec}"`);
    console.error("");
    console.error("En funktion som skriver ett dokument ska inte ladda ett komponentbibliotek. Mätt: 8 ms mot 1946 ms.");
    process.exit(1);
  }
}

// ── Dokumentationshalvan ───────────────────────────────────────────────────

const indexfil = path.join(nodeDir, "index.js");
if (!fs.existsSync(indexfil)) {
  console.error("check-node-side: src/node/index.js finns inte. Nodsidan måste ha en ingång, annars är dess yta odefinierad.");
  process.exit(1);
}

const index = fs.readFileSync(indexfil, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
/** @type {string[]} */
const utlovade = [];
for (const m of index.matchAll(/export\s*\{([^}]*)\}/g)) {
  for (const del of m[1].split(",")) {
    const namn = del.trim().split(/\s+as\s+/).pop()?.trim();
    if (namn) utlovade.push(namn);
  }
}
for (const m of index.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_$]+)/g)) {
  utlovade.push(m[1]);
}

if (utlovade.length === 0) {
  console.error("check-node-side: läste noll exporter ur src/node/index.js. En tom lista gör vakten grön av fel skäl.");
  process.exit(1);
}

const readme = fs.readFileSync(path.join(bas, "README.md"), "utf8");
const odokumenterade = utlovade.filter((namn) => !readme.includes(namn));
if (odokumenterade.length > 0) {
  console.error("check-node-side: nodsidans exporter saknas i README\n");
  for (const namn of odokumenterade) console.error(`  ${namn}`);
  console.error(
    "\n  check-docs läser bara src/index.js, så nodsidan hade annars blivit en publik yta\n" +
      "  ingen dokumentationsvakt ser. Nämn varje namn i README.md.",
  );
  process.exit(1);
}

console.log(
  `check-node-side: ${utanfor.length} webbfiler rör inte src/node/, och nodsidans ${utlovade.length} export(er) är nämnda i README`,
);
