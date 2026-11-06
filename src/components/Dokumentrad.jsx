import { OpsButton } from "./OpsButton.jsx";
import { HtmlZoomRad } from "./htmlZoom.jsx";

/**
 * Raden ovanför ett dokument (0.196.0): zoomen, sidan och ikonknapparna. EN rad, delad av PDF-vyn (`OpsPdfVisning`) och HTML-rutan (`OpsHtmlDokument`), så att två dokument i samma Bibliotek ser likadana ut (regel 2).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-06, med en skärmbild från telefonen (gästens bibliotek, en PDF i detaljen): "Det här ser jättekonstigt ut, kolla hur ful titeln ligger skarv.pdf. Det här håller inte. Presentera är ett konstigt ord i sammanhanget."
 * Under detaljens rubrik stod då, var för sig, en ruta med bakgrund där filnamnet stod stort med "Sida 1 av 1" under, en rad med zoomen och en stor knapp Presentera, Ladda ned ensam på en egen rad, och sidan i en egen ram
 * med rundade hörn inne i rutan. Fyra lager och tre rader, och filnamnet upprepade det detaljen redan sade.
 *
 * ⛔ SÅ HÄR SER RADEN UT:
 * 1. INGEN EGEN BAKGRUND OCH INGEN RAM. Raden står på den yta den hamnar på. Filnamnet står inte i raden: i detaljen har posten redan sin rubrik, och i ett eget fönster står namnet som rubrik bredvid raden.
 * 2. VÄNSTER: zoomen (`HtmlZoomRad`, samma knappar som förut) och sidan som "1/3" när dokumentet har fler än en sida. Skärmläsaren hör "Sida 1 av 3".
 * 3. HÖGER: ikonknappar (`DokumentKnapp`), var och en med sitt namn för skärmläsaren och som `title`. Ingen text som tar en rad.
 * 4. RADEN BRYTS INTE (`flex-nowrap`). I 390 px rymmer den zoomen, sidan och tre ikonknappar (mätt i montaget för 0.196.0).
 *
 * @param {object} props
 * @param {string} props.mark Radens dataattribut, för prov och mätningar (`data-pdf-rad`, `data-html-dokument-verktyg`).
 * @param {string} props.etikett Gruppens namn för skärmläsaren.
 * @param {import("./htmlZoom.jsx").HtmlZoom | null} [props.zoom] Utan zoom (dokumentet hämtas ännu) står bara knapparna.
 * @param {string} props.sprak
 * @param {{ nr: number, antal: number, etikett: string } | null} [props.sida] Sidan och antalet. Ritas bara när antalet är större än ett.
 * @param {import("react").ReactNode} [props.children] Ikonknapparna till höger.
 */
export function Dokumentrad({ mark, etikett, zoom, sprak, sida, children }) {
  return (
    <div {...{ [mark]: "" }} data-dokumentrad="" role="group" aria-label={etikett} className="flex min-w-0 flex-nowrap items-center gap-1">
      {zoom ? <HtmlZoomRad zoom={zoom} sprak={sprak} /> : null}
      {sida && sida.antal > 1 ? (
        <span data-dokumentrad-sida="" className="shrink-0 px-1 text-meta text-ink-secondary tabular-nums">
          <span aria-hidden="true">{`${sida.nr}/${sida.antal}`}</span>
          <span className="sr-only">{sida.etikett}</span>
        </span>
      ) : null}
      <div data-dokumentrad-knappar="" className="ml-auto flex shrink-0 items-center gap-0.5">
        {children}
      </div>
    </div>
  );
}

/**
 * En ikonknapp i dokumentraden. Namnet står för skärmläsaren och som `title`, så att den som håller pekaren över knappen läser vad den gör.
 * Med `href` är den en länk som öppnas i en ny flik (Öppna i eget fönster), annars en knapp.
 *
 * @param {object} props
 * @param {string} props.mark Dataattribut på omslaget (`OpsButton` tar inga egna attribut).
 * @param {import("react").ComponentType<{ size?: number, "aria-hidden"?: boolean | "true" }>} props.ikon
 * @param {string} props.etikett
 * @param {() => void} [props.onClick]
 * @param {string} [props.href]
 * @param {boolean} [props.disabled]
 */
export function DokumentKnapp({ mark, ikon: Ikon, etikett, onClick, href, disabled = false }) {
  return (
    <span {...{ [mark]: "" }} className="inline-flex">
      <OpsButton variant="ghost" size="sm" iconOnly ariaLabel={etikett} title={etikett} href={href} newTab={Boolean(href)} onClick={onClick} disabled={disabled}>
        <Ikon size={18} aria-hidden="true" />
      </OpsButton>
    </span>
  );
}
