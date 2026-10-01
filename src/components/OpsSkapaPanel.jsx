import { useEffect, useId, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { ChevronNedIkon } from "./icons.jsx";
import { OpsButton } from "./OpsButton.jsx";
import { TillbakaKnapp } from "./TillbakaKnapp.jsx";

/**
 * Skapa-panelen: en SIDA i innehållskolumnen, inte en dialog (0.31.0).
 *
 * ══ ⛔ SESSIONSTUDIO SKAPAR I EN PANEL (CP 2026-09-29) ═══════════════════
 *
 * CP: "Skapa nytt i ramverket. Låt det vara paneler istället för modaler precis som i sessionstudio." SS "Ny grupp":
 * `GroupEditRouteView.jsx:36-47` är en rad "‹ Tillbaka" (`text-sm text-muted`, `ChevronLeft w-5`), och under den formuläret
 * (`ManageGroupModal inline`, `:454` rubrikraden, `:479` kroppen som rullar, `:640` knappraden längst ned med
 * `border-t`). Huvudet och gruppanelen står kvar. Här ritas samma delar: Tillbaka, rubrik, en rad "Skapas i", formuläret i en
 * kolumn (SS bredd per formulär, se `kolumn`, centrerad) och en FAST knapprad längst ned till höger (Avbryt som textknapp, Spara som
 * fylld accentknapp).
 *
 * ⛔ TILLBAKA GÅR TILLBAKA DIT MAN VAR. Skalet håller appens vy monterad men dold medan panelen visas, så ett tryck på
 * Tillbaka återställer exakt den vy (och rullposition) man kom från, i stället för att appen ritar om från noll.
 *
 * ⛔ EN PANEL HAR INGEN `role="dialog"`. Den är en del av sidan, inte ett lager över den: skärmläsaren ska inte få veta att
 * resten av sidan är utom räckhåll. Den har en rubrik (`aria-labelledby`) och är en region.
 *
 * ⛔ UNDER `md` ÄR PANELEN HELSKÄRM (`fixed inset-0`) med en EGEN rubrikrad (Tillbaka och titel), en kropp som rullar och en
 * knapprad som ligger kvar längst ned inom `--safe-bottom`. Höjden följer `visualViewport`, så när tangentbordet öppnas krymper
 * panelen med det och knappraden och det aktiva fältet ligger ovanför tangentbordet, inte under det. Bottenraden täcks: skapa är
 * ett läge man är i, och en bottenrad som ligger över knappraden är precis det som gjorde arket inträngt (CP 2026-09-29 15:01).
 *
 * ⛔ KNAPPRADEN ÄR SKALETS, FORMULÄRET ÄR APPENS. `Spara` är en `type="submit" form={formId}`: appens formulär ger sitt
 * `<form>` `id={formId}` (skalet skickar `formId` till formuläret). Ritas ingen `Spara` (`sparaEtikett` utelämnad) är det
 * för att formuläret har en egen knapp, och då är bara `Avbryt` skalets.
 *
 * @param {object} props
 * ══ ⛔ KOLUMNBREDDEN ÄR SS, PER FORMULÄR (0.32.0, #180) ═══════════════════════════════════════════════════════════
 *
 * Före 0.32.0 var kolumnen 880 px (`max-w-[55rem]`) för ALLA formulär. SS har olika bredd per formulär: `GroupEditRouteView.jsx:40` är
 * `max-w-2xl` (672 px) och `EventEditRouteView.jsx:145` är `max-w-4xl` (896 px). Bredden är därför en prop, `kolumn`: `"smal"` (672, grupp) och
 * `"bred"` (896, händelse, ärende och en moduls formulär). Båda breddarna inkluderar sidomarginalen `px-4`, som SS `box-border`. Skalet väljer.
 *
 * @param {string} props.titel
 * @param {() => void} props.onTillbaka
 * @param {string} [props.tillbakaEtikett] Förval "Tillbaka".
 * @param {string} [props.skapasIEtikett] Förval "Skapas i".
 * @param {string | null} [props.skapasI] Namnet på målet. Utelämnad/`null`: ingen rad.
 * @param {() => void} [props.onByt] Öppnar väljaren. Utan den är raden inte en knapp.
 * @param {string} [props.avbrytEtikett] Förval "Avbryt".
 * @param {string} [props.sparaEtikett] Ritar en `Spara`-knapp kopplad till `formId`.
 * @param {string} [props.formId]
 * @param {"smal"|"bred"} [props.kolumn] `smal` = 672 px (SS `max-w-2xl`, grupp), `bred` = 896 px (SS `max-w-4xl`, händelse). Förval `bred`.
 * @param {import("react").ReactNode} props.children
 */
export function OpsSkapaPanel({ kolumn = "bred", titel, onTillbaka, tillbakaEtikett = "Tillbaka", skapasIEtikett = "Skapas i", skapasI = null, onByt, avbrytEtikett = "Avbryt", sparaEtikett, formId, children }) {
  const ref = useRef(/** @type {HTMLElement | null} */ (null));
  const [hojd, setHojd] = useState(/** @type {number | null} */ (null));

  // ⛔ Höjden ur `visualViewport`: `dvh` följer inte iOS-tangentbordet, `visualViewport.height` gör det.
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return undefined;
    const lyssna = () => setHojd(vv.height);
    lyssna();
    vv.addEventListener("resize", lyssna);
    return () => vv.removeEventListener("resize", lyssna);
  }, []);

  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "start" });
  }, []);

  const rubrikId = useId();
  return (
    <section
      ref={ref}
      aria-labelledby={rubrikId}
      data-skapa-panel=""
      style={hojd ? /** @type {any} */ ({ "--skapa-hojd": `${hojd}px` }) : undefined}
      className={cx(
        // Under md: helskärm. Från md: en sida i kolumnen som är minst lika hög som fönstret, så knappraden vilar nere.
        "flex flex-col bg-canvas max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-(--z-modal) max-md:h-(--skapa-hojd,100dvh)",
        "md:min-h-[calc(100dvh-var(--safe-top)-var(--topbar-height))]",
      )}
    >
      <div className={cx("mx-auto flex w-full min-h-0 flex-1 flex-col px-4 max-md:pt-(--safe-top) md:pt-4", kolumn === "smal" ? "max-w-2xl" : "max-w-4xl")}>
        <div className="flex shrink-0 flex-col max-md:min-h-14 max-md:flex-row max-md:items-center max-md:gap-1 max-md:border-b max-md:border-line">
          <TillbakaKnapp onClick={onTillbaka} etikett={tillbakaEtikett} className="self-start" />
          {/* ⛔ EN rubrik: i raden bredvid Tillbaka under md (helskärm), under Tillbaka från md (som SS `GroupEditRouteView`). */}
          <h2 id={rubrikId} className="m-0 mt-1 mb-3 min-w-0 truncate text-sida font-bold leading-tight text-ink max-md:mt-0 max-md:mb-0 max-md:flex-1 max-md:pr-16 max-md:text-center max-md:text-brod">
            {titel}
          </h2>
        </div>
        {/* ⛔ `pt-4`: LUFT MELLAN HUVUDET OCH FÖRSTA RADEN (0.32.1). CP 2026-09-30 08:12, med en skärmbild av "Nytt ärende"
            vid 390 px: "Vidare är det skönt om det är lite luft mellan första raden och headern." Formulärets första rad låg
            direkt under huvudets linje. SS har 16 px där i båda sina inline-formulär: `ManageGroupModal` (`py-4` på kroppen,
            `ManageGroupModal.jsx:479`) och `EventModal` (`formPad: "py-4 ..."`, `eventModal/sizeClasses.js:7`). Luften bor här
            i panelens innehållsbehållare och inte i varje formulär, så att inget formulär kan glömma den. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4 pb-4 md:overflow-visible">
          {skapasI ? (
            <div className="mb-4 flex min-w-0 items-center gap-2 text-etikett text-ink-secondary">
              <span className="shrink-0 whitespace-nowrap">{skapasIEtikett}:</span>
              {onByt ? (
                <button
                  type="button"
                  onClick={onByt}
                  aria-label={`${skapasIEtikett}: ${skapasI}`}
                  className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-1 rounded-base px-2 font-semibold text-ink transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="truncate">{skapasI}</span>
                  <ChevronNedIkon size={14} />
                </button>
              ) : (
                <span className="min-w-0 truncate font-semibold text-ink">{skapasI}</span>
              )}
            </div>
          ) : null}
          {children}
        </div>
      </div>
      <div
        data-skapa-knappar=""
        className="sticky bottom-0 shrink-0 border-t border-line bg-canvas pb-(--safe-bottom)"
      >
        <div className={cx("mx-auto flex w-full items-center justify-end gap-2 px-4 py-3", kolumn === "smal" ? "max-w-2xl" : "max-w-4xl")}>
          <OpsButton variant="ghost" onClick={onTillbaka}>
            {avbrytEtikett}
          </OpsButton>
          {sparaEtikett ? (
            <OpsButton variant="primary" type="submit" form={formId}>
              {sparaEtikett}
            </OpsButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
