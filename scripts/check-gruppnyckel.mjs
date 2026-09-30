#!/usr/bin/env node
/**
 * Vakt: exakt EN gruppnyckel per rad, i varje samling ramverket äger.
 *
 * ══ ⛔ VARFÖR DEN HÄR VAKTEN FINNS (#136) ══════════════════════════════
 *
 * SessionStudio bar `invitedGroupIds` på raderna, alltså delning inbakad i
 * datamodellen. Följden var att varje regel, varje fråga och varje vy fick bära
 * "eller någon av de här", och att ingen längre kunde svara på vems rad något
 * var. Det går inte att ta bort efteråt, eftersom datan redan har formen.
 *
 * Fas 2.5 valde motsatsen: ett `groupId`, ett uppslag. Sammanslagning över
 * flera grupper (#139) sker i RAMVERKET, med en fråga per grupp, och ändrar
 * ingen rad och ingen regel.
 *
 * ⛔ VAKTEN ÄR BILLIG I DAG OCH OMÖJLIG ATT EFTERMONTERA. Det är hela skälet
 * att den skrivs nu, innan den första raden finns.
 *
 * Kör: node scripts/check-gruppnyckel.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/*
 * ⛔ KÄLLTRÄDET GÅR ATT PEKA OM, av samma skäl som i de andra vakterna: en
 * vakt som bara kan köras mot ett träd som råkar vara grönt går inte att se
 * falla. `test-guards` pekar den mot en kopia med ett planterat `groupIds`.
 *
 * ⛔ OCH REGELTEXTEN IMPORTERAS UR SAMMA TRÄD. Läste vakten fältlistorna ur
 * kopian men reglerna ur originalet vore halva mätningen alltid grön, oavsett
 * vad som planterades.
 */
const kalltrad = process.argv[2] ? path.resolve(process.argv[2]) : path.join(rot, "src");
const libmapp = path.join(kalltrad, "lib");

if (!fs.existsSync(libmapp)) {
  console.error(`check-gruppnyckel: hittar inte ${libmapp}. Fel sökväg i vakten, inte ett godkänt utfall.`);
  process.exit(1);
}

const { gruppadSamling, katalogregelfragment, regelfragment } = await import(pathToFileURL(path.join(libmapp, "regler.js")).href);
const { byggKategori } = await import(pathToFileURL(path.join(libmapp, "katalog.js")).href);
const { createCatalogSource } = await import(pathToFileURL(path.join(kalltrad, "data", "katalogkalla.js")).href);

/** Den enda tillåtna gruppnyckeln. */
const ENDA = "groupId";

/** Ett fältnamn som rör grupper men inte är `groupId`. */
const RORGRUPP = /grupp|group/i;

/** @type {string[]} */
const brott = [];

// ── 1. Fältlistorna i samlingarna ramverket äger ───────────────────────────
//
// ⛔ LISTORNA LÄSES UR KÄLLAN OCH IMPORTERAS INTE. En import hade gett vakten
// de värden modulen råkar exportera, medan felet vi letar efter är ett fält
// någon SKREV. Att läsa texten fångar också en lista som glömts exporteras.
const libfiler = fs
  .readdirSync(libmapp)
  .filter((f) => f.endsWith(".js"))
  .map((f) => path.join(libmapp, f));

/** @type {{ lista: string, falt: string[], fil: string }[]} */
const listor = [];
for (const fil of libfiler) {
  const kalla = fs.readFileSync(fil, "utf8");
  for (const m of kalla.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*FALT)\s*=\s*\[([^\]]*)\]/g)) {
    const falt = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    listor.push({ lista: m[1], falt, fil: path.relative(rot, fil) });
  }
}

// ⛔ GOLV. En vakt som blir grön av att ingenting lästes är det arbetsreglerna
// kallar tomt underlag. Fyra listor är de fyra samlingarna i #136.
if (listor.length < 4) {
  console.error(`check-gruppnyckel: bara ${listor.length} fältlistor lästes ur ${libmapp}. Fel mönster, eller en samling som saknar sin lista.`);
  process.exit(1);
}

for (const { lista, falt, fil } of listor) {
  for (const namn of falt) {
    if (!RORGRUPP.test(namn)) continue;
    if (namn === ENDA) continue;
    brott.push(
      `${fil}: ${lista} bär fältet "${namn}". En rad får peka på EXAKT en grupp, och nyckeln heter ${ENDA}. Ett fält som pekar på flera är delning inbakad i datamodellen, och det går inte att ta bort sedan.`,
    );
  }
}

