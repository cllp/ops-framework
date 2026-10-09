import { cx } from "../lib/cx.js";
import { ChevronVansterIkon } from "./icons.jsx";
import { useIHuvudmenyn } from "./OpsHuvudmeny.jsx";

/**
 * Tillbaka-raden: EN komponent för VARJE sida under Hub (0.31.2, CP 2026-09-29 20:57).
 *
 * ══ ⛔ EN TEXTLÄNK MED CHEVRON OCH SIDANS RUBRIK UNDER, SOM SESSIONSSTUDIO ══════
 *
 * CP, med en bild från telefonen av `/hub/ekonomi`: "Navigeringen tillbaka ser inget bra ut. Gör samma som SessionStudio och
 * aktivitet." På bilden var raden ett bandformat fält över hela bredden med en linje under sig ("‹ Hub / Ekonomi", `sticky`,
 * `border-b`, `bg-canvas`), och sidans första kort hade sin överkant under bandet. SessionStudio ritar det som en textlänk:
 * `GroupEditRouteView.jsx:41` och `GroupDetailView.jsx:83` är `flex items-center gap-2 text-sm text-muted hover:text-primary mb-3`,
 * en `ChevronLeft` (20 px) och ordet "Tillbaka", och sidans rubrik (`<h1 text-xl>`) står under den. Ramverkets egen
 * Aktivitet-panel har samma gest (`MenyTillbakaKnapp`: chevron, ingen ram, ingen platta).
 *
 * ⛔ Därför: ingen `sticky`, ingen `border`, ingen bakgrund, inget brödsmulespår. Ett spår ("Hub / Ekonomi / Inkomster") är en
 * bredare sak än en tillbakaknapp, och SS har aldrig haft det. Länken leder ETT steg upp: senaste `steg`, annars Hub.
 * Rubriken ritas av raden (`rubrik`) på modulens sida (`OpsHubModul`); på en sida som redan har `OpsViewHeader` ritas den inte
 * (en sida har en `<h1>`).
 */

/**
 * Sidans rubrik (0.90.1, lifehub.app#146).
 *
 * SessionStudio ritar den som `text-xl font-semibold`: 20 px, vikt 600
 * (`GroupDetailView`). `text-sida` är 1.25rem. `--font-display` är
 * `--font-sans`, Plus Jakarta Sans, samma familj. Vikten 700 (`font-bold`)
 * på den storleken var det som såg ut som fel typsnitt. Samma klass i
 * `OpsViewHeader` och `OpsInstallningar`.
 */
export const SIDRUBRIK_KLASS = "m-0 font-display text-sida font-semibold leading-tight tracking-tight text-ink";

/**
 * @param {object} props
 * @param {string} props.hubHref Hubbens `href`: länkens mål när `steg` är tom.
 * @param {string} props.etikett Den nuvarande sidans namn. Rubriken när `rubrik` är sant.
 * @param {ReadonlyArray<{ href: string, label: string }>} [props.steg] Mellanliggande sidor mellan Hub och den nuvarande. Länken leder till den sista.
 * @param {string} [props.hubEtikett] Förval "Appar" (0.50.0; tidigare "Hub"). Ingår i skärmläsarnamnet när länken leder till Hub.
 * @param {(href: string, event: any) => void} [props.onNavigate]
 * @param {string} [props.brodsmulaEtikett] Skärmläsarnamn på raden. Förval "Var du är".
 * @param {string} [props.tillbakaEtikett] Ordet på länken. Förval "Tillbaka".
 * @param {string} [props.tillbakaTillEtikett] Skärmläsarens "Tillbaka till". Förval "Tillbaka till".
 * @param {boolean} [props.rubrik] Rita sidans rubrik under länken. Förval falskt.
 * @param {string} [props.modul] (0.88.1) Modulens id. Står modulen i huvudmenyn (`OpsHuvudmenyProvider`) ritas ingen länk, bara rubriken: en fäst modul är inbyggd.
 * @param {import("react").ReactNode} [props.atgard] (0.89.0) Något till höger om rubriken, på samma rad. Kugghjulet i modulramen. Utan rubrik och utan åtgärd ritas ingenting när modulen är fäst.
 */
export function OpsHubTillbaka({ hubHref, etikett, steg = [], hubEtikett = "Appar", onNavigate, brodsmulaEtikett = "Var du är", tillbakaEtikett = "Tillbaka", tillbakaTillEtikett = "Tillbaka till", rubrik = false, modul, atgard = null }) {
  const fast = useIHuvudmenyn(modul);
  if (typeof hubHref !== "string" || hubHref === "") {
    throw new Error("OpsHubTillbaka: hubHref krävs. Tillbaka-raden är ett steg upp till Hub, och en rad som inte vet vart den leder är en knapp som inte gör något.");
  }
  if (typeof etikett !== "string" || etikett === "") {
    throw new Error("OpsHubTillbaka: etikett krävs, den nuvarande sidans namn. Raden utan det säger inte var man är.");
  }
  const mal = steg.length > 0 ? steg[steg.length - 1] : { href: hubHref, label: hubEtikett };
  if (fast && !rubrik && !atgard) return null;
  return (
    <div className="flex flex-col gap-1" data-tillbaka-fast={fast ? "" : undefined}>
      {fast ? null : (
      <nav aria-label={brodsmulaEtikett}>
        <a
          href={mal.href}
          onClick={(e) => onNavigate?.(mal.href, e)}
          aria-label={`${tillbakaTillEtikett} ${mal.label}`}
          className={cx(
            "inline-flex min-h-11 items-center gap-2 rounded-base text-etikett text-ink-secondary transition-colors duration-(--duration-fast) ease-standard hover:text-ink",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <ChevronVansterIkon size={20} />
          <span>{tillbakaEtikett}</span>
        </a>
      </nav>
      )}
      {rubrik && atgard ? (
        <div className="flex items-start justify-between gap-3">
          <h1 className={cx(SIDRUBRIK_KLASS, "min-w-0 flex-1")}>{etikett}</h1>
          {atgard}
        </div>
      ) : rubrik ? (
        <h1 className={SIDRUBRIK_KLASS}>{etikett}</h1>
      ) : atgard ? (
        <div className="flex justify-end">{atgard}</div>
      ) : null}
    </div>
  );
}
