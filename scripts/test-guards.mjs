#!/usr/bin/env node
/**
 * Provar vakterna genom att bryta mot varje regel och kräva rött.
 *
 * ⛔ EN VAKT INGEN SETT FAILA ÄR EN FÖRHOPPNING, INTE EN VAKT.
 *
 * Det är inte en formulering, det är erfarenhet. Vi har haft vakter som var
 * gröna i månader därför att de läste fel fil, jämförde en lista mot en kopia
 * av sig själv, eller blev gröna av tom indata. Alla tre såg ut precis som en
 * fungerande vakt, och alla tre gav falsk trygghet som var värre än ingen vakt
 * alls, eftersom de flyttade uppmärksamheten bort från risken.
 *
 * Harnesset muterar en kopia, kör vakten mot kopian och kräver både att
 * utgångskoden är skild från noll OCH att felmeddelandet nämner rätt sak. Det
 * andra villkoret är det som fångar en vakt som blir röd av fel anledning.
 *
 * Kör: node scripts/test-guards.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenfil = path.join(rot, "tokens", "tokens.css");
const original = fs.readFileSync(tokenfil, "utf8");

const arbetsmapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-guards-"));
/** @type {{ namn: string, vantat: "rott" | "gront", utfall: "ok" | string }[]} */
const resultat = [];

/**
 * @param {string} namn
 * @param {string[]} kommando
 * @param {string} forvantat Text som MÅSTE finnas i felutskriften.
 */
function kravRott(namn, kommando, forvantat) {
  const k = spawnSync(process.execPath, kommando, { cwd: rot, encoding: "utf8" });
  const utdata = `${k.stdout ?? ""}${k.stderr ?? ""}`;
  if (k.status === 0) {
    resultat.push({ namn, vantat: "rott", utfall: "vakten var GRÖN trots ett inplanterat brott" });
    return;
  }
  if (!utdata.includes(forvantat)) {
    resultat.push({
      namn,
      vantat: "rott",
      utfall: `vakten blev röd, men av fel anledning. Väntade text som innehåller "${forvantat}".\n      Fick: ${utdata.trim().split("\n").slice(0, 3).join(" | ")}`,
    });
    return;
  }
  resultat.push({ namn, vantat: "rott", utfall: "ok" });
}

/**
 * Kräver att vakten är GRÖN mot ett underlag som INTE bryter mot något.
 *
 * ⛔ Lika viktigt som `kravRott`. En vakt som är röd mot korrekt kod blir
 * avstängd inom en vecka, och då skyddar den ingenting alls. Det var precis vad
 * som höll på att hända när `accept="image/*"` lästes som en kommentar.
 *
 * @param {string} namn @param {string[]} kommando
 */
function kravGront(namn, kommando) {
  const k = spawnSync(process.execPath, kommando, { cwd: rot, encoding: "utf8" });
  const utdata = `${k.stdout ?? ""}${k.stderr ?? ""}`;
  resultat.push(
    k.status === 0
      ? { namn, vantat: "gront", utfall: "ok" }
      : { namn, vantat: "gront", utfall: `vakten blev RÖD mot korrekt kod: ${utdata.trim().split("\n").slice(0, 3).join(" | ")}` },
  );
}

/** @param {string} namn @param {(s: string) => string} mutera @returns {string} */
function tokenkopia(namn, mutera) {
  const muterat = mutera(original);
  if (muterat === original) {
    throw new Error(`test-guards: mutationen "${namn}" ändrade ingenting. Då provar den inget, den bara ser ut att göra det.`);
  }
  const fil = path.join(arbetsmapp, `${namn}.css`);
  fs.writeFileSync(fil, muterat);
  return fil;
}

/** @param {string} namn @param {string} innehall @returns {string} */
function kallkopia(namn, innehall) {
  const mapp = path.join(arbetsmapp, namn);
  fs.mkdirSync(mapp, { recursive: true });
  const fil = path.join(mapp, "Prov.jsx");
  fs.writeFileSync(fil, innehall);
  return mapp;
}

// ── Tokenvakten, regel för regel ────────────────────────────────────────────
const tokenvakt = "tokens/check-tokens.mjs";

kravRott(
  "tokens 1: färgord i namn",
  [tokenvakt, tokenkopia("r1", (s) => s.replace("--color-accent:", "--color-teal:"))],
  "färgordet",
);

kravRott(
  "tokens 2: fallback i var()",
  [tokenvakt, tokenkopia("r2", (s) => s.replace("var(--dark-ink)", "var(--dark-ink, #fff)"))],
  "har en fallback",
);

kravRott(
  "tokens 3a: mörkerblocken glider isär",
  [tokenvakt, tokenkopia("r3a", (s) => s.replace("    --color-ink: var(--dark-ink);", "    --color-ink: var(--dark-ink-muted);"))],
  "skiljer sig mellan blocken",
);

kravRott(
  "tokens 3b: råvärde i aliasblock",
  [tokenvakt, tokenkopia("r3b", (s) => s.replace("    --color-canvas: var(--dark-canvas);", "    --color-canvas: #101010;"))],
  "Mörkerpaletten deklareras EN gång",
);

kravRott(
  "tokens 4: golv mot trasig fil",
  [tokenvakt, tokenkopia("r4", (s) => s.slice(0, 400))],
  "golv",
);

kravRott(
  "tokens 5: @theme inline",
  [tokenvakt, tokenkopia("r5", (s) => s.replace("@theme static {", "@theme inline {"))],
  "@theme inline",
);

kravRott(
  "tokens 6: föräldralös --dark-token",
  [tokenvakt, tokenkopia("r6", (s) => s.replace("  --dark-info-bg: rgba(111, 163, 196, 0.14);\n", ""))],
  "föräldralös",
);

kravRott(
  "tokens 7: mörkret skriver över något som inte finns i temat",
  [tokenvakt, tokenkopia("r7", (s) => s.replace("  --color-info-bg: var(--dark-info-bg);", "  --color-hittepa: var(--dark-info-bg);\n  --color-info-bg: var(--dark-info-bg);"))],
  "skriver över tomhet",
);

