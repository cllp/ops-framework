#!/usr/bin/env node
/**
 * Vakt: ingenting som tillhör en person eller ett bolag får ligga i ramverket (cllp/ops-framework#7).
 *
 * ══ ⛔ VARFÖR ════════════════════════════════════════════════════════════════════════════════════════
 *
 * Ramverket delas av varje plattform som installerar paketet, och det innehåller ingen persons eller bolags uppgifter i någon av dem. Hamnar en
 * enda rad här sprids den till varje installation, och den går inte att ta tillbaka: en publicerad commit finns kvar i historiken även efter att
 * filen raderats. Det är dyrast för det som är kort och oåterkalleligt, och det är därför vakten letar efter just det.
 *
 * ══ ⛔ BARA FORMER, INGEN LISTA ÖVER ORD OCH INGEN LISTA ÖVER FILER ═══════════════════════════════════
 *
 * Ett personnummer ser likadant ut oavsett vem det tillhör. Ord byts ut, former gör det inte. Därför letar vakten efter FORM:
 *
 *   - personnummer och samordningsnummer (tio eller tolv siffror med bindestreck eller plus, rimligt datum, giltig kontrollsiffra),
 *   - organisationsnummer (tio siffror med bindestreck, tredje siffran 2 eller högre, giltig kontrollsiffra),
 *   - IBAN (alla länder, giltig kontrollsumma mod 97),
 *   - nyckelformat: privata nycklar (PEM) och API-nycklar i kända format (GitHub, Google, AWS, Slack, Stripe, Anthropic, npm).
 *
 * Beslutet (CP 2026-10-26, "Kör och förenkla", se #7): den första versionen hade också en TILLÅTLISTA över vilka filer ramverket får bestå av,
 * plus bankgiro, belopp i kronor och plattformsnamn. Tillåtlistan stryks: i ett repo som växer så här snabbt blir den ständigt röd, och en
 * ständigt röd vakt stängs av. Bankgiro, belopp och plattformsnamn stryks av samma skäl (för många falska positiva, för lite som är oåterkalleligt).
 * Det som blir kvar är det smala, billiga och katastrofala.
 *
 * ⛔ KONTROLLSIFFRAN ÄR MED FLIT. En tiosiffrig sträng med bindestreck är ett personnummer ungefär lika ofta som den är ett löpnummer, och en
 * vakt som larmar på löpnummer stängs av inom en vecka. Ett riktigt personnummer, organisationsnummer eller IBAN klarar alltid sin kontrollsiffra;
 * ett påhittat exempel gör det nästan aldrig. Priset är att en felskriven siffra släpps igenom, och det priset är rätt: en felskriven siffra pekar
 * inte ut någon.
 *
 * ⛔ VAKTEN SKRIVER ALDRIG UT DET DEN HITTAR. Fil, rad och vilken sorts uppgift, inte värdet: en vaktutskrift hamnar i en CI-logg, och då hade vakten
 * själv spridit det den skulle hindra.
 *
 * ══ ⛔ TYSTNAD ÄR INTE ETT SVAR (arbetsreglernas punkt 4 och 5) ══════════════════════════════════════
 *
 * Det som inte kunde läsas räknas inte som rent:
 *
 *   - en fil som inte går att läsa, och en symbolisk länk (vars mål vakten inte följer), är ett brott och inte ett undantag,
 *   - binära filer (en NUL-byte i filen) hoppas över av INNEHÅLLET och inte av ett filnamnsslut, så att ingen lista över filformat behöver hållas.
 *     Antalet skrivs ut PER ÄNDELSE. UTF-16 med BOM (Windows) avkodas och läses. En binär fil vars ändelse också finns bland trädets textfiler
 *     (en `.md` med NUL-byte: UTF-16 utan BOM, eller en trasig fil) är ett brott och inte en tyst överhoppad fil; ändelserna härleds ur trädet,
 *     så ingen lista behöver hållas. Det enklaste som inte blir falsk grönhet: en PDF eller en bild hoppas över, en textfil som inte gick att läsa gör det inte.
 *   - GOLV: minst `GOLV_FILER` textfiler lästa. En vakt som blir grön av att inget lästes mäter ingenting.
 *
 * ══ ⛔ INGET TAK, FÖR DET FINNS INGET ATT TÅLA ═════════════════════════════════════════════════════════
 *
 * Arbetsreglernas punkt 4 säger att man vaktar en skuld med ett tak som bara får sjunka, inte noll. Här finns ingen skuld: mätt mot `main` när vakten
 * kopplades in (2026-10-26) gav den NOLL träffar, så noll är dagens läge och varje träff är röd. Ett tak som stod över noll hade släppt in nya
 * träffar, och ett tak byggt för ett läge som inte finns vore en gren ingen provat. Visar sig en äkta träff som inte går att ta bort: bygg taket då,
 * med träffarna listade och en provad gren, i samma PR.
 *
 * Kör: node scripts/check-no-app-content.mjs [mapp]
 * Exit: 0 grönt, 1 brott med fil, rad och sort.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rot = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Textfiler som minst måste ha lästs. */
