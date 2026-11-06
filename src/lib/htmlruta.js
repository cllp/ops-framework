/**
 * Det som bara RUTAN behöver: `srcdoc` och zoomen (0.192.0, cllp/ops-framework#529).
 *
 * ⛔ EGEN MODUL, INTE EN DEL AV `htmldokument.js`: Biblioteket importerar `htmldokument.js` för `htmlVyAdress` och hamnar i appens startfil, och paketet skriver en fil per källmodul. Zoomens skript och räkning
 * ligger här, där bara rutan (`OpsHtmlDokument`, som Biblioteket läser in lat, och helfönstret `OpsHtmlVy`) hämtar dem. Mätt: med zoomen i `htmldokument.js` växte en startfil som importerar `OpsBibliotek`.
 */
import { HTML_LANKSKRIPT, HTML_UTSKRIFTSSKRIPT } from "./htmldokument.js";

// ── Zoomen (0.192.0, cllp/ops-framework#529) ─────────────────────────────────────────────────────────────────────────

/**
 * ══ ⛔ ZOOMEN: ANPASSA TILL BREDD SOM FÖRVAL, − OCH +, CTRL- OCH CMD+HJUL BARA MED FOKUS ═════════════════════════════════
 *
 * CP 2026-11-06, med en skärmbild där rubriken och tabellens andra kolumn klipptes: "HTML-sidan är ofta för stor och man behöver scrolla i vyn." Och om förhandstitten: "Zoomen måste finnas med i förhandstitt."
 *
 * Mekanismen är densamma som utskriftens: rutans skript (`HTML_ZOOMSKRIPT`, i `srcdoc` efter de två andra) och meddelanden. Fyra sorter, och bara de:
 *
 *   appen → rutan   `HTML_ZOOMMEDDELANDE`      `{ typ, skala }`. Skriptet sätter `document.documentElement.style.zoom`, bara för ett meddelande från `parent` och bara för ett tal mellan `ZOOM_MIN` och `ZOOM_MAX`.
 *   rutan → appen   `HTML_MATTMEDDELANDE`      `{ typ, innehall, synlig }`: dokumentets bredd och den synliga bredden, mätta vid zoom 1 (zoomen sätts till 1 och tillbaka i samma uppgift, så inget ritas däremellan).
 *   rutan → appen   `HTML_ZOOMSTEGMEDDELANDE`  `{ typ, delta }`: ett Ctrl- eller Cmd+hjul, bara när dokumentet har fokus (`document.hasFocus()`). Då och bara då stoppar skriptet webbläsarens egen zoom av sidan.
 *   rutan → appen   `HTML_FOKUSMEDDELANDE`     `{ typ, fokus }`: dokumentet fick eller tappade fokus. Appen ritar ramen.
 *
 * ⛔ SANDLÅDAN ÄR OFÖRÄNDRAD (`HTML_SANDBOX`). Appen tar bara emot ett meddelande vars avsändare är just den rutans fönster, och bara i en känd form (`tolkaRutmeddelande`: känd typ, tal som är ändliga och inom gränser,
 * fokus som är sant eller falskt). Dokumentets egen kod kan skicka samma meddelanden, eftersom den kör i samma fönster som skriptet. Det den då kan göra är att ändra SIN EGEN zoom inom gränserna, och ramen runt sin egen ruta.
 * Inget av det når appens inloggning, lagring eller sida, och ett dokument kan redan rita vad det vill i sin ruta.
 *
 * ⛔ UTAN FOKUS GÖR HJULET SOM I DAG (CP: "Bara i dokumentet om dokumentet är i fokus."): Ctrl+hjul zoomar hela appen. Nypning på en styrplatta kommer som Ctrl+hjul och följer samma regel.
 *
 * ⛔ LÄGSTA ZOOMEN ÄR 10 PROCENT, INTE 25. Mätt i skalytan (avsnitt 62): rutan i detaljen är 348 px bred i en telefon på 390 px, och ett dokument på 1800 px ryms då först vid 19 procent. Med 25 procent som golv hade
 * Anpassa till bredd lämnat dokumentet för brett, och just det var felet på CP:s bild. − och + stegar i hela tiotal mellan 10 och 200 procent.
 */