// ── Vakten för det stängda API:et ───────────────────────────────────────────
const apivakt = "scripts/check-closed-api.mjs";

kravRott(
  "api 1a: primitiv tar className",
  [apivakt, kallkopia("a1a", 'export function OpsProv({ variant, className }) {\n  return <div className={className}>{variant}</div>;\n}\n')],
  "stängt API",
);

kravRott(
  "api 1b: primitiv tar ...rest",
  [apivakt, kallkopia("a1b", 'export function OpsProv({ variant, ...rest }) {\n  return <div {...rest}>{variant}</div>;\n}\n')],
  "...rest",
);

kravRott(
  "api 2: konsument lappar på anropsstället",
  [apivakt, kallkopia("a2", 'export const Vy = () => <OpsButton className="mt-4">Spara</OpsButton>;\n')],
  "ingen lappning",
);

// ── ⛔ Strängar är inte kod, och den skillnaden var en lucka i vakten ───────
//
// `accept="image/*,application/pdf"` är en helt vanlig rad i en filväljare. Den
// gamla kommentarstrykaren läste snedstreck-stjärna inuti strängen som början på
// en blockkommentar och slukade allt fram till nästa kommentarslut i filen.
//
// Den SYNLIGA skadan var en falsk positiv. Den OSYNLIGA var att allt i det
// uppslukade spannet blev osynligt för vakten, alltså ett hål man inte kunde se.
// Båda proven behövs: det ena visar att hålet är igenluckat, det andra att
// lagningen inte gjorde vakten skrikig.
kravRott(
  "api 2b: brott gömt bakom image/* i en sträng",
  [
    apivakt,
    kallkopia(
      "a2b",
      // ⛔ JSDoc-blocket LÄNGST NER ÄR HELA POÄNGEN. Den gamla strykaren behövde
      // ett kommentarslut att svälja fram till; utan ett sådant i filen matchade
      // den ingenting alls och provet hade varit grönt mot båda varianterna,
      // alltså mätt ingenting. Det var precis vad första utkastet gjorde.
      'export function Vy() {\n  return <OpsFilePicker accept="image/*,application/pdf" />;\n}\n' +
        '\nexport function Rad() {\n  return <OpsButton className="mt-4">Spara</OpsButton>;\n}\n' +
        '\n/** En kommentar som stänger. */\nexport const slut = 1;\n',
    ),
  ],
  "ingen lappning",
);

/*
 * ⛔ REGEL 2 LÄSTE IN I BARNELEMENT, OCH DET UPPTÄCKTES AV EN RÖD GRIND I
 * bolag-ops, inte av det här harnesset.
 *
 * Den gamla regexen var `<(Ops[A-Za-z0-9_]*)\b[^>]*?\b(className|style)\s*=`.
 * `[^>]*?` stannar vid ett `>`, och i en flerradig tagg med en ReactNode-prop
 * finns inget `>` att stanna vid förrän långt inne i barnet. En `className` på
 * appens egen `span` inuti `summary={...}` rapporterades därför som ett brott
 * mot det stängda API:et.
 *
 * ⛔ EN FALSK POSITIV ÄR INTE OFARLIG. En grind som är röd av fel skäl är en
 * grind man lär sig att gå förbi, och då fångar den inte det riktiga brottet.
 */
kravGront("api 2d: className inuti en ReactNode-prop är appens layout, inte lappning", [
  apivakt,
  kallkopia(
    "a2d",
    "export function Vy() {\n  return (\n    <OpsDisclosure\n      summary={\n" +
      '        <span className="flex w-full">\n          <span className="font-semibold">Rubrik</span>\n        </span>\n' +
      "      }\n    >\n      <p>Innehåll</p>\n    </OpsDisclosure>\n  );\n}\n",
  ),
]);

kravRott(
  "api 2f: lappning EFTER en pilfunktion i en prop fångas",
  [
    apivakt,
    // ⛔ `() =>` bär ett `>`. Stannar scannern där är className osynlig, alltså
    // ett riktigt brott som slinker igenom. Mutationsprovet visade att inget
    // annat prov täckte just den vägen.
    kallkopia("a2f", 'export const Vy = () => <OpsButton onClick={() => spara(1)} className="mt-4">Spara</OpsButton>;\n'),
  ],
  "ingen lappning",
);

kravRott(
  "api 2e: lappning på en FLERRADIG tagg fångas fortfarande",
  [
    apivakt,
    kallkopia(
      "a2e",
      "export function Vy() {\n  return (\n    <OpsCard\n      tone=\"raised\"\n" +
        '      className="mt-4"\n    >\n      <p>Innehåll</p>\n    </OpsCard>\n  );\n}\n',
    ),
  ],
  "ingen lappning",
);

kravGront("api 2c: image/* i en sträng är inte ett brott", [
  apivakt,
  // ⛔ Inget `>` mellan kommentarslutet och `className`, alltså inga pilfunktioner
  // här. Med `() =>` finns ett `>` som stoppar vaktens `[^>]*?`, och då blir
  // provet grönt även med den trasiga strykaren, alltså grönt av fel anledning.
  kallkopia(
    "a2c",
    'export function Vy() {\n  return <OpsFilePicker accept="image/*,application/pdf" />;\n}\n' +
      '\n/** En kommentar som stänger. */\nfunction Rad() {\n  return <div className="mt-4" />;\n}\n',
  ),
]);

kravRott(
  "api 3a: godtycklig hex i klass",
  [apivakt, kallkopia("a3a", 'export const Vy = () => <div className="bg-[#ff0000]" />;\n')],
  "ad-hoc-färg",
);

kravRott(
  "api 3b: färg via inline style",
  [apivakt, kallkopia("a3b", 'export const Vy = () => <div style={{ backgroundColor: "#f00" }} />;\n')],
  "ad-hoc-färg",
);

kravRott("api golv: tom katalog", [apivakt, path.join(arbetsmapp, "finns-inte")], "noll filer lästa");

