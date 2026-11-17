import { useEffect, useMemo, useRef } from "react";

import { dateKey, monthGrid, monthNames, todayKey, weekdayNames } from "../lib/calendar.js";
import { MAX_ARSBAND, UTAN_KALENDER, arsband } from "../lib/arsband.js";
import { lagerFarg } from "../lib/kalenderlager.js";
import { ORD_HELSKARM } from "../lib/helskarmord.js";
import { forvalda } from "../lib/ord.js";
import { cx } from "../lib/cx.js";
import { ChevronHogerIkon, ChevronVansterIkon, KryssIkon } from "./icons.jsx";

/**
 * Årsvyn (cllp/lifehub.app#874): tolv minimånader med ett färgband per kalender för heldags- och flerdagsposter.
 *
 * CP 2026-11-17: ett helt år med flera kalendrar (barnveckor, lov, uthyrning, resor, jobb) på en skärm, utfällt i helskärm som en karta eller en PDF.
 * Komponenten ritar bara innehållet. Helskärmen (`useHelskarm`) och knappen bor i `OpsCalendar`, eftersom webbläsaren bara släpper in helskärm i trycket.
 *
 * ⛔ BANDETS PLATS BÄR BETYDELSEN, inte bara färgen: syns högst tre kalendrar (`MAX_ARSBAND`) har var och en en fast rad i varje dag, i listans ordning,
 * också de dagar den saknar band. Syns fler packas banden i listans ordning och resten står som "+N". Dagens knappnamn räknar alltid upp alla med namn.
 * ⛔ BARA INLÄSTA MÅNADER (`inlasta`). Kalendern har poster för sitt fönster och inte för hela året. En månad utanför står som "Inte inläst", och
 * året bläddrar bara till år som har någon inläst månad: annars hade "inget hela dagar" stått på dagar som bara inte var hämtade (granskningen av 0.237.0).
 * ⛔ ETT LAGER ÄR EN DIALOG. Fokus flyttas in när det öppnas och stannar där (Tab går runt), och `OpsCalendar` lägger tillbaka det på knappen när det stängs.
 * ⛔ INGA NYA VAL. Förklaringens växlar är kalenderlistans egna (`vaxla`), sparade på samma ställe som i månadsvyn.
 */

/** Orden i årsvyn. */
export const ORD_ARSVY = {
  rubrik: { sv: "Året {ar}", en: "The year {ar}" },
  foregaende: { sv: "Föregående år", en: "Previous year" },
  nasta: { sv: "Nästa år", en: "Next year" },
  oppnaManad: { sv: "Öppna {manad}", en: "Open {manad}" },
  inget: { sv: "inget hela dagar", en: "nothing all day" },
  fler: { sv: "+{n}", en: "+{n}" },
  visa: { sv: "Visa {namn}", en: "Show {namn}" },
  kalendrar: { sv: "Kalendrar", en: "Calendars" },
  utan: { sv: "Utan kalender", en: "No calendar" },
  inteInlast: { sv: "Inte inläst", en: "Not loaded" },
  stang: ORD_HELSKARM.avsluta,
};

const BAND = { 1: "bg-identity-1", 2: "bg-identity-2", 3: "bg-identity-3", 4: "bg-identity-4", 5: "bg-identity-5", 6: "bg-identity-6" };

/**
 * @param {object} props
 * @param {number} props.ar
 * @param {readonly import("../lib/calendar.js").CalendarEntry[]} props.poster De synliga posterna.
 * @param {ReadonlyArray<{ id: string, namn?: string, farg?: unknown }>} props.kalendrar Alla rader i listans ordning, också dolda.
 * @param {string} props.forvaldId
 * @param {(id: string) => boolean} props.arSynlig
 * @param {(id: string) => void} [props.onVaxla]
 * @param {string} [props.locale]
 * @param {Date} [props.today]
 * @param {ReadonlySet<string>} [props.inlasta] Månaderna (`YYYY-MM`) kalendern har poster för. Utan den räknas alla som inlästa.
 * @param {(ar: number) => void} props.onAr
 * @param {(dag: string) => void} props.onValjDag
 * @param {(ar: number, month: number) => void} props.onValjManad
 * @param {() => void} props.onStang
 */