export const GOLV_FILER = 600;

/** Kataloger som inte är paketets egna: installerade paket, bygget och git. */
const UTANFOR = new Set(["node_modules", "dist", ".git"]);

/**
 * Luhn över en sträng av siffror. Samma kontrollsiffra som personnummer och organisationsnummer använder (de tio siffrorna utan bindestreck).
 *
 * @param {string} siffror
 */
export function luhn(siffror) {
  let summa = 0;
  for (let i = 0; i < siffror.length; i += 1) {
    let s = Number(siffror[siffror.length - 1 - i]);
    if (i % 2 === 1) {
      s *= 2;
      if (s > 9) s -= 9;
    }
    summa += s;
  }
  return summa % 10 === 0;
}

/**
 * IBAN-längd per land (ISO 13616-registret). ⛔ LÄNGDEN AVGÖR VAD SOM ÄR EN IBAN, och inte hur långt ett mönster råkar nå: ett girigt mönster som
 * svalde "SEK" efter kontot prövade bara den långa, felaktiga strängen och släppte igenom den riktiga. Ett land som inte står här prövas inte alls
 * (en IBAN därifrån missas); ett nytt land läggs till här.
 *
 * @type {Readonly<Record<string, number>>}
 */
export const IBAN_LANGD = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26,
  IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18,
  NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24,
  TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

/**
 * Finns det en giltig IBAN i början av kandidaten? Kandidaten är en träff av IBAN-mönstret och kan sluta med ord eller siffror som inte hör till
 * kontot ("... 7466 SEK"). Landets längd väljer hur många tecken som tas, mellanslag räknas inte, och de tecknen ska klara kontrollsumman.
 *
 * @param {string} kandidat
 */
export function ibanIBorjan(kandidat) {
  const tecken = kandidat.replace(/ /g, "");
  const langd = IBAN_LANGD[tecken.slice(0, 2)];
  return langd !== undefined && tecken.length >= langd && ibanGiltig(tecken.slice(0, langd));
}

/**
 * IBAN-kontrollen: flytta de fyra första tecknen sist, byt bokstäver mot tal (A=10), och resten vid division med 97 ska vara 1.
 *
 * @param {string} iban utan mellanslag
 */
export function ibanGiltig(iban) {
  if (iban.length < 15 || iban.length > 34) return false;
  const omflyttad = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const tecken of omflyttad) {
    const kod = tecken >= "A" && tecken <= "Z" ? String(tecken.charCodeAt(0) - 55) : tecken;
    for (const siffra of kod) rest = (rest * 10 + Number(siffra)) % 97;
  }
  return rest === 1;
}

/**
 * Formerna. `monster` har alltid flaggan g. `giltig` får träffen (hela matchen) och avgör om den är en riktig uppgift eller bara har formen.
 *
 * @type {ReadonlyArray<{ namn: string, monster: RegExp, giltig?: (traff: string) => boolean }>}
 */