// ── Vakten för en konsumentapps stilrot ────────────────────────────────────
//
// ⛔ Regel 1 är den viktigaste i hela uppsättningen, och den ser minst ut som
// en regel: saknas `@source`-raden hittar Tailwind inga klassnamn i ramverkets
// primitiver, och appen blir HELT OSTYLAD utan ett enda felmeddelande.
const overridevakt = "scripts/check-token-overrides.mjs";

/** @param {string} namn @param {string} innehall @returns {string} */
function appkopia(namn, innehall) {
  const fil = path.join(arbetsmapp, `${namn}.css`);
  fs.writeFileSync(fil, innehall);
  return fil;
}

const GILTIG_APPCSS = `@import "tailwindcss";
@import "@staiger/ops-framework/tokens.css";
@source "../node_modules/@staiger/ops-framework/dist";
@theme static { --color-accent: #2f5d8a; }
:root { --dark-accent: #7fb0d9; }
`;

// Kontroll av kontrollen: underlaget måste vara GRÖNT, annars bevisar
// mutationerna nedan ingenting (allt hade varit rött ändå).
{
  const fil = appkopia("app-ok", GILTIG_APPCSS);
  const k = spawnSync(process.execPath, [overridevakt, fil], { cwd: rot, encoding: "utf8" });
  const namn = "overrides: giltigt underlag är grönt";
  resultat.push(
    k.status === 0
      ? { namn, vantat: "gront", utfall: "ok" }
      : { namn, vantat: "gront", utfall: `underlaget var RÖTT, så mutationerna nedan bevisar ingenting: ${(k.stderr ?? "").trim().split("\n").slice(0, 2).join(" | ")}` },
  );
}

kravRott(
  "overrides 1: @source-raden saknas",
  [overridevakt, appkopia("ao1", GILTIG_APPCSS.replace(/@source[^\n]*\n/, ""))],
  "helt ostylad",
);

kravRott(
  "overrides 2: tokens importeras före tailwindcss",
  [overridevakt, appkopia("ao2", '@import "@staiger/ops-framework/tokens.css";\n@import "tailwindcss";\n@source "../node_modules/@staiger/ops-framework/dist";\n')],
  "FÖRE tailwindcss",
);

kravRott(
  "overrides 3: appen hittar på ett eget token",
  [overridevakt, appkopia("ao3", `${GILTIG_APPCSS}@theme static { --color-brandad-yta: #123456; }\n`)],
  "inte finns i tokenkontraktet",
);

kravRott(
  "overrides 4: eget mörkerblock i appen",
  [overridevakt, appkopia("ao4", `${GILTIG_APPCSS}:root[data-theme="dark"] { --color-accent: #7fb0d9; }\n`)],
  "eget mörkerblock",
);

kravRott("overrides golv: fel sökväg", [overridevakt, path.join(arbetsmapp, "finns-inte.css")], "hittar inte");

// ── Exportvakten ───────────────────────────────────────────────────────────
//
// ⛔ Den tysta ytadriften: ett namn döps om i en modul men inte i index.js, och
// importen ger undefined i stället för att kasta. Ingenting loggar, och felet
// dyker upp långt från sin orsak. Exakt det hände under passet som skrev vakten.
{
  const namn = "exports: omdopt export som index.js inte foljde med pa";
  const kopia = path.join(arbetsmapp, "index-trasig.js");
  const riktig = path.join(rot, "src", "index.js");
  const original = fs.readFileSync(riktig, "utf8");
  fs.writeFileSync(kopia, original);
  fs.writeFileSync(riktig, original.replace("OpsButton }", "OpsButton, OpsFinnsInte }"));
  const k = spawnSync(process.execPath, ["scripts/check-exports.mjs"], { cwd: rot, encoding: "utf8" });
  fs.writeFileSync(riktig, original);
  const utdata = `${k.stdout ?? ""}${k.stderr ?? ""}`;
  resultat.push(
    k.status !== 0 && utdata.includes("finns inte i den byggda bundlen")
      ? { namn, vantat: "rott", utfall: "ok" }
      : { namn, vantat: "rott", utfall: `vakten fangade inte en utlovad export som saknas i bundlen. Utdata: ${utdata.trim().split("\n").slice(0, 2).join(" | ")}` },
  );
}

// ── Adoptionsraknaren ──────────────────────────────────────────────────────
//
// ⛔ Tva riktningar maste provas, och den andra glommer man alltid: att vakten
// blir ROD nar den laser noll filer. En upprensning dar katalogen bara flyttats
// ser da ut som att allt ar klart, vilket ar den dyraste falska gronheten av
// alla eftersom den firas.
{
  const adoptvakt = "scripts/check-adoption.mjs";
  const mapp = path.join(arbetsmapp, "adoption");
  fs.mkdirSync(path.join(mapp, "web"), { recursive: true });
  for (const n of ["a", "b", "c"]) fs.writeFileSync(path.join(mapp, "web", `${n}.html`), "<p>x</p>\n");

  const skriv = (tak) => {
    const f = path.join(mapp, `adoption-${tak}.json`);
    fs.writeFileSync(f, JSON.stringify({ matningar: [{ namn: "sidor", katalog: "web", andelser: [".html"], tak }] }));
    return f;
  };

  kravRott("adoption: fler filer an taket tillater", [adoptvakt, skriv(2)], "gått BAKÅT");
  kravRott("adoption: noll filer lasta men taket ar hogt", [adoptvakt, path.join(mapp, "tomt.json")], "hittar inte");

  fs.writeFileSync(path.join(mapp, "fel-katalog.json"), JSON.stringify({ matningar: [{ namn: "sidor", katalog: "finns-inte", andelser: [".html"], tak: 14 }] }));
  kravRott("adoption: fel sokvag firas inte som klart", [adoptvakt, path.join(mapp, "fel-katalog.json")], "läste NOLL filer");

  const k = spawnSync(process.execPath, [adoptvakt, skriv(5)], { cwd: rot, encoding: "utf8" });
  const namn = "adoption: under taket ar gront och foreslar en sankning";
  resultat.push(
    k.status === 0 && `${k.stdout}`.includes("tak 5 -> 3")
      ? { namn, vantat: "gront", utfall: "ok" }
      : { namn, vantat: "gront", utfall: `vantade gront med forslag om sankt tak. Fick status ${k.status}: ${`${k.stdout}${k.stderr}`.trim().split("\n").slice(0, 2).join(" | ")}` },
  );
}

