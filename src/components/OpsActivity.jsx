import { useState } from "react";
import { cx } from "../lib/cx.js";
import { unreadCount } from "../lib/aktivitet.js";
import { formatDateTime, formatRelativeDate } from "../lib/format.js";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsModal } from "./OpsModal.jsx";

/**
 * Aktiviteten: vad som kördes, när, och vad det ändrade.
 *
 * ══ ⛔ VAD DEN SVARAR PÅ ════════════════════════════════════════════════
 *
 * CP (bolag-ops): "notiser i appen som visar aktivitet. När saker kördes och
 * hamnade där … En integration kördes mot LF och uppdaterade ekonomiposter."
 *
 * Frågan är inte "vad är sant nu", den ställer resten av appen. Den här ställer
 * **hände något, och gick det bra?** Utan svaret ser en app som hämtar i
 * bakgrunden likadan ut oavsett om hämtningen kördes i morse eller gick sönder
 * i förrgår, och ett tal som ser färskt ut går inte att skilja från ett som är
 * gammalt.
 *
 * ══ ⛔ RAMVERKET RITAR, APPEN BESTÄMMER VAD SOM STÅR ════════════════════
 *
 * Komponenten tar färdiga rader och slagens ord. Den vet inte vad en
 * bankintegration är, vilka jobb som finns, eller var de bor. Formen står i
 * `lib/aktivitet.js`, vägen in för skrivare i `node/aktivitet.js`.
 *
 * ══ ⛔ "OLÄST" ÄR LÄSARENS EGENSKAP, INTE RADENS ════════════════════════
 *
 * Märket räknas ur en tidpunkt i webbläsaren, inte ur ett fält på dokumentet.
 * Två personer som öppnar samma logg har olika svar, och skrevs `last: false`
 * på raden vore det en delad sanning om något privat: den som läser sist skriver
 * över den andres.
 *
 * ⛔ `localStorage` KASTAR i privat läge och när webbplatsdata är blockerad.
 * Läses den utan try blir en notisikon anledningen att hela sidan vitnar, och
 * det är en dyr växel för en siffra på en prick.
 */

/** @param {string | undefined} key */
function lastSedd(key) {
  if (!key) return null;
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** @param {string | undefined} key @param {string} value */
function sparaSedd(key, value) {
  if (!key) return;
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // ⛔ Tyst med flit. Att märket inte minns är en olägenhet; att sidan faller
    // för att en webbläsare blockerar lagring är ett fel.
  }
}

/**
 * En rad i listan.
 *
 * ⛔ BÅDE RELATIV OCH EXAKT TID. "för 2 timmar sedan" är det man läser, och det
 * går inte att jämföra med något: den som undrar om importen kördes före eller
 * efter en ändring behöver klockslaget. Det exakta står i `title` och som liten
 * text, så raden går att skumma utan att bli en tabell.
 *
 * @param {{ handelse: import("../lib/aktivitet.js").Handelse, slagord: string, nu?: Date | number }} props
 */
function Rad({ handelse, slagord, nu }) {
  const trasig = handelse.resultat === "fel";
  return (
    <li className="flex flex-col gap-0.5 border-t border-divider py-3 first:border-t-0 first:pt-0">
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {/* ⛔ ORDET OCH INTE BARA EN FÄRG. Ett misslyckande som bara syns som en
            röd ton går inte att läsa upp och är osynligt för var tjugonde man. */}
        {trasig ? <span className="text-sm font-semibold text-danger">Gick fel</span> : null}
        <span className={cx("font-semibold", trasig ? "text-ink" : "text-ink")}>{handelse.rubrik}</span>
      </span>

      {handelse.detalj ? <span className="text-sm text-ink-secondary">{handelse.detalj}</span> : null}
      {trasig && handelse.fel ? <span className="text-sm text-danger">{handelse.fel}</span> : null}

      <span className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-muted">
        <time dateTime={handelse.nar} title={formatDateTime(handelse.nar)}>
          {formatRelativeDate(handelse.nar, nu ? { now: nu } : undefined)}
        </time>
        <span aria-hidden="true">·</span>
        <span>{formatDateTime(handelse.nar)}</span>
        {slagord ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{slagord}</span>
          </>
        ) : null}
        {handelse.kalla ? (
          <>
            <span aria-hidden="true">·</span>
            {/* ⛔ JOBBETS NAMN SYNS. Den som undrar varför en siffra ändrades ska
                kunna se VAD som ändrade den, utan att gissa ur rubriken. */}
            <code className="rounded-sm bg-sunken px-1 text-sm">{handelse.kalla}</code>
          </>
        ) : null}
      </span>
    </li>
  );
}

