import { useCallback, useEffect, useRef, useState } from "react";
import { rapporteraFel } from "../lib/felrapport.js";

/**
 * Att kopiera en text till urklipp, och att säga det en kort stund (0.115.0, cllp/lifehub.app#347 och #349).
 *
 * ⛔ EN KROK FÖR TALK OCH BIBLIOTEKET. Båda har en knapp Kopiera under en text, och med två egna kopior hade ordningen "kopierat, sedan
 * ett fel" och reglerna för vad som händer när urklippet saknas glidit isär (arbetsreglernas punkt 2).
 *
 * ⛔ FALLER URKLIPPET SYNS DET. `navigator.clipboard` finns bara på en säker adress och efter en användargest, och en iPhone som
 * nekar skrivningen gav förut ingenting alls. Ett saknat API, ett kast och ett avvisat löfte är samma sak för personen, och går alla
 * till `rapporteraFel` med steget `kopiera`. Texten ritas av den som anropar kroken (`misslyckades`), på sitt språk.
 */

/** Så länge "Kopierat" och andra korta besked står kvar. */
export const KORT_VISNING_MS = 1500;

/**
 * Ett besked som står en kort stund och försvinner. Timern städas när komponenten avmonteras, och ett sent svar efter det sätter inget.
 *
 * @param {number} [ms]
 */
export function useKortVisning(ms = KORT_VISNING_MS) {
  const [synlig, setSynlig] = useState(false);
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);
  const dolj = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSynlig(false);
  }, []);
  const visa = useCallback(() => {
    if (!levande.current) return;
    if (timer.current) clearTimeout(timer.current);
    setSynlig(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setSynlig(false);
    }, ms);
  }, [ms]);
  return { synlig, visa, dolj, levande };
}

/**
 * @param {string} yta Namnet i felrapporten, till exempel "OpsTalk".
 * @returns {{ kopierat: boolean, misslyckades: boolean, kopiera: (text: string) => void, nolla: () => void }}
 */
export function useKopiera(yta) {
  const { synlig, visa, dolj, levande } = useKortVisning();
  const [misslyckades, setMisslyckades] = useState(false);
  const kopiera = useCallback(
    /** @param {string} text */
    (text) => {
      setMisslyckades(false);
      /** @param {unknown} fel */
      const fall = (fel) => {
        rapporteraFel(fel, { yta, steg: "kopiera" });
        dolj();
        if (levande.current) setMisslyckades(true);
      };
      try {
        const urklipp = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
        if (!urklipp || typeof urklipp.writeText !== "function") {
          throw new Error("Urklipp saknas: webbläsaren ger inte sidan något clipboard-API här (det kräver en säker adress).");
        }
        Promise.resolve(urklipp.writeText(text)).then(() => visa(), fall);
      } catch (fel) {
        fall(fel);
      }
    },
    [yta, visa, dolj, levande],
  );
  /** Städar både beskedet och felet, till exempel när fältet lämnar läget där knappen står. */
  const nolla = useCallback(() => {
    dolj();
    setMisslyckades(false);
  }, [dolj]);
  return { kopierat: synlig, misslyckades, kopiera, nolla };
}
