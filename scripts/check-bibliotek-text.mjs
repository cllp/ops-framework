#!/usr/bin/env node
/**
 * Vakt: Bibliotekets synliga text står i ordböcker med `sv` och `en`, inte som svensk text direkt i koden (0.251.0, cllp/ops-framework#612).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════
 *
 * CP 2026-11-17, med engelska valt i appen: "Har engelska i systemet men modulen Bibliotek är på svenska". På samma skärm stod "Search...",
 * "Paste" och "Tags" på engelska och rubriken "Bibliotek", knappen "Ny" och "Biblioteket är tomt." på svenska. Mätt: `OpsBibliotek.jsx`
 * hade ordböcker (`ORD_BIBLIOTEKLISTA`, `ORD_ANTECKNINGSFIL` med flera), men 145 ställen i filen bar svensk text skriven direkt i koden
 * (mätt med vaktens egen regel på 0.250.0; två av dem var interna namn i ett konsolmeddelande, resten text som visas).
 * Ordböckerna täckte det som någon råkat flytta, och resten följde aldrig språket. Det syntes inte i något prov, för proven letar efter
 * svensk text och det svenska utfallet var rätt.
 *
 * ══ ⛔ ETT TAK SOM BARA FÅR SJUNKA ═══════════════════════════════════════
 *
 * Arbetsreglernas punkt 4, samma form som `check-sprak.mjs`. 0.251.0 flyttade all synlig text till ordböcker, så taket är noll. Hamnar en
 * svensk text i koden igen är svaret en ordpost, inte ett högre tak. Ligger räkningen under taket är vakten också röd: sänk TAK i samma PR.
 *
 * ══ ⛔ VAD SOM RÄKNAS ════════════════════════════════════════════════════
 *
 * Filen läses som syntax (`@babel/parser`, JSX), inte med ett grep, så att en kommentar eller ett attributnamn aldrig räknas.
 *
 * - JSX-text med minst en bokstav.
 * - En sträng eller mallsträng som innehåller å, ä eller ö, eller ett vanligt svenskt ord och samtidigt ett mellanslag eller en versal
 *   först. Det andra villkoret skiljer "Ny" och "Spara" (text) från "ny" och "alla" (interna värden som jämförs och skickas runt).
 *
 * Räknas inte: allt inuti ett objekt som har både en `sv`- och en `en`-nyckel (en ordpost), allt inuti `new XxxError(...)` och `throw`
 * (riktat till en utvecklare), argumenten till `console.*`, värdet i ett `data-*`- eller `className`-attribut, en sträng som börjar på `data-` eller innehåller `[data-` (en väljare),
 * importer och exporter.
 *
 * ⛔ VAKTEN SER INTE ALLT: ett ensamt ord utan å, ä eller ö som inte står i ordlistan (`SVENSKA_ORD`) släpps igenom. Hittar du ett sådant,
 * lägg ordet i listan och texten i en ordbok.
 *
 * GOLV: filen ska gå att läsa och ge minst 500 JSX-noder. En vakt som blir grön av att inget lästes mäter ingenting.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fil = path.join(rot, "src", "components", "OpsBibliotek.jsx");

/** Taket. ⛔ FÅR BARA SJUNKA. */
export const TAK = 0;
/** Golvet: minst så många JSX-noder (element, attribut, uttryck och text) ska filen ge. */
export const GOLV_JSX = 500;

const SVENSKA_TECKEN = /[åäöÅÄÖ]/;
/** Vanliga svenska ord som kan stå i en text utan å, ä eller ö. Gemener, jämförs mot orden i strängen. */
const SVENSKA_ORD = new Set(
  [
    "och att en ett den det som med till av inte kan ny nytt nya spara sparad avbryt ta bort kopiera lista listor listan",
    "bibliotek biblioteket anteckning anteckningen anteckningar bild bilder ljud ljudet dokument ingen inga inget alla allt",
    "redigera radera dela delad visa flytta flyttad kopierad kunde posten post poster har finns eller om du din ditt dina vill",
    "ladda upp ned ner namn namnet rubrik rubriken adress adressen tom tomt klar fel igen sida sidan skriv skriver ut",
    "taggar tagg taggen arkivera arkiverad arkivet arkiveras hittar matchar laddar lagt plats platsen typ fil filer filen",
    "filerna sparas tillbaka mer meny klistra in hela kommentera saknas kopplad vald valt ny nytt detaljer spela grupp gruppen",
  ].join(" ").split(" "),
);

/** @param {string} s */
function arSvenskText(s) {
  const t = s.trim();
  if (!/\p{L}/u.test(t)) return false;
  if (t.startsWith("data-") || t.includes("[data-")) return false;
  if (SVENSKA_TECKEN.test(t)) return true;
  const ord = t.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (!ord.some((o) => SVENSKA_ORD.has(o))) return false;
  return /\s/.test(t) || /^\p{Lu}/u.test(t);
}

