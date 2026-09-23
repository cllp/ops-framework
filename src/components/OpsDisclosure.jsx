import { useState } from "react";
import { cx } from "../lib/cx.js";
import { ChevronNedIkon } from "./icons.jsx";

/**
 * Hopfällbart kort: en alltid synlig rubrik som fäller ut ett innehåll.
 *
 * ⛔ Byggt på native `<details>`/`<summary>`, inte en egen knapp med state.
 * Skälet är mätt: en hopfällning gjord av `<div onClick>` tappar tangentbord
 * (Enter/Space), fokusordning och skärmläsarens "expanderad/hopfälld" gratis,
 * och någon måste återuppfinna dem, oftast fel. `<details>` bär allt det i
 * plattformen. Den här komponenten lägger bara till form (token-radie, ram,
 * chevron till HÖGER — samma sida app-wide som Inkorg/Idag (CP)) och ett valfritt styrt läge.
 *
 * ⛔ Ramverket äger formen, inte innehållet. `summary` och `children` är vad
 * appen än vill visa: en rubrik med etiketter och ett belopp till höger, en
 * lista, en tabell. Ingen domän här.
 *
 * ── ⛔ DEN HÄR FILEN HAR HAFT TVÅ IMPLEMENTATIONER SAMTIDIGT ────────────────
 *
 * Den här versionen skrevs först och låg i en öppen PR som bolag-ops redan
 * pinnade till. En senare session byggde en ANDRA `OpsDisclosure` på main, med
 * en `label`-prop, en egen knapp och höjdanimering med grid, utan att veta att
 * den här fanns. Skälet var att sessionen listade repots öppna **issues** men
 * inte dess öppna **pull requests**.
 *
 * Lärdomen är inte "läs PR-listan". Den är att **ett begrepp kan finnas utan
 * att finnas på main**, och att en konsument kan peka på en ogrenad commit. Vad
 * ramverket består av går därför inte att avgöra genom att titta på main
 * ensamt.
 *
 * Den här implementationen vann, av två skäl som båda är principiella:
 *
 *   1. `<details>` har aldrig det fokusproblem den andra versionen byggde en
 *      `inert`-hantering för att lösa. Hopfälld panel är inte fokuserbar i
 *      plattformen. Att skriva 40 rader för att återskapa en garanti man redan
 *      har är per definition fel väg.
 *   2. `summary` var redan en publicerad yta som en app använde. Att byta den
 *      till `label` hade brutit en konsument för noll användarvinst.
 *
 * Det den andra versionen hade och som är värt att behålla ligger nedan:
 * `storageKey`, `badge` och 44 px träffyta. De är tillägg, inte en andra väg
 * att göra samma sak.
 *
 * Priset för `<details>` är att höjden inte går att animera. Det är ett
 * medvetet byte: en utfällning som hoppar fram är en kosmetisk brist, en
 * hopfällning man kan tabba in i är en trasig sida.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.summary Alltid synlig rad. Klickytan som fäller ut.
 * @param {import("react").ReactNode} props.children Innehållet som visas när den är öppen.
 * @param {boolean} [props.defaultOpen] Startläge när komponenten är ostyrd.
 * @param {boolean} [props.open] Styrt läge. Anges det äger appen öppet/stängt via `onOpenChange`.
 * @param {(open: boolean) => void} [props.onOpenChange] Anropas när användaren fäller ut eller ihop.
 * @param {string} [props.storageKey] Minns öppet eller stängt per webbläsare. Bara i ostyrt läge.
 * @param {number} [props.badge] Siffra efter rubriken, t.ex. antal ifyllda fält därinne. Visas bara över noll.
 * @param {string} [props.id]
 */
export function OpsDisclosure({ summary, children, defaultOpen = false, open, onOpenChange, storageKey, badge, id }) {
  const styrd = open !== undefined;
  const [internOppen, setInternOppen] = useState(() => readSaved(storageKey, defaultOpen));
  const arOppen = styrd ? open : internOppen;

  /** @param {any} e */
  function hanteraToggle(e) {
    const ny = e.currentTarget.open;
    // ⛔ I ostyrt läge följer state med native-elementet. I styrt läge rör vi
    // INTE internt state; appen bestämmer, annars finns två sanningar om öppet.
    if (!styrd) {
      setInternOppen(ny);
      writeSaved(storageKey, ny);
    }
    if (ny !== arOppen) onOpenChange?.(ny);
  }

  return (
    <details
      id={id}
      open={arOppen}
      onToggle={hanteraToggle}
      className="group rounded-lg border border-line bg-raised"
    >
      <summary
        className={cx(
          // ⛔ 44 px träffyta. En rubrikrad som bara är lika hög som sin text är
          // svår att träffa med tummen, och det är den vanligaste platsen där
          // ett utfällbart avsnitt känns trasigt på telefon.
          "flex min-h-11 cursor-pointer list-none items-center gap-3 p-4",
          // Native marker bort (den ligger annars kvar bredvid chevronen).
          "[&::-webkit-details-marker]:hidden",
          "rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        <div className="min-w-0 flex-1">{summary}</div>
        {badge && badge > 0 ? (
          <span className="shrink-0 rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">{badge}</span>
        ) : null}
        <span
          aria-hidden="true"
          className={cx("shrink-0 text-ink-secondary transition-transform duration-(--duration-fast)", arOppen && "rotate-180")}
        >
          <ChevronNedIkon />
        </span>
      </summary>
      <div className="border-t border-divider p-4">{children}</div>
    </details>
  );
}

/**
 * ⛔ `localStorage` kastar i privat läge och när webbplatsdata är blockerad.
 * Läser man den utan try blir ett hopfällbart avsnitt anledningen att hela
 * sidan är vit.
 * @param {string | undefined} key @param {boolean} fallback @returns {boolean}
 */
function readSaved(key, fallback) {
  if (!key) return fallback;
  try {
    const saved = globalThis.localStorage?.getItem(key);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch {
    // Blockerad lagring är inte ett fel, det är bara ingen minneskälla.
  }
  return fallback;
}

/** @param {string | undefined} key @param {boolean} value */
function writeSaved(key, value) {
  if (!key) return;
  try {
    globalThis.localStorage?.setItem(key, value ? "1" : "0");
  } catch {
    // Läget gäller för den här sidvisningen även om det inte kan sparas.
  }
}
