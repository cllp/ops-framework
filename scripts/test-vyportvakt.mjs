#!/usr/bin/env node
/**
 * Provar LAYOUTMÄTNINGEN genom att bryta mot varje sak den lovar och kräva rött.
 *
 * ⛔ DEN HÄR SAKNADES, OCH DET VAR DEN ENDA VAKTEN INGEN SETT FAILA.
 *
 * `test-guards.mjs` bryter mot varje regel i fjorton vakter. `check-scaffold`
 * fanns inte med i den listan: ordet "scaffold" förekom noll gånger i filen.
 * Samtidigt är den vakten den ENDA i huset som kan se CSS, alltså den som bär
 * hela mobilgolvet och numera också temat och träffytan.
 *
 * Följden var precis den felklass repot är fullt av varningar om: mätningen såg
 * ut som ett skydd, och ingen hade sett den säga nej. En mätning som råkat läsa
 * fel fönster, tappat sin `brott`-lista på vägen eller fått noll element att mäta
 * hade varit grön i månader.
 *
 * ── ⛔ VARFÖR EN FIXTUR OCH INTE HELA SCAFFOLDEN ────────────────────────────
 *
 * Att plantera en defekt i den riktiga mallappen skulle betyda scaffold,
 * `npm install` och bygge PER defekt, alltså tio minuter för att bevisa en
 * if-sats. Fixturen nedan är en enda HTML-fil som har samma FORM som en
 * ops-app: två navigeringar med rätt aria-namn, en `main` med botteninset, en
 * bottenradshöjd i en token, ett mörkt läge och ett reglage vars tumme målas ur
 * accenttokenet.
 *
 * ⛔ Det som bevisas här är alltså MÄTNINGEN, inte hela kedjan. Att scaffoldningen,
 * installationen och bygget fungerar bevisas av `check-scaffold` själv, som kör i
 * samma CI-jobb. De två raderna tillsammans täcker både verktyget och verkligheten.
 *
 * ── ⛔ VARFÖR DEN INTE LIGGER I `npm run check` ─────────────────────────────
 *
 * Den kräver en webbläsare. `npm run check` gör det inte idag, och ska inte
 * börja göra det: en grind som är röd på en nyss klonad maskin blir kringgången,
 * och då är vi tillbaka i att mobilgolvet mäts när någon kommer ihåg det. Den kör
 * i CI:s scaffoldjobb, tillsammans med den vakt den provar.
 *
 * Kör: node scripts/test-vyportvakt.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(rot, "scripts", "ops-viewport.mjs");
const arbetsmapp = fs.mkdtempSync(path.join(os.tmpdir(), "ops-vyportvakt-"));

/**
 * En sida med samma form som en ops-app, och inget mer.
 *
 * ⛔ Den använder INTE ramverkets CSS. Fixturen ska prova mätningen, inte
 * tokenfilen: blandas de två vet man inte vilken av dem ett rött kom ur. Därför
 * står varje värde här i klartext, inklusive de tre tokens tumman behöver.
 *
 * ⛔ `--bottom-nav-h` är i rem, precis som i ramverket, eftersom mätningen
 * multiplicerar med rotens `font-size`. Skrevs den i px här hade fixturen
 * provat en annan enhet än verkligheten.
 */
const SIDA = `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fixtur</title>
<style>
  :root {
    --color-accent: #9a9588;
    --color-surface: #f8f7f4;
    --color-line: #d8d4cc;
    --bottom-nav-h: 3.5rem;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --color-accent: #e8e0d0;
      --color-surface: #16140f;
      --color-line: #322d25;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--color-surface); font-family: system-ui, sans-serif; }
  main { padding: 16px 16px calc(var(--bottom-nav-h) + 8px); }
  /* ⛔ Kromet och den låsta kolumnen ligger på SKILDA lager med flit, och det är
     just den skillnaden prov 8 tar bort. Värdena speglar ramverkets
     --z-chrome (150) och --z-sticky (100), men står i klartext här av samma
     skäl som resten av fixturen: den ska prova mätningen, inte tokenfilen. */
  header { position: sticky; top: 0; z-index: 150; height: 56px; background: var(--color-surface); border-bottom: 1px solid var(--color-line); }
  .lang { height: 2000px; }
  /* Höjden är inte kosmetisk: mätningen tittar mitt i headern, och en kolumn
     lägre än 56/2 px hade aldrig nått dit. Provet var grönt av det skälet en
     gång, vilket är precis den sortens tysta miss vakten finns för. */
  .kolumn { position: sticky; top: 0; left: 0; z-index: 100; width: 40%; height: 80px; margin: 0; background: var(--color-surface); }
  /* Fast, precis som OpsBottomNav. Låg den i flödet provades aldrig att krom
     kan målas över, eftersom den då scrollar ur fönstret. */
  nav[aria-label="Snabbnavigering"] { display: flex; height: var(--bottom-nav-h); position: fixed; inset-inline: 0; bottom: 0; z-index: 150; background: var(--color-surface); }
  nav[aria-label="Huvudnavigering"] { display: none; height: 48px; }
  @media (min-width: 768px) {
    nav[aria-label="Snabbnavigering"] { display: none; }
    nav[aria-label="Huvudnavigering"] { display: flex; }
  }
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 44px;
    background: transparent;
  }
  input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: var(--color-line); border-radius: 9999px; }
  input[type="range"]::-moz-range-track { height: 4px; background: var(--color-line); border-radius: 9999px; }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -8px;
    border-radius: 9999px;
    background: var(--color-accent);
  }
  input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: 9999px;
    background: var(--color-accent);
  }
</style>
</head>
<body>
  <nav aria-label="Huvudnavigering"><a href="/">Start</a></nav>
  <header>Fixtur</header>
  <main>
    <h1>Fixtur</h1>
    <input type="range" min="-50" max="100" step="5" value="0" aria-label="Hyra">
    <div class="lang"><p class="kolumn">Låst kolumn</p></div>
  </main>
  <nav aria-label="Snabbnavigering"><a href="/">Start</a></nav>
</body>
</html>
`;

