import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { ChevronNedIkon } from "./icons.jsx";

/**
 * Fäll ut och fäll ihop. Rubrik med chevron, innehåll under.
 *
 * Mönstret är hämtat från SessionStudios `MoreSettingsDisclosure`, som är det
 * vi redan känner igen: knapp med `aria-expanded`, chevron som roterar 180
 * grader, och en panel som växer i höjd i stället för att hoppa fram.
 *
 * ── ⛔ TRE SAKER SOM SER UT SOM DETALJER OCH INTE ÄR DET ────────────────────
 *
 * **1. Höjden animeras med grid, inte med `max-height`.**
 * Den vanliga lösningen är `max-height: 0` till `max-height: 500px`. Den kräver
 * att någon gissar en maxhöjd. Gissar man för lågt klipps innehållet av utan
 * felmeddelande, gissar man för högt blir utfällningen långsam i början
 * eftersom övergången räknar på ett avstånd som inte finns. `grid-template-rows`
 * från `0fr` till `1fr` animerar till innehållets FAKTISKA höjd, och då finns
 * ingen siffra att ha fel om.
 *
 * **2. Hopfälld panel tas ur tabbordningen med `inert`.**
 * Det här är den enda riktiga buggen i mönstret vi ärvde. `0fr` plus
 * `overflow: hidden` ger noll höjd, men innehållet är fortfarande i DOM:en och
 * fortfarande fokuserbart. Följden är att den som tabbar sig genom sidan
 * försvinner in i osynliga fält: fokusringen är borta från skärmen, och det
 * enda som händer är att sidan verkar sluta svara på Tab.
 *
 * `aria-hidden` är INTE lösningen. Det döljer för skärmläsaren men lämnar kvar
 * elementen i tabbordningen, alltså exakt det värsta av två världar: ett fält
 * som går att fokusera men inte att höra.
 *
 * `inert` gör båda sakerna. Det sätts via ref i stället för som JSX-attribut,
 * eftersom React 18 inte känner till propen och tyst släpper den. Sätter man
 * den på DOM-elementet fungerar den i varje webbläsare som stöder den och är en
 * tom operation i övriga, vilket är rätt gradvis försämring.
 *
 * **3. Sparat läge får inte krascha appen.**
 * `localStorage` kastar i privat läge och när webbplatsdata är blockerad. Läser
 * man den utan try blir ett hopfällbart avsnitt anledningen att hela sidan är
 * vit. Både läsning och skrivning är därför inneslutna, och utan lagring
 * fungerar allt utom att läget minns sig.
 */

/**
 * @param {object} props
 * @param {string} props.label Rubriktexten på knappen.
 * @param {import("react").ReactNode} props.children Innehållet som fälls ut.
 * @param {boolean} [props.defaultOpen] Läget första gången, när inget är sparat.
 * @param {string} [props.storageKey] Sparar öppet eller stängt per webbläsare. Utelämnas den minns komponenten ingenting.
 * @param {number} [props.badge] Siffra efter rubriken, t.ex. antal ifyllda fält därinne. Visas bara när den är över noll.
 * @param {string} [props.ariaLabel] När rubriktexten inte räcker som namn på egen hand.
 * @param {boolean} [props.divider] Linje ovanför rubriken. Av som standard: ett kort har redan en kant.
 */
export function OpsDisclosure({ label, children, defaultOpen = false, storageKey, badge, ariaLabel, divider = false }) {
  const knappId = useId();
  const panelId = useId();
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const [oppen, setOppen] = useState(() => lasSparat(storageKey, defaultOpen));

  useEffect(() => {
    const el = panelRef.current;
    if (el) el.inert = !oppen;
  }, [oppen]);

  const vaxla = useCallback(() => {
    setOppen((foreg) => {
      const nytt = !foreg;
      if (storageKey) {
        try {
          globalThis.localStorage?.setItem(storageKey, nytt ? "1" : "0");
        } catch {
          // Läget gäller för den här sidvisningen även om det inte kan sparas.
        }
      }
      return nytt;
    });
  }, [storageKey]);

  const text = badge && badge > 0 ? `${label} (${badge})` : label;

  return (
    <div className={cx(divider && "border-t border-line")}>
      <button
        type="button"
        id={knappId}
        aria-expanded={oppen}
        aria-controls={panelId}
        aria-label={ariaLabel}
        onClick={vaxla}
        className={cx(
          // ⛔ 44 px träffyta. En rubrik som bara är lika hög som sin text är
          // omöjlig att träffa med tummen, och det är den vanligaste platsen
          // där ett utfällbart avsnitt känns trasigt på telefon.
          "flex min-h-11 w-full items-center gap-2 py-2 text-base font-semibold text-ink-secondary",
          "transition-colors duration-(--duration-fast) ease-standard hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        <span className="min-w-0 flex-1 text-left">{text}</span>
        <span
          className={cx(
            "shrink-0 text-ink-muted transition-transform duration-(--duration-fast) ease-standard",
            oppen && "rotate-180",
          )}
        >
          <ChevronNedIkon />
        </span>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-(--duration-fast) ease-standard"
        style={{ gridTemplateRows: oppen ? "1fr" : "0fr" }}
      >
        <div ref={panelRef} id={panelId} role="region" aria-labelledby={knappId} className="overflow-hidden">
          <div className="pb-3 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {string | undefined} nyckel
 * @param {boolean} standard
 * @returns {boolean}
 */
function lasSparat(nyckel, standard) {
  if (!nyckel) return standard;
  try {
    const sparat = globalThis.localStorage?.getItem(nyckel);
    if (sparat === "1") return true;
    if (sparat === "0") return false;
  } catch {
    // Blockerad lagring är inte ett fel, det är bara ingen minneskälla.
  }
  return standard;
}