export function OpsKalenderAr({ ar, poster, kalendrar, forvaldId, arSynlig, onVaxla, locale = "sv-SE", today, inlasta, onAr, onValjDag, onValjManad, onStang }) {
  const sprak = String(locale).toLowerCase().startsWith("en") ? "en" : "sv";
  const o = forvalda(ORD_ARSVY, sprak);
  const band = useMemo(() => arsband(poster, { kalendrar, forvaldId }), [poster, kalendrar, forvaldId]);
  const namn = monthNames(locale);
  const veckodagar = weekdayNames(locale);
  const idag = todayKey(today);
  const inlast = (/** @type {number} */ a, /** @type {number} */ m) => !inlasta || inlasta.has(`${a}-${String(m + 1).padStart(2, "0")}`);
  const harAr = (/** @type {number} */ a) => Array.from({ length: 12 }, (_, m) => inlast(a, m)).some(Boolean);
  // Fasta rader när högst tre kalendrar syns: platsen bär betydelsen. Fler än så: packat i listans ordning.
  const synligaId = kalendrar.filter((k) => arSynlig(k.id)).map((k) => k.id);
  const fastaRader = synligaId.length > 0 && synligaId.length <= MAX_ARSBAND ? synligaId : null;
  const namnPa = (/** @type {{ id: string, namn: string }} */ k) => (k.id === UTAN_KALENDER ? o.utan : k.namn);

  const ram = useRef(/** @type {HTMLDivElement | null} */ (null));
  useEffect(() => {
    ram.current?.focus();
  }, []);
  /** @param {import("react").KeyboardEvent<HTMLDivElement>} e */
  const fangaTab = (e) => {
    if (e.key !== "Tab" || !ram.current) return;
    const alla = /** @type {HTMLElement[]} */ ([...ram.current.querySelectorAll("button:not([disabled])")]);
    if (alla.length === 0) return;
    const forsta = alla[0];
    const sista = alla[alla.length - 1];
    const nu = document.activeElement;
    if (e.shiftKey && (nu === forsta || nu === ram.current)) {
      e.preventDefault();
      sista.focus();
    } else if (!e.shiftKey && nu === sista) {
      e.preventDefault();
      forsta.focus();
    }
  };
  const rubrik = o.rubrik.replace("{ar}", String(ar));
  return (
    <div ref={ram} role="dialog" aria-modal="true" aria-label={rubrik} tabIndex={-1} onKeyDown={fangaTab} data-ops-arsvy="" className="flex h-full flex-col bg-canvas text-ink outline-none">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <button type="button" aria-label={o.foregaende} disabled={!harAr(ar - 1)} onClick={() => onAr(ar - 1)} className="inline-flex size-9 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent">
          <ChevronVansterIkon size={18} />
        </button>
        <h2 className="m-0 text-rubrik">{rubrik}</h2>
        <button type="button" aria-label={o.nasta} disabled={!harAr(ar + 1)} onClick={() => onAr(ar + 1)} className="inline-flex size-9 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent">
          <ChevronHogerIkon size={18} />
        </button>
        <ul aria-label={o.kalendrar} className="order-last m-0 flex w-full list-none flex-wrap gap-1.5 p-0 md:order-none md:ml-auto md:w-auto">
          {kalendrar.map((k) => {
            const pa = arSynlig(k.id);
            const ton = lagerFarg(/** @type {any} */ (k));
            const etikett = typeof k.namn === "string" ? k.namn : k.id;
            return (
              <li key={k.id}>
                <button
                  type="button"
                  aria-pressed={pa}
                  aria-label={o.visa.replace("{namn}", etikett)}
                  disabled={!onVaxla}
                  onClick={() => onVaxla?.(k.id)}
                  className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-meta", pa ? "border-line text-ink" : "border-transparent text-ink-muted line-through")}
                >
                  <span aria-hidden="true" className={cx("h-1.5 w-4 rounded-full", BAND[ton], pa ? "" : "opacity-40")} />
                  {etikett}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" aria-label={o.stang} title={o.stang} onClick={onStang} className="ml-auto inline-flex size-9 md:ml-0 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2">
          <KryssIkon size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 p-4 landscape:grid-cols-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, month) => {
            const manadsnamn = `${namn[month]} ${ar}`;
            if (!inlast(ar, month)) {
              return (
                <section key={month} aria-label={`${manadsnamn}, ${o.inteInlast}`} data-arsvy-manad={`${ar}-${String(month + 1).padStart(2, "0")}`} data-arsvy-ej-inlast="" className="opacity-50">
                  <p className="m-0 mb-1 text-etikett font-medium capitalize text-ink-secondary">{namn[month]}</p>
                  <p className="m-0 text-hjalp text-ink-muted">{o.inteInlast}</p>
                </section>
              );
            }
            return (
              <section key={month} aria-label={manadsnamn} data-arsvy-manad={`${ar}-${String(month + 1).padStart(2, "0")}`}>
                <button type="button" aria-label={o.oppnaManad.replace("{manad}", manadsnamn)} onClick={() => onValjManad(ar, month)} className="mb-1 text-etikett font-medium capitalize text-ink hover:text-accent">
                  {namn[month]}
                </button>
                <div aria-hidden="true" className="grid grid-cols-7 text-center text-hjalp text-ink-muted">
                  {veckodagar.map((d) => (
                    <span key={d}>{d.slice(0, 1)}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {monthGrid(ar, month).flat().map((dag, i) => {
                    if (dag === null) return <span key={`t${i}`} />;
                    const nyckel = dateKey(ar, month, dag);
                    const alla = band.get(nyckel) ?? [];
                    /** @type {Array<{ id: string, ton: 1|2|3|4|5|6 } | null>} */
                    const rader = fastaRader ? fastaRader.map((id) => alla.find((k) => k.id === id) ?? null) : alla.slice(0, MAX_ARSBAND);
                    const efter = alla.length - rader.filter(Boolean).length;
                    const etikett = `${dag} ${namn[month]}${alla.length ? `: ${alla.map(namnPa).join(", ")}` : `, ${o.inget}`}`;
                    return (
                      <button key={nyckel} type="button" aria-label={etikett} data-arsvy-dag={nyckel} onClick={() => onValjDag(nyckel)} className={cx("flex min-h-8 flex-col items-stretch gap-px rounded px-px pt-0.5 text-center hover:bg-surface-2", nyckel === idag && "ring-1 ring-accent")}>
                        <span className="text-hjalp leading-none text-ink-secondary">{dag}</span>
                        {rader.map((k, r) => (
                          <span key={k ? k.id : `tom${r}`} aria-hidden="true" data-arsvy-band={k ? k.id : undefined} className={cx("h-1 rounded-full", k ? BAND[k.ton] : "")} />
                        ))}
                        {efter > 0 ? <span aria-hidden="true" data-arsvy-fler="" className="text-hjalp leading-none text-ink-muted">{o.fler.replace("{n}", String(efter))}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
