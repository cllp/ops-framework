import { useId, useState } from "react";
import { cx } from "../lib/cx.js";

/**
 * En siffra som följer med när man scrollar, och går att fälla ihop.
 *
 * ── ⛔ VARFÖR DEN FINNS ──────────────────────────────────────────────────
 *
 * Reglagen och talet de påverkar får inte plats på samma skärm på en telefon.
 * Antingen ser man vad man drar i, eller vad det blir. Scrollar man mellan dem
 * jämför man mot ett MINNE i stället för mot en siffra, och då är hela poängen
 * med ett reglage borta.
 *
 * Kommer ur bolag-ops#210. CP: "låta den följa med fönstret när man skrollar i
 * sidan. Det gör att man kan se kassaflödet när man drar i reglagen utan att
 * scrolla upp."
 *
 * ── ⛔ `sticky`, ALDRIG `fixed`. MEKANISMEN ÄR LÅNAD OCH MÄTT ────────────
 *
 * SessionStudios kalender har samma sak: knappen "Idag" som ligger kvar medan
 * månaderna rullar förbi (`CalView.jsx`, `sticky bottom-4 ml-auto`). Den är
 * INTE `fixed`, och det är skillnaden som gör den användbar:
 *
 *   `fixed`   lyfts ur flödet och ligger över allt, för alltid. Den täcker
 *             sista raden i innehållet, och man märker det först när någon
 *             letar efter sin sista post.
 *   `sticky`  ligger kvar i flödet. Den nyper fast vid nederkanten medan man
 *             scrollar och LANDAR på sin plats när man når slutet. Innehållet
 *             under den kommer alltså fram av sig självt.
 *
 * Priset är att elementet måste ligga SIST i det som scrollar, och att ingen
 * förälder får ha `overflow: hidden`. Båda är krav på den som använder den, och
 * båda är utskrivna här därför att symptomet är detsamma i båda fallen: den
 * slutar bara följa med, utan att något går sönder.
 *
 * ── ⛔ DEN LIGGER ÖVER BOTTENRADEN, ALLTSÅ MÅSTE DEN BOTTNA ÖVANFÖR DEN ──
 *
 * `--bottom-nav-h` plus `--safe-bottom`, precis som OpsToast. Räknas den bort
 * hamnar bubblan ovanpå telefonens navigering, alltså över den enda knappen man
 * behöver för att komma härifrån.
 *
 * ── ⛔ LAGRET ÄR `--z-sticky`, INTE `--z-chrome` ────────────────────────
 *
 * Bubblan är INNEHÅLL som fastnar, inte appskal. Kromet (headern, bottenraden)
 * ligger på `--z-chrome` sedan en tabellcell målade över logotypen, och en ny
 * fast yta som tar kromets lager gör om exakt det felet, fast nedåt.
 *
 * ── ⛔ IHOPFÄLLD ÄR INTE BORTA ──────────────────────────────────────────
 *
 * CP: "Det skall gå att klicka ner den också." Ihopfälld blir den en smal pille
 * med bara värdet kvar, aldrig ingenting. En yta som försvinner helt går inte
 * att få tillbaka utan att veta att den funnits, och då är den borta på riktigt
 * för den som inte visste.
 */

/**
 * @param {object} props
 * @param {string} props.label Vad siffran är. Syns utfälld, och är knappens namn för den som lyssnar.
 * @param {string} props.value Siffran, färdigformaterad.
 * @param {"neutral"|"success"|"danger"} [props.tone] Färg på värdet.
 * @param {string} [props.hint] En rad till under värdet, till exempel skillnaden mot nuläget.
 * @param {boolean} [props.defaultOpen] Startläge när komponenten är ostyrd.
 * @param {string} [props.storageKey] Minns utfällt eller ihopfällt per webbläsare.
 */
export function OpsStickySummary({ label, value, tone = "neutral", hint, defaultOpen = true, storageKey }) {
  if (!label || !value) {
    throw new Error(
      "OpsStickySummary: label och value krävs. En bubbla med ett tal utan namn säger inte vad talet är, och en med ett namn utan tal är en tom ruta som ligger i vägen.",
    );
  }

  const id = useId();
  const [oppen, setOppen] = useState(() => lasSparat(storageKey, defaultOpen));

  const vaxla = () => {
    const ny = !oppen;
    setOppen(ny);
    spara(storageKey, ny);
  };

  const tonklass = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-ink";

  return (
    // ⛔ `pointer-events-none` på omslaget och `pointer-events-auto` på bubblan.
    // Omslaget spänner hela bredden för att `ml-auto` ska kunna skjuta bubblan
    // åt höger, och utan det hade den osynliga remsan ätit varje tryck längs
    // nederkanten av sidan.
    <div className="pointer-events-none sticky bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+0.5rem)] z-(--z-sticky) flex justify-end md:bottom-[calc(var(--safe-bottom)+1rem)]">
      <button
        type="button"
        id={id}
        onClick={vaxla}
        aria-expanded={oppen}
        aria-label={oppen ? `${label}: ${value}. Fäll ihop` : `${label}: ${value}. Fäll ut`}
        className={cx(
          "pointer-events-auto flex min-h-11 items-center gap-3 rounded-full border border-line bg-raised shadow-lg",
          oppen ? "px-4 py-2" : "px-3 py-2",
        )}
      >
        {oppen ? (
          <span className="flex flex-col items-start text-left">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-secondary">{label}</span>
            {hint ? <span className="text-xs text-ink-secondary">{hint}</span> : null}
          </span>
        ) : null}
        <span className={cx("tabular-nums text-md font-bold", tonklass)}>{value}</span>
      </button>
    </div>
  );
}

/**
 * ⛔ Läsningen är inslagen i try/catch. `localStorage` kastar i privat läge i
 * vissa webbläsare, och en bubbla som kraschar hela vyn för att den inte fick
 * minnas ett hopfällt läge är ett sämre byte än att börja utfälld.
 *
 * @param {string | undefined} nyckel @param {boolean} standard @returns {boolean}
 */
function lasSparat(nyckel, standard) {
  if (!nyckel) return standard;
  try {
    const v = globalThis.localStorage?.getItem(nyckel);
    return v === null || v === undefined ? standard : v === "1";
  } catch {
    return standard;
  }
}

/** @param {string | undefined} nyckel @param {boolean} varde */
function spara(nyckel, varde) {
  if (!nyckel) return;
  try {
    globalThis.localStorage?.setItem(nyckel, varde ? "1" : "0");
  } catch {
    // Minns inte. Bubblan fungerar ändå.
  }
}