// ── Typvakten ──────────────────────────────────────────────────────────────
//
// ⛔ JSDoc-typer som inte kontrolleras ar kommentarer, och kommentarer glider
// fran koden. Vakten ar `tsc --checkJs`. Mutationen planterar ett fel av precis
// den sort som annars ger en tyst bugg: ett vardet utanfor den slutna mangden.
{
  const namn = "typer: varde utanfor den slutna mangden";
  const fil = path.join(rot, "src", "__typprov.js");
  fs.writeFileSync(fil, 'import { OpsButton } from "./index.js";\n/** @type {Parameters<typeof OpsButton>[0]["variant"]} */\nexport const v = "fancy";\n');
  const k = spawnSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: rot, encoding: "utf8", shell: true });
  fs.rmSync(fil, { force: true });
  const utdata = `${k.stdout ?? ""}${k.stderr ?? ""}`;
  resultat.push(
    k.status !== 0 && utdata.includes("__typprov")
      ? { namn, vantat: "rott", utfall: "ok" }
      : { namn, vantat: "rott", utfall: `tsc fangade inte ett varde utanfor den slutna mangden. Status ${k.status}: ${utdata.trim().split("\n").slice(0, 2).join(" | ")}` },
  );
}

// ── Dokumentationsvakten ───────────────────────────────────────────────────
//
// ⛔ Dokumentation ruttnar tyst. En ny primitiv laggs till, README uppdateras
// inte, och sex manader senare beskriver dokumentet ett ramverk som inte langre
// ar det som finns. Da ar dokumentet SAMRE an inget dokument, for det ser
// fortfarande auktoritativt ut. Den forsta korningen av den har vakten hittade
// fyra odokumenterade exporter, alltsa precis det den finns for.
{
  const namn = "docs: ny export utan omnamnande i README";
  const riktig = path.join(rot, "src", "index.js");
  const original = fs.readFileSync(riktig, "utf8");
  fs.writeFileSync(riktig, `${original}\nexport const OpsHittepa = 1;\n`);
  const k = spawnSync(process.execPath, ["scripts/check-docs.mjs"], { cwd: rot, encoding: "utf8" });
  fs.writeFileSync(riktig, original);
  const utdata = `${k.stdout ?? ""}${k.stderr ?? ""}`;
  resultat.push(
    k.status !== 0 && utdata.includes("OpsHittepa")
      ? { namn, vantat: "rott", utfall: "ok" }
      : { namn, vantat: "rott", utfall: `vakten fangade inte en odokumenterad export. Status ${k.status}: ${utdata.trim().split("\n").slice(0, 2).join(" | ")}` },
  );
}

// ── Datalagervakten ────────────────────────────────────────────────────────
//
// ⛔ Regeln som avgor om datalagret ar vart nagot. Alla bygger ett datalager,
// och nastan alla far det forstort pa samma satt: en enda vy anropar nagot
// kallspecifikt "bara den har gangen".
{
  const datavakt = "scripts/check-data-layer.mjs";
  kravRott(
    "data 1: SDK importerad i en vy",
    [datavakt, kallkopia("d1", 'import { getFirestore } from "firebase/firestore";\nexport const Vy = () => getFirestore();\n')],
    "utanför en adapter",
  );
  kravRott(
    "data 2: fetch i en vy",
    [datavakt, kallkopia("d2", 'export const Vy = () => fetch("/api/kostnader");\n')],
    "fetch utanfor en adapter".replace("utanfor", "utanför"),
  );
  kravRott("data golv: tom katalog", [datavakt, path.join(arbetsmapp, "finns-inte-heller")], "noll filer lästa");

  // Kontroll av kontrollen: en adapter FAR importera sin SDK, annars vore
  // vakten omojlig att uppfylla och skulle stangas av.
  const mapp = path.join(arbetsmapp, "d3", "adaptrar");
  fs.mkdirSync(mapp, { recursive: true });
  fs.writeFileSync(path.join(mapp, "Prov.jsx"), 'import { getFirestore } from "firebase/firestore";\nexport const db = getFirestore();\n');
  const k = spawnSync(process.execPath, [datavakt, path.join(arbetsmapp, "d3")], { cwd: rot, encoding: "utf8" });
  resultat.push(
    k.status === 0
      ? { namn: "data: adaptern far importera sin SDK", vantat: "gront", utfall: "ok" }
      : { namn: "data: adaptern far importera sin SDK", vantat: "gront", utfall: `vakten blev rod i adaptern, alltsa omojlig att uppfylla: ${(k.stderr ?? "").trim().split("\n").slice(0, 2).join(" | ")}` },
  );
}