export const FORMER = [
  {
    namn: "personnummer eller samordningsnummer",
    // Avgränsad mot siffror och bokstäver, inte mot bindestreck och understreck: `kund-850709-...` och `id_850709-...` är lika mycket ett personnummer.
    // Datum: månad 01 till 12, dag 01 till 31 (samordningsnummer lägger 60 på dagen). Bindestreck eller plus är KRAV: tolv siffror utan avgränsare är
    // lika ofta en tidsstämpel (ÅÅÅÅMMDDttmm).
    monster: /(?<![0-9A-Za-z])((?:19|20)?\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01]|[6-8]\d|9[01])[-+](\d{4})(?![0-9A-Za-z])/g,
    giltig: (t) => luhn(t.replace(/\D/g, "").slice(-10)),
  },
  {
    namn: "organisationsnummer",
    // Tredje siffran 2 eller högre skiljer det från ett personnummer, vars tredje siffra är månadens första (0 eller 1).
    monster: /(?<![0-9A-Za-z])\d{2}[2-9]\d{3}-\d{4}(?![0-9A-Za-z])/g,
    giltig: (t) => luhn(t.replace(/\D/g, "")),
  },
  {
    namn: "IBAN",
    // Kandidaten får vara längre än en IBAN (högst 34 tecken, med mellanslag emellan); `ibanIBorjan` tar landets längd ur den.
    monster: /(?<![0-9A-Za-z])[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}/g,
    giltig: ibanIBorjan,
  },
  { namn: "privat nyckel (PEM)", monster: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g },
  { namn: "GitHub-token", monster: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/g },
  { namn: "Google-API-nyckel", monster: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { namn: "Google OAuth-hemlighet", monster: /\bGOCSPX-[0-9A-Za-z_-]{20,}/g },
  { namn: "AWS-åtkomstnyckel", monster: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { namn: "Slack-token", monster: /\bxox[abprs]-[0-9A-Za-z-]{10,}/g },
  { namn: "Stripe-nyckel", monster: /\b[sr]k_live_[0-9A-Za-z]{16,}/g },
  { namn: "Anthropic-nyckel", monster: /\bsk-ant-[0-9A-Za-z_-]{20,}/g },
  { namn: "npm-token", monster: /\bnpm_[0-9A-Za-z]{36}\b/g },
];

/**
 * Alla filer under en mapp, utan de som ligger utanför paketet.
 *
 * @param {string} mapp
 * @param {string} [bas]
 * @returns {{ filer: string[], lankar: string[] }}
 */
function samla(mapp, bas = "") {
  /** @type {string[]} */
  const filer = [];
  /** @type {string[]} */
  const lankar = [];
  for (const post of fs.readdirSync(mapp, { withFileTypes: true })) {
    if (UTANFOR.has(post.name)) continue;
    const rel = bas ? `${bas}/${post.name}` : post.name;
    if (post.isSymbolicLink()) lankar.push(rel);
    else if (post.isDirectory()) {
      const inre = samla(path.join(mapp, post.name), rel);
      filer.push(...inre.filer);
      lankar.push(...inre.lankar);
    } else filer.push(rel);
  }
  return { filer, lankar };
}

/**
 * Träffarna i en text: rad och sort. Aldrig värdet.
 *
 * @param {string} text
 * @returns {{ rad: number, namn: string }[]}
 */
export function hitta(text) {
  /** @type {{ rad: number, namn: string }[]} */
  const ut = [];
  for (const { namn, monster, giltig } of FORMER) {
    monster.lastIndex = 0;
    for (const m of text.matchAll(monster)) {
      if (giltig && !giltig(m[0])) continue;
      ut.push({ rad: text.slice(0, m.index).split("\n").length, namn });
    }
  }
  return ut;
}

/**
 * Filens text, eller `null` när den är binär. UTF-16 med BOM avkodas; en NUL-byte i övrigt gör filen binär.
 *
 * @param {Buffer} data
 * @returns {string | null}
 */
export function avkoda(data) {
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) return data.subarray(2, 2 + ((data.length - 2) & ~1)).toString("utf16le");
  if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) return Buffer.from(data.subarray(2, 2 + ((data.length - 2) & ~1))).swap16().toString("utf16le");
  return data.includes(0) ? null : data.toString("utf8");
}

/** @param {string} rel */
function andelseAv(rel) {
  const namn = rel.slice(rel.lastIndexOf("/") + 1);
  const punkt = namn.lastIndexOf(".");
  return punkt > 0 ? namn.slice(punkt + 1).toLowerCase() : "";
}

