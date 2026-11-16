/**
 * TALK till fältet där markören står (0.230.0, cllp/ops-framework#602).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-15, med en skärmbild från meddelandevyn i SessionStudio: rutan sa "Den här webbläsaren kan inte spela in ljud."
 * (Sentry JAVASCRIPT-REACT-2Y). Det var chattens mikrofon i skrivfältet, inte TALK-knappen: i appens webbvy saknas `MediaRecorder`, och
 * mikrofonen försökte spela in. TALK-knappen på samma enhet fungerade. Två röstknappar på samma skärm, och bara den ena fungerade.
 * CP: "EN sak. tal i textfält, de behöver kanske ersättas nu av TALK generellt." Beslutet: en röstknapp, och den är TALK. Står
 * markören i ett textfält när man trycker på TALK, går talet dit.
 *
 * ══ HUR DET HÄNGER IHOP ══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   1. `OpsInput` och `OpsTextarea` registrerar sitt element här (`registreraTalkfalt`), med ett sätt att läsa fältets läge. Det
 *      gäller bara fält som går att skriva i: med `onChange`, utan `disabled` och `readOnly`, och inte av en typ i `UTAN_TAL`.
 *   2. ⛔ FÅNGSTEN SKER VID TRYCKET, INNAN FOKUS FLYTTAS. `pointerdown` är före fokusbytet i varje webbläsare, så `document.activeElement`
 *      är då fortfarande fältet och markören står där den stod. När klicket kommer är fokus på knappen, och markören är borta
 *      (Safari fokuserar dessutom aldrig en knapp). `lyssnaPaTryck` lyssnar därför på dokumentet i fångstfasen, så att båda TALK-knapparna
 *      i skalet (huvudets och bottenradens) och `useTalk().knapp` täcks av samma kod, utan att varje knapp ska komma ihåg att anropa den.
 *   3. ⛔ BARA DEN OMGÅNG SOM TRYCKET STARTAR. Fångsten är färsk i `FANGST_GILTIG_MS` och förbrukas av omgången (`tagFangst`). En tangent
 *      (Enter på knappen) river den: tangentbordsaktivering har fokus på knappen och ger inget fält, och det är rätt.
 *   4. `useTalk` gör fångsten till ett samtal (`{ namn, direkt: true, etikett, onText }`) som går FÖRE appens `samtalet`: det man står i vinner.
 *
 * ══ ⛔ 0.232.0: MIKROFONEN I FÄLTET, OCH DET SENASTE FÄLTET I EN PANEL ═════════════════════════════════════════════════════════
 *
 * CP 2026-11-16, med en skärmbild från iPhone (en rad i Inkorgen, fältet Not med markören i, tangentbordet uppe): "TALK KOmmer inte upp alls."
 * Bottenraden göms medan tangentbordet är uppe (0.152.0), och telefonens huvud har ingen TALK, så just där man skriver fanns ingen röst. Mätt i
 * koden: `OpsBottomNav` får `hidden` av `useTangentbordUppe`. CP samma morgon: "När man tryckte på ikonen tidigare i textfältet så visste man
 * iallafall vilket fält som talk hanterade", och om fältikonen som öppnade skalets TALK: snygg, men TALK "hamnade lite på olika platser".
 * Beslutet ("Ja kör."): mikrofonen kommer tillbaka i fältet, men den öppnar SKALETS TALK med just det fältet som mål. En röstknapp till ytan,
 * en yta, på en plats.
 *
 *   5. `useTalkfalt` ritar mikrofonen medan fältet har fokus, och bara i ett skal med TALK (`TalkfaltKontext`). Klicket fångar fältet uttryckligen
 *      (`fangaTalkfalt(el)`, inte den globala fångsten vid trycket) och lämnar det till skalets `useTalk().tillFalt`.
 *   6. Medan en omgång har ett fält som mål bär fältet `TALK_MAL` (`data-ops-talk-mal`), och `tokens.css` ritar en ram runt det.
 *   7. ⛔ DET SENASTE FÄLTET I EN ÖPPEN PANEL. Trycker man på bottenradens TALK efter att ha fällt ned tangentbordet har fältet inte längre
 *      fokus. Är det senast fokuserade fältet fortfarande monterat och ligger i en panel som är öppen (`PANEL`), är det målet, med markören där
 *      den stod när fokus lämnade. Utanför en panel finns ingen sådan reserv: där vet ingen om personen fortfarande menar fältet.
 *      ⛔ (granskningen av PR 605) Två villkor till. Panelen ska vara den ÖVERSTA öppna panelen: öppnas en annan panel ovanpå (eller byts
 *      panelen) menar personen inte längre fältet under. Och reserven glöms när fokus går till ett annat skrivbart element som inte är
 *      registrerat (ett sökfält, ett e-postfält, `contenteditable`): där skrev personen senast, och det hade varit fel fält att skriva i.
 *
 * ⛔ INGENTING SKICKAS AV SIG SJÄLVT. `skriv` lägger texten i fältet genom fältets egen `onChange`, där markören stod. Är fältet borta
 * (avmonterat) eller skrivskyddat när Klar trycks, eller får inte det sagda plats, kastas ett fel med svensk text: TALK:s meny står då
 * kvar med texten (samma väg som när appens `onText` avvisas). Ingenting försvinner tyst (regel 5).
 */

