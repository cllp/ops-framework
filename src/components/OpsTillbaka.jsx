import { cx } from "../lib/cx.js";
import { ChevronVansterIkon } from "./icons.jsx";

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
 *
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
 */
export function OpsHubTillbaka({ hubHref, etikett, steg = [], hubEtikett = "Appar", onNavigate, brodsmulaEtikett = "Var du är", tillbakaEtikett = "Tillbaka", tillbakaTillEtikett = "Tillbaka till", rubrik = false }) {
  if (typeof hubHref !== "string" || hubHref === "") {
    throw new Error("OpsHubTillbaka: hubHref krävs. Tillbaka-raden är ett steg upp till Hub, och en rad som inte vet vart den leder är en knapp som inte gör något.");
  }
  if (typeof etikett !== "string" || etikett === "") {
    throw new Error("OpsHubTillbaka: etikett krävs, den nuvarande sidans namn. Raden utan det säger inte var man är.");
  }
  const mal = steg.length > 0 ? steg[steg.length - 1] : { href: hubHref, label: hubEtikett };
  return (
    <div className="flex flex-col gap-1">
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
      {rubrik ? <h1 className="m-0 font-display text-sida font-bold leading-tight tracking-tight text-ink">{etikett}</h1> : null}
    </div>
  );
}
