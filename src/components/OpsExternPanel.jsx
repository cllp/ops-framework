import * as Dialog from "@radix-ui/react-dialog";
import { OpsHandelsePanel } from "./OpsHandelsePanel.jsx";

/**
 * Läspanelen för en extern händelse (0.134.0, cllp/lifehub.app#402): en post från Apple eller Google, utan eget `handelseId`, öppnad ur kalendern.
 *
 * ══ ⛔ SAMMA PANEL, BARA FÖR LÄSNING ═════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-21: "Varje händelse går att öppna. Händelser från Apple och Google öppnas i samma panel, bara för läsning, med titel, tid, plats,
 * beskrivning och 'Från Apple, ändras i Apple'." Panelen ÄR `OpsHandelsePanel`, med de fält posten bär (`extern`), och med EXAKT det en
 * läspanel har: Tillbaka, titeln, tid, plats, beskrivning, källraden och Kopiera till…. Den får aldrig `onRedigera`, `atgarder`, `flyttmal`, `onDela`
 * eller `svar`: det som en extern händelse inte kan göra här finns inte som knapp. Det är ingen avstängd knapp med en förklaring utan en knapp som inte
 * finns, eftersom ingenting i panelen går att göra åt den.
 *
 * ⛔ EN DIALOG OVANPÅ KALENDERN OCH INTE EN SIDA I SKALET. Skalets händelsepanel är en egen adress (`?handelse=<id>`) som appen löser upp ur sin data,
 * och en extern händelse har ingen sådan: dess id räknas fram och sparas ingenstans. Kalendern håller sig därför monterad under panelen, med sitt urval,
 * sin månad och sitt filter, och Tillbaka (eller Escape) lämnar den som den var. Fokus går till panelen (som i skalet), inte till dialogens första knapp.
 *
 * @param {object} props
 * @param {import("../lib/calendar.js").CalendarEntry | null} props.post Posten som öppnas, med `extern`. `null`: stängd.
 * @param {() => void} props.onStang
 * @param {string} props.sprak "sv" eller "en".
 * @param {ReadonlyArray<{ id: string, namn: string, farg?: 1|2|3|4|5|6 }>} [props.kopieraTill]
 * @param {(arg: { handelse: import("./OpsHandelsePanel.jsx").HandelseVy, malKalenderId: string }) => void | Promise<void>} [props.onKopiera]
 */
export function OpsExternPanel({ post, onStang, sprak, kopieraTill, onKopiera }) {
  const handelse = post ? externTillHandelse(post) : null;
  return (
    <Dialog.Root open={post !== null} onOpenChange={(o) => (o ? undefined : onStang())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-scrim" />
        <Dialog.Content
          data-externpanel=""
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-(--z-modal) overflow-y-auto bg-canvas outline-none md:inset-y-6 md:left-1/2 md:w-[min(48rem,calc(100vw-3rem))] md:-translate-x-1/2 md:rounded-base md:border md:border-line"
        >
          <Dialog.Title className="sr-only">{handelse ? handelse.titel : ""}</Dialog.Title>
          {handelse && post ? (
            <OpsHandelsePanel
              handelse={handelse}
              onTillbaka={onStang}
              sprak={sprak}
              // ⛔ BARA DET EN LÄSPANEL HAR. Se filhuvudet: ingen redigering, ingen flytt, ingen delning.
              kopieraTill={kopieraTill}
              onKopiera={onKopiera}
              kopierad={post.extern ? post.extern.kopierad : undefined}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Posten som en `HandelseVy`: titel, dag och spann ur posten, och resten ur `extern`. Id:t är postens, alltså det appen räknat fram.
 * @param {import("../lib/calendar.js").CalendarEntry} post
 * @returns {import("./OpsHandelsePanel.jsx").HandelseVy}
 */
export function externTillHandelse(post) {
  const e = /** @type {NonNullable<import("../lib/calendar.js").CalendarEntry["extern"]>} */ (post.extern);
  return {
    id: post.id,
    titel: post.title,
    datum: post.date,
    ...(typeof post.endDate === "string" && post.endDate > post.date ? { slutDatum: post.endDate } : {}),
    ...(post.allDay === true ? { heldag: true } : {}),
    ...(e.tid ? { tid: e.tid } : {}),
    ...(e.slutTid ? { slutTid: e.slutTid } : {}),
    ...(post.kalender ? { kalender: { namn: post.kalender.namn, farg: post.kalender.farg } } : {}),
    ...(e.plats ? { plats: e.plats } : {}),
    ...(e.beskrivning ? { beskrivning: e.beskrivning } : {}),
    kalla: e.kalla,
  };
}