/** @type {{ namn: string, vantat: "rott" | "gront", utfall: "ok" | string }[]} */
const resultat = [];

/**
 * Skriver en dist-mapp med fixturen, muterad av `mutera`.
 *
 * @param {string} namn
 * @param {(s: string) => string} [mutera]
 * @returns {string} Sökvägen till dist-mappen.
 */
function fixtur(namn, mutera) {
  const html = mutera ? mutera(SIDA) : SIDA;
  if (mutera && html === SIDA) {
    // ⛔ Samma golv som `tokenkopia` i test-guards: en mutation som inte ändrar
    // något provar ingenting, den ser bara ut att göra det. Det har hänt.
    throw new Error(`test-vyportvakt: mutationen "${namn}" ändrade ingenting i fixturen.`);
  }
  const mapp = path.join(arbetsmapp, namn);
  fs.mkdirSync(mapp, { recursive: true });
  fs.writeFileSync(path.join(mapp, "index.html"), html);
  return mapp;
}

/** @param {string} dist @returns {{ status: number | null, utdata: string }} */
function mat(dist) {
  const k = spawnSync(process.execPath, [cli, dist, "--rutter", "/"], { cwd: rot, encoding: "utf8" });
  return { status: k.status, utdata: `${k.stdout ?? ""}${k.stderr ?? ""}` };
}

/** @param {string} namn @param {(s: string) => string} mutera @param {string} forvantat */
function kravRott(namn, mutera, forvantat) {
  const { status, utdata } = mat(fixtur(namn.replace(/[^a-z0-9]+/gi, "-"), mutera));
  if (status === 0) {
    resultat.push({ namn, vantat: "rott", utfall: "mätningen var GRÖN trots ett inplanterat brott" });
    return;
  }
  if (!utdata.includes(forvantat)) {
    resultat.push({
      namn,
      vantat: "rott",
      utfall: `blev röd, men av fel anledning. Väntade text som innehåller "${forvantat}".\n      Fick: ${utdata.trim().split("\n").slice(-3).join(" | ")}`,
    });
    return;
  }
  resultat.push({ namn, vantat: "rott", utfall: "ok" });
}

/** @param {string} namn */
function kravGront(namn) {
  const { status, utdata } = mat(fixtur("gront"));
  resultat.push(
    status === 0
      ? { namn, vantat: "gront", utfall: "ok" }
      : { namn, vantat: "gront", utfall: `blev RÖD mot en korrekt sida: ${utdata.trim().split("\n").slice(-4).join(" | ")}` },
  );
}

// ── Grönt först ─────────────────────────────────────────────────────────────
//
// ⛔ Ordningen är inte kosmetisk. Är den korrekta fixturen röd är varje rött
// nedan meningslöst, eftersom det då kan komma ur fixturen i stället för ur
// mutationen. Då vill jag se det på första raden.
kravGront("en korrekt sida går igenom alla sju påståenden");

// ── 1. Horisontell scroll ───────────────────────────────────────────────────
kravRott(
  "sidan är bredare än fönstret",
  (s) => s.replace("<h1>Fixtur</h1>", '<h1 style="width:900px">Fixtur</h1>'),
  "horisontell scroll",
);

// ── 2. Två navigeringar samtidigt ───────────────────────────────────────────
kravRott(
  "båda navigeringarna syns samtidigt",
  (s) => s.replace('nav[aria-label="Huvudnavigering"] { display: none;', 'nav[aria-label="Huvudnavigering"] { display: flex;'),
  "navigeringar är synliga samtidigt",
);

