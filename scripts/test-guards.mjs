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
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  [tokenvakt, tokenkopia("r6", (s) => s.replace("  --dark-info-bg: rgba(128, 176, 209, 0.14);\n", ""))],
  "föräldralös",
);

kravRott(
  "tokens 7: mörkret skriver över något som inte finns i temat",
  [tokenvakt, tokenkopia("r7", (s) => s.replace("  --color-info-bg: var(--dark-info-bg);", "  --color-hittepa: var(--dark-info-bg);\n  --color-info-bg: var(--dark-info-bg);"))],
  "skriver över tomhet",
);

// ⛔ #167, Regel 8/9: paletten och rundningsskalan är inte längre en lista i
// vakten, de är ett genererat block ur `tokens/sessionstudio-profil.json`.
// Muterar en av de genererade raderna för hand (exakt det filhuvudet i
// `tokens.css` förbjuder), och vakten ska fälla för att blocket inte längre
// matchar vad generatorn skulle skrivit.
kravRott(
  "tokens 8/9a: ljus accent redigerad för hand i det genererade blocket",
  [tokenvakt, tokenkopia("r8a", (s) => s.replace("--color-accent: #8E7A4E;", "--color-accent: #a0a0a0;"))],
  "genererat block",
);
kravRott(
  "tokens 8/9b: mörk accent redigerad för hand i det genererade blocket",
  [tokenvakt, tokenkopia("r8b", (s) => s.replace("--dark-accent: #9e8a6e;", "--dark-accent: #c9a84c;"))],
  "genererat block",
);
kravRott(
  "tokens 0.31.0: accentens genomskinliga ton skriven som eget rgba-tal (olivgrön kvar efter bytet)",
  [tokenvakt, tokenkopia("r8d", (s) => s.replace("--color-accent-subtle: rgba(142, 122, 78, 0.12);", "--color-accent-subtle: rgba(107, 142, 78, 0.12);"))],
  "genererat block",
);
kravRott(
  "tokens 8/9c: rundningsskalan redigerad för hand i det genererade blocket",
  [tokenvakt, tokenkopia("r9", (s) => s.replace("--radius-sm: 8px;", "--radius-sm: 4px;"))],
  "genererat block",
);

// ⛔ #167, Regel 11: fixturens golv. En tömd grupp ska fälla, inte tigas ihjäl
// av att generatorn råkar skriva en tom sträng utan fel.
{
  const fixturVag = path.join(rot, "tokens", "sessionstudio-profil.json");
  const fixturOriginal = fs.readFileSync(fixturVag, "utf8");
  const tomFixtur = path.join(arbetsmapp, "tom-fixtur.json");
  const parsed = JSON.parse(fixturOriginal);
  parsed.radier = { sm: "8px" };
  fs.writeFileSync(tomFixtur, JSON.stringify(parsed));
  // Skriver den trasiga fixturen på PLATS (samma sökväg vakten alltid läser)
  // och lägger tillbaka originalet efteråt, oavsett utfall.
  fs.writeFileSync(fixturVag, JSON.stringify(parsed));
  try {
    kravRott("tokens 11: fixturens golv, en tömd grupp", [tokenvakt, tokenfil], "fixturens golv");
  } finally {
    fs.writeFileSync(fixturVag, fixturOriginal);
  }
}

// ⛔ #164, Regel 10: ett border-radius-literal utanför @theme static som
// råkar träffa ett redan deklarerat radie-token. Mutationen återinför exakt
// det fyndet arkitekturgranskningen gjorde (999px, samma tal som
// --radius-full), på en av de fyra rader som fixen bytte till var(...).
kravRott(
  "tokens 10: radie-literal dubblerar ett token",
  [tokenvakt, tokenkopia("r10", (s) => s.replace("border-radius: var(--radius-full);\n    background:", "border-radius: 999px;\n    background:"))],
  "dubblerar ett token",
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

// ── Det gamla paketnamnet (0.68.0, #270 klarkriterium 2, granskningen av PR 271, A1) ──
//
// ⛔ Namnet byggs av delar, så att den här filen inte är ett undantag i vakten.
{
  const namnvakt = "scripts/check-gammalt-namn.mjs";
  const GAMMALT = "@" + "staiger/ops-framework";
  /** @param {string} namn @param {Record<string, string>} innehall */
  const namnrot = (namn, innehall) => {
    const d = path.join(arbetsmapp, `namn-${namn}`);
    for (const [rel, text] of Object.entries(innehall)) {
      fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
      fs.writeFileSync(path.join(d, rel), text);
    }
    return d;
  };
  const UNDERLAG = {
    "src/a.js": 'import { OpsButton } from "ops-framework";\n',
    "src/b.css": '@import "ops-framework/tokens.css";\n',
    "CHANGELOG.md": `Paketet hette ${GAMMALT}.\n`,
    "create-ops-app/package.json": `{ "beskrivning": "${GAMMALT}" }\n`,
    "README.md": `Före 0.67.0 hette paketet ${GAMMALT}.\nTarbollen hette ${"staiger" + "-ops-framework"}-X.Y.Z.tgz.\n`,
  };
  {
    const k = spawnSync(process.execPath, [namnvakt, "--rot", namnrot("ok", UNDERLAG), "--golv", "5"], { cwd: rot, encoding: "utf8" });
    const namn = "gammalt namn: giltigt underlag med undantagen är grönt";
    resultat.push(k.status === 0 ? { namn, vantat: "gront", utfall: "ok" } : { namn, vantat: "gront", utfall: `underlaget var RÖTT: ${(k.stderr ?? "").trim().split("\n")[0]}` });
  }
  kravRott("gammalt namn 1: en import med det scopade namnet", [namnvakt, "--rot", namnrot("imp", { ...UNDERLAG, "src/a.js": `import { OpsButton } from "${GAMMALT}";\n` }), "--golv", "5"], "är tillbaka");
  kravRott("gammalt namn 2: tarbollens gamla filnamn i ett skript", [namnvakt, "--rot", namnrot("tgz", { ...UNDERLAG, "scripts/x.sh": `curl -LO .../${"staiger" + "-ops-framework"}-0.67.0.tgz\n` }), "--golv", "5"], "är tillbaka");
  kravRott("gammalt namn 3: README över sitt tak", [namnvakt, "--rot", namnrot("tak", { ...UNDERLAG, "README.md": `${GAMMALT}\n${GAMMALT}\n${GAMMALT}\n` }), "--golv", "5"], "taket är 2");
  kravRott("gammalt namn 4: golvet, för få lästa filer", [namnvakt, "--rot", namnrot("golv", UNDERLAG), "--golv", "50"], "golvet är 50");
  // Omgranskningen av PR 268, A4: taket ska sänkas när träffarna blir färre, och golvet följa med när filerna blir fler.
  kravRott("gammalt namn 5: README under sitt tak", [namnvakt, "--rot", namnrot("under", { ...UNDERLAG, "README.md": `Före 0.67.0 hette paketet ${GAMMALT}.\n` }), "--golv", "5"], "Sänk taket till 1");
  kravRott("gammalt namn 6: golvet står långt under det som läses", [namnvakt, "--rot", namnrot("hojgolv", UNDERLAG), "--golv", "3"], "Höj golvet");
}

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
@import "ops-framework/tokens.css";
@source "../node_modules/ops-framework/dist";
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
  "overrides 1b: @source mot det gamla scopade namnet (0.68.0, granskningen av PR 271, A2)",
  [overridevakt, appkopia("ao1b", GILTIG_APPCSS.replace('@source "../node_modules/ops-framework/dist";', '@source "../node_modules/@' + 'staiger/ops-framework/dist";'))],
  "helt ostylad",
);