// ── 2. Regeltexten ─────────────────────────────────────────────────────────
//
// ⛔ OCH REGLERNA, INTE BARA FORMEN. En rad kan bära ett enda `groupId` medan
// regeln ändå frågar "är du med i NÅGON av de här", och då är hålet lika stort.
// `array-contains` och `in` över en grupplista är hur det skulle se ut.
const regeltexter = [regelfragment(), gruppadSamling("provsamling"), gruppadSamling("provkonfig", { agareKravsForSkrivning: true }), katalogregelfragment("provkatalog")];
const FORBJUDET = [
  ["array-contains", "en fråga mot en lista grupper på raden"],
  ["groupIds", "en gruppnyckel i plural"],
  ["invitedGroupIds", "SessionStudios delningsfält"],
];

for (const text of regeltexter) {
  for (const [nal, vad] of FORBJUDET) {
    if (text.includes(nal)) {
      brott.push(`regelfragmentet innehåller "${nal}", alltså ${vad}. Regeln ska vara ETT uppslag mot memberships, inget OR.`);
    }
  }
}

// ⛔ OCH ATT DET FAKTISKT ÄR ETT UPPSLAG. Utan den här kontrollen är vakten
// nöjd med en regel som släpper igenom allt, eftersom den bara letar efter det
// som INTE får stå. Ett golv för närvaro, inte bara för frånvaro.
if (!regelfragment().includes("opsArMedlem") || !regelfragment().includes("exists(")) {
  brott.push("regelfragmentet saknar opsArMedlem eller exists(). Då mäter resten av vakten ingenting.");
}

