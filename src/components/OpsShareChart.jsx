import { useState } from "react";
import { cx } from "../lib/cx.js";

/**
 * Hur en helhet är fördelad.
 *
 * ── ⛔ VAD DEN SVARAR PÅ, OCH VAD DEN INTE GÖR ───────────────────────────
 *
 * "Hur stor del av det här är X?" En ring svarar på det i ögonkastet, och det
 * är den enda fråga den svarar bra på.
 *
 * ⛔ DEN DUGER INTE FÖR ATT JÄMFÖRA NÄRLIGGANDE VÄRDEN. Två bitar på 18 och 21
 * procent går inte att skilja åt som vinklar, och den som försöker läser fel.
 * Ska läsaren rangordna eller se hur mycket större något är, är det staplar
 * (`OpsRankChart`) eller en tabell. Ringen är till för proportion, inte för
 * precision.
 *
 * ── ⛔ SEX BITAR, SEDAN KASTAR DEN ───────────────────────────────────────
 *
 * Paletten har sex slottar, och en sjunde färg skulle behöva genereras. En
 * genererad färg är omätt, och omätt färg i ett diagram betyder i praktiken två
 * serier som någon inte kan skilja åt.
 *
 * ⛔ Komponenten viker INTE ihop svansen till "Övrigt" åt appen. Ordet är
 * appens, och vilka poster som får försvinna i en restpost är ett innehållsbeslut
 * som inte hör hemma i ett ramverk. Den kastar i stället, med besked om vad som
 * ska göras.
 *
 * ── ⛔ FÄRGEN BÄR ALDRIG BETYDELSEN ENSAM ────────────────────────────────
 *
 * Varje bit har en rad i listan bredvid, med etikett, värde och andel. Det är
 * inte en legend som pynt, det är kravet: tre av de sex färgerna ligger under
 * 3:1 mot ljus yta, och de är tillåtna ENDAST med synliga etiketter eller en
 * tabellvy. Listan är den vyn. Tar man bort den är paletten fel använd.
 */

/**
 * ⛔ Klassnamnen står som hela strängar i en tabell och byggs ALDRIG ihop av
 * `fill-series-${n}`. Tailwind läser källkod som text: en klass som bara finns
 * som en sammansatt sträng genereras inte, och resultatet är ett diagram som
 * ritas helt utan färg i bygget medan det ser rätt ut i utvecklingsläge.
 */
const STRECK = ["stroke-series-1", "stroke-series-2", "stroke-series-3", "stroke-series-4", "stroke-series-5", "stroke-series-6"];
const PRICK = ["bg-series-1", "bg-series-2", "bg-series-3", "bg-series-4", "bg-series-5", "bg-series-6"];

const MAX_BITAR = STRECK.length;

const RADIE = 40;
const OMKRETS = 2 * Math.PI * RADIE;
// ⛔ Ett mellanrum i ytans färg mellan bitarna, inte en ritad kant runt dem. En
// kant lägger till en linje som ögat läser som information; ett mellanrum säger
// bara "här slutar den ena".
const GLAPP = 1.2;

/**
 * @typedef {object} Andel
 * @property {string} id
 * @property {import("react").ReactNode} label
 * @property {number} value Används för geometrin. Måste vara ett tal.
 * @property {import("react").ReactNode} [text] Värdet som det ska LÄSAS, t.ex. "4 600 000 kr". ⛔ Ramverket formaterar aldrig pengar: det vet inte vilken valuta plattformen räknar i.
 */

/**
 * @param {object} props
 * @param {Andel[]} props.segments
 * @param {string} props.ariaLabel Vad ringen visar, för den som inte ser den.
 * @param {import("react").ReactNode} [props.empty] Visas när allt är noll eller listan är tom.
 */
export function OpsShareChart({ segments, ariaLabel, empty = null }) {
  const [aktiv, setAktiv] = useState(/** @type {string | null} */ (null));

  const poster = (segments || []).filter((s) => s && typeof s.value === "number" && Number.isFinite(s.value) && s.value > 0);

  if (poster.length > MAX_BITAR) {
    throw new Error(
      `OpsShareChart: ${poster.length} bitar, högst ${MAX_BITAR}. En sjunde färg skulle behöva genereras, och en genererad färg är omätt. ` +
        "Slå ihop svansen till en restpost i appen (ordet är ditt, inte ramverkets), dela upp i flera ringar, eller visa en tabell.",
    );
  }

  const summa = poster.reduce((s, p) => s + p.value, 0);
  if (summa <= 0) return empty;

  let vinkel = 0;
  const bitar = poster.map((p, i) => {
    const andel = p.value / summa;
    const langd = andel * OMKRETS;
    const bit = {
      ...p,
      i,
      andel,
      // ⛔ Glappet dras från bitens egen längd i stället för att läggas till
      // nästa. Läggs det till driver summan ifrån omkretsen och sista biten
      // hamnar ovanpå den första.
      dash: `${Math.max(langd - GLAPP, 0.01)} ${OMKRETS - Math.max(langd - GLAPP, 0.01)}`,
      offset: -vinkel,
    };
    vinkel += langd;
    return bit;
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="shrink-0 self-center">
        {/* ⛔ `role="img"` med ett namn, inte en osynlig graf. Utan det läses
            ringen upp som en hög med tomma cirklar, eller inte alls. Siffrorna
            finns i listan bredvid, som är den faktiska datavyn. */}
        <svg viewBox="0 0 100 100" role="img" aria-label={ariaLabel} className="h-40 w-40 -rotate-90">
          {bitar.map((b) => (
            <circle
              key={b.id}
              cx="50"
              cy="50"
              r={RADIE}
              fill="none"
              strokeWidth="14"
              strokeDasharray={b.dash}
              strokeDashoffset={b.offset}
              onMouseEnter={() => setAktiv(b.id)}
              onMouseLeave={() => setAktiv(null)}
              className={cx(
                STRECK[b.i],
                "transition-opacity duration-(--duration-fast) ease-standard",
                // ⛔ Framhävning genom att DÄMPA de andra, inte genom att lysa
                // upp den aktiva. En bit som byter färg vid hover ser ut att
                // byta betydelse.
                aktiv && aktiv !== b.id && "opacity-25",
              )}
            />
          ))}
        </svg>
      </div>

      {/* ⛔ DET HÄR ÄR INTE EN LEGEND, DET ÄR DATAN. Varje rad bär etikett,
          värde och andel, så ringen aldrig är enda vägen till en siffra. Tre av
          sex färger klarar inte 3:1 mot ljus yta och är tillåtna just för att
          den här listan finns. */}
      <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1 p-0">
        {bitar.map((b) => (
          <li
            key={b.id}
            onMouseEnter={() => setAktiv(b.id)}
            onMouseLeave={() => setAktiv(null)}
            className={cx(
              "flex items-baseline gap-2 rounded-md px-2 py-1 transition-colors duration-(--duration-fast) ease-standard",
              aktiv === b.id && "bg-sunken",
            )}
          >
            <span aria-hidden="true" className={cx("size-2.5 shrink-0 translate-y-px rounded-full", PRICK[b.i])} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{b.label}</span>
            {b.text === undefined || b.text === null ? null : (
              <span className="shrink-0 text-sm tabular-nums text-ink-secondary">{b.text}</span>
            )}
            {/* Andelen räknas här och inte av appen: den följer direkt av
                geometrin, och två uträkningar av samma tal glider isär. */}
            <span className="w-11 shrink-0 text-right text-sm tabular-nums text-ink-muted">
              {Math.round(b.andel * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
