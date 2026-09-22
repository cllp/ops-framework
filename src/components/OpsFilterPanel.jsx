import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { BockIkon, ReglageIkon } from "./icons.jsx";
import { Raknare } from "./raknare.jsx";

/**
 * Filter i flera dimensioner, bakom EN knapp, plus sortering.
 *
 * ── ⛔ VARFÖR EN TILL OCH INTE `OpsFilterChip` ─────────────────────────
 *
 * `OpsFilterChip` filtrerar på EN sak. Ska en lista filtreras på slag, status
 * och tid finns två vägar: tre piller bredvid varandra, eller en knapp som
 * öppnar allt. Tre piller är mätbart fel här: verktygsraden på Idag har redan
 * ett segment i mitten, och vid 390 px finns inte plats för tre piller till
 * utan att raden bryts. En bruten verktygsrad flyttar dessutom listan nedåt på
 * varje besök, för kontroller man rör en gång i veckan.
 *
 * ⛔ DEN ERSÄTTER INTE `OpsFilterChip`. En lista med en enda filterdimension
 * ska fortsätta använda pillret: en panel för ett val är ett klick extra utan
 * att något blir tydligare.
 *
 * ── ⛔ KNAPPEN BYTER FORM MED VALET, OCH DET ÄR HELA POÄNGEN ───────────
 *
 * CP 2026-09-21, med två bilder ur SessionStudio: "Ingen text när inget filter
 * är valt, endast när det är valt."
 *
 *   inget valt  -> rund ikonknapp, ingen text
 *   ett valt    -> piller med ikon plus DEN VALDA ETIKETTEN
 *   flera valda -> samma piller plus en räknare i hörnet
 *
 * Skälet är att ett filter som ser likadant ut oavsett val låter en läsa en
 * beskuren lista i tron att den är komplett. Ordet i knappen är svaret på
 * "vad har jag filtrerat bort", och det ska synas utan att man öppnar något.
 *
 * ⛔ ORDET SITTER I KNAPPEN OCH INTE PÅ EN EGEN RAD UNDER. Idag hade en sådan
 * rad, och den flyttade hela listan nedåt så fort man filtrerade. Knappen bär
 * sitt eget tillstånd, precis som pillret gör.
 *
 * ── ⛔ SORTERING RÄKNAS ALDRIG SOM ETT FILTER ──────────────────────────
 *
 * Räknaren och ordet i knappen visar bara FILTER. En sorterad lista är
 * fortfarande komplett, och att låta en sortering tända filterknappen hade
 * sagt "något är dolt" när ingenting är dolt. Sorteringen ligger ändå i samma
 * panel, eftersom det är samma fråga ställd av samma person vid samma tillfälle.
 */

/**
 * @typedef {object} Filtergrupp
 * @property {string} id Nyckeln i `value`.
 * @property {string} label Rubriken i panelen, t.ex. "Status".
 * @property {string} [allaLabel] Texten för "inget valt" i gruppen. Standard "Alla".
 * @property {{ value: string, label: string, icon?: import("react").ReactNode }[]} options
 */

/**
 * @param {object} props
 * @param {Filtergrupp[]} props.grupper ⛔ Minst en. En panel utan grupper är en knapp som inte gör något.
 * @param {Record<string, string | null>} props.value Vad som är valt per grupp, `null` = alla.
 * @param {(value: Record<string, string | null>) => void} props.onChange Hela kartan, inte en delmängd.
 * @param {string} props.ariaLabel Vad knappen öppnar, t.ex. "Filter och sortering".
 * @param {{ label: string, value: string, options: { value: string, label: string }[], onChange: (v: string) => void }} [props.sortering]
 * @param {string} [props.rensaLabel]
 * @param {string} [props.flerLabel] Ordet efter antalet när mer än ett filter är satt, t.ex. "filter".
 */