import { PANEL } from "./panellager.js";
import { arTextfalt } from "./tangentbord.js";
import { ORD_TALK } from "./talk.js";

/** Attributet på fältet som en pågående TALK-omgång skriver i (0.232.0). `tokens.css` ritar ramen. */
export const TALK_MAL = "data-ops-talk-mal";

/**
 * Fälttyper där tal aldrig erbjuds. ⛔ EN LISTA, HÄR (0.230.0): `OpsInput` läser den ur den här filen. Lösenord: det sagda hade gått till
 * Googles eller Apples taltjänst. E-post, nummer, tel, url: en taltjänst skriver "anna snabel-a exempel punkt se" och "tjugo", inte
 * adressen och talet. Sök: rutan ger svar medan man skriver. (bedömning)
 */
export const UTAN_TAL = /** @type {const} */ (["password", "email", "number", "search", "tel", "url"]);

/** Hur länge efter ett tryck som fångsten gäller. Klicket kommer inom några tiotal ms, ett långtryck inom `LANGTRYCK_MS`. */
export const FANGST_GILTIG_MS = 3000;

/**
 * Fältets läge, läst när det behövs (inte när det registrerades): värdet och `onChange` byts vid varje ritning.
 * @typedef {object} Faltlage
 * @property {string} varde
 * @property {(v: string) => void} onChange
 * @property {number | undefined} maxLength
 * @property {boolean} disabled
 * @property {boolean} readOnly
 */

/**
 * @typedef {object} Talkfalt
 * @property {"input" | "textarea"} slag
 * @property {() => string} namn Fältets namn för den som pratar: synlig etikett, annars `ariaLabel`, annars `placeholder`. Tom om inget finns.
 * @property {() => Faltlage} las
 * @property {(varde: string, markor: number) => void} [efterSkrivning] Anropas efter `onChange`, så att fältet kan lägga markören efter det inskrivna.
 */

/** @type {WeakMap<Element, Talkfalt>} */
const REGISTER = new WeakMap();

/**
 * Registrerar ett element som ett fält TALK kan skriva i. Ger en funktion som tar bort registreringen (vid avmontering).
 * @param {Element} el @param {Talkfalt} post
 * @returns {() => void}
 */
export function registreraTalkfalt(el, post) {
  REGISTER.set(el, post);
  return () => {
    if (REGISTER.get(el) === post) REGISTER.delete(el);
  };
}

/**
 * @typedef {object} Talkfangst Ett fält som markören stod i när TALK trycktes.
 * @property {Element} el (0.232.0) Fältets element, för ramen medan omgången skriver dit (`TALK_MAL`).
 * @property {string} namn
 * @property {(text: string) => void} skriv Skriver det sagda där markören stod. Kastar ett fel med svensk text när det inte går.
 */

/**
 * Fältet där markören står: `document.activeElement` om det är registrerat. Markören läses NU (`selectionStart` och `selectionEnd`), för
 * efter fokusbytet är den borta.
 * @param {Element | null} [aktivt]
 * @returns {Talkfangst | null}
 */
export function fangaTalkfalt(aktivt = typeof document !== "undefined" ? document.activeElement : null) {
  if (!aktivt) return null;
  const post = REGISTER.get(aktivt);
  if (!post) return null;
  return fangst(/** @type {HTMLInputElement | HTMLTextAreaElement} */ (aktivt), post, lasMarkor(/** @type {HTMLInputElement | HTMLTextAreaElement} */ (aktivt)));
}