/** @param {any} n */
function arOrdpost(n) {
  if (n.type !== "ObjectExpression") return false;
  const nycklar = new Set(n.properties.map((/** @type {any} */ p) => (p.key ? (p.key.type === "Identifier" ? p.key.name : p.key.value) : null)));
  return nycklar.has("sv") && nycklar.has("en");
}

/** @param {any} n */
function arFelForUtvecklare(n) {
  if (n.type === "ThrowStatement") return true;
  if (n.type !== "NewExpression") return false;
  const namn = n.callee?.type === "Identifier" ? n.callee.name : n.callee?.type === "MemberExpression" ? n.callee.property?.name : "";
  return typeof namn === "string" && /Error$/.test(namn);
}

/** @param {any} n */
function arDataAttribut(n) {
  if (n.type !== "JSXAttribute" || n.name?.type !== "JSXIdentifier") return false;
  const namn = String(n.name.name);
  return namn.startsWith("data-") || namn === "className";
}

/** Ett anrop av `console.*`: ett meddelande till den som felsöker, inte till användaren. @param {any} n */
function arKonsol(n) {
  return n.type === "CallExpression" && n.callee?.type === "MemberExpression" && n.callee.object?.type === "Identifier" && n.callee.object.name === "console";
}

const HOPPA_OVER = new Set(["ImportDeclaration", "ExportAllDeclaration"]);

/**
 * Räknar svensk text som visas utanför en ordbok.
 * @param {string} kod
 * @returns {{ traffar: Array<{ rad: number, text: string }>, jsxNoder: number }}
 */
export function rakna(kod) {
  const ast = parse(kod, { sourceType: "module", plugins: ["jsx"] });
  /** @type {Array<{ rad: number, text: string }>} */
  const traffar = [];
  let jsxNoder = 0;
  /** @param {any} n */
  const ga = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const x of n) ga(x);
      return;
    }
    if (typeof n.type !== "string") return;
    if (HOPPA_OVER.has(n.type) || arOrdpost(n) || arFelForUtvecklare(n) || arKonsol(n) || arDataAttribut(n)) return;
    if (n.type === "ExportNamedDeclaration" && n.source) return;
    if (n.type.startsWith("JSX")) jsxNoder += 1;
    const rad = n.loc?.start.line ?? 0;
    if (n.type === "JSXText") {
      const t = n.value.trim();
      if (/\p{L}/u.test(t)) traffar.push({ rad, text: t });
    } else if (n.type === "StringLiteral") {
      if (arSvenskText(n.value)) traffar.push({ rad, text: n.value });
    } else if (n.type === "TemplateLiteral") {
      // Delarna läses ihop utan mellanrum, så att `${a}:${b}` inte får ett mellanslag som det aldrig hade.
      const t = n.quasis.map((/** @type {any} */ q) => q.value.cooked ?? "").join("");
      if (arSvenskText(t)) traffar.push({ rad, text: n.quasis.map((/** @type {any} */ q) => q.value.cooked ?? "").join("${…}") });
    }
    for (const k of Object.keys(n)) {
      if (k === "loc" || k === "start" || k === "end" || k === "leadingComments" || k === "trailingComments" || k === "innerComments" || k === "extra") continue;
      // En objektnyckel är ett internt namn, aldrig text som visas.
      if (k === "key" && (n.type === "ObjectProperty" || n.type === "ObjectMethod")) continue;
      ga(n[k]);
    }
  };
  ga(ast.program);
  return { traffar, jsxNoder };
}

function main() {
  let kod;
  try {
    kod = fs.readFileSync(fil, "utf8");
  } catch (e) {
    console.error(`check-bibliotek-text: RÖTT. ${path.relative(rot, fil)} gick inte att läsa (${e instanceof Error ? e.message : e}). En vakt utan underlag mäter ingenting.`);
    process.exit(1);
  }
  const { traffar, jsxNoder } = rakna(kod);
  if (jsxNoder < GOLV_JSX) {
    console.error(`check-bibliotek-text: RÖTT. Bara ${jsxNoder} JSX-noder lästes i ${path.relative(rot, fil)}, golvet är ${GOLV_JSX}. En vakt utan underlag mäter ingenting.`);
    process.exit(1);
  }
  if (traffar.length > TAK) {
    console.error(`check-bibliotek-text: RÖTT. ${traffar.length} svenska texter direkt i koden i OpsBibliotek.jsx, taket är ${TAK}.`);
    console.error("  Lägg texten i en ordbok med sv och en (mönstret ORD_BIBLIOTEKLISTA och ordet()) i stället för att höja taket.");
    for (const t of traffar.slice(0, 20)) console.error(`  rad ${t.rad}: ${JSON.stringify(t.text)}`);
    process.exit(1);
  }
  const marginal = TAK - traffar.length;
  console.log(`check-bibliotek-text: ${jsxNoder} JSX-noder lästa, ${traffar.length} svenska texter utanför en ordbok (tak ${TAK})${marginal > 0 ? `. ⛔ ${marginal} under taket: sänk TAK till ${traffar.length} i samma PR` : ""}.`);
  if (marginal > 0) process.exit(1);
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