// ── 3. Innehåll bakom bottenraden ───────────────────────────────────────────
kravRott(
  "main saknar botteninset för bottenraden",
  (s) => s.replace("padding: 16px 16px calc(var(--bottom-nav-h) + 8px);", "padding: 16px;"),
  "hamnar bakom baren",
);

// ── 4. Mörkt läge når inte sidan ────────────────────────────────────────────
//
// ⛔ Mutationen tar bort HELA mörka blocket, alltså samma utfall som ett stavfel
// i selektorn eller en tokenfil som aldrig importeras. Det är den tystaste av
// alla brister här: filen ser komplett ut och sviten är grön.
kravRott(
  "mörkt läge saknas helt",
  (s) => s.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n  \}\n/, ""),
  "i BÅDA lägen",
);

// ── 5. Träffytan under golvet ───────────────────────────────────────────────
kravRott("reglaget är för lågt för en tumme", (s) => s.replace("height: 44px;", "height: 24px;"), "golvet är 44");

// ── 6. Tumman målas av webbläsaren i stället för ur tokens ──────────────────
//
// ⛔ Det här är mätningens skarpaste påstående och det enda som behövde en
// bild för att gå att svara på. Mätt: med tumregeln kvar ger en 20px tumme 268
// bildpunkter i accentfärgen, utan den ger den 0. Skillnaden är alltså inte
// marginell, den är total.
kravRott(
  "tumman målas inte ur tokens",
  (s) => s.replace(/  input\[type="range"\]::-webkit-slider-thumb \{[\s\S]*?\n  \}\n/, ""),
  "bildpunkter i accentfärgen",
);

// ── 7. Noll reglage rapporteras som noll, inte som grönt ────────────────────
//
// ⛔ Mätningen ska inte bli RÖD av att en app saknar reglage, för de flesta sidor
// gör det. Den ska säga hur många den fotograferade, så den som läser kan se om
// beviset ens kördes. `check-scaffold` gör noll till ett brott, eftersom MALLENS
// primitivsida har ett reglage och noll där betyder att mätningen inte ser sidan.
{
  const { status, utdata } = mat(fixtur("utan-reglage", (s) => s.replace(/  <input type="range"[^>]*>\n/, "")));
  const sagerNoll = /0 reglage fotograferade/.test(utdata);
  resultat.push({
    namn: "en sida utan reglage är grön men redovisar noll fotograferade",
    vantat: "gront",
    utfall:
      status === 0 && sagerNoll
        ? "ok"
        : `väntade grönt med "0 reglage fotograferade" i utskriften, fick status ${status}: ${utdata.trim().split("\n").slice(-3).join(" | ")}`,
  });
}

// ── 8. Innehåll målar över kromet ───────────────────────────────────────────
//
// ⛔ DET HÄR ÄR FELET SOM HITTADES AV ETT SKÄRMKLIPP, INTE AV EN VAKT.
// I bolag-ops låg OpsTables låsta förstakolumn och appskalets header båda på
// `--z-sticky`. Vid lika z-index avgör dokumentordningen, och tabellen står i
// `main`, alltså efter `header`. På telefon målade kolumnen rakt över headern
// under scroll: logotyp, inkorg och temaknapp försvann bakom en tabellcell.
//
// Mutationen gör exakt det: den lyfter den låsta kolumnen till kromets lager.
// Inget annat ändras. Blir mätningen grön ändå mäter den inte lagren, utan bara
// att de står skrivna någonstans.
//
// ⛔ Kolumnen är 40 % bred med flit. En övermålning täcker sällan hela bredden,
// och mätningen måste därför prova flera punkter. Med bara mittpunkten hade det
// här provet varit grönt och felet levt kvar.
kravRott(
  "innehåll ligger på kromets lager och målar över headern",
  (s) => s.replace(".kolumn { position: sticky; top: 0; left: 0; z-index: 100;", ".kolumn { position: sticky; top: 0; left: 0; z-index: 150;"),
  "appskalets header är övermålad",
);

fs.rmSync(arbetsmapp, { recursive: true, force: true });

const fel = resultat.filter((r) => r.utfall !== "ok");
for (const r of resultat) {
  console.log(`${r.utfall === "ok" ? "ok  " : "FEL "} [${r.vantat}] ${r.namn}${r.utfall === "ok" ? "" : `\n      ${r.utfall}`}`);
}

const roda = resultat.filter((r) => r.vantat === "rott").length;
const grona = resultat.filter((r) => r.vantat === "gront").length;

if (fel.length > 0) {
  console.error(`\ntest-vyportvakt: ${fel.length} av ${resultat.length} kontroller gick inte som väntat.`);
  process.exit(1);
}

console.log(`\ntest-vyportvakt: ${roda} inplanterade brott gav rött, ${grona} korrekta sidor gav grönt.`);
