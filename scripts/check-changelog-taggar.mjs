#!/usr/bin/env node
/**
 * Vakt: varje publicerad tagg har en egen rubrik i CHANGELOG.md.
 *
 * ══ ⛔ VARFÖR (0.82.0, granskningen av PR 314, B1) ═══════════════════════
 *
 * PR 314 tog av misstag bort rubriken `## 0.80.1`. Texten för 0.80.1 stod
 * därefter kvar utan egen rubrik, inuti avsnittet för 0.82.0, och såg ut att
 * höra dit. `check-paket` var grön, eftersom den bara läser rubriken för
 * versionen i package.json, alltså den som ska taggas härnäst. En utgivning
 * som redan är taggad hade ingen vakt alls, och det är den som någon väljer
 * att hoppa över eller inte.
 *
 * ══ ⛔ VAD DEN LÄSER ══════════════════════════════════════════════════════
 *
 * Taggarna ur `git tag -l 'v*'`, de som har formen vX.Y.Z. Varje sådan ska ha
 * en rad `## X.Y.Z` (eller `## [X.Y.Z]`), samma form som `check-paket` kräver.
 *
 * ⛔ GOLV: MINST 10 TAGGAR. En utcheckning utan taggar (en grund klon, eller
 * CI utan `fetch-tags: true`) ger noll taggar, och noll taggar som alla har en
 * rubrik är ett grönt som inte mätte något (arbetsreglernas punkt 4, tomt
 * underlag). Det blir rött och säger hur taggarna hämtas.
 *
 * ⛔ TAK: 0. Mätt 2026-10-08: alla 82 taggar har en rubrik. Taket får bara
 * sjunka, och det står redan på noll.
 *
 * Kör: node scripts/check-changelog-taggar.mjs [CHANGELOG.md] [--taggar fil]
 *   `--taggar` läser taggarna ur en fil, en per rad, i stället för ur git. Det
 *   är för `test-guards`, som planterar en logg utan en rubrik.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const taggIndex = argv.indexOf("--taggar");
const taggfil = taggIndex >= 0 ? argv[taggIndex + 1] : null;
const loggArg = argv.find((a, i) => !a.startsWith("--") && (taggIndex < 0 || i !== taggIndex + 1));
const loggvag = loggArg ? path.resolve(loggArg) : path.join(rot, "CHANGELOG.md");

const GOLV = 10;
const TAK = 0;

if (!fs.existsSync(loggvag)) {
  console.error(`check-changelog-taggar: ${loggvag} finns inte. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

/** @type {string[]} */
let taggar;
if (taggfil) {
  if (!fs.existsSync(taggfil)) {
    console.error(`check-changelog-taggar: taggfilen ${taggfil} finns inte.`);
    process.exit(1);
  }
  taggar = fs.readFileSync(taggfil, "utf8").split("\n");
} else {
  const git = spawnSync("git", ["tag", "-l", "v*"], { cwd: rot, encoding: "utf8" });
  if (git.status !== 0) {
    console.error(`check-changelog-taggar: git tag föll: ${(git.stderr || git.stdout).trim()}`);
    process.exit(1);
  }
  taggar = git.stdout.split("\n");
}
const versioner = taggar.map((t) => t.trim()).filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).map((t) => t.slice(1));

if (versioner.length < GOLV) {
  console.error(
    `check-changelog-taggar: bara ${versioner.length} taggar lästa, golvet är ${GOLV}. Noll taggar med rubrik är inte ett godkänt utfall. Hämta taggarna (git fetch --tags, eller fetch-tags: true i actions/checkout) och kör igen.`,
  );
  process.exit(1);
}

const logg = fs.readFileSync(loggvag, "utf8");
const saknas = versioner.filter((v) => !new RegExp(`^##\\s+\\[?${v.replace(/\./g, "\\.")}\\]?\\s*$`, "m").test(logg));

if (saknas.length > TAK) {
  console.error(`check-changelog-taggar: ${saknas.length} publicerade taggar saknar rubrik i CHANGELOG.md, taket är ${TAK}:`);
  for (const v of saknas) console.error(`  saknar rubrik "## ${v}" (taggen v${v})`);
  console.error("  En tagg utan rubrik är en utgivning vars anteckningar har hamnat under en annan version, eller försvunnit.");
  process.exit(1);
}

console.log(`check-changelog-taggar: ${versioner.length} publicerade taggar lästa, alla har en egen rubrik i CHANGELOG.md.`);
