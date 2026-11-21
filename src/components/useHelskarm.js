import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Helskärm för en yta, med ett fast lager som reserv (0.234.0, en sanning för PDF-vyn och kartan, regel 2).
 *
 * ══ ⛔ HÄNDELSEN ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * PDF-vyn fick Helskärm i 0.196.0, med webbläsarens egen helskärm där den finns och ett lager som fyller fönstret där den inte gör
 * det. CP 2026-11-16: "Jag kan inte få en fullscreen för kartor, det är ett måste." Kartan får samma beteende, och beteendet bor här
 * i stället för att skrivas en gång till.
 *
 *   - `oppna()` anropas i trycket: webbläsaren släpper bara in helskärm i en användargest. Finns `requestFullscreen` och säger dokumentet
 *     ja (`fullscreenEnabled`) blir läget `helskarm`. Annars, och om webbläsaren avslår (iPhone ger inte ett element helskärm), `fonster`:
 *     anroparen ritar ytan som ett fast lager över hela skärmen.
 *   - Lämnas helskärmen utan oss (Esc i webbläsaren, F11, en annan flik) är läget slut. Webbläsaren äger det läget.
 *   - I `fonster` stänger Escape lagret, och sidan bakom rullar inte medan lagret ligger över den.
 *   - ⛔ AVMONTERAS ÄGAREN I HELSKÄRM AVSLUTAS HELSKÄRMEN (0.249.1, GPT:s granskning av cllp/lifehub.app PR 922). Tavlan lägger hela sidan
 *     (`document.documentElement`) i helskärm, och sidan finns kvar när tavlan avmonteras. Mätt i byggd Chromium på 390 och 1280: öppna ett kort
 *     med ikonen, gå tillbaka, och `document.fullscreenElement` var fortfarande sidan medan den nya tavlan saknade Stäng helskärm. Personen satt kvar
 *     i webbläsarens helskärm utan utväg. Ett element som tas bort ur sidan lämnar helskärmen av sig självt (PDF-vyn, kartan), sidan gör det inte.
 *     Därför minns kroken elementet den själv bad om (`agd`) och avslutar helskärmen vid avmonteringen bara om det fortfarande är det elementet
 *     som är i helskärm. En helskärm någon annan bett om lämnas orörd.
 *
 * @param {{ current: HTMLElement | null }} yta Elementet som blir helskärm.
 * @returns {{ lage: false | "helskarm" | "fonster", oppna: () => void, avsluta: () => void }}
 */
export function useHelskarm(yta) {
  const [lage, setLage] = useState(/** @type {false | "helskarm" | "fonster"} */ (false));
  /** Elementet kroken själv bad om helskärm för, så att avmonteringen bara avslutar sin egen. */
  const agd = useRef(/** @type {Element | null} */ (null));

  const avsluta = useCallback(() => {
    setLage(false);
    agd.current = null;
    if (typeof document !== "undefined" && document.fullscreenElement && document.fullscreenElement === yta.current) document.exitFullscreen?.()?.catch(() => {});
  }, [yta]);

  const oppna = useCallback(() => {
    const el = yta.current;
    const kan = Boolean(el) && typeof document !== "undefined" && Boolean(document.fullscreenEnabled) && typeof el?.requestFullscreen === "function";
    setLage(kan ? "helskarm" : "fonster");
    if (kan && el) {
      agd.current = el;
      const tillFonster = () => {
        agd.current = null;
        setLage((nu) => (nu ? "fonster" : nu));
      };
      try {
        el.requestFullscreen()?.catch(tillFonster);
      } catch {
        tillFonster();
      }
    }
  }, [yta]);

  useEffect(() => {
    if (lage !== "helskarm") return undefined;
    const vid = () => {
      if (document.fullscreenElement === yta.current) return;
      agd.current = null;
      setLage(false);
    };
    document.addEventListener("fullscreenchange", vid);
    return () => document.removeEventListener("fullscreenchange", vid);
  }, [lage, yta]);

  useEffect(
    () => () => {
      const egen = agd.current;
      agd.current = null;
      if (egen && document.fullscreenElement === egen) document.exitFullscreen?.()?.catch(() => {});
    },
    [],
  );

  /*
   * ⛔ SIDRAMENS RESERVERADE RULLNINGSLIST GÄLLER INTE YTAN I HELSKÄRM (mätt i `check-skalyta` 52c, samma som `OpsHtmlVy`, avsnitt 60). Tokens ger `html`
   * `scrollbar-gutter: stable`, och i Chromium var kartan då 10 px smalare än skärmen i båda lägena, med en svart rand till höger.
   */
  useEffect(() => {
    if (!lage) return undefined;
    const rot = document.documentElement;
    const fore = rot.style.scrollbarGutter;
    rot.style.scrollbarGutter = "auto";
    return () => {
      rot.style.scrollbarGutter = fore;
    };
  }, [lage]);

  useEffect(() => {
    if (lage !== "fonster") return undefined;
    /** @param {KeyboardEvent} e */
    const tangent = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setLage(false);
    };
    document.addEventListener("keydown", tangent);
    const rot = document.documentElement;
    const fore = rot.style.overflow;
    rot.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tangent);
      rot.style.overflow = fore;
    };
  }, [lage]);

  return { lage, oppna, avsluta };
}
