import { createContext, createElement, useContext, useEffect, useRef } from "react";
import { talkOrd } from "../lib/talk.js";
import { arTextfalt } from "../lib/tangentbord.js";
import { TALK_MAL, UTAN_TAL, registreraTalkfalt } from "../lib/talkfalt.js";
import { Faltknapp } from "./Faltknapp.jsx";
import { MikrofonIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Skalets TALK för fältens mikrofon (0.232.0, cllp/ops-framework#602). `OpsAppShell` ger `{ tala }` när dess TALK har valen (`talk.onAgent`):
 * `tala(el)` startar skalets omgång med fältet `el` som mål och svarar `true` om den startade. Utanför ett skal (`tam`, gästens sida) och i ett
 * skal utan valen är värdet `null`, och då ritas ingen mikrofon: en knapp utan någon som lyssnar hade varit död. Se `src/lib/talkfalt.js`, punkt 5.
 * `upptagen` (granskningen av PR 605): en omgång pågår, och mikrofonen bär `aria-disabled`.
 * (CP 2026-11-18) `rostSamtal(vidare)` börjar ett röstsamtal i skalets TALK: vågikonen i agentens chatt ger det sagda till `vidare`
 * (`vidareISamtal` i `src/lib/talkrost.js`), och svaret läses upp. Samma villkor som `tala`: bara när TALK har valen.
 * (0.252.0, cllp/lifehub.app#915) `tala(el, { iFaltet: true })` ber skalet visa omgången i fältet (`TalkfaltDiktering`), och `slapp(el)` säger att
 * fältet avmonterats, så att skalets yta tar över.
 * @type {import("react").Context<{ tala: (el: Element, val?: { iFaltet?: boolean }) => boolean, slapp?: (el: Element) => void, upptagen: boolean, rostSamtal?: (vidare: import("../lib/talkrost.js").Talkrost["vidare"]) => boolean } | null>}
 */
export const TalkfaltKontext = createContext(/** @type {{ tala: (el: Element, val?: { iFaltet?: boolean }) => boolean, slapp?: (el: Element) => void, upptagen: boolean, rostSamtal?: (vidare: import("../lib/talkrost.js").Talkrost["vidare"]) => boolean } | null} */ (null));

/**
 * ⛔ DET SAGDA I FÄLTET, INTE PÅ TALK:S YTA (0.252.0, cllp/lifehub.app#915). CP 2026-11-20 i telefonen: "Via Fråga agenten gick det inte att
 * prata in, ingen ljudvåg syntes i textfältet", och 2026-11-21 00.05 om förslaget att fältet i samtalet med agenten ska visa det sagda medan man
 * pratar: "Ja kör. Fullt ut".
 *
 * Mikrofonen i fältet öppnade skalets TALK, och TALK:s yta lade sig över skrivfältet: ljudvågen och texten stod i ytan, och fältet syntes inte
 * förrän Klar. Ett fält som ber om det (`useTalkfalt(ref, { iFaltet: true })`, i dag chattens skrivfält med `talIFaltet`) får i stället omgången
 * visad i sig själv: ljudvågen, texten medan den växer, Avbryt och Klar. Skalet ritar då ingen yta.
 *
 * ⛔ SAMMA OMGÅNG SOM TALK, INTE EN ANDRA RÖST (0.230.0:s skäl står kvar). Det är skalets `useTalk` som lyssnar, med appens `igenkanning`, så
 * samma igenkänning gäller i fältet som i TALK (telefonens i appen, Soniox där gruppen valt det). Fältet visar bara omgången. Värdet är `null`
 * utom medan en sådan omgång lyssnar eller skriver in: i alla andra lägen (ett fel, ett tillstånd som behöver menyn, ett fält som avmonterats)
 * ritar skalet sin vanliga yta, så att inget fel blir tyst.
 *
 * @type {import("react").Context<Talkdiktering | null>}
 */
export const TalkfaltDiktering = createContext(/** @type {Talkdiktering | null} */ (null));

/**
 * @typedef {object} Talkdiktering
 * @property {Element} el Fältet som omgången skriver i.
 * @property {"lyssnar" | "skickar"} lage `lyssnar` medan man pratar, `skickar` medan det sagda skrivs in.
 * @property {string} text Texten hittills.
 * @property {string} textFel Igenkänningens fel medan man pratar, eller tom.
 * @property {() => number} niva Nivån 0 till 1 för ljudvågen.
 * @property {() => void} klar Skriver in det sagda i fältet (TALK:s Klar).
 * @property {() => void} avbryt Slänger det sagda (TALK:s Avbryt).
 */

/**
 * Registrerar ett textfält som ett fält TALK kan skriva i (0.230.0, cllp/ops-framework#602). Se `src/lib/talkfalt.js` för hela flödet.
 *
 * Fältet registreras bara när det går att skriva i: med `onChange`, utan `disabled` och `readOnly`, och inte av en typ i `UTAN_TAL`.
 * Registreringen tas bort när något av det slutar gälla och när fältet avmonteras. Fältets värde och `onChange` läses vid skrivningen och inte
 * vid registreringen, så att ett fält som ritats om skriver i sitt nya läge.
 *
 * Efter en skrivning läggs markören efter det inskrivna när värdet kommit tillbaka genom `value` (appen ritar om först, så det är inte
 * samma ögonblick). Fokus flyttas inte: ett tangentbord som dyker upp av sig självt hade varit en överraskning.
 *
 * ══ ⛔ 0.232.0: MIKROFONEN I FÄLTET ═════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-16 från iPhone: "TALK KOmmer inte upp alls", med markören i ett fält och tangentbordet uppe (bottenraden göms då), och "När man
 * tryckte på ikonen tidigare i textfältet så visste man iallafall vilket fält som talk hanterade". Kroken ger därför också fältets mikrofon,
 * `mik(placering)`, som öppnar skalets TALK med fältet som mål. `medMik` säger att den ritas, och fältet reserverar platsen för den.
 * `medOmslag` säger att skalet har TALK, och då har fältet ALLTID sitt omslag, oberoende av om det går att skriva i just nu: ett träd som
 * byter form när `disabled` växlar monterar om fältet, och fokus och markör försvinner med det (granskningen av PR 605).
 *
 * ══ ⛔ 0.233.0: ALLTID SYNLIG, ETT TRYCK, INGET TANGENTBORD ═════════════════════════════════════════════════════════════════════
 *
 * CP efter att ha provat 0.232.0 i telefonen: "Kör med mikrofonen och kör alla fält". I 0.232.0 syntes ikonen först när fältet hade fokus: ett
 * tryck i fältet (tangentbordet kom upp och sidan rullade), sedan ett tryck på ikonen. Han ville ha en större ikon som startar talet direkt,
 * och inget tangentbord när man pratar. Därför:
 *   - MIKROFONEN STÅR I VARJE FÄLT SOM GÅR ATT SKRIVA I, i ett skal med TALK (`medMik`), med eller utan fokus. Utanför ett skal (`tam`, gästens
 *     sida) och i ett skal utan valen finns den inte: en knapp utan någon som lyssnar hade varit död.
 *   - TRYCKET GER FÄLTET INGET FOKUS. `pointerdown` och `mousedown` på knappen gör `preventDefault`, så webbläsaren flyttar inte fokus och
 *     inget tangentbord kommer. Klicket startar `tala(el)`, och hade fältet redan fokus släpps det (`blur`), så att tangentbordet fälls ned
 *     och TALK:s yta står på sin vanliga plats. Fältet får ramen (`TALK_MAL`), och efter Klar skrivs texten in utan att fokus flyttas.
 *   - MARKÖREN: hade fältet fokus, eller har personen satt markören i det sedan det monterades, gäller den. Annars hamnar det sagda sist
 *     (`src/lib/talkfalt.js`, punkt 8).
 *   - STÖRRE: cirkeln är 40 px och ikonen 22 px (`Faltknapp` med `storlek="stor"`), träffytan 44 px som förut.
 * ⛔ TANGENTBORDET (granskningen av PR 605). Med Tab och Enter har knappen fokus. Fokus går till TALK-ytans första knapp när ytan öppnats,
 * och står annars kvar på knappen. Medan en omgång pågår bär knappen `aria-disabled`.
 *
 * ══ ⛔ 0.252.0: DET SAGDA I FÄLTET (`iFaltet`, cllp/lifehub.app#915) ═════════════════════════════════════════════════════════════
 *
 * Med `iFaltet: true` ber mikrofonen skalet visa omgången i fältet (`TalkfaltDiktering`), och kroken ger `diktering`: omgången när den skriver i
 * just det här fältet, annars `null`. Fältet ritar ljudvågen och texten själv. Avmonteras fältet mitt i omgången släpps den (`slapp`), och skalets
 * yta tar över med det som sagts hittills, så att ingenting lyssnar osynligt.
 *
 * @param {import("react").RefObject<HTMLInputElement | HTMLTextAreaElement | null>} ref
 * @param {{ slag: "input" | "textarea", typ?: string, value: string | undefined, onChange: ((v: string) => void) | undefined, disabled: boolean, readOnly?: boolean, maxLength?: number, etikett?: string, ariaLabel?: string, placeholder?: string, iFaltet?: boolean }} f
 * @returns {{ medOmslag: boolean, medMik: boolean, mik: (placering: "falt" | "rad-falt" | "plats" | "rad") => import("react").ReactNode, diktering: Talkdiktering | null }}
 */
export function useTalkfalt(ref, f) {
  const kontext = useContext(TalkfaltKontext);
  const sprak = useOpsSprak();
  const lage = useRef(f);
  lage.current = f;
  /** @type {import("react").MutableRefObject<{ varde: string, pos: number } | null>} */
  const efter = useRef(null);
  const namnRef = useRef(/** @type {() => string} */ (() => ""));
  const kan = typeof f.onChange === "function" && !f.disabled && !f.readOnly && !(/** @type {readonly string[]} */ (UTAN_TAL)).includes(f.typ ?? "text");
  // ⛔ (granskningen av PR 605) Avmonteras fältet mitt i en omgång tas ramen bort med det, i stället för att stå kvar på ett element utanför
  // sidan tills omgången är över.
  const kontextRef = useRef(kontext);
  kontextRef.current = kontext;
  useEffect(() => {
    const el = ref.current;
    return () => {
      el?.removeAttribute(TALK_MAL);
      // ⛔ (0.252.0, #915) Visades omgången i fältet tar skalets yta över, så att den inte fortsätter osynligt.
      if (el) kontextRef.current?.slapp?.(el);
    };
  }, [ref]);
  const dikteringNu = useContext(TalkfaltDiktering);
  useEffect(() => {
    const el = ref.current;
    if (!el || !kan) return undefined;
    return registreraTalkfalt(el, {
      slag: lage.current.slag,
      // ⛔ BARA TEXT (granskningen av 0.230.0). En etikett i JSX hade blivit "Till fältet [object Object]". Är den inte text gäller
      // nästa källa: ariaLabel, sedan placeholder.
      namn: () => namnRef.current(),
      las: () => {
        const n = lage.current;
        return { varde: n.value ?? "", onChange: /** @type {(v: string) => void} */ (n.onChange), maxLength: n.maxLength, disabled: n.disabled, readOnly: Boolean(n.readOnly) };
      },
      efterSkrivning: (varde, pos) => {
        efter.current = { varde, pos };
      },
    });
  }, [kan, ref]);
  /** Fältets namn för den som pratar. EN källa för TALK:s rad och för knappens etikett (regel 2). */
  const namn = () => [lage.current.etikett, lage.current.ariaLabel, lage.current.placeholder].find((v) => typeof v === "string" && v.trim() !== "")?.trim() ?? "";
  namnRef.current = namn;
  const medOmslag = kontext !== null;
  const medMik = kan && medOmslag;
  /** @param {"falt" | "rad-falt" | "plats" | "rad"} placering */
  const mik = (placering) => {
    if (!medMik || !kontext) return null;
    const n = namn();
    // ⛔ Trycket flyttar inte fokus: inget fokus i fältet, inget tangentbord. `touchstart` är passiv i React och behövs inte här, eftersom
    // `pointerdown` kommer före den kompatibla `mousedown` som hade flyttat fokus.
    const ner = (/** @type {import("react").SyntheticEvent} */ e) => e.preventDefault();
    return createElement(Faltknapp, {
      ikon: createElement(MikrofonIkon, { size: 22 }),
      etikett: n ? talkOrd("talaInFaltet", sprak, { namn: n }) : talkOrd("talaInFaltetUtanNamn", sprak),
      placering,
      storlek: "stor",
      data: { "data-falt-talk": "", ...(kontext.upptagen ? { "aria-disabled": "true" } : {}) },
      onPointerDown: ner,
      onMouseDown: ner,
      onClick: (/** @type {import("react").MouseEvent<HTMLButtonElement>} */ e) => {
        const el = ref.current;
        if (!el) return;
        const knappHadeFokus = document.activeElement === e.currentTarget;
        // Ingen omgång startade (en pågår redan): ingenting ändras, och fokus står kvar där det stod.
        if (!kontext.tala(el, lage.current.iFaltet ? { iFaltet: true } : undefined)) return;
        // ⛔ (granskningen av PR 606) Det fält som har fokus släpps, inte bara det här. Hade ett annat fält fokus stod tangentbordet kvar uppe och
        // markören blinkade i ett fält som inte fick texten: samma läge som CP:s "TALK kommer inte upp".
        const aktivt = document.activeElement;
        if (aktivt instanceof HTMLElement && (aktivt === el || arTextfalt(aktivt))) aktivt.blur();
        if (knappHadeFokus) {
          // Tangentbordsvägen: fokus till TALK-ytans första knapp när ytan ritats. Finns ingen yta står fokus kvar på knappen.
          queueMicrotask(() => {
            const forsta = /** @type {HTMLElement | null} */ (document.querySelector("[data-ops-talk] button"));
            if (forsta) forsta.focus();
          });
        }
      },
    });
  };
  useEffect(() => {
    const e = efter.current;
    const el = ref.current;
    if (e && el && el.value === e.varde) {
      efter.current = null;
      try {
        el.setSelectionRange(e.pos, e.pos);
      } catch {
        // Ett element som inte bär en markör (ovanligt för text) är inget fel: texten står redan i fältet.
      }
    }
  }, [f.value, ref]);
  // Omgången visas i det här fältet: ett annat fälts omgång är inte den här, och utan `iFaltet` visar fältet aldrig någon.
  const diktering = f.iFaltet && dikteringNu && ref.current && dikteringNu.el === ref.current ? dikteringNu : null;
  return { medOmslag, medMik, mik, diktering };
}
