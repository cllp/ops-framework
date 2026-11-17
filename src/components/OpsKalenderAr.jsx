import { useMemo } from "react";

import { dateKey, monthGrid, monthNames, todayKey, weekdayNames } from "../lib/calendar.js";
import { MAX_ARSBAND, arsband } from "../lib/arsband.js";
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
 * ⛔ BANDETS PLATS BÄR BETYDELSEN, inte bara färgen: kalendrarna står alltid i listans ordning, och förklaringen överst säger vilken rad som är vilken
 * kalender. ⛔ HÖGST TRE BAND PER DAG (`MAX_ARSBAND`), resten som "+N", och dagens knappnamn räknar upp alla med namn.
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
 * @param {(ar: number) => void} props.onAr
 * @param {(dag: string) => void} props.onValjDag
 * @param {(ar: number, month: number) => void} props.onValjManad
 * @param {() => void} props.onStang
 */
export function OpsKalenderAr({ ar, poster, kalendrar, forvaldId, arSynlig, onVaxla, locale = "sv-SE", today, onAr, onValjDag, onValjManad, onStang }) {
  const sprak = String(locale).toLowerCase().startsWith("en") ? "en" : "sv";
  const o = forvalda(ORD_ARSVY, sprak);
  const band = useMemo(() => arsband(poster, { kalendrar, forvaldId }), [poster, kalendrar, forvaldId]);
  const namn = monthNames(locale);
  const veckodagar = weekdayNames(locale);
  const idag = todayKey(today);
  return (
    <div data-ops-arsvy="" className="flex h-full flex-col bg-canvas text-ink">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <button type="button" aria-label={o.foregaende} onClick={() => onAr(ar - 1)} className="inline-flex size-9 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2">
          <ChevronVansterIkon size={18} />
        </button>
        <h2 className="m-0 text-rubrik">{o.rubrik.replace("{ar}", String(ar))}</h2>
        <button type="button" aria-label={o.nasta} onClick={() => onAr(ar + 1)} className="inline-flex size-9 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2">
          <ChevronHogerIkon size={18} />
        </button>
        <ul aria-label="Kalendrar" className="order-last m-0 flex w-full list-none flex-wrap gap-1.5 p-0 md:order-none md:ml-auto md:w-auto">
          {kalendrar.map((k) => {
            const pa = arSynlig(k.id);
            const ton = /** @type {1|2|3|4|5|6} */ (Number(k.farg) >= 1 && Number(k.farg) <= 6 ? Number(k.farg) : 1);
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
          {Array.from({ length: 12 }, (_, month) => (
            <section key={month} aria-label={`${namn[month]} ${ar}`} data-arsvy-manad={`${ar}-${String(month + 1).padStart(2, "0")}`}>
              <button type="button" aria-label={o.oppnaManad.replace("{manad}", `${namn[month]} ${ar}`)} onClick={() => onValjManad(ar, month)} className="mb-1 text-etikett font-medium capitalize text-ink hover:text-accent">
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
                  const ritas = alla.slice(0, MAX_ARSBAND);
                  const efter = alla.length - ritas.length;
                  const etikett = `${dag} ${namn[month]}${alla.length ? `: ${alla.map((k) => k.namn).join(", ")}` : `, ${o.inget}`}`;
                  return (
                    <button key={nyckel} type="button" aria-label={etikett} data-arsvy-dag={nyckel} onClick={() => onValjDag(nyckel)} className={cx("flex min-h-8 flex-col items-stretch gap-px rounded px-px pt-0.5 text-center hover:bg-surface-2", nyckel === idag && "ring-1 ring-accent")}>
                      <span className="text-hjalp leading-none text-ink-secondary">{dag}</span>
                      {ritas.map((k) => (
                        <span key={k.id} aria-hidden="true" className={cx("h-1 rounded-full", BAND[k.ton])} />
                      ))}
                      {efter > 0 ? <span aria-hidden="true" className="text-hjalp leading-none text-ink-muted">{o.fler.replace("{n}", String(efter))}</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