// ── Konfigkravvakten ───────────────────────────────────────────────────────
//
// ⛔ Regeln den upprätthåller stod som text i tre filers kommentarer och bröts av
// fyra av nio fabriker utan att någon sett det. Valideringen fanns och hann aldrig
// tala, eftersom destruktureringen i parameterlistan dog först.
//
// ⛔ Kravet är att felet NÄMNER FABRIKEN, inte bara att något kastas. Ett krav på
// "kastar något" hade varit grönt för båda fallen, och det farliga är just att en
// destruktureringskrasch ÄR ett kast: den ser ut som en kontroll.
{
  const konfigvakt = "scripts/check-config-requirements.mjs";

  /** @param {string} namn @param {string} innehall */
  const fixtur = (namn, innehall) => {
    const mapp = path.join(arbetsmapp, namn);
    fs.mkdirSync(mapp, { recursive: true });
    const fil = path.join(mapp, "fabriker.mjs");
    fs.writeFileSync(fil, innehall);
    return fil;
  };

  kravRott(
    "konfigkrav 1: destrukturering i parameterlistan",
    [konfigvakt, fixtur("k1", 'export function createProbe({ db }) { if (!db) throw new Error("createProbe: db krävs"); return {}; }\n')],
    "nämner inte fabriken",
  );

  kravRott(
    "konfigkrav 2: fabrik utan kontroll alls",
    [konfigvakt, fixtur("k2", "export function createProbe() { return {}; }\n")],
    "utan att säga ifrån",
  );

  kravRott(
    "konfigkrav 3: klassificerad som utan krav men kastar",
    [konfigvakt, fixtur("k3", 'export function createMemorySource() { throw new Error("createMemorySource: nej"); }\n')],
    "men kastade ändå",
  );

  kravRott("konfigkrav golv: noll fabriker", [konfigvakt, fixtur("k4", "export const x = 1;\n")], "noll fabriker");

  kravRott(
    "konfigkrav golv: fel sökväg",
    [konfigvakt, path.join(arbetsmapp, "finns-inte-konfig.mjs")],
    "Fel sökväg i vakten",
  );

  // Kontroll av kontrollen: en fabrik som gör rätt MÅSTE vara grön, annars vore
  // vakten omöjlig att uppfylla.
  {
    const fil = fixtur(
      "k5",
      "export function createProbe(konfig) { const { db } = konfig ?? {}; if (!db) throw new Error('createProbe: db krävs. Skicka in getFirestore(app).'); return {}; }\n",
    );
    const k = spawnSync(process.execPath, [konfigvakt, fil], { cwd: rot, encoding: "utf8" });
    resultat.push(
      k.status === 0
        ? { namn: "konfigkrav: en fabrik som namnger sig ar gron", vantat: "gront", utfall: "ok" }
        : {
            namn: "konfigkrav: en fabrik som namnger sig ar gron",
            vantat: "gront",
            utfall: `vakten blev rod pa en korrekt fabrik, alltsa omojlig att uppfylla: ${(k.stderr ?? "").trim().split("\n").slice(0, 2).join(" | ")}`,
          },
    );
  }
}

// ── Nodsidevakten ──────────────────────────────────────────────────────────
//
// ⛔ Den enda vakten i repot som skyddar mot ett SÄKERHETSFEL och inte ett
// kvalitetsfel: att kod som hanterar en token hamnar i webbundeln. Den ska
// därför falla på båda formerna en import kan ta, och SKILJA dem, eftersom
// åtgärderna är olika.
//
// ⛔ Den fångade sitt första fel i sin egen PR: kontraktet låg på nodsidan och
// importerades in i webbsidan som en typ. Det var inget läckage, men fel
// riktning, och nästa person följer typen dit och lägger körkod intill den.
{
  const nodvakt = "scripts/check-node-side.mjs";

  /**
   * En kopia av trädet, med en fil planterad i `src/` utanför `src/node/`.
   *
   * ⛔ Kopian bär ett eget README och ett eget `src/node/index.js`, eftersom vakten
   * kontrollerar båda halvorna. Utan dem hade den fallit på dokumentationshalvan,
   * och provet sett rött ut av fel skäl.
   *
   * @param {string} namn @param {string} innehall
   */
  const nodkopia = (namn, innehall) => {
    const mapp = path.join(arbetsmapp, namn);
    fs.mkdirSync(path.join(mapp, "src", "node"), { recursive: true });
    fs.mkdirSync(path.join(mapp, "src", "lib"), { recursive: true });
    fs.writeFileSync(path.join(mapp, "src", "node", "index.js"), 'export { nagot } from "./nagot.js";\n');
    fs.writeFileSync(path.join(mapp, "src", "node", "nagot.js"), "export const nagot = 1;\n");
    fs.writeFileSync(path.join(mapp, "README.md"), "Dokumenterar nagot.\n");
    fs.writeFileSync(path.join(mapp, "src", "lib", "Prov.js"), innehall);
    return mapp;
  };

  kravRott(
    "nodsida 1: körimport från webbsidan",
    [nodvakt, nodkopia("n1", 'import { nagot } from "../node/nagot.js";\nexport const x = nagot;\n')],
    "i KÖRKOD",
  );

  kravRott(
    "nodsida 2: dynamisk import räknas också",
    [nodvakt, nodkopia("n2", 'export const x = () => import("../node/nagot.js");\n')],
    "i KÖRKOD",
  );

  kravRott(
    "nodsida 3: JSDoc-typimport, fel riktning men inget läckage",
    [nodvakt, nodkopia("n3", '/** @typedef {import("../node/nagot.js").T} T */\nexport const x = 1;\n')],
    "nodsidans TYPER",
  );

  {
    const mapp = nodkopia("n4", "export const x = 1;\n");
    fs.writeFileSync(path.join(mapp, "README.md"), "Namner ingenting.\n");
    kravRott("nodsida 4: odokumenterad export", [nodvakt, mapp], "saknas i README");
  }

  {
    const mapp = nodkopia("n5", "export const x = 1;\n");
    fs.writeFileSync(path.join(mapp, "src", "node", "index.js"), "// ingen export\n");
    kravRott("nodsida golv: noll exporter", [nodvakt, mapp], "noll exporter");
  }

  kravRott("nodsida golv: src saknas", [nodvakt, path.join(arbetsmapp, "finns-inte-nod")], "Fel sökväg i vakten");

  // ⛔ Omvägen genom proven. Proven FÅR importera nodsidan, alltså får ingen annan
  // importera proven: då når nodsidan bundlen i två hopp och den första
  // kontrollen ser ingenting. Ingen skulle göra det med flit, och det är precis
  // därför det kontrolleras.
  {
    const mapp = nodkopia("n7", 'import { h } from "../__tests__/hjalp.js";\nexport const x = h;\n');
    fs.mkdirSync(path.join(mapp, "src", "__tests__"), { recursive: true });
    fs.writeFileSync(path.join(mapp, "src", "__tests__", "hjalp.js"), 'export { nagot as h } from "../node/nagot.js";\n');
    kravRott("nodsida 5: omväg genom provkatalogen", [nodvakt, mapp], "importerar provkatalogen");
  }

  // Kontroll av kontrollen: ett PROV får importera nodsidan, annars går modulen
  // inte att prova och vakten hade tvingat fram oprovad kod.
  {
    const mapp = nodkopia("n8", "export const x = 1;\n");
    fs.mkdirSync(path.join(mapp, "src", "__tests__"), { recursive: true });
    fs.writeFileSync(path.join(mapp, "src", "__tests__", "nagot.test.js"), 'import { nagot } from "../node/nagot.js";\nexport default nagot;\n');
    const k = spawnSync(process.execPath, [nodvakt, mapp], { cwd: rot, encoding: "utf8" });
    resultat.push(
      k.status === 0
        ? { namn: "nodsida: ett prov far importera nodsidan", vantat: "gront", utfall: "ok" }
        : {
            namn: "nodsida: ett prov far importera nodsidan",
            vantat: "gront",
            utfall: `vakten blev rod pa ett prov, alltsa tvingar den fram oprovad kod: ${(k.stderr ?? "").trim().split("\n").slice(0, 2).join(" | ")}`,
          },
    );
  }

  // Kontroll av kontrollen: ett rent träd MÅSTE vara grönt, annars vore vakten
  // omöjlig att uppfylla och skulle stängas av.
  {
    const mapp = nodkopia("n6", "export const x = 1;\n");
    const k = spawnSync(process.execPath, [nodvakt, mapp], { cwd: rot, encoding: "utf8" });
    resultat.push(
      k.status === 0
        ? { namn: "nodsida: ett rent trad ar gront", vantat: "gront", utfall: "ok" }
        : {
            namn: "nodsida: ett rent trad ar gront",
            vantat: "gront",
            utfall: `vakten blev rod pa ett rent trad, alltsa omojlig att uppfylla: ${(k.stderr ?? "").trim().split("\n").slice(0, 2).join(" | ")}`,
          },
    );
  }
}

