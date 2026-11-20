/*
 * ══ ⛔ LÅNG TEXT I CHATTEN BLIR EN FIL (0.246.0, cllp/lifehub.app#903) ════════════════════════════════════════════════════════
 *
 * CP 2026-11-19, i ett samtal med Lars: "Lång text i chatten. Lägg till som en fil, med storleksbegränsning istället." En inklistrad
 * text på flera sidor blev en bubbla som tog över hela tråden, och över meddelandets tak (`MAX_MEDDELANDE`) gick den inte alls att
 * skicka. Nu blir den en textfil (`text/plain`) med samma form och samma tak som varje annan bilaga, och bubblan visar de första
 * raderna (`textensBorjan`). Ett tryck öppnar hela texten i samma dialog som en uppladdad textfil.
 *
 * ⛔ INGEN NY MODELL. Filen är en vanlig bilaga (`KOMMENTARBILAGAFALT`), prövad av `kommentarbilagaFel` och regeln, med taket
 * `MAX_KOMMENTARBILAGA`. En egen samling eller ett eget fält för "lång text" hade varit en andra sorts bilaga att hålla i takt.
 *
 * ⛔ GRÄNSEN GÄLLER INKLISTRING, INTE SKRIVANDE. Den som skriver ett långt svar själv får inte texten flyttad under fingrarna. Över
 * meddelandets tak erbjuder raden under fältet "Gör till fil" i stället, så att ingen behöver korta en text för att få skicka den.
 */
import { KOMMENTARBILAGA_TYPER, MAX_BILAGENAMN, MAX_KOMMENTARBILAGA } from "./handelsemodell.js";

/** En inklistrad text från så här många tecken blir en fil. Under det är den ett vanligt meddelande. */
export const TEXTFIL_FRAN = 2000;

/** Typen en textfil får. */
export const TEXTFIL_TYP = "text/plain";

/** Så många tecken ur första raden blir filnamnet. */
const NAMN_TECKEN = 40;

/** Prefixet på en textfils data-URL. */
const PREFIX = `data:${TEXTFIL_TYP};base64,`;

/**
 * Filnamnet för en text: första raden som inte är tom, kortad till 40 tecken, utan tecken som inte går i ett filnamn, och `.txt`.
 * "Text.txt" när texten inte har något att ta ett namn ur.
 *
 * @param {unknown} text
 * @returns {string}
 */
export function textfilnamn(text) {
  const forsta = String(text ?? "")
    .split(/\r?\n/)
    .map((r) => r.trim())
    .find(Boolean) ?? "";
  // eslint-disable-next-line no-control-regex
  const rensad = forsta.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const kort = [...rensad].slice(0, NAMN_TECKEN).join("").trimEnd();
  return `${kort || "Text"}.txt`.slice(0, MAX_BILAGENAMN);
}

/** @param {Uint8Array} bytes */
function base64(bytes) {
  let binar = "";
  const BIT = 0x8000;
  for (let i = 0; i < bytes.length; i += BIT) binar += String.fromCharCode(...bytes.subarray(i, i + BIT));
  return btoa(binar);
}

/**
 * Största antalet byte en textfil kan ha och ändå rymmas i taket.
 * Base64 gör tre byte till fyra tecken, och prefixet tar sin del.
 */
export const TEXTFIL_MAX_BYTE = Math.floor((MAX_KOMMENTARBILAGA - PREFIX.length) / 4) * 3;

/**
 * En text som en bilaga, eller varför den inte ryms.
 *
 * ⛔ UTF-8. Svenska tecken tar två byte, så taket i tecken text är lägre än taket i byte, och storleken räknas på det som skrivs.
 * ⛔ FÖR STOR ÄR ETT SVAR, INTE ETT KAST OCH ALDRIG EN KAPNING (regel 5): `{ forStor: { byte, tak } }`, så att vyn kan säga
 * siffrorna. En tom text är ingen fil.
 *
 * @param {string} text
 * @param {string} [namn]
 * @returns {{ bilaga: import("./file.js").Bilaga } | { forStor: { byte: number, tak: number } } | { tom: true }}
 */
