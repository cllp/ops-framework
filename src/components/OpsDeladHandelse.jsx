import { useId, useState } from "react";
import { cx } from "../lib/cx.js";
import { DELNINGSFEL, DELNINGSORSAKER } from "../lib/delning.js";
import { deladTid, lasSparatSprak, sparaSprak, valdSprak } from "../lib/deladdatum.js";
import { sizeText } from "../lib/file.js";
import { definierade, forvalda } from "../lib/ord.js";
import { PUBLIK_KLASS, PUBLIK_KNAPP, PUBLIK_TONER } from "../lib/publikKlass.js";
import { SPRAK } from "../lib/sprak.js";
import { DeladKod } from "./DeladKod.jsx";
import { DatumIkon, FilIkon, KlockaIkon, PlatsIkon } from "./icons.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";

/**
 * Orden på den publika händelsesidan, på svenska och engelska (0.125.0, cllp/lifehub.app#377). Svenskan i feltexterna är `DELNINGSFEL` och ingen kopia av den (regel 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSDELADHANDELSE = {
  sprakEtikett: { sv: "Språk", en: "Language" },
  laddar: { sv: "Hämtar händelsen", en: "Loading the event" },
  tidEtikett: { sv: "När och var", en: "When and where" },
  till: { sv: "till", en: "to" },
  platsEtikett: { sv: "Plats", en: "Location" },
  filerRubrik: { sv: "Filer", en: "Files" },
  ingaFiler: { sv: "Inga filer har lagts till.", en: "No files have been added." },
  ejVisade: { sv: "{n} filer till finns men visas inte här.", en: "{n} more files exist but are not shown here." },
  oppna: { sv: "Öppna", en: "Open" },
  oppnaFil: { sv: "Öppna {namn}", en: "Open {namn}" },
  typ_ljud: { sv: "Ljud", en: "Audio" },
  typ_bild: { sv: "Bild", en: "Image" },
  typ_video: { sv: "Video", en: "Video" },
  typ_pdf: { sv: "PDF", en: "PDF" },
  typ_dokument: { sv: "Dokument", en: "Document" },
  orsak_utgangen: { sv: DELNINGSFEL.utgangen, en: "The link has expired" },
  orsak_stangd: { sv: DELNINGSFEL.stangd, en: "The link is closed" },
  orsak_saknas: { sv: DELNINGSFEL.saknas, en: "The file no longer exists" },
  "orsak_handelse-saknas": { sv: DELNINGSFEL["handelse-saknas"], en: "The event no longer exists" },
  "orsak_kod-kravs": { sv: DELNINGSFEL["kod-kravs"], en: "This link needs a code" },
  "orsak_fel-kod": { sv: DELNINGSFEL["fel-kod"], en: "The code was not right" },
  "orsak_for-manga": { sv: DELNINGSFEL["for-manga"], en: "Too many attempts. Wait a while and try again" },
};

/** Orsakerna där sidan ber om en kod. */
const KODORSAKER = /** @type {readonly string[]} */ (["kod-kravs", "fel-kod", "for-manga"]);