kravRott(
  "overrides 2: tokens importeras före tailwindcss",
  [overridevakt, appkopia("ao2", '@import "ops-framework/tokens.css";\n@import "tailwindcss";\n@source "../node_modules/ops-framework/dist";\n')],
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

// 0.31.2 (bolag-ops #240): reglern som smalnade skalets toppruta. Vakten var GRÖN på den, eftersom den bara läste custom properties.
kravRott(
  "overrides 5: en regel som stilar ramverkets skal (bolag-ops #240)",
  [overridevakt, appkopia("ao5", `${GILTIG_APPCSS}\nheader.sticky > div.max-w-7xl {\n  max-width: 64rem;\n}\n`)],
  'regeln "header.sticky > div.max-w-7xl" stilar ett element',
);

kravRott(
  "overrides 6: en klassregel och ett @media i appens stilrot",
  [overridevakt, appkopia("ao6", `${GILTIG_APPCSS}\n.max-w-7xl { max-width: 64rem; }\n`)],
  "stilar en klass",
);

kravRott(
  "overrides 7: :root med en vanlig deklaration i stället för ett token",
  [overridevakt, appkopia("ao7", `${GILTIG_APPCSS}\n:root { font-size: 20px; }\n`)],
  "som inte är ett token",
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

  // ── check:fonts i konsumentens check-kedja (#164) ──────────────────────
  //
  // ⛔ DEN GAMLA FIXTUREN (`skriv(...)`) SAKNAR MED FLIT ETT package.json, och
  // det är precis det som bevisar att kravet är villkorat: de mutationerna
  // ovan är fortfarande gröna utan filen. Den här mutationen lägger filen
  // till och tar sedan bort raden, för att visa att NÄR package.json finns
  // blir avsaknaden av "check:fonts" rött.
  const fontmapp = path.join(mapp, "fonter");
  fs.mkdirSync(path.join(fontmapp, "web"), { recursive: true });
  fs.writeFileSync(path.join(fontmapp, "web", "a.html"), "<p>x</p>\n");
  const fontadoption = path.join(fontmapp, "adoption.json");
  fs.writeFileSync(fontadoption, JSON.stringify({ matningar: [{ namn: "sidor", katalog: "web", andelser: [".html"], tak: 5 }] }));

  fs.writeFileSync(path.join(fontmapp, "package.json"), JSON.stringify({ scripts: { check: "npm run lint && npm run check:tokens && npm test" } }));
  kravRott("adoption: package.json saknar check:fonts i check-kedjan", [adoptvakt, fontadoption], "check:fonts");

  fs.writeFileSync(path.join(fontmapp, "package.json"), JSON.stringify({ scripts: { check: "npm run lint && npm run check:fonts && npm test" } }));
  kravGront("adoption: check:fonts finns i check-kedjan är grönt", [adoptvakt, fontadoption]);
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

  /**
   * En kopia där NODSIDANS ingång är det som planteras.
   *
   * @param {string} namn @param {string} nodIndex @param {Record<string, string>} [extra]
   */
  const nodsidekopia = (namn, nodIndex, extra = {}) => {
    const mapp = path.join(arbetsmapp, namn);
    fs.mkdirSync(path.join(mapp, "src", "node"), { recursive: true });
    fs.mkdirSync(path.join(mapp, "src", "lib"), { recursive: true });
    fs.mkdirSync(path.join(mapp, "src", "components"), { recursive: true });
    fs.writeFileSync(path.join(mapp, "src", "node", "index.js"), nodIndex);
    fs.writeFileSync(path.join(mapp, "src", "node", "nagot.js"), "export const nagot = 1;\n");
    fs.writeFileSync(path.join(mapp, "src", "lib", "ren.js"), "export const ren = 1;\n");
    fs.writeFileSync(path.join(mapp, "src", "components", "Knapp.jsx"), 'import "react";\nexport const Knapp = 1;\n');
    fs.writeFileSync(path.join(mapp, "README.md"), "Dokumenterar nagot och ren.\n");
    for (const [rel, txt] of Object.entries(extra)) fs.writeFileSync(path.join(mapp, rel), txt);
    return mapp;
  };

  // ⛔ SIDOEFFEKTIMPORTEN ÄR DET FALL SOM FAKTISKT SLAPP IGENOM. Mönstret
  // matchade `from "x"` och `import("x")` men inte `import "x";`, alltså den form
  // man skriver när man vill åt en bieffekt och inte tänker på vad filen drar
  // med sig. Mätt: den planterade raden lämnade vakten grön.
  kravRott(
    "nodsida 5: sidoeffektimport av react i nodsidan",
    [nodvakt, nodsidekopia("n5", 'export { nagot } from "./nagot.js";\nimport "react";\n')],
    "drar in webben",
  );

  kravRott(
    "nodsida 6: nodsidan importerar en komponent",
    [nodvakt, nodsidekopia("n6", 'export { nagot } from "./nagot.js";\nimport { Knapp } from "../components/Knapp.jsx";\nexport const k = Knapp;\n')],
    "drar in webben",
  );

  // ⛔ TRANSITIVT, och det är det svåra fallet: nodsidan ser ren ut, och filen
  // den återexporterar ur drar in React. Exakt den kanten öppnades när
  // `createActivityLog` började återexporteras ur `src/lib/`.
  kravRott(
    "nodsida 7: webben kommer in via en mellanfil",
    [
      nodvakt,
      nodsidekopia("n7", 'export { nagot } from "./nagot.js";\nexport { ren } from "../lib/ren.js";\n', {
        "src/lib/ren.js": 'import "react";\nexport const ren = 1;\n',
      }),
    ],
    "drar in webben",
  );

  kravGront(
    "nodsida 8: en ren nodsida som återexporterar ur lib är grön",
    [nodvakt, nodsidekopia("n8", 'export { nagot } from "./nagot.js";\nexport { ren } from "../lib/ren.js";\n')],
  );

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
    "typsnitt 2: mallen slutar hämta Plus Jakarta Sans",
    [typsnittsvakt, "tokens/tokens.css", mallkopia("ty2", (s) => s.replace(/<link\s+rel="stylesheet"[\s\S]*?\/>/, ""))],
    'saknar <link rel="stylesheet"> för Plus Jakarta Sans',
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

// ── Typsnitt som paketeras (0.31.0): filen och licensen måste följa med ───────
{
  const typsnittsvakt = "scripts/check-fonts.mjs";
  const mallsokvag = "create-ops-app/template/index.html";
  /** En fristående kopia av tokenfilen och typsnittsmappen, så relativa sökvägar löser som i paketet. */
  const paket = (/** @type {string} */ namn) => {
    const mapp = path.join(arbetsmapp, namn);
    fs.mkdirSync(path.join(mapp, "tokens"), { recursive: true });
    fs.cpSync(path.join(rot, "fonts"), path.join(mapp, "fonts"), { recursive: true });
    fs.copyFileSync(tokenfil, path.join(mapp, "tokens", "tokens.css"));
    return mapp;
  };

  const ok = paket("font-ok");
  kravGront("typsnitt 4: ett självvärdat typsnitt med fil och licens är grönt", [typsnittsvakt, path.join(ok, "tokens", "tokens.css"), mallsokvag]);

  const utanLicens = paket("font-utan-licens");
  fs.rmSync(path.join(utanLicens, "fonts", "glacial-indifference", "LICENSE.txt"));
  kravRott("typsnitt 5: typsnittet saknar licensfil", [typsnittsvakt, path.join(utanLicens, "tokens", "tokens.css"), mallsokvag], "saknar licensfil");

  const utanFil = paket("font-utan-fil");
  fs.rmSync(path.join(utanFil, "fonts", "glacial-indifference", "glacial-indifference-400.woff2"));
  kravRott("typsnitt 6: @font-face pekar på en fil som saknas", [typsnittsvakt, path.join(utanFil, "tokens", "tokens.css"), mallsokvag], "finns inte");

  const utanRegel = paket("font-utan-regel");
  const tf = path.join(utanRegel, "tokens", "tokens.css");
  fs.writeFileSync(tf, fs.readFileSync(tf, "utf8").replace(/@font-face\s*\{[^}]*\}/, ""));
  kravRott("typsnitt 7 golv: ingen @font-face alls", [typsnittsvakt, tf, mallsokvag], "Väntat minst 1 regel");
}

// ── Diagramfärgvakten ───────────────────────────────────────────────────────
// ⛔ Den enda vakten i repot vars regel inte går att bedöma med ögat. En palett
// kan se utmärkt ut och ändå ha två serier som är identiska för var tjugonde
// man, så beviset för att den biter är särskilt viktigt: kan den inte bli röd
// är den bara ett påstående om att färgerna är mätta.
{
  const diagramvakt = "scripts/check-chart-colors.mjs";

  kravRott(
    "diagramfärger: två chart-toner som ingen kan skilja åt",
    [
      diagramvakt,
      // Slot 2 sätts nästan lika slot 1. Det är exakt felet identitetstonerna
      // hade: två grannar under normalseendets golv.
      tokenkopia("df1", (s) => s.replace("--color-chart-2: #eb6834;", "--color-chart-2: #2f7cd8;")),
    ],
    "chart, ljust läge",
  );

  kravRott(
    "diagramfärger: en chart-ton som läses som grått",
    [
      diagramvakt,
      tokenkopia("df2", (s) => s.replace("--color-chart-3: #1baf7a;", "--color-chart-3: #8a8a88;")),
    ],
    "chart, ljust läge",
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
      // Ett mörkt steg som är för mörkt mot #202420. Klarar sig mot vitt, alltså
      // fångas det bara av att båda lägena mäts var för sig.
      tokenkopia("df4", (s) => s.replace("--dark-chart-1: #3987e5;", "--dark-chart-1: #123a66;")),
    ],
    "chart, mörkt läge",
  );

  kravRott(
    "diagramfärger golv: inga tokens alls",
    [diagramvakt, tokenkopia("df5", (s) => s.replace(/--(color|dark)-chart-\d+: #[0-9a-f]{6};\n/g, ""))],
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

// ── Vakten över paketets form ──────────────────────────────────────────────
//
// ⛔ BARA STRUKTURDELEN PROVAS HÄR. Den tunga delen packar och installerar på
// riktigt och tar en halv minut; den körs som eget jobb i CI. Strukturdelen är
// den som fångar utgivningens klassiska fel, att `exports` pekar på en fil som
// inte ligger i `files`, och den går att plantera.
{
  const paketvakt = "scripts/check-paket.mjs";

  /** @param {string} namn @param {Record<string, unknown>} manifest @returns {string} */
  function paketrot(namn, manifest) {
    const mapp = path.join(arbetsmapp, `paket-${namn}`);
    fs.mkdirSync(path.join(mapp, "dist"), { recursive: true });
    fs.mkdirSync(path.join(mapp, "tokens"), { recursive: true });
    fs.writeFileSync(path.join(mapp, "tokens", "tokens.css"), ":root {}\n");
    fs.writeFileSync(path.join(mapp, "CHANGELOG.md"), `## ${manifest.version}\n\nNågot.\n`);
    fs.writeFileSync(path.join(mapp, "package.json"), JSON.stringify(manifest, null, 2));
    return mapp;
  }

  const HEL = {
    name: "ops-prov",
    version: "1.2.3",
    files: ["dist", "tokens"],
    exports: { ".": { types: "./dist/types/index.d.ts", default: "./dist/index.js" }, "./tokens.css": "./tokens/tokens.css" },
  };

  kravGront("paket 0: ett helt manifest är grönt", [paketvakt, paketrot("helt", HEL), "--struktur"]);

  // ⛔ Utgivningens klassiska fel: ingången finns i arbetskopian men inte i
  // tarbollen. Allt är grönt i repot och paketet är tomt hos den som installerar.
  kravRott(
    "paket 1: en ingång som inte täcks av files",
    [paketvakt, paketrot("otackt", { ...HEL, files: ["tokens"] }), "--struktur"],
    "inte täcks av \"files\"",
  );

  kravRott(
    "paket 2: en post i files som inte finns på disk",
    [paketvakt, paketrot("saknad", { ...HEL, files: ["dist", "tokens", "skills"] }), "--struktur"],
    "som inte finns",
  );

  kravRott(
    "paket 3: en version som inte är semver",
    [paketvakt, paketrot("version", { ...HEL, version: "0.17" }), "--struktur"],
    "inte semver",
  );

  kravRott(
    "paket 3b: ett scopat namn ger scopet i tarbollens filnamn",
    [paketvakt, paketrot("scope", { ...HEL, name: "@staiger/prov" }), "--struktur"],
    "har ett scope",
  );

  // ⛔ En utgivning utan anteckningar är en version ingen kan välja att hoppa
  // över. Taggen sätts långt efter att koden skrevs.
  {
    const mapp = paketrot("logg", HEL);
    fs.writeFileSync(path.join(mapp, "CHANGELOG.md"), "## 9.9.9\n\nFel version.\n");
    kravRott("paket 4: versionen saknar avsnitt i ändringsloggen", [paketvakt, mapp, "--struktur"], "ingen rubrik");
  }

  kravGront("paket 5: ramverkets eget manifest är grönt", [paketvakt, rot, "--struktur"]);
  kravRott("paket golv: fel sökväg", [paketvakt, path.join(arbetsmapp, "finns-inte"), "--struktur"], "finns inte");

  // ⛔ #159: SENTRY FÅR ALDRIG NÅ HUVUDBUNDLEN. Två sätt att bryta det, och
  // båda ska fällas: en import i källan, eller ordet i den byggda filen.
  {
    const mappA = paketrot("sentry-import", HEL);
    fs.mkdirSync(path.join(mappA, "src"), { recursive: true });
    fs.writeFileSync(path.join(mappA, "src", "index.js"), 'export { sentryMottagare } from "./sentry.js";\n');
    kravRott("paket: src/index.js importerar sentry.js", [paketvakt, mappA, "--struktur"], "importerar ./sentry.js");
  }

  {
    const mappB = paketrot("sentry-bundlad", HEL);
    fs.writeFileSync(path.join(mappB, "dist", "index.js"), '// @sentry/browser råkade hamna här\n');
    kravRott("paket: dist/index.js nämner sentry", [paketvakt, mappB, "--struktur"], 'nämner "sentry"');
  }
}

/*
 * ⛔ KOPIORNA LIGGER UTANFÖR `node_modules`, OCH DET ÄR ETT MÄTFYND. tsc vägrar
 * typkontrollera JS därifrån och svarar TS7016, alltså rött av fel anledning.
 * Mappen delas av kontrast-, gruppnyckel- och gruppfrågeproven.
 */
const gruppmapp = fs.mkdtempSync(path.join(rot, ".ops-vaktprov-"));

// ── Exempelmodulen: README och exemplet säger samma sak (#131) ───────────
//
// ⛔ VAKTEN HÅLLER TVÅ DOKUMENT I TAKT, och kan bara bevisas genom att ta bort
// ett fält ur vart och ett av dem. Den läser fältlistorna ur källan, alltså är
// den inte en tredje sanning som själv kan glida isär.
{
  const exempelvakt = path.join(rot, "scripts", "check-exempelmodul.mjs");

  /** @param {string} namn @param {(fil: string, text: string) => string} mutera @param {string} fil */
  const kopia = (namn, fil, mutera) => {
    const mapp = path.join(gruppmapp, namn);
    fs.mkdirSync(path.join(mapp, "src", "lib"), { recursive: true });
    fs.mkdirSync(path.join(mapp, "examples", "paminnelser"), { recursive: true });
    fs.copyFileSync(path.join(rot, "src", "lib", "modul.js"), path.join(mapp, "src", "lib", "modul.js"));
    fs.copyFileSync(path.join(rot, "README.md"), path.join(mapp, "README.md"));
    for (const f of fs.readdirSync(path.join(rot, "examples", "paminnelser"))) {
      fs.copyFileSync(path.join(rot, "examples", "paminnelser", f), path.join(mapp, "examples", "paminnelser", f));
    }
    for (const f of Array.isArray(fil) ? fil : [fil]) {
      const mal = path.join(mapp, f);
      fs.writeFileSync(mal, mutera(f, fs.readFileSync(mal, "utf8")));
    }
    return mapp;
  };

  kravGront("exempelmodul: README och exemplet är i takt", [exempelvakt]);

  kravRott(
    "exempelmodul: en källtyp saknas i exemplet",
    [exempelvakt, kopia("ex1", "examples/paminnelser/index.js", (_f, t) => t.replace(/    notiser: async[\s\S]*?\.map\(\(r\) => \(\{ id: r\.id[\s\S]*?\}\)\),\n/, ""))],
    "inte i exempelmodulen",
  );

  /*
   * ⛔ FÖRSTA MUTATIONEN HÄR VAR FÖR SVAG, och svepet visade det. Den bytte
   * `kallor` mot `kaellor` i EN tabellrad, men ordet står kvar i kodexemplet i
   * samma avsnitt, så vakten förblev grön. En vakt som letar efter en
   * förekomst bevisas bara av att ta bort ALLA.
   */
  kravRott(
    "exempelmodul: ett samlingsfält saknas i README-avsnittet",
    [exempelvakt, kopia("ex2", "README.md", (_f, t) => t.split("agareKravsForSkrivning").join("agareKrav"))],
    "inte i README-avsnittet",
  );

  kravRott(
    "exempelmodul: rubriken Modulkontraktet omdöpt",
    [exempelvakt, kopia("ex3", "README.md", (_f, t) => t.replace("### Modulkontraktet", "### Moduler"))],
    "saknar rubriken",
  );

  /*
   * ⛔ IMPORTVÄGARNA, OCH DE ÄR ETT GRANSKNINGSFYND PÅ #151. Exemplet
   * importerade `../../src/lib/modul.js`, alltså ramverkets innanmäte, medan
   * README säger import från paketnamnet. En modulbyggare som kopierade
   * mappen fick sökvägar som inte finns i en installerad tarboll.
   *
   * ⛔ OCH DEN GAMLA VAKTEN KUNDE INTE SE DET: den jämför fältnamn, och
   * importvägar är inte fältnamn. Avvikelsen var osynlig genom varje grön
   * körning i hela #131.
   */
  kravRott(
    "exempelmodul: en import ut ur exempelmappen",
    [
      exempelvakt,
      kopia("ex4", "examples/paminnelser/index.js", (_f, t) =>
        t.replace('import { defineModule, byggKategori } from "ops-framework";', 'import { defineModule } from "../../src/lib/modul.js";\nimport { byggKategori } from "../../src/lib/katalog.js";'),
      ),
    ],
    "utanför sin egen mapp",
  );

  /*
   * ⛔ OCH MOTSATSEN, som är lika viktig: en relativ import INOM mappen ska
   * INTE fällas. Det är så en kopierad mapp hänger ihop, och en vakt som
   * förbjöd även den hade tvingat fram en modul i en enda fil.
   */
  kravGront("exempelmodul: en relativ import inom mappen är tillåten", [
    exempelvakt,
    kopia("ex5", "examples/paminnelser/index.js", (_f, t) => t.replace('import { lazy } from "react";', 'import { lazy } from "react";\nimport "./PaminnelserVy.jsx";')),
  ]);

  kravRott(
    "exempelmodul golv: importmönstret matchar ingenting",
    // ⛔ HELA MAPPEN, INTE BARA index.js: med tilläggets fil (0.60.0) räckte de andra filernas importer till golvet, och provet
    // blev grönt fast mönstret i index.js inte matchade något.
    [exempelvakt, kopia("ex6", fs.readdirSync(path.join(rot, "examples", "paminnelser")).map((f) => `examples/paminnelser/${f}`), (_f, t) => t.split("import").join("importera"))],
    "golvet är 4",
  );

  // ⛔ GOLVET: läser vakten noll fält ur källan står den grön mot två dokument
  // den aldrig jämfört.
  kravRott(
    "exempelmodul golv: fältlistorna går inte att läsa ur källan",
    [exempelvakt, kopia("ex4", "src/lib/modul.js", (_f, t) => t.replace(/const MODULFALT = \[[^\]]*\]/, "const MODULFALT = []"))],
    "mäter vakten ingenting",
  );

  kravRott("exempelmodul golv: fel sökväg", [exempelvakt, path.join(gruppmapp, "finns-inte")], "hittar inte");
}

// ── Regelgeneratorn: mönstret ändras inte i tysthet (#130) ────────────────
//
// ⛔ VAKTEN JÄMFÖR MOT FÖRRA UTFALLET, INTE MOT EN HANDSKRIVEN KOPIA. En
// gyllene fil kan inte glida isär, eftersom varje avvikelse är precis det den
// larmar på. Att mönstret är RÄTT bevisas av emulatorproven, inte av den här.
{
  const genvakt = path.join(rot, "scripts", "check-regelgenerator.mjs");
  const gyllene = path.join(rot, "rules", "__fixturer__", "genererad.rules");
  const original = fs.readFileSync(gyllene, "utf8");

  /** @param {string} mutation @param {string} vantat */
  const medÄndradFil = (mutation, vantat, namn) => {
    fs.writeFileSync(gyllene, mutation);
    kravRott(namn, [genvakt], vantat);
    fs.writeFileSync(gyllene, original);
  };

  kravGront("regelgenerator: den riktiga fixturen ger den gyllene filen", [genvakt]);

  // ⛔ Det fall som faktiskt oroar: någon lossar på ett skrivvillkor och
  // ingenting annat i filen ändras.
  medÄndradFil(
    original.replace("allow create: if opsArAgare(", "allow create: if opsArMedlem("),
    "generatorn ger inte längre samma text",
    "regelgenerator: ett skrivvillkor lossat i den gyllene filen",
  );

  medÄndradFil(
    original.replace(/\n *&& request\.resource\.data\.keys\(\)\.hasOnly\(\[[^\]]*\]\)/, ""),
    "generatorn ger inte längre samma text",
    "regelgenerator: formvalideringen borta ur den gyllene filen",
  );

  medÄndradFil(
    original.replace("    match /{document=**} {\n      allow read, write: if false;\n    }\n", ""),
    "generatorn ger inte längre samma text",
    "regelgenerator: catch-allen borta ur den gyllene filen",
  );

  // ⛔ RADERINGEN, OCH DEN ÄR ETT GRANSKNINGSFYND PÅ #151. Generatorn skrev
  // `allow delete: if opsArMedlem(...)`, alltså att en medlem fick radera,
  // medan #136 säger arkivering och aldrig radering och ramverkets egna
  // samlingar redan har `delete: if false`. Generatorn hade infört den enda
  // raderingsvägen i hela modellen, som ett förval ingen valt.
  //
  // Det här fallet är rött om `delete` blir något ANNAT än `false`, oavsett
  // vilket villkor som skrivs dit. Ett fall som bara letade efter det gamla
  // uttrycket hade varit grönt för varje nytt sätt att öppna raderingen.
  medÄndradFil(
    original.replace("allow delete: if false;", "allow delete: if opsArAgare(resource.data.groupId);"),
    "generatorn ger inte längre samma text",
    "regelgenerator: raderingen öppnad i den gyllene filen",
  );

  {
    // ⛔ GOLVET: en gyllene fil som saknas ska inte vara ett godkänt utfall.
    fs.rmSync(gyllene);
    kravRott("regelgenerator golv: den gyllene filen saknas", [genvakt], "saknas");
    fs.writeFileSync(gyllene, original);
  }
}

// ── Kontrasten: AA i båda teman (#132) ────────────────────────────────────
//
// ⛔ VAKTEN HADE INGET BEVIS FÖRRÄN NU, och den är en av de två CP räknade upp
// 2026-09-27. Den hade stått grön genom hela det fel den skulle fånga om
// mätningen slutat mäta, och ingen hade sett skillnaden utifrån.
{
  const kontrastvakt = path.join(rot, "scripts", "check-kontrast.mjs");
  const tokenkalla = fs.readFileSync(path.join(rot, "tokens", "tokens.css"), "utf8");

  /** @param {string} namn @param {(css: string) => string} mutera */
  const tokenkopia = (namn, mutera) => {
    const fil = path.join(arbetsmapp, `${namn}.css`);
    fs.writeFileSync(fil, mutera(tokenkalla));
    return fil;
  };

  kravGront("kontrast: de riktiga tokens håller AA", [kontrastvakt]);

  // ⛔ Exakt det fel som fanns på riktigt: brödtext i sidans egen bottenfärg.
  kravRott(
    "kontrast: brödtexten sänks till bakgrundens färg",
    [kontrastvakt, tokenkopia("k1", (css) => css.replace(/--color-ink:\s*#[0-9a-fA-F]{3,8}/, "--color-ink: #f8f7f4"))],
    "ger",
  );

  kravRott(
    "kontrast: accentens kontrastfärg tillbaka till den gamla",
    [kontrastvakt, tokenkopia("k2", (css) => css.replace(/--color-accent-contrast:\s*#[0-9a-fA-F]{3,8}/, "--color-accent-contrast: #f8f7f4"))],
    "Kravet är",
  );

  // ⛔ GOLVET, och det är den viktigaste av de tre: en tokenfil utan paren ger
  // noll brott, alltså grönt av att ingenting mättes.
  kravRott("kontrast golv: tokens utan paren", [kontrastvakt, tokenkopia("k3", () => ":root { --color-ink: #000; }\n")], "gick att mäta");

  kravRott("kontrast golv: fel sökväg", [kontrastvakt, path.join(arbetsmapp, "finns-inte.css")], "hittar inte");
}

// ── Gruppnyckeln: exakt en per rad (#136) ─────────────────────────────────
//
// ⛔ DEN ANDRA VAKTEN UTAN BEVIS. Den vaktar det som inte går att eftermontera,
// alltså är den den sista som borde ha stått oprövad.
{
  const nyckelvakt = path.join(rot, "scripts", "check-gruppnyckel.mjs");

  /** @param {string} namn @param {(kalla: string) => string} mutera @param {string} [fil] */
  const libkopia = (namn, mutera, fil = "grupp.js") => {
    const mapp = path.join(gruppmapp, namn);
    fs.cpSync(path.join(rot, "src"), path.join(mapp, "src"), { recursive: true });
    const mal = path.join(mapp, "src", "lib", fil);
    fs.writeFileSync(mal, mutera(fs.readFileSync(mal, "utf8")));
    return path.join(mapp, "src");
  };

  kravGront("gruppnyckel: det riktiga källträdet bär en gruppnyckel", [nyckelvakt]);

  // ⛔ SessionStudios fält, planterat i en fältlista.
  kravRott(
    "gruppnyckel: invitedGroupIds i en fältlista",
    [nyckelvakt, libkopia("gn1", (k) => k.replace('"groupId", "roll", "typ", "status"', '"groupId", "invitedGroupIds", "roll", "typ", "status"'))],
    "EXAKT en grupp",
  );

  // ⛔ Och samma hål från regelhållet: formen kan vara rätt medan regeln ändå
  // frågar "är du med i någon av de här".
  kravRott(
    "gruppnyckel: array-contains i regeltexten",
    [nyckelvakt, libkopia("gn2", (k) => k.replace("function opsArMedlem(", "function opsArMedlemLista(gid) { return resource.data.grupper.hasAny([gid]); }\n    // array-contains\n    function opsArMedlem("), "regler.js")],
    "array-contains",
  );

  // ⛔ NÄRVAROGOLVET: en regeltext utan uppslag släpper igenom allt, och
  // frånvarohalvan av vakten är nöjd med det.
  kravRott(
    "gruppnyckel golv: regeln slutar slå upp medlemskapet",
    [nyckelvakt, libkopia("gn3", (k) => k.replace(/opsArMedlem/g, "opsNagon"), "regler.js")],
    "mäter resten av vakten ingenting",
  );

  // ⛔ #156: hasOnly ÄR HÄRLEDD UR ANVANDARFALT (regler.js importerar den ur
  // grupp.js), så en ändring av ANVANDARFALT ensam kan inte längre få dem
  // att glida isär. Det som KAN hända är att någon skriver om härledningen
  // till en handskriven lista igen och glömmer ett fält, precis som en ren
  // kopia hade gjort. Provet simulerar det: den härledda raden i regler.js
  // ersätts med en hårdkodad, ofullständig lista.
  kravRott(
    "gruppnyckel: users-regelns hasOnly hårdkodad och ofullständig",
    [
      nyckelvakt,
      libkopia(
        "gn4",
        (k) =>
          k.replace(
            'request.resource.data.keys().hasOnly([${ANVANDARFALT.map((f) => `"${f}"`).join(", ")}])',
            'request.resource.data.keys().hasOnly(["id", "namn", "epost", "bild", "sprak", "tema", "telefon", "stad", "presentation", "lankar"])',
          ),
        "regler.js",
      ),
    ],
    'saknar fältet "bildSokvag"',
  );

  kravRott("gruppnyckel golv: fel sökväg", [nyckelvakt, path.join(gruppmapp, "finns-inte")], "hittar inte");

  // ⛔ #162, cllp/bolag-ops#447: KATEGORIFALT SAKNADE groupId HELT, alltså
  // NOLL träffar för steg 1 (som bara fäller fel FORM) att fälla. Steg 4
  // (KATEGORIFALT bär groupId) finns för att fånga just det: en lista som
  // saknar fältet, inte en som har det i fel form.
  kravRott(
    "gruppnyckel: KATEGORIFALT saknar groupId helt",
    [
      nyckelvakt,
      libkopia(
        "gn5",
        (k) => k.replace('"id", "namn", "farg", "ikon", "fas", "ordning", "arkiverad", "texter", "groupId"', '"id", "namn", "farg", "ikon", "fas", "ordning", "arkiverad", "texter"'),
        "katalog.js",
      ),
    ],
    "KATEGORIFALT saknar",
  );

  // ⛔ 0.33.0: FÖRVALET ÄR DET SOM GÖR groupId OBLIGATORISKT. Planterat: förvalet tillbaka till 0.32.1:s
  // `grupp = false`. KATEGORIFALT bär fortfarande groupId, alltså är steg 4 grönt, och bara beteendet fäller.
  kravRott(
    "gruppnyckel: en kategori utan groupId byggs med förvalet (grupp = false)",
    [nyckelvakt, libkopia("gn6", (k) => k.replace("farger = true, grupp = true } = {}) {", "farger = true, grupp = false } = {}) {"), "katalog.js")],
    "byggKategori byggde en kategori utan groupId",
  );

  // ⛔ 0.33.0: nyckellåset i katalogregeln borttaget.
  kravRott(
    "gruppnyckel: katalogregelns nyckellås borta",
    [nyckelvakt, libkopia("gn7", (k) => k.replace("const nyckelrad = config.nyckelMedGrupp", "const nyckelrad = false && config.nyckelMedGrupp"), "regler.js")],
    "låser inte dokumentnyckeln",
  );

  // ⛔ 0.33.0: 0.29.0:s `groupId: null` tillbaka i katalogkällan (kravet borttaget).
  kravRott(
    "gruppnyckel: katalogkällan byggs utan grupp",
    [nyckelvakt, libkopia("gn8", (k) => k.replace("  if (!groupId) {\n    throw new Error(\n      \"createCatalogSource: groupId krävs.", "  if (false) {\n    throw new Error(\n      \"createCatalogSource: groupId krävs."), path.join("..", "data", "katalogkalla.js"))],
    "createCatalogSource gick att bygga",
  );
}

// ── Gruppfrågan: groupId är ett KRAV i typen, inte en konvention (#139) ────
//
// ⛔ VAKTEN BEVISAS MOT EN KOPIA AV HELA `src`, inte mot en lös fil. Kopieras
// bara `gruppkalla.js` någon annanstans faller tsc på att `./contract.js` inte
// finns, och det felet är också rött. En vakt som blir röd av en trasig import
// har slutat mäta det den påstår sig mäta, och det syns inte utifrån.
{
  const gruppvakt = path.join(rot, "scripts", "check-gruppfraga.mjs");

  /** @param {string} namn @param {(kalla: string) => string} mutera */
  const kopieradKalla = (namn, mutera) => {
    const mapp = path.join(gruppmapp, namn);
    fs.cpSync(path.join(rot, "src"), path.join(mapp, "src"), { recursive: true });
    const fil = path.join(mapp, "src", "data", "gruppkalla.js");
    fs.writeFileSync(fil, mutera(fs.readFileSync(fil, "utf8")));
    return fil;
  };

  kravGront("gruppfraga: den riktiga källan kräver groupId", [gruppvakt]);

  kravRott(
    "gruppfraga: groupId gjord valfri i GruppFraga",
    [gruppvakt, kopieradKalla("gf1", (k) => k.replace("@property {string} groupId", "@property {string} [groupId]"))],
    "SLÄPPTE IGENOM",
  );

  kravRott(
    "gruppfraga: groupId gjord valfri i gruppSkapas data",
    [
      gruppvakt,
      kopieradKalla("gf2", (k) =>
        k
          .replace("@property {string} groupId", "@property {string} [groupId]")
          .replace("@param {Partial<T> & { groupId: string }} data", "@param {Partial<T> & { groupId?: string }} data"),
      ),
    ],
    "SLÄPPTE IGENOM",
  );

  kravRott("gruppfraga golv: fel sökväg", [gruppvakt, path.join(gruppmapp, "finns-inte.js")], "hittar inte");

  fs.rmSync(gruppmapp, { recursive: true, force: true });
}

// ── Vakten mot handritade ikoner (#164) ─────────────────────────────────────
//
// ⛔ VAKTEN SJÄLV LÅG UTAN PROV I DET FÖRRA PASSET. Den skrevs, verifierades
// för hand mot en tillfällig kopia, och lades i `check`-kedjan, men aldrig in
// här. En vakt som ingen sett faila i DET HÄR harnesset är, med samma ord som
// filhuvudet ovan, en förhoppning och inte en vakt: nästa ändring av regexen
// eller undantagslistan kan tysta den utan att något upptäcker det.
{
  const ikonvakt = "scripts/check-handritade-ikoner.mjs";
  const ikonmapp = path.join(arbetsmapp, "ikoner");

  // Grönt mot den riktiga komponentkatalogen: den ska INTE bli röd av sig
  // själv, annars är vakten obrukbar från dag ett.
  kravGront("handritade ikoner: den riktiga src/components är grön", [ikonvakt, path.join(rot, "src", "components")]);

  // Rött: en kopia av den rensade katalogen med EN injicerad handritad ikon i
  // en fil som inte står i undantagslistan.
  fs.cpSync(path.join(rot, "src", "components"), path.join(ikonmapp, "smutsig"), { recursive: true });
  fs.writeFileSync(
    path.join(ikonmapp, "smutsig", "OpsProvikon.jsx"),
    'export function OpsProvikon() {\n  return <svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z" /></svg>;\n}\n',
  );
  kravRott("handritade ikoner: en injicerad svg utanför icons.jsx", [ikonvakt, path.join(ikonmapp, "smutsig")], "handritad");

  // Golv: en katalog som finns men är för liten (t.ex. en trasig sökväg som
  // råkar peka på en mapp) ska inte tolkas som "inga fynd, alltså klart".
  const tunnmapp = path.join(ikonmapp, "tunn");
  fs.mkdirSync(tunnmapp, { recursive: true });
  fs.writeFileSync(path.join(tunnmapp, "Ensam.jsx"), "export function Ensam() { return null; }\n");
  kravRott("handritade ikoner golv: för få filer lästa", [ikonvakt, tunnmapp], "väntat fler än");

  kravRott("handritade ikoner golv: fel sökväg", [ikonvakt, path.join(ikonmapp, "finns-inte")], "finns inte");
}

// ── Vakten mot egna storlekar och typsnitt (#173) ───────────────────────────
//
// ⛔ Samma skäl som ikonvakten ovan: en vakt ingen sett faila är en förhoppning.
// Tre fall som skulle tysta den i det tysta: regexen slutar matcha `text-[Npx]`,
// kommentarsstrippen börjar svälja kod, eller golvet försvinner så att en tom
// katalog blir grön.
{
  const typvakt = "scripts/check-typografi.mjs";
  const typmapp = path.join(arbetsmapp, "typografi");

  kravGront("typografi: den riktiga src/components är grön", [typvakt]);

  fs.cpSync(path.join(rot, "src", "components"), path.join(typmapp, "smutsig"), { recursive: true });
  fs.writeFileSync(
    path.join(typmapp, "smutsig", "OpsProvstorlek.jsx"),
    'export function OpsProvstorlek() {\n  return <span className="text-[13px] text-ink">x</span>;\n}\n',
  );
  kravRott("typografi: en injicerad text-[13px]", [typvakt, path.join(typmapp, "smutsig"), "--golv=60"], "literal storlek");

  fs.writeFileSync(
    path.join(typmapp, "smutsig", "OpsProvstorlek.jsx"),
    'export const s = { fontSize: 1 };\nexport const c = ".x { font-family: serif; }";\n',
  );
  kravRott("typografi: en injicerad font-family", [typvakt, path.join(typmapp, "smutsig"), "--golv=60"], "font-family");

  // Grönt: en kommentar som citerar det gamla värdet är inte ett brott.
  fs.writeFileSync(
    path.join(typmapp, "smutsig", "OpsProvstorlek.jsx"),
    '/** Förr `text-[13px]`, nu en roll. */\nexport function OpsProvstorlek() {\n  return <span className="text-liten text-[var(--x)]">x</span>;\n}\n',
  );
  kravGront("typografi: en kommentar och text-[var(--x)] är inga brott", [typvakt, path.join(typmapp, "smutsig"), "--golv=60"]);

  // 0.31.2: ramverkets regel att ingen komponent skriver en Tailwind-storlek (text-xs/sm/base/md/lg/xl), bara en roll.
  fs.writeFileSync(
    path.join(typmapp, "smutsig", "OpsProvstorlek.jsx"),
    'export function OpsProvstorlek() {\n  return <span className="md:text-sm text-ink">x</span>;\n}\n',
  );
  kravRott("typografi: en injicerad text-sm i ramverksläge", [typvakt, path.join(typmapp, "smutsig"), "--golv=60", "--ramverksregler"], "Tailwind-storlek");
  kravGront("typografi: samma text-sm är inget brott i en app (utan --ramverksregler)", [typvakt, path.join(typmapp, "smutsig"), "--golv=60"]);
  fs.writeFileSync(
    path.join(typmapp, "smutsig", "OpsProvstorlek.jsx"),
    'export function OpsProvstorlek() {\n  return <span className="text-etikett md:text-meta text-ink">x</span>;\n}\n',
  );
  kravGront("typografi: en roll är ingen Tailwind-storlek, också i ramverksläge", [typvakt, path.join(typmapp, "smutsig"), "--golv=60", "--ramverksregler"]);

  const tunn = path.join(typmapp, "tunn");
  fs.mkdirSync(tunn, { recursive: true });
  fs.writeFileSync(path.join(tunn, "Ensam.jsx"), "export function Ensam() { return null; }\n");
  kravRott("typografi golv: för få filer lästa", [typvakt, tunn], "väntat minst");
  kravRott("typografi golv: fel sökväg", [typvakt, path.join(typmapp, "finns-inte")], "finns inte");
}

// ── Utvecklarord i användartext (0.69.0, #274) ─────────────────────────────
//
// ⛔ Det planterade fallet är CP:s skärmbild, ordagrant: en banderoll som säger att slagen inte är seedade och att samlingen är tom.
// Grönt: samma ord i en kommentar, i ett felmeddelande och i en jämförelse med en konstant, för de är skrivna för en utvecklare.
{
  const ordvakt = "scripts/check-utvecklarord.mjs";
  const ordmapp = path.join(arbetsmapp, "utvecklarord");

  kravGront("utvecklarord: ramverkets riktiga src är grön", [ordvakt]);

  fs.cpSync(path.join(rot, "src", "components"), path.join(ordmapp, "smutsig"), { recursive: true });
  const prov = path.join(ordmapp, "smutsig", "OpsProvbanderoll.jsx");
  fs.writeFileSync(prov, 'export function OpsProvbanderoll() {\n  return <OpsBanner tone="info" title="Slagen är inte seedade än">Inget att visa.</OpsBanner>;\n}\n');
  kravRott("utvecklarord: \"seedade\" i en banderolls title", [ordvakt, path.join(ordmapp, "smutsig")], '"seedade"');
  fs.writeFileSync(prov, "export function OpsProvbanderoll() {\n  return <p>Samlingen är tom, så appen ritar repots standardvärden.</p>;\n}\n");
  kravRott("utvecklarord: \"Samlingen\" i JSX-text", [ordvakt, path.join(ordmapp, "smutsig")], '"Samlingen"');
  fs.writeFileSync(prov, "export const TEXTER = { hjalpText: \"Står i koden (SLAGBETEENDEN).\" };\n");
  kravRott("utvecklarord: ett kodnamn i versaler i en texttabell", [ordvakt, path.join(ordmapp, "smutsig")], '"SLAGBETEENDEN"');
  fs.writeFileSync(prov, "export function OpsProvbanderoll({ fel }) {\n  return <OpsBanner title={`${fel} kräver en driftsättning`} />;\n}\n");
  kravRott("utvecklarord: \"driftsättning\" i en mall", [ordvakt, path.join(ordmapp, "smutsig")], '"driftsättning"');

  // ⛔ Granskningen av PR 278 fann två hål som var gröna: `hint` lästes inte, och ordböckernas `sv:`/`en:` lästes inte.
  fs.writeFileSync(prov, 'export function OpsProvbanderoll() {\n  return <OpsField hint="Slagen är inte seedade än" />;\n}\n');
  kravRott("utvecklarord: \"seedade\" i en hint", [ordvakt, path.join(ordmapp, "smutsig")], '"seedade"');
  fs.writeFileSync(prov, 'export const ORD_H = { rubrik: { sv: "Samlingen är tom", en: "Empty" } };\n');
  kravRott("utvecklarord: \"Samlingen\" i en ordboks sv:", [ordvakt, path.join(ordmapp, "smutsig")], '"Samlingen"');
  fs.writeFileSync(prov, 'export function OpsProvbanderoll() {\n  return <p>{"Kör seedningen först"}</p>;\n}\n');
  kravRott("utvecklarord: \"seedningen\" som ensam sträng i JSX", [ordvakt, path.join(ordmapp, "smutsig")], '"seedningen"');
  fs.writeFileSync(prov, 'export function OpsProvbanderoll({ tom }) {\n  return <OpsBanner title={tom ? "Samlingens slag saknas" : "Allt finns"} />;\n}\n');
  kravRott("utvecklarord: \"Samlingens\" i en ternär i ett attribut", [ordvakt, path.join(ordmapp, "smutsig")], '"Samlingens"');
  fs.writeFileSync(prov, 'export function OpsProvbanderoll({ tom }) {\n  return <p>{tom ? "Inga samlingar ännu" : "Klart"}</p>;\n}\n');
  kravRott("utvecklarord: \"samlingar\" i en ternär som barn", [ordvakt, path.join(ordmapp, "smutsig")], '"samlingar"');

  fs.writeFileSync(
    prov,
    [
      "/** Före seedningen är samlingen tom och repots standardvärden ritas (SLAGBETEENDEN). */",
      "export function OpsProvbanderoll({ text }) {",
      '  if (!text) throw new Error("OpsProvbanderoll: samlingen saknas, kör seedningen.");',
      "  if (text.length > MAX_TEXT) return null;",
      "  return <p>Allt är som det ska.</p>;",
      "}",
      "",
    ].join("\n"),
  );
  kravGront("utvecklarord: en kommentar, ett felmeddelande och en jämförelse är inga brott", [ordvakt, path.join(ordmapp, "smutsig")]);

  const tunn = path.join(ordmapp, "tunn");
  fs.mkdirSync(tunn, { recursive: true });
  fs.writeFileSync(path.join(tunn, "Ensam.jsx"), "export function Ensam() { return <p>Hej</p>; }\n");
  kravRott("utvecklarord golv: för få filer lästa", [ordvakt, tunn], "väntat minst");
  kravRott("utvecklarord golv: fel sökväg", [ordvakt, path.join(ordmapp, "finns-inte")], "finns inte");
  const tyst = path.join(ordmapp, "tyst");
  fs.mkdirSync(tyst, { recursive: true });
  for (let i = 0; i < 6; i++) fs.writeFileSync(path.join(tyst, `Tom${i}.js`), `export const x${i} = ${i};\n`);
  kravRott("utvecklarord golv: filer lästa men inga användartexter", [ordvakt, tyst], "användartexter hittades");
  kravRott("utvecklarord golv: ett golv som inte är ett tal", [ordvakt, "--golv=abc"], "inte ett heltal");

  // ⛔ GOLV PER MÖNSTER. Varje mönster stängs av i en kopia av vakten (det matchar aldrig), och ramverkets körning ska då bli
  // röd på just det mönstret.
  //
  // ⛔ KOPIAN LIGGER I EN TEMPORÄR KATALOG, INTE I scripts/ (0.70.1, granskningen av PR 278). I scripts/ stod den kvar om körningen
  // avbröts mellan skrivningen och `finally`, och då låg en vakt med ett avstängt mönster bredvid den riktiga. Kopian får i stället
  // sin import och sin rot omskrivna till absoluta sökvägar, och varje omskrivning kontrolleras, så att en ändrad rad i vakten ger
  // ett fel här och inte en kopia som tyst läser fel katalog.
  const ordkalla = fs.readFileSync(path.join(rot, ordvakt), "utf8");
  const kopiemapp = fs.mkdtempSync(path.join(os.tmpdir(), "ops-utvecklarord-"));
  const ordkopia = path.join(kopiemapp, "_prov-utvecklarord-avstangt.mjs");
  /** @param {string} kalla @param {string | RegExp} fran @param {string} till */
  const skrivOm = (kalla, fran, till) => {
    const ut = kalla.replace(fran, till);
    if (ut === kalla) throw new Error(`test-guards: ${String(fran)} hittades inte i ${ordvakt}, så kopian kan inte flyttas ut ur scripts/`);
    return ut;
  };
  let flyttbar = skrivOm(ordkalla, `from "./lib/kallkod.mjs"`, `from ${JSON.stringify(pathToFileURL(path.join(rot, "scripts", "lib", "kallkod.mjs")).href)}`);
  flyttbar = skrivOm(flyttbar, /^const rot = .*$/m, `const rot = ${JSON.stringify(rot)};`);
  try {
    // Kopian utan avstängt mönster är grön: annars hade de röda utfallen nedan kunnat bero på flytten och inte på mönstret.
    fs.writeFileSync(ordkopia, flyttbar);
    kravGront("utvecklarord: kopian i en temporär katalog är grön med alla mönster", [ordkopia]);
    for (const namn of ["attribut", "ordbok", "ternar", "barn", "jsxtext"]) {
      const avstangd = flyttbar.replace(new RegExp(`(namn: "${namn}",[\\s\\S]*?\\n    re: )[^\\n]*`), "$1/(?!)/g,");
      if (avstangd === flyttbar) throw new Error(`test-guards: mönstret ${namn} hittades inte i ${ordvakt}`);
      fs.writeFileSync(ordkopia, avstangd);
      kravRott(`utvecklarord golv: mönstret "${namn}" avstängt`, [ordkopia], `Mönstret "${namn}"`);
      if (namn === "barn") {
        // Det planterade {"..."}-fallet fångas BARA av barnmönstret: med det avstängt är samma fil grön.
        fs.writeFileSync(prov, 'export function OpsProvbanderoll() {\n  return <p>{"Kör seedningen först"}</p>;\n}\n');
        kravGront("utvecklarord: {\"...\"}-fallet släpps igenom utan barnmönstret", [ordkopia, path.join(ordmapp, "smutsig")]);
      }
    }
  } finally {
    fs.rmSync(kopiemapp, { recursive: true, force: true });
  }
}

// ── Gruppkulör (0.65.0, #265): kontrasten för alla 360 kulörer, i båda lägena ──
{
  const fargvakt = path.join(rot, "scripts", "check-gruppfarg.mjs");
  const fargmapp = path.join(arbetsmapp, "gruppfarg");
  fs.mkdirSync(fargmapp, { recursive: true });
  /** @param {string} namn @param {(css: string) => string} f */
  const fargfil = (namn, f) => {
    const ut = path.join(fargmapp, `${namn}.css`);
    fs.writeFileSync(ut, f(original));
    return ut;
  };
  kravGront("gruppfärg: tokens.css som den står", [fargvakt, tokenfil]);
  kravRott("gruppfärg: ljus ikon för nära plattan (L 0,62)", [fargvakt, fargfil("ljus", (c) => c.replace("--gruppmarke-ikon-l: 0.47;", "--gruppmarke-ikon-l: 0.62;"))], "ikonen mot plattan");
  kravRott("gruppfärg: mörk platta för ljus (L 0,6)", [fargvakt, fargfil("mork", (c) => c.replace("--dark-gruppmarke-platta-l: 0.33;", "--dark-gruppmarke-platta-l: 0.6;"))], "morkt, kulör");
  kravRott("gruppfärg golv: mättnad 0, alla kulörer gråa", [fargvakt, fargfil("gra", (c) => c.replace("--gruppmarke-ikon-c: 0.13;", "--gruppmarke-ikon-c: 0;"))], "olika ikonfärger");
  kravRott("gruppfärg golv: talen saknas", [fargvakt, fargfil("tom", (c) => c.replace(/--gruppmarke-ikon-l: [^;]+;/, ""))], "saknas i");
}

// ── Märket utan React (0.70.0, lifehub.identity#27): `ops-framework/gruppmarke` når aldrig ett paket ──
//
// ⛔ Kopian är det RIKTIGA trädet (src/gruppmarke, src/lib och README), så att den gröna kontrollen bevisar att vakten
// släpper igenom ingången som den står, och varje röd att ett enda planterat steg räcker.
{
  const markevakt = "scripts/check-gruppmarke.mjs";
  /** @param {string} namn @param {(rot: string) => void} [plantera] */
  const markekopia = (namn, plantera) => {
    const mapp = path.join(arbetsmapp, namn);
    fs.cpSync(path.join(rot, "src", "gruppmarke"), path.join(mapp, "src", "gruppmarke"), { recursive: true });
    fs.cpSync(path.join(rot, "src", "lib"), path.join(mapp, "src", "lib"), { recursive: true });
    fs.copyFileSync(path.join(rot, "README.md"), path.join(mapp, "README.md"));
    plantera?.(mapp);
    return mapp;
  };
  /** @param {string} mapp @param {string} rel @param {(t: string) => string} f */
  const andra = (mapp, rel, f) => {
    const fil = path.join(mapp, rel);
    const fore = fs.readFileSync(fil, "utf8");
    const efter = f(fore);
    if (efter === fore) throw new Error(`test-guards: mutationen i ${rel} ändrade ingenting.`);
    fs.writeFileSync(fil, efter);
  };
  kravGront("gruppmärke: ingången som den står", [markevakt, markekopia("m0")]);
  kravRott(
    "gruppmärke 1: en lib-fil i grafen importerar react",
    [markevakt, markekopia("m1", (m) => andra(m, "src/lib/gruppikonsvg.js", (t) => `import "react";\n${t}`))],
    'paketet "react"',
  );
  kravRott(
    "gruppmärke 2: transitivt, lucide-react via gruppfarg.js",
    [markevakt, markekopia("m2", (m) => andra(m, "src/lib/gruppfarg.js", (t) => `import { Music } from "lucide-react";\nexport const _m = Music;\n${t}`))],
    'paketet "lucide-react"',
  );
  kravRott(
    "gruppmärke 3: ingången återexporterar en komponent",
    [
      markevakt,
      markekopia("m3", (m) => {
        fs.mkdirSync(path.join(m, "src", "components"), { recursive: true });
        fs.writeFileSync(path.join(m, "src", "components", "Knapp.jsx"), "export const Knapp = 1;\n");
        andra(m, "src/gruppmarke/index.js", (t) => `${t}export { Knapp } from "../components/Knapp.jsx";\n`);
      }),
    ],
    "utanför src/lib/",
  );
  kravRott(
    "gruppmärke 4: en export saknas i README",
    [markevakt, markekopia("m4", (m) => andra(m, "README.md", (t) => t.replaceAll("sparaSenasteGruppikon", "spara-senaste")))],
    "sparaSenasteGruppikon saknas i README",
  );
  kravRott(
    "gruppmärke 5: react importerat med mallsträng",
    [markevakt, markekopia("m6", (m) => andra(m, "src/lib/gruppikonsvg.js", (t) => `${t}\nexport const ladda = () => import(\`react\`);\n`))],
    'paketet "react"',
  );
  kravRott(
    "gruppmärke 6: en dynamisk import med beräknat mål",
    [markevakt, markekopia("m7", (m) => andra(m, "src/lib/gruppfarg.js", (t) => `${t}\nconst p = "re" + "act";\nexport const ladda = () => import(p);\n`))],
    "inte är en bokstavlig sträng",
  );
  kravRott(
    "gruppmärke 7: exporten står bara som del av ett längre ord i README",
    [markevakt, markekopia("m8", (m) => andra(m, "README.md", (t) => t.replaceAll("narmasteKulornamn", "narmasteKulornamnet")))],
    "narmasteKulornamn saknas i README",
  );
  kravRott(
    "gruppmärke golv: ingången har nästan inga exporter",
    [markevakt, markekopia("m5", (m) => fs.writeFileSync(path.join(m, "src", "gruppmarke", "index.js"), 'export { initials } from "../lib/identity.js";\n'))],
    "filer i grafen",
  );
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