// ── Byggvakten ─────────────────────────────────────────────────────────────
// Den dyraste och viktigaste: tar vi bort nollningen av Tailwinds palett ska
// `bg-red-500` dyka upp i utdata igen och vakten bli röd. Är den grön här är
// påståendet "ad-hoc-färger finns inte" obevisat.
kravRott(
  "css-build: paletten nollas inte längre",
  ["scripts/check-css-build.mjs", tokenkopia("cb", (s) => s.replace("  --color-*: initial;\n", ""))],
  "genererades trots att tokenkontraktet nollar",
);

// ── Typsnittsvakten ────────────────────────────────────────────────────────
// ⛔ Bevakar ett fel vi HADE, inte ett vi föreställer oss: Inter hämtades med
// `@import` i tokenfilen, raden ignorerades av webbläsaren eftersom den inte
// stod först, och sidan ritades i systemets typsnitt. Bredvid stod en utförlig
// kommentar som förklarade varför lösningen var den rätta.
{
  const typsnittsvakt = "scripts/check-fonts.mjs";
  const mallsokvag = "create-ops-app/template/index.html";

  kravRott(
    "typsnitt 1: @import tillbaka i tokenfilen",
    [
      typsnittsvakt,
      tokenkopia("ty1", (s) => `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap");\n${s}`),
      mallsokvag,
    ],
    "ignoreras av webbläsaren",
  );

  /** @param {string} namn @param {(s: string) => string} mutera @returns {string} */
  const mallkopia = (namn, mutera) => {
    const forlaga = fs.readFileSync(path.join(rot, mallsokvag), "utf8");
    const muterat = mutera(forlaga);
    if (muterat === forlaga) {
      throw new Error(`test-guards: mallmutationen "${namn}" ändrade ingenting. Då provar den inget, den bara ser ut att göra det.`);
    }
    const fil = path.join(arbetsmapp, `${namn}.html`);
    fs.writeFileSync(fil, muterat);
    return fil;
  };

  kravRott(
    "typsnitt 2: mallen slutar hämta Inter",
    [typsnittsvakt, "tokens/tokens.css", mallkopia("ty2", (s) => s.replace(/<link\s+rel="stylesheet"[\s\S]*?\/>/, ""))],
    'saknar <link rel="stylesheet"> för Inter',
  );

  kravRott(
    "typsnitt 3: preconnect utan crossorigin",
    [
      typsnittsvakt,
      "tokens/tokens.css",
      mallkopia("ty3", (s) => s.replace('href="https://fonts.gstatic.com" crossorigin', 'href="https://fonts.gstatic.com"')),
    ],
    "utan crossorigin",
  );
}