/**
 * Den publika sidan för en delad händelse: det en mottagare ser på `/g/<grupp>/event/<händelse>`, utan inloggning (0.125.0, cllp/lifehub.app#377).
 *
 * ══ ⛔ VYN RITAR VAD SERVERN SVARAR OCH INGET MER ═══════════════════════════════════════════════════════════════════════
 *
 * `delning` är `hamta().delning` ur `createDelningService` för en händelse: titel, beskrivning, plats, datum och tid, och filerna med en adress
 * som går ut. Vyn läser aldrig en grupp, en medlem, ett svar eller en kommentar, för de finns inte i svaret. Och den har ingen egen regel för vem som får se vad:
 * en länk som inte går att visa är ett `orsak`, och texten kommer ur ordboken (`DELNINGSFEL` på svenska).
 *
 * ⛔ ETT AV TRE LÄGEN, OCH ETT FEL KASTAS. `delning`, `orsak` eller `laddar`, som `OpsDelad`. Ingen av dem, eller flera, är ett fel i anropet.
 *
 * ══ ⛔ NÄR, VAR OCH VAD HÖGST UPP (CP 2026-10-19) ═════════════════════════════════════════════════════════════════════
 *
 * CP: "Det skall vara tydligt på händelsen, vilka datum det gäller." Titeln, och direkt under den datumet stort: veckodag, datum och år
 * (`lör 26 dec 2026`), över flera dagar från och till och antalet dagar (`lör 26 dec 2026 till sön 10 jan 2027, 16 dagar`), en heldag som
 * "Heldag" och ett klockslag med klockslaget. Platsen står på en egen rad med en ikon. Därefter beskrivningen (radbrytningarna bevaras, ingen HTML tolkas)
 * och filerna. Texten hämtas vid varje besök, så en ändring i händelsen syns direkt.
 *
 * ══ ⛔ SPRÅKET ÄR BESÖKARENS (CP 2026-10-19: "Man skall kunna byta språk i headern") ══════════════════════════════════════
 *
 * Sidan har ett eget huvud med en språkväljare, SV och EN. Förvalet är webbläsarens språk (svenska om det börjar på `sv`, annars engelska), valet sparas i
 * webbläsarens minne (`DELAD_SPRAKNYCKEL`, med `try/catch`: privat läge eller blockerad lagring ska inte stoppa sidan), och datumen och allt ramverkets
 * eget på sidan följer valet. Händelsens titel och beskrivning översätts inte. Ger appen `sprak` är språket appens och väljaren anropar `onSprak`.
 *
 * ⛔ BARA RAMVERKETS TEMA OCH DE PUBLIKA ROLLERNA (`PUBLIK_KLASS`, `PUBLIK_TONER`), inga egna färger eller mått. Skalet runt (loggan) är appens och kommer som `huvud`.
 *
 * @param {object} props
 * @param {{ titel: string, beskrivning?: string | null, plats?: string | null, datum: string, slutDatum?: string | null, tid?: string | null, slutTid?: string | null, heldag?: boolean, filer?: ReadonlyArray<{ rubrik: string, typ: string, mime?: string, storlek?: number | null, url: string }>, ejVisade?: number } | null} [props.delning] Länken går att visa.
 * @param {string} [props.orsak] Länken går inte att visa: en av `DELNINGSORSAKER`. En okänd orsak får texten för `utgangen`. `kod-kravs`, `fel-kod` och `for-manga` ritar kodrutan när `onKod` finns.
 * @param {boolean} [props.laddar] Länken hämtas.
 * @param {(kod: string) => void | Promise<void>} [props.onKod] Koden som personen skrev. Appen frågar servern med den och ger sidan ett nytt svar.
 * @param {import("react").ReactNode} [props.huvud] Appens logga eller namn, till vänster i huvudet.
 * @param {string} [props.sprak] Språket om appen styr det (`sv` eller `en`). Utelämnat: sidan väljer själv och minns valet.
 * @param {(sprak: string) => void} [props.onSprak] Anropas när besökaren väljer språk.
 * @param {Partial<Record<keyof typeof ORD_OPSDELADHANDELSE, string>>} [props.ord] Egna texter, som vinner över ordboken.
 */
export function OpsDeladHandelse({ delning = null, orsak, laddar = false, onKod, huvud, sprak, onSprak, ord }) {
  const lagen = [Boolean(delning), orsak !== undefined, laddar].filter(Boolean).length;
  if (lagen !== 1) {
    throw new Error("OpsDeladHandelse: ge precis en av delning, orsak och laddar. Ingen av dem är en tom yta, flera är två sanningar om samma länk.");
  }
  if (onKod !== undefined && typeof onKod !== "function") throw new Error("OpsDeladHandelse: onKod ska vara en funktion.");
  if (onSprak !== undefined && typeof onSprak !== "function") throw new Error("OpsDeladHandelse: onSprak ska vara en funktion.");
  if (sprak !== undefined && !(/** @type {readonly string[]} */ (SPRAK).includes(sprak))) {
    throw new Error(`OpsDeladHandelse: språket ${JSON.stringify(sprak)} finns inte (giltiga: ${SPRAK.join(", ")}).`);
  }

  const [valt, setValt] = useState(() =>
    valdSprak({ sparat: lasSparatSprak(), webblasare: typeof navigator === "undefined" ? undefined : navigator.language }),
  );
  const aktivt = sprak ?? valt;
  const t = { ...forvalda(ORD_OPSDELADHANDELSE, aktivt), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };

  /** @param {string} s */
  function valj(s) {
    if (sprak === undefined) setValt(/** @type {"sv" | "en"} */ (s));
    sparaSprak(s);
    if (onSprak) onSprak(s);
  }

  const kandOrsak = orsak !== undefined && /** @type {readonly string[]} */ (DELNINGSORSAKER).includes(orsak) ? orsak : "utgangen";
  return (
    <div lang={aktivt} data-deladhandelse="" data-sprak={aktivt} className={cx("flex min-h-dvh w-full flex-col", PUBLIK_TONER.ljus.band, PUBLIK_TONER.ljus.rubrik)}>
      <header className="sticky top-0 z-10 border-b border-publik-ljus-text/10 bg-publik-ljus">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <div data-dh-huvud="" className="flex min-w-0 items-center">{huvud}</div>
          <Sprakval aktivt={aktivt} etikett={t.sprakEtikett} onVal={valj} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-16 sm:pt-12">
        {laddar ? (
          <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />
        ) : orsak !== undefined ? (
          KODORSAKER.includes(kandOrsak) && onKod ? (
            <DeladKod orsak={kandOrsak} onKod={onKod} sprak={aktivt} publik />
          ) : (
            <div data-delad="fel" data-delad-orsak={kandOrsak}>
              <OpsEmpty title={t[`orsak_${kandOrsak}`]} />
            </div>
          )
        ) : (
          <Handelse delning={/** @type {NonNullable<typeof delning>} */ (delning)} t={t} sprak={aktivt} />
        )}
      </main>
    </div>
  );
}

/**
 * Språkväljaren i huvudet: SV och EN, en knapp var, den valda markerad (`aria-pressed`).
 * @param {{ aktivt: string, etikett: string, onVal: (s: string) => void }} props
 */