/**
 * Listan, utan knapp och utan ruta.
 *
 * ⛔ EXPORTERAS SEPARAT så en app kan lägga aktiviteten på en egen sida i
 * stället för bakom ikonen. Knappen är ett sätt att komma åt listan, inte
 * listans enda hem.
 *
 * @param {object} props
 * @param {import("../lib/aktivitet.js").Handelse[]} props.entries Nyast först. ⛔ Appen sorterar: den vet vilken klocka som gäller.
 * @param {(slag: string) => string} [props.kindLabel] Slagets ord. Utan den står inget slag på raden.
 * @param {import("react").ReactNode} [props.empty] Vad som står när loggen är tom.
 * @param {Date | number} [props.now] Bara för prov. Produktionen har en klocka.
 */
export function OpsActivityList({ entries, kindLabel, empty, now }) {
  const rader = entries || [];

  if (rader.length === 0) {
    /* ⛔ TOM LOGG OCH "INGET HAR KÖRTS" ÄR SAMMA SAK HÄR, och det är sant: raden
       skrivs när jobbet kört. Appen får säga det med egna ord, för vad tomt
       BETYDER beror på vilka jobb den har. */
    return empty ?? <OpsEmpty title="Inget har hänt än" description="Här står vad som kördes och när, så fort något gjort det." />;
  }

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {rader.map((h, i) => (
        <Rad key={`${h.nar}-${i}`} handelse={h} slagord={kindLabel ? kindLabel(h.slag) : ""} nu={now} />
      ))}
    </ul>
  );
}

/**
 * Klockikonen med sitt märke, och listan bakom den.
 *
 * ⛔ EN `<button>` OCH EN MODAL, INTE EN SVÄVANDE PANEL. En egen panel måste
 * återuppfinna fokusfällan, Escape och klick-utanför, och gör det oftast fel.
 * `OpsModal` bär dem redan, och på en telefon är en panel som svävar över halva
 * skärmen ändå en modal med extra steg.
 *
 * ⛔ MÄRKET VISAR ETT ANTAL OCH INTE BARA EN PRICK. "Något har hänt" säger inte
 * om det är värt att öppna; tre säger det. Över nittionio står "99+", eftersom
 * bredden annars skjuter ut ikonen ur sin rad.
 *
 * ⛔ ANTALET STÅR I KNAPPENS NAMN. En prick är dekor och läses inte upp, så utan
 * namnet vet den som lyssnar inte att det finns något nytt alls.
 *
 * @param {object} props
 * @param {import("../lib/aktivitet.js").Handelse[]} props.entries Nyast först.
 * @param {(slag: string) => string} [props.kindLabel]
 * @param {string} [props.title] Modalens rubrik.
 * @param {string} [props.label] Knappens namn för skärmläsare, utan antalet.
 * @param {string} [props.storageKey] Var "senast sedd" minns sig, per webbläsare.
 *   ⛔ Utan den räknas allt som oläst varje gång: det är ärligt, men märket blir
 *   en lampa som alltid lyser.
 * @param {import("react").ReactNode} [props.icon] Appens bild. Utan den ritas en klocka.
 * @param {import("react").ReactNode} [props.empty]
 * @param {Date | number} [props.now] Bara för prov.
 */
export function OpsActivityButton({ entries, kindLabel, title = "Aktivitet", label = "Aktivitet", storageKey, icon, empty, now }) {
  const rader = entries || [];
  const [sedd, setSedd] = useState(() => lastSedd(storageKey));
  const [open, setOpen] = useState(false);

  const olasta = unreadCount(rader, sedd);

  /** @param {boolean} nytt */
  function oppna(nytt) {
    setOpen(nytt);
    // ⛔ MARKERAS SOM SETT NÄR DEN ÖPPNAS, inte när den stängs. Den som öppnar
    // och läser en rad har sett den, även om fliken sedan dör. Vid stängning
    // hade ett tappat fönster gett samma märke igen nästa dag.
    if (nytt && rader.length > 0) {
      const senaste = rader[0].nar;
      sparaSedd(storageKey, senaste);
      setSedd(senaste);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => oppna(true)}
        aria-label={olasta > 0 ? `${label}, ${olasta} nya` : label}
        className={cx(
          "relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-secondary",
          "transition-colors duration-(--duration-fast) ease-standard hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        {icon ?? <KlockIkon />}
        {olasta > 0 ? (
          <span
            aria-hidden="true"
            className={cx(
              "absolute top-1 right-1 min-w-4 rounded-full bg-accent px-1",
              "text-center text-xs font-semibold tabular-nums text-on-accent",
            )}
          >
            {olasta > 99 ? "99+" : olasta}
          </span>
        ) : null}
      </button>

      <OpsModal open={open} onOpenChange={oppna} title={title}>
        <OpsActivityList entries={rader} kindLabel={kindLabel} empty={empty} now={now} />
      </OpsModal>
    </>
  );
}

/** Klockan, som svg och inte som beroende. En ikon till att ladda är en för mycket. */
function KlockIkon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </svg>
  );
}