function main() {
  if (!fs.existsSync(rot) || !fs.statSync(rot).isDirectory()) {
    console.error(`check-no-app-content: RÖTT. Hittar inte mappen ${rot}. En vakt som letar på fel plats är grön av fel skäl.`);
    process.exit(1);
  }

  const { filer, lankar } = samla(rot);
  /** @type {string[]} */
  const brott = [];
  for (const l of lankar) {
    brott.push(`${l} är en symbolisk länk, och vakten följer inte länkar. Det den pekar på lästes inte. Ersätt länken med filen, eller ta bort den.`);
  }

  let lasta = 0;
  let binara = 0;
  /** @type {Map<string, number>} */
  const binaraPerAndelse = new Map();
  /** @type {{ rel: string, andelse: string }[]} */
  const binaraFiler = [];
  /** @type {Set<string>} ändelser som finns bland de filer som lästes som text */
  const textandelser = new Set();
  /** @type {{ fil: string, rad: number, namn: string }[]} */
  const traffar = [];
  for (const rel of filer) {
    /** @type {Buffer} */
    let data;
    try {
      data = fs.readFileSync(path.join(rot, rel));
    } catch (e) {
      brott.push(`${rel} kunde inte läsas (${e instanceof Error ? e.message : String(e)}). Det som inte lästes är inte rent.`);
      continue;
    }
    // Binärt avgörs av innehållet och inte av filnamnet: en lista över filformat vore en lista att hålla i takt.
    // UTF-16 med BOM (en textfil sparad i Windows) är text och läses; allt annat med en NUL-byte är binärt.
    const text = avkoda(data);
    if (text === null) {
      binara += 1;
      const andelse = andelseAv(rel);
      binaraPerAndelse.set(andelse, (binaraPerAndelse.get(andelse) ?? 0) + 1);
      binaraFiler.push({ rel, andelse });
      continue;
    }
    lasta += 1;
    const egen = andelseAv(rel);
    textandelser.add(egen);
    for (const t of hitta(text)) traffar.push({ fil: rel, ...t });
  }

  // ⛔ EN FIL SOM SER UT SOM TEXT MEN INTE LÄSTES SOM TEXT ÄR ETT BROTT. Ändelsen avgör inte vad som är binärt, men den avgör vad som är MISSTÄNKT:
  // finns samma ändelse bland trädets textfiler (en `.md` eller `.txt` med NUL-byte, alltså UTF-16 utan BOM eller en trasig fil) vet vakten inte
  // vad som står i den. Ändelserna härleds ur trädet och ingen lista behöver hållas.
  for (const { rel, andelse } of binaraFiler) {
    if (andelse !== "" && textandelser.has(andelse)) {
      brott.push(`${rel} har en NUL-byte men en ändelse som textfiler i trädet har, och lästes därför inte. Spara om den som UTF-8 (eller UTF-16 med BOM). Det som inte lästes är inte rent.`);
    }
  }

  if (lasta < GOLV_FILER) {
    brott.push(
      `Bara ${lasta} textfiler lästes (${binara} binära, ${lankar.length} länkar), golvet är ${GOLV_FILER}. Vakten letade nästan säkert på fel plats, och ett tomt underlag är inte ett godkänt utfall.`,
    );
  }

  if (traffar.length > 0) {
    brott.push(
      `${traffar.length} träffar. Ramverket ska inte bära en persons eller ett bolags uppgifter. Ta bort dem; en uppgift som redan publicerats ligger kvar i historiken och ska flaggas till CP.`,
    );
  }

  if (brott.length > 0) {
    console.error(`\ncheck-no-app-content: RÖTT, ${brott.length} brott\n`);
    for (const t of traffar.slice(0, 50)) console.error(`  ${t.fil}:${t.rad} innehåller ${t.namn}`);
    if (traffar.length > 50) console.error(`  ... och ${traffar.length - 50} till`);
    for (const b of brott) console.error(`  ${b}`);
    process.exit(1);
  }

  const per = binara > 0 ? `: ${[...binaraPerAndelse].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([e, n]) => `${e || "utan ändelse"} ${n}`).join(", ")}` : "";
  console.log(
    `check-no-app-content: ${lasta} textfiler lästa (${binara} binära hoppade över på innehållet${per}, ${lankar.length} länkar), inga träffar. Letar efter personnummer, organisationsnummer, IBAN och nyckelformat.`,
  );
}

/** Samma realpath-skäl som check-utvecklarord.mjs: temp-kopior på macOS. */
function arHuvudmodul() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
  } catch {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  }
}
if (arHuvudmodul()) main();
