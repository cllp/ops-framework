#!/usr/bin/env node
/**
 * Vakt: `create-ops-app` producerar en app som FAKTISKT fungerar.
 *
 * ⛔ En boilerplate som inte går att starta är värre än ingen boilerplate. Den
 * ser ut som en genväg, kostar en halv dag att felsöka, och felen den ger är
 * uppsättningsfel vars meddelanden pekar långt från orsaken.
 *
 * Därför scaffoldar den här vakten på riktigt, installerar på riktigt och kör
 * appens egen grind på riktigt.
 *
 * Tre detaljer som inte är godtyckliga:
 *
 *   1. `--install-links` gör att ramverket KOPIERAS som ett paket i stället för
 *      att symlänkas. Det provar samtidigt `files`-fältet: glömmer vi `dist`
 *      där fungerar allt lokalt och går sönder för alla andra. Med symlänk
 *      hade den buggen varit osynlig här.
 *   2. Vi läser den byggda CSS:en och kräver att ramverkets utilities finns i
 *      den. Det är enda sättet att bevisa att `@source`-raden mot node_modules
 *      gör sitt jobb, och den raden är den dyraste fällan i uppsättningen:
 *      saknas den blir appen helt ostylad UTAN felmeddelande.
 *   3. Appen öppnas i en riktig webbläsare vid 390 och 768 px. ⛔ Det är den
 *      ENDA plats i huset där CSS faktiskt körs: alla andra tester lever i
 *      jsdom, som inte har någon layoutmotor och därför inte kan se skillnad på
 *      `hidden md:flex` och ingenting alls. Mätningen ligger i
 *      `scripts/lib/matVyport.mjs`; den läses härifrån för att appen redan är
 *      byggd vid det laget och en andra installation vore ren väntetid.
 *
 * Kör: node scripts/check-scaffold.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { matVyport } from "./lib/matVyport.mjs";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arbetsmapp = fs.mkdtempSync(path.join(os.tmpdir(), "ops-scaffold-"));
const appmapp = path.join(arbetsmapp, "provapp");

/** @param {string} vad @param {string[]} argv @param {string} cwd */
function kor(vad, argv, cwd) {
  process.stdout.write(`  ${vad} ... `);
  // ⛔ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: appen har playwright i devDependencies
  // för sin layoutmätning, men vi ska inte ladda ner en webbläsare per
  // scaffold-körning. Mätningen hittar en befintlig Chromium via sin egen
  // fallback, och saknas den blir den röd, aldrig tyst överhoppad.
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "1", PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" },
  });
  if (r.status !== 0) {
    console.log("MISSLYCKADES");
    console.error(`\ncheck-scaffold: "${argv.join(" ")}" gav ${r.status}\n`);
    console.error((r.stdout ?? "").slice(-3000));
    console.error((r.stderr ?? "").slice(-3000));
    fs.rmSync(arbetsmapp, { recursive: true, force: true });
    process.exit(1);
  }
  console.log("ok");
  return r.stdout ?? "";
}

console.log(`check-scaffold: ${appmapp}`);

kor("bygger ramverket", [process.execPath, path.join(rot, "scripts", "build.mjs")], rot);

kor(
  "skapar appen",
  [process.execPath, path.join(rot, "create-ops-app", "bin", "create-ops-app.mjs"), "provapp", "--dir", appmapp, "--framework", `file:${rot}`],
  arbetsmapp,
);

// ⛔ Kontrollera att namnbytena skedde. En mall som publiceras utan .gitignore
// får den nya appen att committa node_modules, och det upptäcks först när
// någon undrar varför repot är 400 MB.
for (const maste of [".gitignore", ".github/workflows/ci.yml", "src/index.css", "scripts/pre-push-gate.sh"]) {
  if (!fs.existsSync(path.join(appmapp, maste))) {
    console.error(`check-scaffold: ${maste} saknas i den skapade appen. Namnbytet i create-ops-app.mjs fungerar inte.`);
    fs.rmSync(arbetsmapp, { recursive: true, force: true });
    process.exit(1);
  }
}

// Platshållarna ska vara utbytta, inte kvar som text i en app någon ska leva med.
const appPaket = fs.readFileSync(path.join(appmapp, "package.json"), "utf8");
if (appPaket.includes("__APP_NAME__") || appPaket.includes("__FRAMEWORK_SPEC__")) {
  console.error("check-scaffold: platshållare kvar i package.json. Ersättningen i create-ops-app.mjs träffade inte.");
  fs.rmSync(arbetsmapp, { recursive: true, force: true });
  process.exit(1);
}

kor("installerar (som ett riktigt paket, inte symlänk)", ["npm", "install", "--install-links", "--no-audit", "--no-fund"], appmapp);
kor("kör appens grind", ["npm", "run", "check"], appmapp);

