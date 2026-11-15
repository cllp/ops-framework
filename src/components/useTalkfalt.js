import { useEffect, useRef } from "react";
import { UTAN_TAL, registreraTalkfalt } from "../lib/talkfalt.js";

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
 * @param {import("react").RefObject<HTMLInputElement | HTMLTextAreaElement | null>} ref
 * @param {{ slag: "input" | "textarea", typ?: string, value: string | undefined, onChange: ((v: string) => void) | undefined, disabled: boolean, readOnly?: boolean, maxLength?: number, etikett?: string, ariaLabel?: string, placeholder?: string }} f
 */
export function useTalkfalt(ref, f) {
  const lage = useRef(f);
  lage.current = f;
  /** @type {import("react").MutableRefObject<{ varde: string, pos: number } | null>} */
  const efter = useRef(null);
  const kan = typeof f.onChange === "function" && !f.disabled && !f.readOnly && !(/** @type {readonly string[]} */ (UTAN_TAL)).includes(f.typ ?? "text");
  useEffect(() => {
    const el = ref.current;
    if (!el || !kan) return undefined;
    return registreraTalkfalt(el, {
      slag: lage.current.slag,
      namn: () => String(lage.current.etikett || lage.current.ariaLabel || lage.current.placeholder || "").trim(),
      las: () => {
        const n = lage.current;
        return { varde: n.value ?? "", onChange: /** @type {(v: string) => void} */ (n.onChange), maxLength: n.maxLength, disabled: n.disabled, readOnly: Boolean(n.readOnly) };
      },
      efterSkrivning: (varde, pos) => {
        efter.current = { varde, pos };
      },
    });
  }, [kan, ref]);
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
}
