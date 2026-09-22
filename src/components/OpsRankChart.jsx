import { cx } from "../lib/cx.js";

/**
 * Vad som är stort och vad som är smått, i ordning.
 *
 * ── ⛔ VARFÖR STAPLAR OCH INTE EN RING ───────────────────────────────────
 *
 * En ring (`OpsShareChart`) svarar på "hur stor del", en stapel på "hur mycket
 * mer". De ser ut att vara samma diagram i två former och är det inte: två
 * bitar på 18 och 21 procent går inte att skilja som vinklar, men som två
 * längder på samma baslinje ser vem som helst vilken som är längre.
 *
 * Är frågan "vilka poster sticker ut", är svaret alltid den här.
 *
 * ── ⛔ NIVÅN ÄR APPENS BEDÖMNING, INTE RAMVERKETS ────────────────────────
 *
 * Komponenten räknar INTE ut vad som är högt. Var gränsen går mellan hög och
 * medel är ett domänbeslut: för en kostnadslista kan tusen kronor vara högt och
 * för en annan försumbart. Appen skickar `level` (1 låg, 2 medel, 3 hög) och
 * ramverket målar den, med en skala där mer är mörkare.
 *
 * ⛔ Skalan är EN nyans som mörknar, aldrig en regnbåge. En regnbåge har ingen
 * ordning, så läsaren måste slå upp legenden för varje steg i stället för att
 * se den.
 *
 * ⛔ Utan `level` får alla staplar samma ton. Det är rätt utfall och inte en
 * degradering: längden bär redan storleken, och en färgskala ovanpå den säger
 * ingenting nytt om den inte delar in i klasser appen menar något med.
 *
 * ── ⛔ EN SIFFRA PER RAD, INTE EN AXEL ───────────────────────────────────
 *
 * Raderna bär sitt eget värde som text i stället för att läsaren ska mäta mot
 * en x-axel. Det är det som gör listan läsbar utan färg och utan mus, och det
 * är också relief-kravet: skalans ljusaste steg ligger nära ytan, och en stapel
 * som nästan är ytan måste ha sin siffra skriven.
 */

/**
 * ⛔ Hela klassnamn i en tabell, aldrig `bg-scale-${n}`. Tailwind läser
 * källkoden som text, så en sammansatt klass genereras inte alls och diagrammet
 * blir färglöst i bygget medan det ser rätt ut i utvecklingsläge.
 */
const NIVAFARG = { 1: "bg-scale-1", 2: "bg-scale-2", 3: "bg-scale-3" };
const STANDARDFARG = "bg-scale-2";

/**
 * @typedef {object} Rangrad
 * @property {string} id
 * @property {import("react").ReactNode} label
 * @property {number} value Stapelns längd. Negativa värden ritas inte: den här formen har en baslinje i noll.
 * @property {import("react").ReactNode} [text] Värdet som det ska LÄSAS. ⛔ Ramverket formaterar aldrig pengar.
 * @property {1 | 2 | 3} [level] Appens bedömning: låg, medel, hög.
 * @property {import("react").ReactNode} [note] Andra raden, t.ex. varför posten sticker ut.
 */

/**
 * @param {object} props
 * @param {Rangrad[]} props.rows
 * @param {string} props.ariaLabel
 * @param {number} [props.max] Vad full stapel betyder. Utan den är det största värdet full stapel.
 * @param {import("react").ReactNode} [props.empty]
 */
export function OpsRankChart({ rows, ariaLabel, max, empty = null }) {
  const entries = (rows || []).filter((r) => r && typeof r.value === "number" && Number.isFinite(r.value) && r.value > 0);
  if (entries.length === 0) return empty;

  // ⛔ Taket är det största värdet om appen inte säger annat, och ALDRIG summan.
  // Mot summan blir varje enskild stapel en tunn strimma och listan säger
  // ingenting om vad som är störst, vilket är hela frågan.
  const tak = typeof max === "number" && max > 0 ? max : Math.max(...entries.map((p) => p.value));

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label={ariaLabel}>
      {entries.map((r) => {
        const andel = Math.min(r.value / tak, 1);
        return (
          <li key={r.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-ink">{r.label}</span>
              {r.text === undefined || r.text === null ? null : (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{r.text}</span>
              )}
            </div>

            {/* ⛔ Spåret är `sunken` och inte en ram. En ram runt stapeln lägger
                till en linje som ögat läser som ett värde; en nedsänkt yta säger
                bara hur långt stapeln KUNDE gå. */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" aria-hidden="true">
              <div
                className={cx(
                  "h-full rounded-full transition-[width] duration-(--duration-slow) ease-standard",
                  r.level ? NIVAFARG[r.level] || STANDARDFARG : STANDARDFARG,
                )}
                // ⛔ Bredden är geometri och måste vara ett räknat tal. Färg via
                // style vore däremot fel: den går förbi tokenkontraktet och
                // mörkt läge, och syns inte i någon granskning av CSS.
                style={{ width: `${Math.max(andel * 100, 1.5)}%` }}
              />
            </div>

            {r.note ? <span className="text-sm text-ink-muted">{r.note}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