// ── 3. users-regelns hasOnly täcker varje fält i ANVANDARFALT (#156) ───────
//
// ⛔ VARFÖR DEN HÄR VAKTEN FINNS, RÄTTAT EFTER GRANSKNING. hasOnly-listan i
// `regelfragment()`s users-block ÄR SEDAN GRANSKNINGEN HÄRLEDD ur
// ANVANDARFALT (`regler.js` importerar den ur `grupp.js`), inte en
// handskriven kopia av den. En härledning kan inte glida isär av sig
// själv, men det kan mekanismen som håller den härledd: en framtida
// ändring som byter härledningen mot en handskriven lista igen (t.ex. vid
// en omskrivning som "råkar" hårdkoda listan för läsbarhet) ska fällas
// precis som en ren kopia hade fällts. Den här kontrollen mäter alltså
// UTFALLET (täcker hasOnly varje fält), oavsett om det kommer från en
// härledning eller en kopia, vilket är det enda en text-vakt kan mäta.
//
// ⛔ BÅDA RIKTNINGARNA MÄTS. Provet i `scripts/test-guards.mjs` ersätter i
// en kopia den härledda hasOnly-raden med en HÅRDKODAD, ofullständig lista
// (som om någon skrivit om härledningen till en kopia och glömt ett fält),
// och kräver att DET HÄR blocket fäller det.
{
  const anvandarfaltLista = listor.find((l) => l.lista === "ANVANDARFALT");
  if (!anvandarfaltLista) {
    brott.push("ANVANDARFALT hittades inte bland fältlistorna. Utan den går det inte att kontrollera att users-regeln täcker alla fält.");
  } else {
    const [, usersBlock] = regelfragment().split(/match \/users\/\{uid\} \{/);
    if (!usersBlock) {
      brott.push("regelfragmentet saknar ett block för users. Formvalideringen går då inte att kontrollera.");
    } else {
      // ⛔ Klipp vid nästa match-block, inte hela resten av filen: annars
      // matchar ett fältnamn som råkar förekomma i EN ANNAN samlings hasOnly
      // och vakten mäter fel block.
      const block = usersBlock.split(/\n {4}match \//)[0];
      for (const falt of anvandarfaltLista.falt) {
        if (!block.includes(`"${falt}"`)) {
          brott.push(`regelfragmentets users-block saknar fältet "${falt}" i sin hasOnly. ANVANDARFALT (grupp.js) och regeln (regler.js) har glidit isär.`);
        }
      }
    }
  }
}

// ── 4. KATEGORIFALT bär groupId (#162) ─────────────────────────────────────
//
// ⛔ VARFÖR DEN HÄR ÄR ETT EGET STEG, INTE BARA STEG 1. Steg 1 fäller ett
// fält som pekar på grupper i FEL FORM (plural, "invitedGroupIds" osv). Den
// säger ingenting om en lista som INTE HAR NÅGOT gruppfält alls, och det var
// exakt läget i cllp/bolag-ops#447: `KATEGORIFALT` saknade `groupId` helt,
// alltså 0 träffar för steg 1 att fälla, medan appen ändå inte kunde göra en
// katalog gruppens egen (väg C, #160). En vakt som bara letar efter fel form
// missar den som saknar formen helt.
{
  const kategorifaltLista = listor.find((l) => l.lista === "KATEGORIFALT");
  if (!kategorifaltLista) {
    brott.push(
      "KATEGORIFALT hittades inte bland fältlistorna. Katalogerna är gruppens egna (#162), och utan listan går det inte att se om schemat glömt groupId.",
    );
  } else if (!kategorifaltLista.falt.includes(ENDA)) {
    brott.push(
      `${kategorifaltLista.fil}: KATEGORIFALT saknar "${ENDA}". En kategori utan grupp delas av alla grupper som använder katalogen, exakt det väg C (#160) skulle stoppa.`,
    );
  }
}

// ── 5. En kategori UTAN groupId är röd, i modellen, i källan och i regeln (0.33.0, #162) ─
//
// ⛔ STEG 4 MÄTER EN LISTA, DET HÄR MÄTER BETEENDE. Att `groupId` står i KATEGORIFALT betyder bara att
// fältet är TILLÅTET, och i 0.29.0 till 0.32.1 var det precis det det var: tillåtet, men en kategori utan
// grupp byggdes utan klagan så länge ingen satte `grupp: true`. Ett närvarogrep efter "groupId" i källan
// hade stått grönt genom hela den perioden (arbetsreglernas punkt 4). Här BYGGS en kategori utan groupId,
// en katalogkälla utan grupp, och regeltexten för katalogen läses, och alla tre måste säga nej.
{
  const utanGrupp = { id: "provkategori", namn: { sv: "Prov" }, farg: 1, ikon: "check", fas: "aktiv" };
  let kastade = null;
  try {
    byggKategori(utanGrupp);
  } catch (e) {
    kastade = e instanceof Error ? e.message : String(e);
  }
  if (!kastade || !kastade.includes("groupId")) {
    brott.push(
      `byggKategori byggde en kategori utan groupId med förvalet${kastade ? ` (kastade, men inte om groupId: ${kastade})` : ""}. En kategori är en grupps egen (#162), och bara en mall eller en moduls kodkatalog får säga grupp: false uttryckligen.`,
    );
  }

  for (const [vad, konfig] of [
    ["utan groupId", {}],
    ["med groupId: null", { groupId: null }],
  ]) {
    let kalla = null;
    try {
      kalla = createCatalogSource({ source: { list: async () => [], create: async () => ({}) }, collection: "provkatalog", ...konfig });
    } catch {
      // Rätt: en katalogkälla utan grupp går inte att bygga.
    }
    if (kalla) {
      brott.push(`createCatalogSource gick att bygga ${vad}. En källa utan grupp läser och skriver mot varje grupps kategorier på en gång.`);
    }
  }

  const katalogregel = katalogregelfragment("provkatalog");
  const skapa = (katalogregel.match(/allow create: if ([\s\S]*?);/) || [])[1] || "";
  if (!skapa.includes("(request.resource.data.groupId)")) {
    brott.push("katalogregelfragmentets create slår inte upp radens groupId. En kategori utan grupp hade kunnat skapas.");
  }
  if (!skapa.includes("id.matches(request.resource.data.groupId")) {
    brott.push("katalogregelfragmentets create låser inte dokumentnyckeln till radens grupp (groupId|id). En admin i en grupp kan då kapa en annan grupps nyckel.");
  }
}

if (brott.length === 0) {
  const falt = listor.reduce((n, l) => n + l.falt.length, 0);
  console.log(`check-gruppnyckel: ${listor.length} fältlistor och ${falt} fält, plus ${regeltexter.length} regeltexter. Exakt en gruppnyckel, och den heter ${ENDA}.`);
  process.exit(0);
}

console.error(`check-gruppnyckel: ${brott.length} brott mot en gruppnyckel per rad\n`);
for (const b of brott) console.error(`  ${b}`);
process.exit(1);
