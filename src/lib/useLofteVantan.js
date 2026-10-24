import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Väntläget för ett val (0.142.0, cllp/ops-framework#440). Samma mönster som OpsButton (0.129.0): ger `onChange` ett löfte är kontrollen
 * upptagen tills löftet är klart. Upptagen betyder snurra, `aria-busy` och spärr mot ett andra val.
 *
 * ⛔ Spärren sitter också i en `ref`, så att två val i samma tick (ett dubbeltryck) inte båda når appen innan tillståndet hunnit ritas.
 * ⛔ Ett avvisat löfte släpper spärren lika säkert som ett uppfyllt, och felet går vidare till appen oförändrat (vi sväljer inget).
 *
 * @template {any[]} A
 * @param {((...args: A) => unknown) | undefined} onChange
 * @returns {{ upptagen: boolean, anropa: (...args: A) => unknown }}
 */
export function useLofteVantan(onChange) {
  const [upptagen, setUpptagen] = useState(false);
  const pagar = useRef(false);
  const monterad = useRef(true);
  useEffect(() => {
    monterad.current = true;
    return () => {
      monterad.current = false;
    };
  }, []);
  const anropa = useCallback(
    /** @param {A} args */
    (...args) => {
      if (!onChange || pagar.current) return undefined;
      const svar = onChange(...args);
      if (svar && typeof (/** @type {any} */ (svar).then) === "function") {
        pagar.current = true;
        setUpptagen(true);
        const klart = () => {
          pagar.current = false;
          if (monterad.current) setUpptagen(false);
        };
        /** @type {Promise<unknown>} */ (svar).then(klart, klart);
      }
      return svar;
    },
    [onChange],
  );
  return { upptagen, anropa };
}