export const HTML_ZOOMMEDDELANDE = "ops-framework:zoom";
/** Rutans mått, se ovan. */
export const HTML_MATTMEDDELANDE = "ops-framework:matt";
/** Ett Ctrl- eller Cmd+hjul i ett dokument med fokus, se ovan. */
export const HTML_ZOOMSTEGMEDDELANDE = "ops-framework:zoomsteg";
/** Dokumentet fick eller tappade fokus, se ovan. */
export const HTML_FOKUSMEDDELANDE = "ops-framework:fokus";
/** Minsta zoomen, 10 procent. Se varför ovan. */
export const ZOOM_MIN = 0.1;
/** Största zoomen, 200 procent. */
export const ZOOM_MAX = 2;
/** Anpassa till bredd förstorar aldrig: ett smalt dokument ritas i sin egen storlek. */
const ANPASSA_MAX = 1;
/** Ett hjulsteg på 100 (ett hack på ett vanligt hjul) är 10 procent. Nypning ger små steg och zoomar därför mjukt. */
const HJULSTEG = 100;
/** Största tal som tas emot i ett mått. Ett dokument är aldrig en miljon pixlar brett, och ett större tal är inte ett mått. */
const MAX_MATT = 1_000_000;

const klamp = (/** @type {number} */ s, /** @type {number} */ min, /** @type {number} */ max) => Math.min(max, Math.max(min, s));
const ettTal = (/** @type {unknown} */ v) => typeof v === "number" && Number.isFinite(v);

/**
 * Skriptet för zoomen, i `srcdoc` efter utskriftens och länkarnas. Se filhuvudet ovan. `window`, `parent` och `document` är rutans; proven ger egna.
 * Måttet skickas en gång per bild (`requestAnimationFrame`), när dokumentet laddats, när rutan ändrar storlek och när dokumentets egen storlek ändras (`ResizeObserver`).
 */
export const HTML_ZOOMSKRIPT = `(function(){var r=document.documentElement,t=0;function m(){t=0;var f=r.style.zoom;r.style.zoom="1";var w=r.scrollWidth,v=r.clientWidth;r.style.zoom=f;parent.postMessage({typ:${JSON.stringify(HTML_MATTMEDDELANDE)},innehall:w,synlig:v},"*");}function s(){if(t)return;t=1;(window.requestAnimationFrame||window.setTimeout)(m);}window.addEventListener("message",function(e){if(e.source!==parent)return;var d=e.data;if(d&&d.typ===${JSON.stringify(HTML_ZOOMMEDDELANDE)}&&typeof d.skala==="number"&&d.skala>=${ZOOM_MIN}&&d.skala<=${ZOOM_MAX}){var z=String(d.skala);if(r.style.zoom!==z)r.style.zoom=z;}});window.addEventListener("load",s);window.addEventListener("resize",s);if(window.ResizeObserver){var o=new window.ResizeObserver(s);o.observe(r);window.addEventListener("DOMContentLoaded",function(){if(document.body)o.observe(document.body);});}window.addEventListener("wheel",function(e){if(!(e.ctrlKey||e.metaKey)||!document.hasFocus())return;e.preventDefault();parent.postMessage({typ:${JSON.stringify(HTML_ZOOMSTEGMEDDELANDE)},delta:e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1)},"*");},{passive:false});window.addEventListener("focus",function(){parent.postMessage({typ:${JSON.stringify(HTML_FOKUSMEDDELANDE)},fokus:true},"*");});window.addEventListener("blur",function(){parent.postMessage({typ:${JSON.stringify(HTML_FOKUSMEDDELANDE)},fokus:false},"*");});s();})();`;

/**
 * Ett meddelande från rutan, prövat: känd typ och värden i rätt form, annars `null`. Avsändaren prövar den som tar emot (`event.source` är rutans fönster); det här prövar innehållet.
 *
 * @param {unknown} data
 * @returns {{ typ: "matt", innehall: number, synlig: number } | { typ: "steg", delta: number } | { typ: "fokus", fokus: boolean } | null}
 */
