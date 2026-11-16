import { createContext, createElement, useContext, useEffect, useRef, useState } from "react";
import { talkOrd } from "../lib/talk.js";
import { UTAN_TAL, registreraTalkfalt } from "../lib/talkfalt.js";
import { Faltknapp } from "./Faltknapp.jsx";
import { MikrofonIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Skalets TALK för fältens mikrofon (0.232.0, cllp/ops-framework#602). `OpsAppShell` ger `{ tala }` när dess TALK har valen (`talk.onAgent`):
 * `tala(el)` startar skalets omgång med fältet `el` som mål och svarar `true` om den startade. Utanför ett skal (`tam`, gästens sida) och i ett
 * skal utan valen är värdet `null`, och då ritas ingen mikrofon: en knapp utan någon som lyssnar hade varit död. Se `src/lib/talkfalt.js`, punkt 5.
 * @type {import("react").Context<{ tala: (el: Element) => boolean } | null>}
 */
export const TalkfaltKontext = createContext(/** @type {{ tala: (el: Element) => boolean } | null} */ (null));

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
 *   - `medMik` säger att mikrofonen kan visas, så att fältet vet när det behöver ett omslag och plats för knappen.
 * ⛔ TRYCKET FLYTTAR INTE FOKUS. `pointerdown` och `mousedown` på knappen gör `preventDefault`, så fältet har fokus och markören fram till
 * klicket, och `fangaTalkfalt(el)` läser den där. Efter klicket släpps fokus (`blur`): tangentbordet fälls ned, och TALK:s yta står på sin
 * vanliga plats ovanför bottenraden.
 *
 * @param {import("react").RefObject<HTMLInputElement | HTMLTextAreaElement | null>} ref
 * @param {{ slag: "input" | "textarea", typ?: string, value: string | undefined, onChange: ((v: string) => void) | undefined, disabled: boolean, readOnly?: boolean, maxLength?: number, etikett?: string, ariaLabel?: string, placeholder?: string }} f
 * @returns {{ medMik: boolean, mikSyns: boolean, mik: (placering: "falt" | "rad-falt" | "plats" | "rad") => import("react").ReactNode, omslag: { onFocus: (e: import("react").FocusEvent) => void, onBlur: (e: import("react").FocusEvent) => void } }}
 */
export function useTalkfalt(ref, f) {
  const kontext = useContext(TalkfaltKontext);
  const sprak = useOpsSprak();
  const [fokus, setFokus] = useState(false);
  const lage = useRef(f);
  lage.current = f;
  /** @type {import("react").MutableRefObject<{ varde: string, pos: number } | null>} */
  const efter = useRef(null);
  const namnRef = useRef(/** @type {() => string} */ (() => ""));
  const kan = typeof f.onChange === "function" && !f.disabled && !f.readOnly && !(/** @type {readonly string[]} */ (UTAN_TAL)).includes(f.typ ?? "text");
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
  const medMik = kan && kontext !== null;
  const mikSyns = medMik && fokus;
  const omslag = {
    onFocus: () => setFokus(true),
    onBlur: (/** @type {import("react").FocusEvent} */ e) => {
      const dit = e.relatedTarget;
      if (dit instanceof Node && e.currentTarget.contains(dit)) return;
      setFokus(false);
    },
  };
  /** @param {"falt" | "rad-falt" | "plats" | "rad"} placering */
  const mik = (placering) => {
    if (!mikSyns || !kontext) return null;
    const n = namn();
    const stopp = (/** @type {import("react").SyntheticEvent} */ e) => e.preventDefault();
    return createElement(Faltknapp, {
      ikon: createElement(MikrofonIkon, { size: 18 }),
      etikett: n ? talkOrd("talaInFaltet", sprak, { namn: n }) : talkOrd("talaInFaltetUtanNamn", sprak),
      placering,
      data: { "data-falt-talk": "" },
      onPointerDown: stopp,
      onMouseDown: stopp,
      onClick: () => {
        const el = ref.current;
        if (!el) return;
        if (kontext.tala(el)) {
          /** @type {HTMLElement} */ (el).blur();
          setFokus(false);
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
  return { medMik, mikSyns, mik, omslag };
}
