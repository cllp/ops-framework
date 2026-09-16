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
  const typsnittsvakt = "scripts/check-typsnitt.mjs";
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
  const diagramvakt = "scripts/check-diagramfarger.mjs";

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