// ── Diagramfärgvakten ───────────────────────────────────────────────────────
// ⛔ Den enda vakten i repot vars regel inte går att bedöma med ögat. En palett
// kan se utmärkt ut och ändå ha två serier som är identiska för var tjugonde
// man, så beviset för att den biter är särskilt viktigt: kan den inte bli röd
// är den bara ett påstående om att färgerna är mätta.
{
  const diagramvakt = "scripts/check-chart-colors.mjs";

  kravRott(
    "diagramfärger: två serier som ingen kan skilja åt",
    [
      diagramvakt,
      // Slot 2 sätts nästan lika slot 1. Det är exakt felet identitetstonerna
      // hade: två grannar under normalseendets golv.
      tokenkopia("df1", (s) => s.replace("--color-series-2: #eb6834;", "--color-series-2: #2f7cd8;")),
    ],
    "serier, ljust läge",
  );

  kravRott(
    "diagramfärger: en serie som läses som grått",
    [
      diagramvakt,
      tokenkopia("df2", (s) => s.replace("--color-series-3: #1baf7a;", "--color-series-3: #8a8a88;")),
    ],
    "serier, ljust läge",
  );

  kravRott(
    "diagramfärger: skalan är ingen enda nyans",
    [
      diagramvakt,
      // En regnbåge i stället för en nyans som mörknar. Den har ingen ordning,
      // så läsaren måste slå upp legenden för varje steg.
      tokenkopia("df3", (s) => s.replace("--color-scale-2: #3987e5;", "--color-scale-2: #1baf7a;")),
    ],
    "skala, ljust läge",
  );

  kravRott(
    "diagramfärger: mörka läget mäts mot mörk yta, inte mot vitt",
    [
      diagramvakt,
      // Ett mörkt steg som är för mörkt mot #16161c. Klarar sig mot vitt, alltså
      // fångas det bara av att båda lägena mäts var för sig.
      tokenkopia("df4", (s) => s.replace("--dark-series-1: #3987e5;", "--dark-series-1: #123a66;")),
    ],
    "serier, mörkt läge",
  );

  kravRott(
    "diagramfärger golv: inga tokens alls",
    [diagramvakt, tokenkopia("df5", (s) => s.replace(/--(color|dark)-series-\d+: #[0-9a-f]{6};\n/g, ""))],
    "Hittade bara",
  );
}

// ── Sidramsvakten ───────────────────────────────────────────────────────────
// ⛔ Bevakar en enda CSS-rad som ingen provsvit kan se. jsdom kör ingen CSS och
// ingen komponent importerar tokenfilen, så `scrollbar-gutter: stable` kan
// försvinna ur basskiktet utan att ett enda prov blir rött. Symptomet läses
// dessutom inte som en bugg utan som att "appen känns ostadig"
// (bolag-ops#143), vilket är precis den felklass en vakt finns för.
{
  const sidramsvakt = "scripts/check-page-frame.mjs";

  kravRott(
    "sidram 1: raden borttagen ur basskiktet",
    [sidramsvakt, tokenkopia("sr1", (s) => s.replace(/\n\s*scrollbar-gutter: stable;/, ""))],
    "saknas i basskiktets",
  );

  // ⛔ En bortkommenterad rad är en borttagen rad. Utan det här provet hade
  // vakten varit grön för den som kommenterar bort raden "tillfälligt", alltså
  // det vanligaste sättet en regel faktiskt försvinner.
  kravRott(
    "sidram 2: raden bortkommenterad i stället för borttagen",
    [sidramsvakt, tokenkopia("sr2", (s) => s.replace("scrollbar-gutter: stable;", "/* scrollbar-gutter: stable; */"))],
    "saknas i basskiktets",
  );

  // ⛔ Rätt rad, fel selektor. Den här mutationen är hela skälet att vakten läser
  // `html`-regeln och inte hela filen: en träff var som helst hade varit grön.
  kravRott(
    "sidram 3: raden finns men i en annan selektor",
    [
      sidramsvakt,
      tokenkopia("sr3", (s) =>
        s.replace(/\n\s*scrollbar-gutter: stable;/, "").replace("  body {\n    margin: 0;", "  body {\n    scrollbar-gutter: stable;\n    margin: 0;"),
      ),
    ],
    "saknas i basskiktets",
  );

  kravGront("sidram 4: den riktiga tokenfilen är grön", [sidramsvakt, "tokens/tokens.css"]);
}

// ── Reglagevakten ───────────────────────────────────────────────────────────
// ⛔ Samma felklass som sidramen, och samma skäl att inte vara ett prov: jsdom
// ritar ingen tumme. `reglage.test.jsx` provar elva saker om `OpsSlider` och
// vore grönt även om hela `.ops-reglage` försvann ur tokenfilen. Reglaget blir
// då inte ostylat utan FEL stylat: webbläsaren ritar det i systemets accentfärg,
// alltså en färg utanför tokenkontraktet som inte byter med mörkt läge
// (bolag-ops#141).
{
  const reglagevakt = "scripts/check-slider.mjs";

  kravRott(
    "reglage 1: hela blocket borttaget",
    [reglagevakt, tokenkopia("rg1", (s) => s.replace(/@layer components \{[\s\S]*$/, ""))],
    "hittade inga",
  );

  // ⛔ Elementets egen `appearance: none` har ett eget prov, för utan den ritar
  // webbläsaren sin egen skena UNDER vår: två skenor ovanpå varandra där bara
  // den ena följer värdet. En vakt som bara läste tummen hade varit grön.
  kravRott(
    "reglage 2: appearance borta från elementet, tummen kvar",
    [reglagevakt, tokenkopia("rg2", (s) => s.replace("    appearance: none;\n    -webkit-appearance: none;\n    margin: 0;", "    margin: 0;"))],
    "egen skena under",
  );

  // ⛔ Motorerna delar inte pseudoelement. Räckte en av dem vore reglaget rätt i
  // Chrome och systemfärgat i Firefox, alltså ett fel bara halva publiken ser.
  kravRott(
    "reglage 3: bara webkit-tummen kvar",
    [reglagevakt, tokenkopia("rg3", (s) => s.replace(/\s*\.ops-reglage::-moz-range-thumb \{[^}]*\}/, ""))],
    "-moz-range-thumb",
  );

  // ⛔ Den troligaste framtida ändringen: någon justerar tummen "bara här" med
  // ett hexvärde. Då finns en färg i ramverket som inte finns i tokenkontraktet.
  kravRott(
    "reglage 4: hårdkodad färg i stället för token",
    [reglagevakt, tokenkopia("rg4", (s) => s.replace("    background: var(--color-accent);\n  }\n\n  .ops-reglage::-moz-range-thumb", "    background: #c9a227;\n  }\n\n  .ops-reglage::-moz-range-thumb"))],
    "hårdkodat färgvärde",
  );

  kravGront("reglage 5: den riktiga tokenfilen är grön", [reglagevakt, "tokens/tokens.css"]);
}

// ── Vakten mot ordet Läge där taxonomin heter Status ───────────────────────
//
// ⛔ DEN HÄR VAKTEN ÄR LÄTTARE ATT SKRIVA FEL ÄN DE ANDRA, eftersom den handlar
// om svenska och inte om struktur. Två fel ligger nära: att fälla på "mörkt
// läge" och "nolläget", som är riktig svenska om något annat, och att missa
// "lägesfiltret" för att ordet sitter ihop med nästa. Därför provas båda
// riktningarna, inte bara att ett brott blir rött.
{
  const ordvakt = "scripts/check-statusord.mjs";

  /** @param {string} namn @param {Record<string, string>} filer @returns {string} */
  function ordkatalog(namn, filer) {
    const mapp = path.join(arbetsmapp, `ord-${namn}`, "src", "components");
    fs.mkdirSync(mapp, { recursive: true });
    for (const [fil, innehall] of Object.entries(filer)) fs.writeFileSync(path.join(mapp, fil), innehall);
    return path.join(arbetsmapp, `ord-${namn}`, "src");
  }

  kravRott(
    "statusord 1: ett filter som heter Läge",
    [ordvakt, ordkatalog("filter", { "Filter.jsx": 'export const f = { label: "Läge", allLabel: "Alla lägen" };\n' })],
    'säger "läge" där taxonomin heter Status',
  );

  // ⛔ Det svåra fallet: ordet är förled i en sammansättning. En vakt som bara
  // matchar det fristående ordet hade varit grön här, och just den formen är
  // den som står i appens hjälptext (cllp/bolag-ops#362).
  kravRott(
    "statusord 2: lägesfiltret som sammansatt förled",
    [ordvakt, ordkatalog("forled", { "Hjalp.jsx": 'export const t = "Det är oftast lägesfiltret som döljer raderna.";\n' })],
    "lägesfiltret",
  );

  // ⛔ Motsatsen, och den som avgör om vakten går att leva med: efterled är en
  // annan betydelse och ska INTE fällas. Blir den här röd är vakten oanvändbar
  // och stängs av inom en vecka.
  kravGront(
    "statusord 3: nolläge och mörkt läge är en annan betydelse",
    [ordvakt, ordkatalog("efterled", { "Reglage.jsx": 'export const a = "Nolläget är utgångspunkten";\nexport const b = "utvecklingsläge";\nexport const c = "radläget";\n' })],
  );

  // ⛔ Kommentarer är resonemang, inte gränssnitt. Faller vakten här får ingen
  // längre skriva ned varför en kontrast mättes i mörkt läge.
  kravGront(
    "statusord 4: samma ord i en kommentar går fritt",
    [ordvakt, ordkatalog("kommentar", { "Kommenterad.jsx": '/* Läge och lägen och lägesfiltret, allt i en kommentar. */\n// Läge här också.\nexport const x = 1;\n' })],
  );

  kravGront("statusord 5: ramverkets egen src är grön", [ordvakt, "src"]);

  // ⛔ Golvet: en vakt som blir grön av att inte hitta något är den farligaste
  // sorten. Den har hänt två gånger i det här repot.
  kravRott("statusord golv: fel sökväg", [ordvakt, path.join(arbetsmapp, "finns-inte")], "finns inte");
}

// ── Vakten mot handskrivna månads- och veckodagsnamn ───────────────────────
{
  const datumvakt = "scripts/check-datumnamn.mjs";

  /** @param {string} namn @param {string} innehall @returns {string} */
  function datumkatalog(namn, innehall) {
    const mapp = path.join(arbetsmapp, `datum-${namn}`, "src");
    fs.mkdirSync(mapp, { recursive: true });
    fs.writeFileSync(path.join(mapp, "Fil.jsx"), innehall);
    return mapp;
  }

  kravRott(
    "datumnamn 1: en egen månadslista",
    [datumvakt, datumkatalog("manader", 'export const M = ["januari", "februari", "december"];\n')],
    "handskrivna datumnamn",
  );

  kravRott(
    "datumnamn 2: en egen veckodagsrad",
    [datumvakt, datumkatalog("dagar", 'export const D = ["Mån", "Tis", "Sön"];\n')],
    "handskrivna datumnamn",
  );

  // ⛔ Engelska räknas också. Ramverket ska gå att använda på engelska, och en
  // handskriven engelsk lista är samma fel med en annan flagga.
  kravRott(
    "datumnamn 3: engelska namn är samma fel",
    [datumvakt, datumkatalog("engelska", 'export const M = ["January", "October"];\n')],
    "January",
  );

  // ⛔ Ett datum i en mening är ett exempel, inte en ordlista. Fälls det här får
  // ingen skriva ned vad som mättes vilken dag.
  kravGront(
    "datumnamn 4: ett datum inuti en text går fritt",
    [datumvakt, datumkatalog("mening", 'export const t = "Mätt 17 september 2026, före ändringen.";\n')],
  );

  // ⛔ "maj" och "mars" är också ett namn och en planet. Ett ensamt sådant ord
  // är inte en ordlista, och en vakt som fäller på dem stängs av.
  kravGront(
    "datumnamn 5: tvetydiga ord fälls inte ensamma",
    [datumvakt, datumkatalog("tvetydig", 'export const a = "mars";\nexport const b = "May";\n')],
  );

  kravGront("datumnamn 6: ramverkets egen src är grön", [datumvakt, "src"]);
  kravRott("datumnamn golv: fel sökväg", [datumvakt, path.join(arbetsmapp, "finns-inte")], "finns inte");
}

fs.rmSync(arbetsmapp, { recursive: true, force: true });

const fel = resultat.filter((r) => r.utfall !== "ok");
for (const r of resultat) {
  const etikett = r.utfall !== "ok" ? "MISSLYCKADES " : r.vantat === "rott" ? "röd som väntat" : "grön som väntat";
  console.log(`  ${etikett.padEnd(14)}  ${r.namn}`);
  if (r.utfall !== "ok") console.log(`      ${r.utfall}`);
}

if (fel.length > 0) {
  console.error(`\ntest-guards: ${fel.length} av ${resultat.length} kontroller bevisades INTE. En regel som inte går att göra röd skyddar ingenting.`);
  process.exit(1);
}

const roda = resultat.filter((r) => r.vantat === "rott").length;
console.log(`\ntest-guards: ${roda} vaktregler gick att bryta och blev röda av rätt anledning, ${resultat.length - roda} kontroll av att giltigt underlag är grönt`);