export function tolkaRutmeddelande(data) {
  if (!data || typeof data !== "object") return null;
  const d = /** @type {Record<string, unknown>} */ (data);
  if (d.typ === HTML_MATTMEDDELANDE) {
    const { innehall, synlig } = d;
    if (!ettTal(innehall) || !ettTal(synlig)) return null;
    const i = /** @type {number} */ (innehall);
    const v = /** @type {number} */ (synlig);
    if (i <= 0 || v <= 0 || i > MAX_MATT || v > MAX_MATT) return null;
    return { typ: "matt", innehall: i, synlig: v };
  }
  if (d.typ === HTML_ZOOMSTEGMEDDELANDE) {
    if (!ettTal(d.delta) || Math.abs(/** @type {number} */ (d.delta)) > 10_000) return null;
    return { typ: "steg", delta: /** @type {number} */ (d.delta) };
  }
  if (d.typ === HTML_FOKUSMEDDELANDE) {
    if (typeof d.fokus !== "boolean") return null;
    return { typ: "fokus", fokus: d.fokus };
  }
  return null;
}

/**
 * Skalan som gör att dokumentet ryms i rutans bredd: den synliga bredden delad med dokumentets, högst 1 (förstorar aldrig) och lägst `ZOOM_MIN`. Båda måtten är tagna vid zoom 1.
 * @param {{ innehall: number, synlig: number }} matt
 * @returns {number}
 */
export function anpassadSkala({ innehall, synlig }) {
  return klamp(synlig / innehall, ZOOM_MIN, ANPASSA_MAX);
}

/**
 * Nästa skala för − (`-1`) eller + (`1`): närmaste hela tiotal i den riktningen från procenten som visas, inom `ZOOM_MIN` och `ZOOM_MAX`. Från 22 procent blir + 30 och − 20, från 100 blir det 110 och 90.
 * @param {number} skala
 * @param {1 | -1} riktning
 * @returns {number}
 */
export function zoomSteg(skala, riktning) {
  // Från procenten som SYNS (hela procent): 19,9 procent visas som 20, och + ska då ge 30 och inte 20.
  const procent = Math.round(skala * 100);
  const nasta = riktning > 0 ? Math.floor(procent / 10 + 1e-9) * 10 + 10 : Math.ceil(procent / 10 - 1e-9) * 10 - 10;
  return klamp(Math.round(nasta) / 100, ZOOM_MIN, ZOOM_MAX);
}

/**
 * Skalan efter ett hjul: ett steg på `HJULSTEG` är 10 procent, uppåt (negativt `delta`) förstorar. Avrundad till hel procent, inom gränserna.
 * @param {number} skala
 * @param {number} delta
 * @returns {number}
 */
export function zoomHjul(skala, delta) {
  return klamp(Math.round(skala * Math.pow(1.1, -delta / HJULSTEG) * 100) / 100, ZOOM_MIN, ZOOM_MAX);
}

/**
 * HTML-texten som rutan ritar (`srcdoc`): skripten för utskriften, länkarna och zoomen FÖRST, sedan dokumentet. Har dokumentet en inledande doctype hamnar skriptet direkt efter den: ett `srcdoc` ritas i standardläge av sig självt, men en doctype
 * efter ett skript hade blivit en ignorerad rad, och dokumentet skulle se ut att sakna en.
 *
 * @param {string} html
 * @returns {string}
 */
export function byggSrcdoc(html) {
  const text = typeof html === "string" ? html : "";
  const skript = `<script>${HTML_UTSKRIFTSSKRIPT}${HTML_LANKSKRIPT}${HTML_ZOOMSKRIPT}</script>`;
  const doctype = /^(?:﻿)?\s*<!doctype[^>]*>/i.exec(text);
  return doctype ? text.slice(0, doctype[0].length) + skript + text.slice(doctype[0].length) : skript + text;
}