function Sprakval({ aktivt, etikett, onVal }) {
  return (
    <div role="group" aria-label={etikett} data-dh-sprak="" className="flex shrink-0 items-center gap-1 text-meta font-medium">
      {SPRAK.map((s) => (
        <button
          key={s}
          type="button"
          lang={s}
          aria-pressed={s === aktivt}
          onClick={() => onVal(s)}
          className={cx(
            "min-h-9 min-w-10 cursor-pointer rounded-full px-3 py-1 transition-colors duration-(--duration-fast) ease-standard",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            s === aktivt ? "bg-publik-ljus-text/10 text-publik-ljus-text" : "text-publik-ljus-text/65 hover:text-publik-ljus-text",
          )}
        >
          {s.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/**
 * @param {{ delning: NonNullable<Parameters<typeof OpsDeladHandelse>[0]["delning"]>, t: Record<string, string>, sprak: string }} props
 */
function Handelse({ delning, t, sprak }) {
  const tid = deladTid(delning, sprak);
  const filer = delning.filer ?? [];
  const filerId = useId();
  const ejVisade = Number.isInteger(delning.ejVisade) ? /** @type {number} */ (delning.ejVisade) : 0;
  return (
    <article data-dh-handelse="" className="flex min-w-0 flex-col gap-8">
      <header className="flex min-w-0 flex-col gap-5">
        <h1 data-dh-titel="" className={cx(PUBLIK_KLASS.sida, "wrap-anywhere")}>{delning.titel}</h1>
        <section aria-label={t.tidEtikett} data-dh-tid="" className="flex min-w-0 flex-col gap-3">
          <p data-dh-datum="" className="m-0 flex items-start gap-3 font-display-publik text-publik-block text-publik-ljus-text">
            <span aria-hidden="true" className="mt-1 flex shrink-0 items-center"><DatumIkon size={28} /></span>
            <span className="min-w-0">
              {tid.start}
              {tid.slut ? (
                <>
                  {" "}
                  <span className="text-publik-ljus-dampad">{t.till}</span>
                  {" "}
                  {tid.slut}
                </>
              ) : null}
              {tid.dagar ? <span className="text-publik-ljus-dampad">{`, ${tid.dagar}`}</span> : null}
            </span>
          </p>
          {tid.tid ? (
            <p data-dh-klockslag="" className="m-0 flex items-center gap-3 text-publik-ingress text-publik-ljus-text">
              <span aria-hidden="true" className="flex shrink-0 items-center"><KlockaIkon size={24} /></span>
              <span className="min-w-0">{tid.tid}</span>
            </p>
          ) : null}
          {delning.plats ? (
            <p data-dh-plats="" className="m-0 flex items-start gap-3 text-publik-ingress text-publik-ljus-text">
              <span aria-hidden="true" className="mt-1 flex shrink-0 items-center"><PlatsIkon size={24} /></span>
              <span className="sr-only">{t.platsEtikett}: </span>
              <span className="min-w-0 wrap-anywhere">{delning.plats}</span>
            </p>
          ) : null}
        </section>
      </header>

      {delning.beskrivning ? (
        <p data-dh-beskrivning="" className={cx(PUBLIK_KLASS.brod, "max-w-las whitespace-pre-line wrap-anywhere")}>{delning.beskrivning}</p>
      ) : null}

      <section aria-labelledby={filerId} data-dh-filer="" className="flex min-w-0 flex-col gap-3">
        <h2 id={filerId} className={PUBLIK_KLASS.eyebrow}>{t.filerRubrik}</h2>
        {filer.length === 0 ? (
          <p data-dh-inga-filer="" className={PUBLIK_KLASS.brod}>{t.ingaFiler}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {filer.map((f) => {
              const typ = t[`typ_${f.typ}`] ?? t.typ_dokument;
              const meta = [typ, f.storlek ? sizeText(f.storlek) : ""].filter(Boolean).join(" · ");
              return (
                <li key={`${f.url}`} data-dh-fil="" className={cx("flex min-w-0 flex-wrap items-center gap-3 rounded-base p-3", PUBLIK_TONER.ljus.panel)}>
                  <span aria-hidden="true" className="flex shrink-0 items-center"><FilIkon size={24} /></span>
                  <span className="flex min-w-0 flex-1 basis-40 flex-col">
                    <span data-dh-filnamn="" className="text-publik-brod text-publik-ljus-text wrap-anywhere">{f.rubrik}</span>
                    <span className="text-meta text-publik-ljus-dampad">{meta}</span>
                  </span>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.oppnaFil.replace("{namn}", f.rubrik)}
                    className={cx(PUBLIK_KNAPP.bas, "border-2 px-4 py-1.5", PUBLIK_TONER.ljus.kantknapp)}
                  >
                    {t.oppna}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        {ejVisade > 0 ? <p data-dh-ejvisade="" className="m-0 text-meta text-publik-ljus-dampad">{t.ejVisade.replace("{n}", String(ejVisade))}</p> : null}
      </section>
    </article>
  );
}