/** @param {HTMLInputElement | HTMLTextAreaElement} el */
function lasMarkor(el) {
  return { start: el.selectionStart ?? el.value.length, slut: el.selectionEnd ?? el.value.length };
}

/**
 * En fångst av ett registrerat fält med en given markör. EN väg för fältet med fokus och för det senaste fältet i en panel (regel 2).
 * @param {HTMLInputElement | HTMLTextAreaElement} el @param {Talkfalt} post @param {{ start: number, slut: number }} markor
 * @returns {Talkfangst}
 */
function fangst(el, post, markor) {
  const namn = post.namn();
  return {
    el,
    namn,
    skriv: (text) => {
      // ⛔ DET FINNS INTE LÄNGRE: avmonterat (registreringen borta), bortplockat ur sidan, eller skrivskyddat sedan trycket.
      if (REGISTER.get(el) !== post || !el.isConnected) throw new Error(ORD_TALK.felFaltetBorta.sv);
      const nu = post.las();
      if (nu.disabled || nu.readOnly) throw new Error(ORD_TALK.felFaltetBorta.sv);
      const ut = String(text ?? "").trim();
      const sagt = post.slag === "input" ? ut.replace(/\s*[\r\n]+\s*/g, " ").trim() : ut;
      const r = skrivInTal(nu.varde, markor, sagt, nu.maxLength);
      // ⛔ DET SAGDA FÅR PLATS HELT ELLER INTE ALLS. En kapad mening hade lämnat resten tyst, och menyn står kvar med hela texten.
      if (r.kapat !== "nej") throw new Error(ORD_TALK.felFaltetFullt.sv);
      if (r.varde !== nu.varde) nu.onChange(r.varde);
      post.efterSkrivning?.(r.varde, r.markor);
    },
  };
}

/**
 * Texten kapad till högst `n` tecken, vid ett ordslut och utan blanksteg sist. Ett enda ord som är längre än `n` kapas mitt i, eftersom
 * ingenting av det annars hade kommit med.
 * @param {string} text @param {number} n
 */
function kapaVidOrd(text, n) {
  if (text.length <= n) return text;
  const snitt = text.slice(0, n);
  if (/\s/.test(text[n])) return snitt.trimEnd();
  const ordslut = snitt.search(/\s\S*$/);
  return (ordslut > 0 ? snitt.slice(0, ordslut) : snitt).trimEnd();
}

/**
 * Var det sagda skrivs in, och vad som fick plats.
 *
 * ⛔ DÄR MARKÖREN STOD, ELLER SIST. En markering ersätts, som när man skriver. Ett mellanslag läggs till där det sagda annars hade
 * suttit ihop med ett ord på någon sida, så att "Beskriv" och "en app" inte blir "Beskriven app".
 *
 * ⛔ `maxLength` GÄLLER ÄVEN DET SAGDA. Webbläsaren håller taket bara för det som skrivs; ett värde som sätts av koden hade gått förbi
 * det tyst. Det som inte får plats kapas vid ett ordslut och `kapat` säger det (regel 5). Avskiljarna släpps aldrig: får det sagda bara
 * plats ihop med ett ord kommer det inte in alls, värdet står kvar, och `kapat` är `fickInte` (eller `fullt` när fältet är fullt).
 * (Flyttad hit ur `OpsField.jsx` 0.230.0, oförändrad.)
 *
 * @param {string} varde
 * @param {{ start: number, slut: number } | null} markor `null`: markören har aldrig stått i fältet, och det sagda hamnar sist.
 * @param {string} ut Det sagda, utan blanksteg i kanterna.
 * @param {number | undefined} max
 * @returns {{ varde: string, markor: number, kapat: "nej" | "kapat" | "fullt" | "fickInte" }}
 */
export function skrivInTal(varde, markor, ut, max) {
  const start = markor ? Math.min(Math.max(0, markor.start), varde.length) : varde.length;
  const slut = markor ? Math.min(Math.max(start, markor.slut), varde.length) : varde.length;
  const fore = varde.slice(0, start);
  const efter = varde.slice(slut);
  const fram = fore && !/\s$/.test(fore) ? " " : "";
  const bak = efter && !/^\s/.test(efter) ? " " : "";
  let mitt = `${fram}${ut}${bak}`;
  /** @type {"nej" | "kapat" | "fullt" | "fickInte"} */
  let kapat = "nej";
  if (typeof max === "number" && max >= 0) {
    const plats = Math.max(0, max - fore.length - efter.length);
    if (mitt.length > plats) {
      const rum = plats - fram.length - bak.length;
      const del = rum > 0 ? kapaVidOrd(ut, rum) : "";
      if (del) {
        mitt = `${fram}${del}${bak}`;
        kapat = "kapat";
      } else {
        return { varde, markor: start, kapat: plats === 0 ? "fullt" : "fickInte" };
      }
    }
  }
  return { varde: `${fore}${mitt}${efter}`, markor: fore.length + mitt.length, kapat };
}

