import { useId, useState } from "react";
import { cx } from "../lib/cx.js";

/**
 * Talet man laborerar med, som håller sin plats i fönstret.
 *
 * ── ⛔ VARFÖR DEN FINNS ──────────────────────────────────────────────────
 *
 * Reglaget och talet det påverkar får inte plats på samma skärm på en telefon.
 * Antingen ser man vad man drar i, eller vad det blir. Scrollar man mellan dem
 * jämför man mot ett MINNE i stället för mot en siffra, och då är hela poängen
 * med ett reglage borta.
 *
 * CP, bolag-ops#210: "man vill se hur reglaget påverkar kassaflödet."
 *
 * ── ⛔ `fixed`, OCH FÖRSTA FÖRSÖKET MED `sticky` VAR FEL ─────────────────
 *
 * Den här komponenten hette `OpsStickySummary` och var `sticky bottom-…`,
 * lånat från SessionStudios "Idag"-knapp. Den lösningen fungerar DÄR, och
 * skälet är värt att kunna:
 *
 *   SessionStudios kalender är ett skal med FAST HÖJD (`h-full overflow-hidden`)
 *   med två kolumner som scrollar var för sig. Panelen bredvid står stilla för
 *   att den inte sitter i samma scroll-behållare som det man scrollar. Det finns
 *   varken `sticky` eller `fixed` inblandat.
 *
 * En sida som scrollar i DOKUMENTET har ingen andra behållare att stå stilla i.
 * Där gör `sticky` att elementet nyper fast bara inom sin egen förälders
 * scrollsträcka, och resultatet blev vad CP såg: en rad i flödet som inte flöt.
 *
 * `fixed` är därför rätt här och inte en genväg. Elementet hör till FÖNSTRET,
 * inte till en förälder.
 *
 * ── ⛔ INVÄNDNINGEN MOT `fixed`, OCH VAD SOM GÖR DEN OGILTIG HÄR ─────────
 *
 * En fast ruta ligger över innehållet för alltid och täcker sista raden, vilket
 * man upptäcker först när någon letar efter sin sista post. Det är ett riktigt
 * problem och skälet till att första versionen undvek `fixed`.
 *
 * Det som gör det ogiltigt: bubblan finns BARA MEDAN NÅGOT ÄR JUSTERAT. Den
 * som inte laborerar ser den aldrig, och den som gör det kan klicka bort den.
 * Appen avgör när den ska finnas; komponenten renderar inte något eget villkor.
 *
 * ── ⛔ BOTTNAR ÖVANFÖR BOTTENRADEN ─────────────────────────────────────
 *
 * `--bottom-nav-h` plus `--safe-bottom`, precis som OpsToast. Räknas det bort
 * hamnar bubblan ovanpå telefonens navigering, alltså över den enda knappen man
 * behöver för att komma därifrån.
 *
 * ── ⛔ LAGRET ÄR `--z-sticky`, INTE `--z-chrome` ────────────────────────
 *
 * Bubblan är innehåll som fastnar, inte appskal. Kromet ligger på `--z-chrome`
 * sedan en tabellcell målade över logotypen, och en ny fast yta som tar kromets
 * lager gör om exakt det felet, fast nedåt.
 */

/**
 * @param {object} props
 * @param {string} props.label Vad siffran är. Syns utfälld, och är knappens namn för den som lyssnar.
 * @param {string} props.value Siffran, färdigformaterad.
 * @param {"neutral"|"success"|"danger"} [props.tone] Färg på värdet.
 * @param {string} [props.hint] En rad till under värdet, till exempel skillnaden mot nuläget.
 * @param {() => void} [props.onDismiss] Finns den får bubblan ett kryss som stänger den.
 * @param {string} [props.dismissLabel] Kryssets namn för den som lyssnar.
 */
export function OpsFloatingSummary({ label, value, tone = "neutral", hint, onDismiss, dismissLabel = "Dölj" }) {
  if (!label || !value) {
    throw new Error(
      "OpsFloatingSummary: label och value krävs. En bubbla med ett tal utan namn säger inte vad talet är, och en med ett namn utan tal är en tom ruta som ligger i vägen.",
    );
  }

  const id = useId();
  const [oppen, setOppen] = useState(true);
  const tonklass = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink";

  return (
    /*
     * ⛔ `pointer-events-none` på omslaget och `pointer-events-auto` på bubblan.
     * Omslaget spänner hela bredden för att bubblan ska kunna skjutas åt höger,
     * och utan det hade den osynliga remsan ätit varje tryck längs nederkanten.
     */
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+0.5rem)] z-(--z-sticky) flex justify-end px-4 md:bottom-[calc(var(--safe-bottom)+1rem)]">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-raised shadow-lg">
        <button
          type="button"
          id={id}
          onClick={() => setOppen((o) => !o)}
          aria-expanded={oppen}
          aria-label={oppen ? `${label}: ${value}. Fäll ihop` : `${label}: ${value}. Fäll ut`}
          className={cx("flex min-h-11 items-center gap-3 rounded-full", oppen ? "pl-4 pr-3" : "px-3")}
        >
          {oppen ? (
            <span className="flex flex-col items-start text-left">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-secondary">{label}</span>
              {hint ? <span className="text-xs text-ink-secondary">{hint}</span> : null}
            </span>
          ) : null}
          <span className={cx("tabular-nums text-md font-bold", tonklass)}>{value}</span>
        </button>

        {/* ⛔ EGEN KNAPP OCH INTE ETT KRYSS INUTI DEN ANDRA. En knapp i en knapp
            är ogiltig HTML, och trycket hade bubblat upp så att ett försök att
            stänga i stället fällde ihop. */}
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`${dismissLabel} ${label}`}
            className="flex size-11 items-center justify-center rounded-full text-ink-secondary"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
