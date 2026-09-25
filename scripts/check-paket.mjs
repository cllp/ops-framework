#!/usr/bin/env node
/**
 * Vakt: paketet går att installera och använda av någon som inte har repot.
 *
 * ══ ⛔ VARFÖR ══════════════════════════════════════════════════════════
 *
 * `bolag-ops/functions` kan i dag inte importera ramverket. Aktivitetsloggen
 * finns därför i två exemplar, en i ramverket och en kopia i `functions/`, med
 * ett prov som håller dem identiska. Det är en lösning på ett riktigt problem,
 * men det är fortfarande två sanningar (cllp/ops-framework#93).
 *
 * ══ ⛔ VAD SOM FAKTISKT MÄTTES, 2026-09-25 ═════════════════════════════
 *
 *   1. `cllp/ops-framework` är PUBLIKT sedan 2026-09-16. Skälet som står i
 *      `functions/aktivitetslogg.js`, "ramverket är en privat git-dep", är
 *      alltså inte längre sant.
 *   2. GitHub Packages kräver ändå inloggning. Mätt mot `@github/catalyst`,
 *      ett publikt paket: HTTP 401, "authentication token not provided".
 *      Alltså faller issuens första förslag på sitt eget krav.
 *   3. `dist/` är git-ignorerad och finns inte i repot, men finns i den
 *      installerade kopian i appen. En `github:`-beroende installation kör
 *      alltså `prepare`, alltså esbuild och tsc, inne i Firebase byggcontainer.
 *   4. En release-tillgång i ett publikt repo hämtas UTAN auth. Mätt: HTTP 200.
 *
 * Därför är en packad tarboll på en GitHub-release mekanismen: färdigbyggd, så
 * ingen `prepare` behövs; publik HTTPS, så ingen inloggning behövs; och
 * oföränderlig per tagg.
 *
 * ══ ⛔ VAD DEN HÄR VAKTEN BEVISAR, OCH VAD DEN INTE GÖR ════════════════
 *
 * Den packar paketet precis som utgivningen gör, installerar tarbollen i ett
 * TOMT projekt med `--omit=dev` och importerar nodsidan. Det är samma tre steg
 * Firebase byggcontainer gör.
 *
 * ⛔ Den bevisar INTE att Firebase deploy fungerar. Den containern går inte att
 * köra härifrån. Den bevisar att paketet är komplett och att nodsidan inte
 * behöver en enda devDependency, vilket är de två fel som annars upptäcks av en
 * misslyckad deploy hos någon annan.
 *
 * Kör: node scripts/check-paket.mjs [paketrot] [--struktur]
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const baraStruktur = argv.includes("--struktur");
const vagArg = argv.find((a) => !a.startsWith("--"));
const paketrot = vagArg ? path.resolve(vagArg) : rot;

const manifestvag = path.join(paketrot, "package.json");
if (!fs.existsSync(manifestvag)) {
  console.error(`check-paket: ${manifestvag} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

const paket = JSON.parse(fs.readFileSync(manifestvag, "utf8"));
/** @type {string[]} */
const fel = [];

// ── 1. Versionen ska vara semver, för taggen härleds ur den ────────────────
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(String(paket.version || ""))) {
  fel.push(`version "${paket.version}" är inte semver. Taggen heter v<version>, så en version som inte är semver ger en tagg ingen kan tolka.`);
}

/*
 * ── 2. Varje ingång måste ligga i `files` ──────────────────────────────────
 *
 * ⛔ DET HÄR ÄR UTGIVNINGENS KLASSISKA FEL, och det ser inte ut som ett fel
 * lokalt: `exports` pekar på en fil som finns i arbetskopian men inte i
 * tarbollen. Allt är grönt i repot, och paketet är tomt hos den som installerar.
 */
