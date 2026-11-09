/**
 * En anteckning in från en .md och ut som en fil (0.209.0, cllp/lifehub.app#706). Rena funktioner, ingen DOM.
 *
 * ── ⛔ IN: EN .MD BLIR EN ANTECKNING ─────────────────────────────────────
 *
 * CP i #706: "Lägg in som anteckning är bättre." En .md som lades in i Biblioteket blev förut en fil som inte gick att redigera (och formatet togs inte ens emot).
 * Nu läses den som text i webbläsaren och sparas som en vanlig anteckning genom appens `onSpara`, samma inmatning som en ny anteckning. Ingen ny posttyp och inget
 * nytt fält: en anteckning från en fil är en anteckning.
 *
 * - Rubriken är den första nivå-ett-rubriken (`# `) i texten, tolkad som visningen tolkar den (`splitMarkdown`: inte i ett kodblock, och utan formateringstecknen),
 *   annars filnamnet utan ändelse. Klippt till `MAX_BIBLIOTEKRUBRIK`.
 * - En text över `MAX_BIBLIOTEKTEXT` ryms inte i en anteckning. Den läggs in som FIL (`text/markdown`) i stället, och vyn säger varför (`OpsBibliotek`).
 * - En bild med en sökväg (`![...](a/b.png)`, inte ett säkert bildnamn enligt `sakertBildnamn`) och en länk som inte är http eller https visas som text i en anteckning
 *   (`lib/markdown.js`). Texten ändras inte, men vyn säger det efter importen, så att ingen tror att filen tappade något (regel 5).
 *
 * ── ⛔ UT: FILNAMNET ÄR RUBRIKEN ─────────────────────────────────────────
 *
 * `anteckningFilnamn` gör rubriken till ett namn som alla vanliga filsystem tar emot: inga snedstreck, kolon, frågetecken och liknande, inga styrtecken, och aldrig tomt.
 * Svenska tecken står kvar.
 */
import { MAX_BIBLIOTEKRUBRIK, MAX_BIBLIOTEKTEXT, trimSomRegeln } from "./bibliotek.js";
import { sakertBildnamn, splitMarkdown } from "./markdown.js";

/** Ändelserna som gör en fil till markdown, oavsett vad webbläsaren säger om typen (text/markdown, text/x-markdown eller ingenting). */
const MARKDOWN_ANDELSE = /\.(md|markdown)$/i;

/**
 * Är filnamnet en markdownfil (`.md` eller `.markdown`, oavsett versaler)?
 * @param {unknown} namn
 * @returns {boolean}
 */
export function arMarkdownFilnamn(namn) {
  return typeof namn === "string" && MARKDOWN_ANDELSE.test(namn.trim());
}

/**
 * Texten utan kodblock och kodsnuttar, så att en bild eller länk som står som exempel i kod inte räknas. Samma staket som `splitMarkdown`.
 * @param {string} text
 */
function utanKod(text) {
  const ut = [];
  let iKod = false;
  for (const rad of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*```/.test(rad)) {
      iKod = !iKod;
      continue;
    }
    if (!iKod) ut.push(rad.replace(/`[^`\n]+`/g, ""));
  }
  return ut.join("\n");
}

/**
 * Hur många bilder med en sökväg och hur många länkar som inte är http eller https texten har, utanför kod. Båda visas som text i en anteckning.
 * @param {string} text
 * @returns {{ bilder: number, lankar: number }}
 */
export function sokvagarSomText(text) {
  const ren = utanKod(typeof text === "string" ? text : "");
  let bilder = 0;
  const utanBilder = ren.replace(/!\[[^\]\n]*\]\(([^)\s]+)\)/g, (hela, mal) => {
    if (sakertBildnamn(mal)) return hela;
    bilder += 1;
    return "";
  });
  let lankar = 0;
  for (const m of utanBilder.matchAll(/(?<!!)\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
    if (!/^https?:\/\//i.test(m[1])) lankar += 1;
  }
  return { bilder, lankar };
}

/**
 * Filnamnet utan ändelse, som rubrik.
 * @param {string} namn
 */
const utanAndelse = (namn) => namn.replace(/\.[^.]+$/, "") || namn;

/**
 * En .md som anteckning. Se filens huvud.
 *
 * @param {{ namn: string, text: string }} fil Filens namn och dess text, redan läst som UTF-8.
 * @returns {{ rubrik: string, text: string, forLang: boolean, bilder: number, lankar: number }} `forLang` när texten inte ryms i en anteckning (`MAX_BIBLIOTEKTEXT`);
 *   `bilder` och `lankar` räknar det som visas som text (`sokvagarSomText`).
 */
export function markdownSomAnteckning({ namn, text }) {
  const t = typeof text === "string" ? text.replace(/^﻿/, "") : "";
  const forsta = splitMarkdown(t).find((b) => b.kind === "heading" && b.level === 1);
  const urRubrik = forsta && forsta.kind === "heading" ? trimSomRegeln(forsta.inline.map((b) => b.value).join("")) : "";
  const rubrik = (urRubrik || trimSomRegeln(utanAndelse(String(namn ?? "")))).slice(0, MAX_BIBLIOTEKRUBRIK).trim() || "Anteckning";
  return { rubrik, text: t, forLang: t.length > MAX_BIBLIOTEKTEXT, ...sokvagarSomText(t) };
}

/**
 * Rubriken som ett säkert filnamn, med ändelsen. Se filens huvud.
 *
 * @param {unknown} rubrik
 * @param {string} andelse Utan punkt: `md`, `html` eller `pdf`.
 * @returns {string}
 */
export function anteckningFilnamn(rubrik, andelse) {
  const ren = String(rubrik ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120)
    .trim();
  return `${ren || "anteckning"}.${andelse}`;
}