// ── Beviset för @source-raden ───────────────────────────────────────────────
const cssfiler = fs
  .readdirSync(path.join(appmapp, "dist", "assets"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => fs.readFileSync(path.join(appmapp, "dist", "assets", f), "utf8"));

if (cssfiler.length === 0) {
  console.error("check-scaffold: bygget producerade ingen CSS alls.");
  fs.rmSync(arbetsmapp, { recursive: true, force: true });
  process.exit(1);
}
const css = cssfiler.join("\n");

/** @type {string[]} */
const brott = [];
for (const v of [".bg-accent", ".text-ink", ".rounded-full", ".bg-identity-"]) {
  if (!css.includes(v)) {
    brott.push(
      `${v} finns inte i appens byggda CSS. Ramverkets klassnamn hittades alltså inte, nästan säkert för att @source-raden i src/index.css saknas eller pekar fel. Appen skulle bli helt ostylad utan ett enda felmeddelande.`,
    );
  }
}
if (css.includes(".bg-red-500")) {
  brott.push(".bg-red-500 finns i appens byggda CSS. Nollningen av Tailwinds palett nådde inte hela vägen genom en riktig installation.");
}

// ── Logotypen måste överleva vägen genom paketet ─────────────────────────────
//
// ⛔ Det här är den enda kontroll som kan fånga felet, och felet är tyst.
// `--logo-phst` är en `url()` skriven relativt `tokens/tokens.css` INNE i
// node_modules. Att den pekar rätt bygger på att byggverktyget skriver om
// sökvägen när filen importeras från appens `src/index.css` och kopierar ut
// bilden. Gör det inte det blir det ingen varning, ingen röd rad och inget
// byggfel, bara ett varumärke som är en tom ruta hos användaren.
//
// ⛔ ALLA fyra kontrolleras, inte den första som råkar matcha. Första versionen
// av den här kontrollen läste bara `css.match(...)`, alltså en enda träff.
// Provkörning med `--logo-phst` pekad på en fil som inte finns gav GRÖNT, för
// att träffen blev `phst-estd-light` i stället. En vakt som svarar på fel fråga
// är farligare än ingen vakt, eftersom den får en att sluta titta.
const MARKEN = ["phst-light", "phst-dark", "phst-estd-light", "phst-estd-dark"];
const urler = [...css.matchAll(/url\(([^)]*phst[^)]*)\)/g)].map((m) => m[1].replace(/["']/g, "").trim());

for (const marke of MARKEN) {
  // Byggverktyget lägger på en innehållshash, så namnet matchas som prefix.
  const traff = urler.find((u) => path.basename(u).startsWith(`${marke}-`) || path.basename(u) === `${marke}.png`);
  if (!traff) {
    brott.push(
      `${marke}.png finns inte som url() i appens byggda CSS. Tokenet nådde inte hela vägen genom paketet, och märket blir en tom ruta i det temat.`,
    );
    continue;
  }
  if (!fs.existsSync(path.join(appmapp, "dist", traff.replace(/^\//, "")))) {
    brott.push(`Appens CSS pekar på ${traff}, men filen finns inte i dist. Bilden skrevs aldrig ut, alltså trasigt märke utan felmeddelande.`);
  }
}

// ── Layouten mäts i en riktig webbläsare ────────────────────────────────────
//
// ⛔ Fail-closed. Går webbläsaren inte att starta blir vakten RÖD, inte
// överhoppad. En grind som är grön för att den inte tittade är sämre än ingen
// grind: den flyttar uppmärksamheten bort från risken, vilket är exakt hur
// dubbelnavigeringen fick leva.
process.stdout.write("  mäter layout vid 390 och 768 px ... ");
let vyport;
try {
  vyport = await matVyport({ dist: path.join(appmapp, "dist"), rutter: ["/", "/primitiver"] });
  console.log("ok");
} catch (e) {
  console.log("MISSLYCKADES");
  fs.rmSync(arbetsmapp, { recursive: true, force: true });
  console.error(`\ncheck-scaffold: layoutmätningen kunde inte köras.\n\n  ${/** @type {Error} */ (e).message}\n`);
  process.exit(1);
}
brott.push(...vyport.brott);

fs.rmSync(arbetsmapp, { recursive: true, force: true });

if (brott.length > 0) {
  console.error(`\ncheck-scaffold: ${brott.length} brott\n`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}

console.log(
  `\ncheck-scaffold: appen skapades, installerades, klarade sin egen grind, fick ${Math.round(css.length / 1024)} kB CSS ` +
    `med ramverkets utilities i sig, skrev ut alla ${MARKEN.length} marken och klarade ${vyport.matningar} layoutmatningar ` +
    `i en riktig webblasare (${vyport.varifran})`,
);