const listade = Array.isArray(paket.files) ? paket.files : [];
/** @param {string} p @returns {boolean} */
function taksAvFiles(p) {
  const ren = p.replace(/^\.\//, "");
  if (ren === "package.json") return true; // npm packar den alltid
  return listade.some((f) => {
    const ff = String(f).replace(/^\.\//, "").replace(/\/$/, "");
    return ren === ff || ren.startsWith(`${ff}/`);
  });
}

/** @param {unknown} nod @param {string} varifran */
function granskaIngang(nod, varifran) {
  if (typeof nod === "string") {
    if (!taksAvFiles(nod)) fel.push(`${varifran} pekar på "${nod}", som inte täcks av "files". Den filen finns inte i tarbollen.`);
    return;
  }
  if (nod && typeof nod === "object") {
    for (const [k, v] of Object.entries(nod)) granskaIngang(v, `${varifran}.${k}`);
  }
}
granskaIngang(paket.exports, "exports");
if (paket.types) granskaIngang(paket.types, "types");
if (paket.main) granskaIngang(paket.main, "main");

// ── 3. Inget i `files` får saknas på disk ─────────────────────────────────
for (const f of listade) {
  const full = path.join(paketrot, String(f).replace(/\/$/, ""));
  // `dist` byggs av `prepare` och finns inte i en ren utcheckning. Att den
  // saknas här är inte ett fel; att den saknas i tarbollen är, och det fångas
  // av installationen nedan.
  if (String(f).replace(/\/$/, "") === "dist") continue;
  if (!fs.existsSync(full)) fel.push(`"files" listar "${f}", som inte finns. En post som inte finns packas inte, och ingen märker det förrän någon installerar.`);
}

// ── 4. Versionen måste ha ett avsnitt i ändringsloggen ────────────────────
//
// ⛔ En utgivning utan anteckningar är en version ingen kan välja att hoppa
// över. Taggen skapas av en människa långt efter att koden skrevs, och då minns
// ingen vad som ändrades.
{
  const loggvag = path.join(paketrot, "CHANGELOG.md");
  if (!fs.existsSync(loggvag)) {
    fel.push("CHANGELOG.md saknas. Varje tagg ska ha ett avsnitt där.");
  } else {
    const logg = fs.readFileSync(loggvag, "utf8");
    const rubrik = new RegExp(`^##\\s+\\[?${String(paket.version).replace(/\./g, "\\.")}\\]?\\s*$`, "m");
    if (!rubrik.test(logg)) fel.push(`CHANGELOG.md har ingen rubrik "## ${paket.version}". Versionen i package.json är den som taggas, så det är den som ska stå där.`);
  }
}

if (fel.length > 0) {
  console.error(`check-paket: ${fel.length} fel i paketets form.`);
  for (const f of fel) console.error(`  ${f}`);
  process.exit(1);
}

if (baraStruktur) {
  console.log(`check-paket: paketets form är hel (${listade.length} poster i files, alla ingångar täckta).`);
  process.exit(0);
}

// ── 4. Packa, installera i ett tomt projekt, importera nodsidan ────────────
const arbete = fs.mkdtempSync(path.join(os.tmpdir(), "ops-paket-"));
/** @param {string} txt */
const steg = (txt) => console.log(`  ${txt}`);

try {
  steg("packar ...");
  const pack = spawnSync("npm", ["pack", "--pack-destination", arbete], { cwd: paketrot, encoding: "utf8" });
  if (pack.status !== 0) {
    console.error("check-paket: `npm pack` föll.\n" + (pack.stderr || pack.stdout));
    process.exit(1);
  }
  const tarboll = fs.readdirSync(arbete).find((f) => f.endsWith(".tgz"));
  if (!tarboll) {
    console.error("check-paket: `npm pack` sade ja men lämnade ingen tarboll. Det är ett tystare fel än ett rött, och därför rött här.");
    process.exit(1);
  }

  const konsument = path.join(arbete, "konsument");
  fs.mkdirSync(konsument);
  fs.writeFileSync(path.join(konsument, "package.json"), JSON.stringify({ name: "ops-paketprov", private: true, type: "module", version: "1.0.0" }, null, 2));

  /*
   * ⛔ `--omit=dev` ÄR HELA PROVET. Firebase byggcontainer installerar inte
   * devDependencies, så en nodsida som råkat importera esbuild eller vitest
   * fungerar perfekt i repot och faller vid första anropet i molnet.
   */
  steg(`installerar ${tarboll} med --omit=dev ...`);
  const inst = spawnSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", path.join(arbete, tarboll)], { cwd: konsument, encoding: "utf8" });
  if (inst.status !== 0) {
    console.error("check-paket: installationen av tarbollen föll.\n" + (inst.stderr || inst.stdout));
    process.exit(1);
  }

  steg("importerar nodsidan ...");
  const prov = spawnSync(
    process.execPath,
    [
      "-e",
      'import("@staiger/ops-framework/node").then((m) => { const kravs = ["createActivityWriter", "createCaseMirror"]; const saknas = kravs.filter((k) => typeof m[k] !== "function"); if (saknas.length) { console.error("saknar " + saknas.join(", ")); process.exit(1); } console.log(Object.keys(m).join(",")); }).catch((e) => { console.error(e.message); process.exit(1); });',
    ],
    { cwd: konsument, encoding: "utf8" },
  );
  if (prov.status !== 0) {
    console.error("check-paket: nodsidan gick inte att importera ur den installerade tarbollen.\n" + (prov.stderr || prov.stdout));
    process.exit(1);
  }

  const antal = fs.readdirSync(path.join(konsument, "node_modules")).filter((n) => !n.startsWith(".")).length;
  console.log(`check-paket: tarbollen installeras i ett tomt projekt med --omit=dev, och nodsidan (${prov.stdout.trim()}) går att importera. ${antal} toppnivåpaket landade.`);
} finally {
  fs.rmSync(arbete, { recursive: true, force: true });
}