export function textSomBilaga(text, namn) {
  const t = String(text ?? "");
  if (!t.trim()) return { tom: true };
  const bytes = new TextEncoder().encode(t);
  if (bytes.length > TEXTFIL_MAX_BYTE) return { forStor: { byte: bytes.length, tak: TEXTFIL_MAX_BYTE } };
  const dataUrl = `${PREFIX}${base64(bytes)}`;
  return { bilaga: { dataUrl, namn: namn ?? textfilnamn(t), typ: TEXTFIL_TYP, tecken: dataUrl.length } };
}

/** Typerna vars början kan visas som text. */
const TEXTTYPER = ["text/plain", "text/csv"];

/**
 * Är bilagan en textfil (text eller CSV)?
 * @param {{ typ?: unknown } | null | undefined} bilaga
 */
export function arTextbilaga(bilaga) {
  return typeof bilaga?.typ === "string" && TEXTTYPER.includes(bilaga.typ) && (/** @type {readonly string[]} */ (KOMMENTARBILAGA_TYPER)).includes(bilaga.typ);
}

/**
 * Byten som text: UTF-8 först, och Windows-1252 när det inte är UTF-8 (en textfil sparad i ett äldre Windows-program), som
 * Bibliotekets förhandsvisning. `slut` säger att byten är ett utdrag, och då får de sista upp till tre byten vara ett tecken som
 * delats mitt i: de tas bort innan UTF-8 prövas, så att ett avklippt "ä" inte gör hela utdraget till Windows-1252.
 *
 * @param {Uint8Array} bytes
 * @param {boolean} utdrag
 */
function avkoda(bytes, utdrag) {
  for (let bort = 0; bort <= (utdrag ? 3 : 0); bort += 1) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, bytes.length - bort));
    } catch {
      // nästa längd
    }
  }
  return new TextDecoder("windows-1252").decode(bytes);
}

/**
 * Början av en textbilaga, för förhandsvisningen i tråden: högst `rader` rader med text och `tecken` tecken, utan tomma rader.
 * Tom sträng när bilagan inte är en textfil eller inte går att läsa, så att bubblan bara visar namnet som förut.
 *
 * ⛔ BARA BÖRJAN AVKODAS. En fil på en halv megabyte avkodas inte för tre rader: data-URL:en skärs vid så många base64-tecken som
 * `tecken` tecken kan ta (fyra byte per tecken som mest).
 *
 * @param {{ dataUrl?: unknown, typ?: unknown } | null | undefined} bilaga
 * @param {{ rader?: number, tecken?: number }} [val]
 * @returns {string}
 */
export function textensBorjan(bilaga, { rader = 3, tecken = 240 } = {}) {
  if (!arTextbilaga(bilaga) || typeof bilaga?.dataUrl !== "string") return "";
  const prefix = `data:${bilaga.typ};base64,`;
  if (!bilaga.dataUrl.startsWith(prefix)) return "";
  const hela = bilaga.dataUrl.slice(prefix.length);
  const behov = Math.ceil((tecken * 4) / 3) * 4;
  const utdrag = hela.length > behov;
  let binar;
  try {
    binar = atob(utdrag ? hela.slice(0, behov) : hela);
  } catch {
    return "";
  }
  const bytes = Uint8Array.from(binar, (c) => c.charCodeAt(0));
  // ⛔ Tomma rader räknas inte: tre rader förhandsvisning ska vara tre rader text, inte en rubrik och två tomrum.
  const raderna = avkoda(bytes, utdrag)
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((r) => r.trimEnd())
    .filter((r) => r.trim());
  const valda = raderna.slice(0, rader).join("\n");
  const kort = [...valda].slice(0, tecken).join("").trimEnd();
  const kapad = utdrag || raderna.length > rader || kort.length < valda.length;
  return kapad ? `${kort}…` : kort;
}
