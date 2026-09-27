#!/usr/bin/env node
/**
 * Vakt: en yta som frågar en källa UTAN grupp ska vara röd.
 *
 * ══ ⛔ VARFÖR VAKTEN KÖR tsc OCH INTE SÖKER I TEXTEN (#139) ════════════
 *
 * Arbetsreglernas punkt 4 räknar upp tre former av falsk grönhet, och den
 * första är närvarogreppet: ett prov som letar efter ett namn i källan mäter
 * inte beteende. En vakt som läste `@property {string} groupId` hade varit
 * exakt det, och den hade stått grön genom hela felet den skulle fånga,
 * eftersom raden kan stå kvar medan typen ändå släpper igenom en fråga utan
 * grupp.
 *
 * Därför skriver vakten en riktig fråga utan `groupId`, kör typkontrollen mot
 * den och KRÄVER ett fel som nämner `groupId`. Det är en mätning.
 *
 * ⛔ OCH DEN KRÄVER ATT FELET HANDLAR OM RÄTT SAK. En tsc som föll på en trasig
 * import är också rött, och ett rött av fel anledning är en vakt som slutat
 * mäta utan att någon märker det.
 *
 * Kör: node scripts/check-gruppfraga.mjs [sökväg till gruppkalla.js]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mal = path.resolve(rot, process.argv[2] ?? path.join("src", "data", "gruppkalla.js"));

if (!fs.existsSync(mal)) {
  console.error(`check-gruppfraga: hittar inte ${path.relative(rot, mal)}. Vakten mäter ingenting mot en fil som inte finns.`);
  process.exit(1);
}

const mapp = fs.mkdtempSync(path.join(rot, "node_modules", ".ops-gruppfraga-"));
const provfil = path.join(mapp, "utan-grupp.js");

/*
 * ⛔ TVÅ ANROP, INTE ETT. `gruppLista` och `gruppSkapa` är två vägar in till
 * samma krav, och en vakt som bara provar den ena lämnar den andra fri. Att
 * skapa utan grupp är dessutom det klarkriterium ärendet skriver ut.
 */
/*
 * ⛔ VARJE ANROPSSTÄLLE PROVAS FÖR SIG, OCH DET ÄR ETT MUTATIONSFYND.
 * Först krävde vakten bara att tsc blev rött NÅGONSTANS. Svepet gjorde
 * `groupId` valfri i `GruppFraga` och vakten stod grön, eftersom `gruppSkapa`
 * fortfarande felade och rödheten räckte. Det är arbetsreglernas "rött av fel
 * anledning" i sin andra form: rätt utfall ur fel hälft. Nu måste BÅDA raderna
 * ha sitt eget fel.
 */
const RADER = [
  { namn: "gruppLista utan groupId", kod: 'export const utanGruppILista = gruppLista(kalla, "rader", { sortBy: "datum" });' },
  { namn: "gruppSkapa utan groupId", kod: 'export const utanGruppISkapa = gruppSkapa(kalla, "rader", { id: "x" });' },
];

const huvud = [
  "// Genererad av scripts/check-gruppfraga.mjs. Ska INTE kompilera.",
  `import { gruppLista, gruppSkapa } from ${JSON.stringify(mal)};`,
  "",
  "/** @type {any} */",
  "const kalla = null;",
  "",
];
const provrader = [...huvud, ...RADER.map((r) => r.kod), ""];
/** Radnummer, ettbaserat, för varje anrop. */
const radnummer = RADER.map((_, i) => huvud.length + i + 1);
fs.writeFileSync(provfil, provrader.join("\n"));

const k = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsc", "--ignoreConfig", "--noEmit", "--allowJs", "--checkJs", "--strict", "--skipLibCheck", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", provfil],
  { cwd: rot, encoding: "utf8" },
);
const utdata = `${k.stdout ?? ""}${k.stderr ?? ""}`;
fs.rmSync(mapp, { recursive: true, force: true });

/*
 * ⛔ ETT FEL SOM INTE HANDLAR OM `groupId` RÄKNAS INTE. En trasig import ger
 * också rött, och den rödheten hade dolt att kravet försvunnit.
 */
const felrader = utdata.split("\n").filter((r) => r.includes("error") && r.includes("groupId"));

/** @type {string[]} */
const utan = [];
RADER.forEach((rad, i) => {
  if (!felrader.some((r) => r.includes(`utan-grupp.js(${radnummer[i]},`))) utan.push(rad.namn);
});

if (utan.length > 0) {
  console.error(
    `check-gruppfraga: typkontrollen SLÄPPTE IGENOM ${utan.join(" och ")} mot ${path.relative(rot, mal)}.\n` +
      "  En yta kan alltså fråga eller skapa utan grupp, och svaret blir antingen någon annans rader eller inga alls.\n" +
      `  groupId måste vara obligatorisk i GruppFraga och i gruppSkapas data.\n` +
      (utdata.trim() ? `  tsc sa: ${utdata.trim().split("\n").slice(0, 3).join(" | ")}` : "  tsc sa ingenting alls."),
  );
  process.exit(1);
}

console.log(`check-gruppfraga: ${RADER.length} anrop utan groupId ger var sitt typfel som nämner groupId. Kravet finns i typen, inte bara i en kommentar.`);
process.exit(0);
