#!/usr/bin/env node
/**
 * check-gammalt-namn: det gamla paketnamnet kommer inte tillbaka (0.68.0, cllp/ops-framework#270, klarkriterium 2).
 *
 * ⛔ HÄNDELSEN: 0.67.0 bytte paketnamnet från det scopade namnet till `ops-framework` (CP 2026-10-06: release-artefakterna
 * ska inte bära "staiger" i namnet). Bytet gjordes för hand i hela repot, och granskningen av PR 271 fann att ingenting
 * hindrade det gamla namnet från att komma tillbaka: en kopierad kodrad, ett exempel ur en äldre README, en kommentar.
 * Det gamla namnet i en import fungerar dessutom tyst i en app som har den gamla nyckeln kvar i `package.json` (mätt i
 * 0.67.0), så ett fel här syns inte förrän någon jämför.
 *
 * Vakten läser varje fil i repot (`git ls-files`, annars en genomgång av katalogen) och är röd på det scopade namnet och
 * på tarbollens gamla filnamn. Undantag, och skälet för vart och ett:
 *   - `CHANGELOG.md`: de äldre avsnitten beskriver vad som var sant när de gavs ut, och deras release-URL:er är de
 *     filnamn som faktiskt ligger på de releaserna;
 *   - `create-ops-app/`: mallens eget paket ges inte ut och har ett eget namn (`@staiger/create-ops-app`, se 0.67.0);
 *   - `README.md` med ett TAK (2 träffar, stycket om tarbollens namn före 0.67.0). Taket får bara sjunka (regel 4).
 * Mönstren byggs av delar i den här filen och i `test-guards`, så att ingen av dem är ett undantag.
 *
 * ⛔ GOLV: minst 400 lästa filer i repot (568 vid 0.68.0). En vakt som läste noll filer hade varit grön (regel 4).
 *
 *   node scripts/check-gammalt-namn.mjs                       repots rot
 *   node scripts/check-gammalt-namn.mjs --rot <mapp> --golv N  för de planterade fallen i test-guards
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const flagga = (/** @type {string} */ n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
const rot = path.resolve(flagga("--rot") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const golv = Number(flagga("--golv") ?? 400);

const SCOPE = "@" + "staiger/";
const MONSTER = [SCOPE + "ops-framework", "staiger" + "-ops-framework"];
const UNDANTAG_FIL = new Set(["CHANGELOG.md"]);
const UNDANTAG_MAPP = ["create-ops-app/"];
/** @type {Record<string, number>} */
const TAK = { "README.md": 2 };

/** @returns {string[]} */
function filer() {
  if (fs.existsSync(path.join(rot, ".git"))) {
    const g = spawnSync("git", ["-C", rot, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
    if (g.status !== 0) {
      console.error(`check-gammalt-namn: git ls-files föll i ${rot}: ${g.stderr}`);
      process.exit(1);
    }
    return g.stdout.split("\0").filter(Boolean);
  }
  /** @type {string[]} */
  const ut = [];
  const ga = (/** @type {string} */ rel) => {
    for (const e of fs.readdirSync(path.join(rot, rel), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) ga(r);
      else if (e.isFile()) ut.push(r);
    }
  };
  ga("");
  return ut;
}

const lista = filer();
/** @type {string[]} */
const brott = [];
let lasta = 0;
for (const rel of lista) {
  const fil = path.join(rot, rel);
  if (!fs.existsSync(fil)) continue;
  const buf = fs.readFileSync(fil);
  lasta += 1;
  if (buf.includes(0)) continue;
  if (UNDANTAG_FIL.has(rel) || UNDANTAG_MAPP.some((m) => rel.startsWith(m))) continue;
  const rader = buf.toString("utf8").split("\n");
  /** @type {string[]} */
  const traffar = [];
  rader.forEach((r, i) => {
    if (MONSTER.some((m) => r.includes(m))) traffar.push(`${rel}:${i + 1}: ${r.trim().slice(0, 140)}`);
  });
  const tak = TAK[rel] ?? 0;
  if (traffar.length > tak) brott.push(...(tak ? [`${rel}: ${traffar.length} träffar, taket är ${tak}.`] : []), ...traffar);
}

if (lasta < golv) {
  console.error(`check-gammalt-namn: läste ${lasta} filer i ${rot}, golvet är ${golv}. Fel rot eller tomt underlag, inte ett godkänt utfall.`);
  process.exit(1);
}
if (brott.length) {
  console.error(`check-gammalt-namn: det gamla paketnamnet är tillbaka (${brott.length}). Paketet heter ops-framework sedan 0.67.0:\n  ${brott.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-gammalt-namn: ${lasta} filer lästa, inget gammalt paketnamn utanför undantagen.`);
