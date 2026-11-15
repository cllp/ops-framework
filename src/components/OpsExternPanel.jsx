import { PanelDialog } from "./PanelDialog.jsx";
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
 * @param {{ atgarder: ReadonlyArray<import("../lib/radkallor.js").Atgard>, dela: import("../lib/radkallor.js").Delning | null }} [props.knapprad] (0.145.0, cllp/ops-framework#446) Knappraden längst ned, när postens id har en källa i
 *   `radkallor` (ur `losKnapprad`): källans knappar ("Öppna i Apple") och Dela, på samma ställe som på varannan rad. Utelämnad ritas ingen rad och panelen är som förut. ⛔ Ändrar inte vad en läspanel KAN:
 *   Kopiera till… står kvar under informationsrutan, och Dela är ofta ett skäl (en post från Apple delas inte härifrån).
 */
export function OpsExternPanel({ post, onStang, sprak, kopieraTill, onKopiera, knapprad }) {
  const handelse = post ? externTillHandelse(post) : null;
  return (
    <PanelDialog oppen={post !== null} onStang={onStang} titel={handelse ? handelse.titel : ""} markor={{ "data-externpanel": "" }}>
      {handelse && post ? (
        <OpsHandelsePanel
          handelse={handelse}
          onTillbaka={onStang}
          sprak={sprak}
          // ⛔ BARA DET EN LÄSPANEL HAR. Se filhuvudet: ingen redigering, ingen flytt, ingen delning.
          kopieraTill={kopieraTill}
          onKopiera={onKopiera}
          kopierad={post.extern ? post.extern.kopierad : undefined}
          knapprad={knapprad}
        />
      ) : null}
    </PanelDialog>
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
