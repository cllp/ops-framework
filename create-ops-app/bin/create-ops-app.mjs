#!/usr/bin/env node
/**
 * Startplats för en ny ops-plattform.
 *
 * ⛔ Skalet KOPIERAS, utseendet och reglerna KONSUMERAS.
 *
 * Det är hela arkitekturen i en mening, och den löser en spänning som annars
 * upptäcks först om ett halvår. En boilerplate kopieras en gång och glider
 * sedan isär. Ett ramverk konsumeras och håller ihop. Vi vill ha båda: slippa
 * grovjobbet OCH behålla en enhetlig profil.
 *
 * Därför lägger det här kommandot ut det som SKA få divergera (appskal, routes,
 * konfiguration, CI, domänkod) och skriver in det som INTE får divergera
 * (tokens, primitiver, arbetsregler, vakter) som ett versionerat beroende.
 *
 * Kör:
 *   node bin/create-ops-app.mjs <namn> [--dir <sökväg>] [--framework <spec>]
 *
 * `--framework` pekar ut ramverket. Under utveckling en `file:`-sökväg, annars
 * en version. Ingen gissning: saknas flaggan används den version som står i
 * DEFAULT_RAMVERK, och det sägs rakt ut i utskriften.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_RAMVERK = "^0.1.0";
const harRot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mall = path.join(harRot, "template");

const argv = process.argv.slice(2);
const flagga = (namn) => {
  const i = argv.indexOf(`--${namn}`);
  return i === -1 ? undefined : argv[i + 1];
};
const namn = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--dir" && argv[argv.indexOf(a) - 1] !== "--framework");

if (!namn) {
  console.error("create-ops-app: ange ett namn.\n\n  create-ops-app tam-ops [--dir ./tam-ops] [--framework file:../ops-framework]\n");
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]*$/.test(namn)) {
  console.error(`create-ops-app: "${namn}" duger inte som paketnamn. Använd gemener, siffror och bindestreck, och börja med en bokstav.`);
  process.exit(1);
}

const mal = path.resolve(flagga("dir") ?? namn);
const ramverk = flagga("framework") ?? DEFAULT_RAMVERK;

// ⛔ Vi skriver aldrig in i en katalog som redan har innehåll. En scaffolder som
// blandar sig med befintliga filer ger ett resultat ingen kan resonera om, och
// skadan upptäcks efter att någon redan committat.
if (fs.existsSync(mal) && fs.readdirSync(mal).length > 0) {
  console.error(`create-ops-app: ${mal} finns redan och är inte tom. Välj en annan katalog.`);
  process.exit(1);
}

/**
 * Filer som måste byta namn vid kopiering.
 *
 * ⛔ npm PLOCKAR BORT `.gitignore` ur publicerade paket. En mall som har filen
 * under sitt riktiga namn fungerar lokalt och tappar den tyst så fort mallen
 * publiceras, och den nya appen börjar då committa `node_modules`. Samma sak
 * gäller `.npmrc`. Därför ligger de under `_`-namn i mallen.
 */
const NAMNBYTEN = { _gitignore: ".gitignore", _github: ".github", _npmrc: ".npmrc" };

let antalFiler = 0;

/** @param {string} fran @param {string} till */
function kopiera(fran, till) {
  for (const post of fs.readdirSync(fran, { withFileTypes: true })) {
    const nyttNamn = NAMNBYTEN[post.name] ?? post.name;
    const kalla = path.join(fran, post.name);
    const dit = path.join(till, nyttNamn);
    if (post.isDirectory()) {
      fs.mkdirSync(dit, { recursive: true });
      kopiera(kalla, dit);
      continue;
    }
    const innehall = fs
      .readFileSync(kalla, "utf8")
      .replaceAll("__APP_NAME__", namn)
      .replaceAll("__FRAMEWORK_SPEC__", ramverk);
    fs.mkdirSync(path.dirname(dit), { recursive: true });
    fs.writeFileSync(dit, innehall);
    if (path.extname(dit) === ".sh") fs.chmodSync(dit, 0o755);
    antalFiler += 1;
  }
}

fs.mkdirSync(mal, { recursive: true });
kopiera(mall, mal);

// Golv: en scaffolder som skrev noll filer och sa "klart" är exakt den falska
// grönhet vi har vakter mot i resten av ramverket.
if (antalFiler < 10) {
  console.error(`create-ops-app: bara ${antalFiler} filer skrevs. Mallen är trasig eller på fel plats (${mall}).`);
  process.exit(1);
}

console.log(`
${namn} skapad i ${mal}
${antalFiler} filer. Ramverket: ${ramverk}${flagga("framework") ? "" : "  (standard, ange --framework för något annat)"}

Nästa steg:

  cd ${path.relative(process.cwd(), mal) || "."}
  npm install
  npm run check     kör vakterna, samma som CI och pre-push
  npm run dev

Det som INTE ligger här ännu, med flit: datalager, auth och behörighetsmodell.
De ser olika ut per plattform och läggs till när det är klart vilken modell just
den här appen ska ha.
`);
