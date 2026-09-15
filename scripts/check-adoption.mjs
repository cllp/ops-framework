#!/usr/bin/env node
/**
 * Vakt: adoptionen går framåt, aldrig bakåt.
 *
 * ⛔ SÄTT ALDRIG ETT NYTT TAK TILL NOLL.
 *
 * Det är den enda regeln som avgör om en upprensning lyckas. Sätter du taket
 * till noll blir all befintlig kod röd på en gång, ingen hinner laga den, och
 * inom en vecka är vakten avstängd eller kringgången. Då är läget sämre än
 * innan, för nu finns dessutom en avstängd vakt som ser ut att skydda något.
 *
 * Sätt taket vid DAGENS siffra och låt det bara få sjunka. Då blir varje flyttad
 * sida och varje raderad klass synlig, och ingen kan smyga tillbaka skräp.
 *
 * Mätningarna beskrivs i `adoption.json` i den app som rensas:
 *
 *   {
 *     "matningar": [
 *       { "namn": "gamla HTML-sidor", "katalog": "web", "andelser": [".html"], "tak": 14 },
 *       { "namn": "egna CSS-klasser", "katalog": "web/assets/css",
 *         "andelser": [".css"], "monster": "^\\\\.[a-z][a-z0-9_-]*", "tak": 422 }
 *     ]
 *   }
 *
 * Utan `monster` räknas FILER. Med `monster` räknas TRÄFFAR i filerna.
 *
 * Kör:  node .../check-adoption.mjs [sökväg till adoption.json] [--skarp]
 *       --skarp skriver ner taken till dagens siffror. Kör den efter en
 *       upprensning, aldrig före.
 * Exit: 0 grönt, 1 när något gått bakåt.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
const skarp = argv.includes("--skarp");
const konfigfil = path.resolve(argv.find((a) => !a.startsWith("--")) ?? "adoption.json");

if (!fs.existsSync(konfigfil)) {
  console.error(`check-adoption: hittar inte ${konfigfil}. Fel sökväg, inte ett godkänt utfall.`);
  process.exit(1);
}

const rot = path.dirname(konfigfil);
const konfig = JSON.parse(fs.readFileSync(konfigfil, "utf8"));
const matningar = konfig.matningar;

if (!Array.isArray(matningar) || matningar.length === 0) {
  console.error("check-adoption: adoption.json saknar matningar. En tom lista är inte ett godkänt utfall, den är en vakt som aldrig kan säga ifrån.");
  process.exit(1);
}

/** @param {string} dir @param {string[]} andelser @returns {string[]} */
function filer(dir, andelser) {
  /** @type {string[]} */
  const ut = [];
  if (!fs.existsSync(dir)) return ut;
  for (const post of fs.readdirSync(dir, { withFileTypes: true })) {
    if (post.name === "node_modules" || post.name.startsWith(".")) continue;
    const full = path.join(dir, post.name);
    if (post.isDirectory()) ut.push(...filer(full, andelser));
    else if (andelser.some((a) => post.name.endsWith(a))) ut.push(full);
  }
  return ut;
}

/** @type {{ namn: string, nu: number, tak: number, status: "bakat" | "framat" | "stilla" }[]} */
const rader = [];
let backat = false;

for (const m of matningar) {
  const lista = filer(path.join(rot, m.katalog), m.andelser ?? [""]);

  let nu;
  if (m.monster) {
    const re = new RegExp(m.monster, "gm");
    nu = lista.reduce((summa, f) => summa + (fs.readFileSync(f, "utf8").match(re)?.length ?? 0), 0);
  } else {
    nu = lista.length;
  }

  // ⛔ Golv: läste vakten noll filer är det nästan alltid fel sökväg, inte en
  // färdig upprensning. Att tolka det som framgång är den vanligaste falska
  // grönheten vi har.
  if (lista.length === 0 && m.tak > 0) {
    console.error(
      `check-adoption: mätningen "${m.namn}" läste NOLL filer ur ${m.katalog}, men taket är ${m.tak}. Antingen är sökvägen fel, eller så raderades katalogen. Bägge ska åtgärdas, inte firas.`,
    );
    process.exit(1);
  }

  const status = nu > m.tak ? "bakat" : nu < m.tak ? "framat" : "stilla";
  if (status === "bakat") backat = true;
  rader.push({ namn: m.namn, nu, tak: m.tak, status });
}

const bredd = Math.max(...rader.map((r) => r.namn.length));
for (const r of rader) {
  const tecken = r.status === "bakat" ? "BAKAT " : r.status === "framat" ? "framat" : "stilla";
  console.log(`  ${tecken}  ${r.namn.padEnd(bredd)}  ${String(r.nu).padStart(5)} av tak ${r.tak}`);
}

if (backat) {
  console.error("\ncheck-adoption: något har gått BAKÅT. Nytt skräp har lagts till i en yta som skulle rensas.");
  console.error("Lägg inte till i det gamla. Bygg det nya mot ramverket, och ta bort det gamla i samma commit.");
  process.exit(1);
}

const attSanka = rader.filter((r) => r.status === "framat");
if (attSanka.length > 0 && !skarp) {
  console.log("\ncheck-adoption: framsteg som inte är låst. Sänk taken så att de inte kan krypa tillbaka:");
  for (const r of attSanka) console.log(`  "${r.namn}": tak ${r.tak} -> ${r.nu}`);
  console.log("\nKör om med --skarp så skrivs de ner åt dig.");
}

if (skarp) {
  konfig.matningar = matningar.map((m) => ({ ...m, tak: rader.find((r) => r.namn === m.namn)?.nu ?? m.tak }));
  fs.writeFileSync(konfigfil, `${JSON.stringify(konfig, null, 2)}\n`);
  console.log("\ncheck-adoption: taken nedskrivna till dagens siffror.");
}

process.exit(0);
