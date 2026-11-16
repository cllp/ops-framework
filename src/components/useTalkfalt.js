import { createContext, createElement, useContext, useEffect, useRef, useState } from "react";
import { talkOrd } from "../lib/talk.js";
import { TALK_MAL, UTAN_TAL, registreraTalkfalt } from "../lib/talkfalt.js";
import { Faltknapp } from "./Faltknapp.jsx";
import { MikrofonIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Skalets TALK för fältens mikrofon (0.232.0, cllp/ops-framework#602). `OpsAppShell` ger `{ tala }` när dess TALK har valen (`talk.onAgent`):
 * `tala(el)` startar skalets omgång med fältet `el` som mål och svarar `true` om den startade. Utanför ett skal (`tam`, gästens sida) och i ett
 * skal utan valen är värdet `null`, och då ritas ingen mikrofon: en knapp utan någon som lyssnar hade varit död. Se `src/lib/talkfalt.js`, punkt 5.
 * `upptagen` (granskningen av PR 605): en omgång pågår, och mikrofonen bär `aria-disabled`.
 * @type {import("react").Context<{ tala: (el: Element) => boolean, upptagen: boolean } | null>}
 */
export const TalkfaltKontext = createContext(/** @type {{ tala: (el: Element) => boolean, upptagen: boolean } | null} */ (null));

/**
 * Hur länge mikrofonen står kvar efter att fokus lämnat fältet, i ms (granskningen av PR 605). Se `DOLJ_EFTER_MS` i kroken.
 */
export const MIK_DOLJS_EFTER_MS = 250;

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
 * tryckte på ikonen tidigare i textfältet så visste man iallafall vilket fält som talk hanterade". Kroken ger därför också fältets mikrofon:
 *   - `mik(placering)` ritar den MEDAN FÄLTET (eller knappen själv) HAR FOKUS, och bara när skalet ger `TalkfaltKontext`. Annars `null`.
 *   - `omslag` sätts på elementet runt fältet och knappen. Fokus räknas på det, inte på fältet, så att Tab från fältet till knappen inte får
 *     knappen att försvinna under fokus.
 *   - `medMik` säger att mikrofonen kan visas, så att fältet reserverar platsen för knappen hela tiden (granskningen av PR 605: annars hoppade
 *     texten åt sidan när fältet fick fokus). `medOmslag` säger att skalet har TALK, och då har fältet ALLTID sitt omslag, oberoende av om det
 *     går att skriva i just nu: ett träd som byter form när `disabled` växlar monterar om fältet, och fokus och markör försvinner med det.
 * ⛔ MIKROFONEN FÅR INTE FÖRSVINNA MELLAN TRYCK OCH KLICK (granskningen av PR 605, CP:s scenario). På iOS lämnar fokus fältet när fingret
 * landar på knappen (Safari fokuserar aldrig en knapp, och `touchstart` i React är passiv, så `preventDefault` där gör ingenting). Hade
 * mikrofonen dolts på `blur` hade klicket kommit till en knapp som inte längre fanns. Därför: medan knappen trycks (`trycks`, satt på
 * `pointerdown`, `touchstart` och `mousedown`, nollad efter `click` och `pointercancel`) döljs den inte alls, och annars döljs den först
 * `MIK_DOLJS_EFTER_MS` efter att fokus lämnat, och inte alls om fokus kommer tillbaka. Klicket behöver inte fältets fokus: `tala(el)` får
 * elementet ur ref:en, och markören står kvar i elementet efter `blur`.
 * ⛔ TANGENTBORDET (granskningen av PR 605). Med Enter eller Space har knappen fokus, och när den avmonteras hade fokus hamnat på <body>. Fokus
 * går därför till TALK-ytans första knapp, eller tillbaka till fältet om ytan inte öppnades.
 * ⛔ TRYCKET FLYTTAR INTE FOKUS. `pointerdown` och `mousedown` på knappen gör `preventDefault`, så fältet har fokus och markören fram till
 * klicket, och `fangaTalkfalt(el)` läser den där. Efter klicket släpps fokus (`blur`): tangentbordet fälls ned, och TALK:s yta står på sin
 * vanliga plats ovanför bottenraden.
 *
 * @param {import("react").RefObject<HTMLInputElement | HTMLTextAreaElement | null>} ref
 * @param {{ slag: "input" | "textarea", typ?: string, value: string | undefined, onChange: ((v: string) => void) | undefined, disabled: boolean, readOnly?: boolean, maxLength?: number, etikett?: string, ariaLabel?: string, placeholder?: string }} f
 * @returns {{ medOmslag: boolean, medMik: boolean, mikSyns: boolean, mik: (placering: "falt" | "rad-falt" | "plats" | "rad") => import("react").ReactNode, omslag: { onFocus: (e: import("react").FocusEvent) => void, onBlur: (e: import("react").FocusEvent) => void } }}
 */
export function useTalkfalt(ref, f) {
  const kontext = useContext(TalkfaltKontext);
  const sprak = useOpsSprak();
  const [fokus, setFokus] = useState(false);
  /** Knappen trycks just nu: mellan `pointerdown` (eller `touchstart`, `mousedown`) och `click` eller `pointercancel`. */
  const trycks = useRef(false);
  /** Det uppskjutna döljandet efter `blur`. @type {import("react").MutableRefObject<ReturnType<typeof setTimeout> | null>} */
  const doljTimer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const avbrytDolj = () => {
    if (doljTimer.current) clearTimeout(doljTimer.current);
    doljTimer.current = null;
  };
  useEffect(() => avbrytDolj, []);
  const lage = useRef(f);
  lage.current = f;
  /** @type {import("react").MutableRefObject<{ varde: string, pos: number } | null>} */
  const efter = useRef(null);
  const namnRef = useRef(/** @type {() => string} */ (() => ""));
  const kan = typeof f.onChange === "function" && !f.disabled && !f.readOnly && !(/** @type {readonly string[]} */ (UTAN_TAL)).includes(f.typ ?? "text");
  // ⛔ (granskningen av PR 605) Avmonteras fältet mitt i en omgång tas ramen bort med det, i stället för att stå kvar på ett element utanför
  // sidan tills omgången är över.
  useEffect(() => {
    const el = ref.current;
    return () => el?.removeAttribute(TALK_MAL);
  }, [ref]);
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
  const mikSyns = medMik && fokus;
  /** Döljer mikrofonen om `MIK_DOLJS_EFTER_MS`, om inte fokus kommer tillbaka eller knappen trycks under tiden. */
  const planeraDolj = () => {
    avbrytDolj();
    doljTimer.current = setTimeout(() => {
      doljTimer.current = null;
      if (!trycks.current) setFokus(false);
    }, MIK_DOLJS_EFTER_MS);
  };
  const omslag = {
    onFocus: () => {
      avbrytDolj();
      setFokus(true);
    },
    onBlur: (/** @type {import("react").FocusEvent} */ e) => {
      const dit = e.relatedTarget;
      if (dit instanceof Node && e.currentTarget.contains(dit)) return;
      // ⛔ Inte synkront: se filhuvudet, "MIKROFONEN FÅR INTE FÖRSVINNA MELLAN TRYCK OCH KLICK".
      if (trycks.current) return;
      planeraDolj();
    },
  };
  /** @param {"falt" | "rad-falt" | "plats" | "rad"} placering */
  const mik = (placering) => {
    if (!mikSyns || !kontext) return null;
    const n = namn();
    // `preventDefault` på `pointerdown` och `mousedown` håller fokus i fältet där webbläsaren låter det. `touchstart` är passiv i React och
    // markerar bara trycket.
    const ner = (/** @type {import("react").SyntheticEvent} */ e) => {
      trycks.current = true;
      avbrytDolj();
      e.preventDefault();
    };
    return createElement(Faltknapp, {
      ikon: createElement(MikrofonIkon, { size: 18 }),
      etikett: n ? talkOrd("talaInFaltet", sprak, { namn: n }) : talkOrd("talaInFaltetUtanNamn", sprak),
      placering,
      data: { "data-falt-talk": "", ...(kontext.upptagen ? { "aria-disabled": "true" } : {}) },
      onPointerDown: ner,
      onMouseDown: ner,
      onTouchStart: () => {
        trycks.current = true;
        avbrytDolj();
      },
      onPointerCancel: () => {
        trycks.current = false;
      },
      onClick: (/** @type {import("react").MouseEvent<HTMLButtonElement>} */ e) => {
        trycks.current = false;
        const el = ref.current;
        if (!el) return;
        const knappHadeFokus = document.activeElement === e.currentTarget;
        if (!kontext.tala(el)) {
          // Ingen omgång startade (en pågår redan). Med tangentbordet står fokus kvar på knappen; med ett tryck utan fokus i fältet döljs
          // knappen som efter vilken `blur` som helst.
          if (!knappHadeFokus && document.activeElement !== el) planeraDolj();
          return;
        }
        if (document.activeElement === el) /** @type {HTMLElement} */ (el).blur();
        avbrytDolj();
        setFokus(false);
        if (knappHadeFokus) {
          // ⛔ Knappen avmonteras i den här renderingen. Efter den: fokus till TALK-ytans första knapp, eller tillbaka till fältet.
          queueMicrotask(() => {
            const forsta = /** @type {HTMLElement | null} */ (document.querySelector("[data-ops-talk] button"));
            if (forsta) forsta.focus();
            else if (el.isConnected) /** @type {HTMLElement} */ (el).focus();
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
  return { medOmslag, medMik, mikSyns, mik, omslag };
}