/** @type {{ fangst: Talkfangst | null, tid: number } | null} */
let senaste = null;
let lyssnare = 0;
/**
 * Det senast fokuserade registrerade fältet, med markören som den stod när fokus lämnade det (0.232.0). Se punkt 7 i filhuvudet.
 * @type {{ el: HTMLInputElement | HTMLTextAreaElement, post: Talkfalt, markor: { start: number, slut: number } } | null}
 */
let senastFalt = null;

/**
 * Det senast fokuserade fältet, om det fortfarande går att skriva i och ligger i en panel som är öppen. Annars `null`.
 * @returns {Talkfangst | null}
 */
export function senasteFaltetIPanel() {
  const s = senastFalt;
  if (!s) return null;
  if (REGISTER.get(s.el) !== s.post || !s.el.isConnected) return null;
  const panel = s.el.closest(`[${PANEL}]`);
  if (!panel || panel !== overstePanelen()) return null;
  return fangst(s.el, s.post, s.markor);
}

/**
 * Den översta öppna panelen: den sista med `PANEL` i dokumentets ordning. (bedömning, mätt mot hur panelerna ritas) En modal panel ritas
 * i en portal sist i <body> när den öppnas, och skapa-panelen står i skalets innehåll före portalerna, med samma `z-index` (`--z-modal`).
 * Den som ligger sist i dokumentet ligger alltså överst.
 * @returns {Element | null}
 */
function overstePanelen() {
  const alla = document.querySelectorAll(`[${PANEL}]`);
  return alla.length ? alla[alla.length - 1] : null;
}

function vidTryck() {
  senaste = { fangst: fangaTalkfalt() ?? senasteFaltetIPanel(), tid: Date.now() };
}
/**
 * Fokus till ett annat skrivbart element som inte är registrerat glömmer reserven (se punkt 7 i filhuvudet).
 * @param {FocusEvent} e
 */
function vidFokusIn(e) {
  const el = e.target;
  if (el instanceof Element && !REGISTER.has(el) && arTextfalt(el)) senastFalt = null;
}
/** @param {FocusEvent} e */
function vidFokusUt(e) {
  const el = e.target;
  if (!(el instanceof Element)) return;
  const post = REGISTER.get(el);
  if (!post) return;
  const f = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (el);
  senastFalt = { el: f, post, markor: lasMarkor(f) };
}
function vidTangent() {
  // Tangentbordsaktivering har fokus på knappen och ger inget fält.
  senaste = null;
}

/**
 * Börjar lyssna på tryck i hela dokumentet (fångstfasen, före fokusbytet). Räknas upp och ner: en lyssnare för alla som ber om den.
 * @returns {() => void} Avslutar den här anropets lyssning.
 */
export function lyssnaPaTryck() {
  if (typeof document === "undefined") return () => {};
  if (lyssnare === 0) {
    document.addEventListener("pointerdown", vidTryck, true);
    document.addEventListener("keydown", vidTangent, true);
    document.addEventListener("focusout", vidFokusUt, true);
    document.addEventListener("focusin", vidFokusIn, true);
  }
  lyssnare += 1;
  let kvar = true;
  return () => {
    if (!kvar) return;
    kvar = false;
    lyssnare -= 1;
    if (lyssnare === 0) {
      document.removeEventListener("pointerdown", vidTryck, true);
      document.removeEventListener("keydown", vidTangent, true);
      document.removeEventListener("focusout", vidFokusUt, true);
      document.removeEventListener("focusin", vidFokusIn, true);
      senaste = null;
      senastFalt = null;
    }
  };
}

/**
 * Fångsten från senaste trycket, om den är färsk. Förbrukas: nästa omgång får ingen om inget nytt tryck kommit.
 * @returns {Talkfangst | null}
 */
export function tagFangst() {
  const s = senaste;
  senaste = null;
  if (!s || !s.fangst) return null;
  if (Date.now() - s.tid > FANGST_GILTIG_MS) return null;
  return s.fangst;
}