export function OpsFilterPanel({
  grupper,
  value,
  onChange,
  ariaLabel,
  sortering,
  rensaLabel = "Rensa",
  flerLabel = "filter",
}) {
  const [oppen, setOppen] = useState(false);

  if (!Array.isArray(grupper) || grupper.length === 0) {
    throw new Error("OpsFilterPanel: grupper krävs. En panel utan grupper är en knapp som inte gör något.");
  }
  if (!ariaLabel) {
    throw new Error("OpsFilterPanel: ariaLabel krävs. En knapp med bara en ikon har inget namn för den som inte ser den.");
  }

  /** @type {Record<string, string | null>} */
  const val = value || {};

  /** @type {{ grupp: Filtergrupp, vald: { value: string, label: string } }[]} */
  const aktiva = [];
  for (const g of grupper) {
    const vald = g.options.find((o) => o.value === val[g.id]);
    if (vald) aktiva.push({ grupp: g, vald });
  }

  /*
   * ⛔ ETIKETTEN KOMMER UR DET VALDA ALTERNATIVET, inte ur gruppens rubrik.
   * "Väntar" säger vad som visas; "Status" säger bara vilken sorts filter som
   * är satt, alltså precis det man redan ser av att knappen är tänd.
   */
  const text = aktiva.length > 0 ? aktiva[0].vald.label : "";

  /** @param {string} id @param {string | null} nytt */
  const vlj = (id, nytt) => onChange({ ...val, [id]: nytt });

  const rensa = () => {
    // ⛔ Alla grupper nollställs, även de som inte var satta. Ett `onChange`
    // med en delmängd hade lämnat appens karta halvfylld, och nästa läsning
    // hade sett en nyckel som saknas som "aldrig konfigurerad".
    /** @type {Record<string, string | null>} */
    const tomt = {};
    for (const g of grupper) tomt[g.id] = null;
    onChange(tomt);
  };

  return (
    <Popover.Root open={oppen} onOpenChange={setOppen}>
      <Popover.Trigger
        aria-label={aktiva.length > 0 ? `${ariaLabel}: ${text}` : ariaLabel}
        aria-pressed={aktiva.length > 0}
        className={cx(
          "relative inline-flex cursor-pointer items-center justify-center gap-2 transition-colors duration-(--duration-fast) ease-standard",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          // ⛔ SAMMA HÖJD I BÅDA LÄGENA (min-h-11, alltså 44 px träffyta). Byter
          // knappen höjd när man filtrerar hoppar raden under, och det är
          // exakt det felet som mättes bort ur bubblan i #242.
          "min-h-11",
          aktiva.length > 0
            ? "rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink"
            : "min-w-11 rounded-xl text-ink-secondary hover:bg-accent-faint hover:text-ink",
        )}
      >
        <ReglageIkon size={20} />
        {aktiva.length > 0 ? <span className="max-w-40 truncate">{text}</span> : null}
        {/* ⛔ Räknaren visas BARA när ordet inte räcker, alltså från två filter
            och uppåt. Vid ett filter står hela sanningen redan i knappen, och en
            etta i ett hörn hade varit dekor. */}
        {aktiva.length > 1 ? <Raknare antal={aktiva.length} text={flerLabel} /> : null}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-(--z-dropdown) max-h-[70vh] w-72 overflow-y-auto rounded-md border border-line bg-raised p-2 shadow-md"
        >
          <div className="flex flex-col gap-3">
            {grupper.map((g) => (
              <div key={g.id} className="flex flex-col">
                <p className="m-0 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{g.label}</p>
                <Rad
                  vald={!val[g.id]}
                  onClick={() => vlj(g.id, null)}
                  text={g.allaLabel || "Alla"}
                />
                {g.options.map((o) => (
                  <Rad
                    key={o.value}
                    vald={val[g.id] === o.value}
                    onClick={() => vlj(g.id, o.value)}
                    text={o.label}
                    ikon={o.icon}
                  />
                ))}
              </div>
            ))}

            {sortering ? (
              <div className="flex flex-col border-t border-line pt-2">
                <p className="m-0 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {sortering.label}
                </p>
                {sortering.options.map((o) => (
                  <Rad
                    key={o.value}
                    vald={sortering.value === o.value}
                    onClick={() => sortering.onChange(o.value)}
                    text={o.label}
                  />
                ))}
              </div>
            ) : null}

            {/* ⛔ Rensa syns bara när det finns något att rensa. En alltid
                synlig knapp som inte gör något lär en att den inte gör något. */}
            {aktiva.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  rensa();
                  setOppen(false);
                }}
                className={cx(
                  "min-h-11 cursor-pointer rounded-sm border-t border-line px-3 text-left text-sm font-semibold text-accent",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent hover:bg-accent-faint",
                )}
              >
                {rensaLabel}
              </button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * En rad i panelen.
 *
 * ⛔ EGEN KOMPONENT OCH INTE TRE KOPIOR. Grupperna, sorteringen och
 * "alla"-raden ritas likadant, och tre kopior av samma fjorton klasser hade
 * glidit isär första gången någon ändrade höjden på en av dem.
 *
 * @param {{ vald: boolean, onClick: () => void, text: string, ikon?: import("react").ReactNode }} props
 */
function Rad({ vald, onClick, text, ikon }) {
  return (
    <button
      type="button"
      aria-pressed={vald}
      onClick={onClick}
      className={cx(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-left text-base",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        vald ? "bg-accent-subtle font-semibold text-ink" : "text-ink-secondary hover:bg-accent-faint hover:text-ink",
      )}
    >
      {ikon ? <span className="shrink-0 text-ink-secondary">{ikon}</span> : null}
      <span className="flex-1">{text}</span>
      {vald ? (
        <span aria-hidden="true" className="shrink-0 text-accent">
          <BockIkon />
        </span>
      ) : null}
    </button>
  );
}
