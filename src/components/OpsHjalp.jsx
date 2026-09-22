import { cx } from "../lib/cx.js";

/**
 * En rubrik med sin förklaring bakom ett frågetecken.
 *
 * ══ ⛔ VAD DEN LÖSER ═══════════════════════════════════════════════════
 *
 * CP 2026-09-22: "Låt texter komma fram med hjälp av att man trycker på ett
 * frågetecken, så blir appen lite renare."
 *
 * Varje vy inledde med en rubrik och en mening under den. Meningen är sann och
 * värd att ha, men den läses en gång och står kvar för alltid, och på en telefon
 * betalar man för den varje gång man öppnar sidan: den trycker ner det man kom
 * för. Bakom ett frågetecken finns den kvar för den som undrar och är borta för
 * den som inte gör det.
 *
 * ══ ⛔ `<details>` OCH INTE EN KNAPP MED STATE ═════════════════════════
 *
 * Samma skäl som står i `OpsDisclosure`, och det är värt att upprepa eftersom
 * frestelsen är större här: en liten knapp ser ut som något man kan skriva på
 * fem rader. En hopfällning gjord av `<div onClick>` tappar tangentbord
 * (Enter/Space), fokusordning och skärmläsarens "expanderad/hopfälld" gratis,
 * och någon måste återuppfinna dem, oftast fel. `<details>` bär allt det i
 * plattformen.
 *
 * ⛔ HELA RUBRIKRADEN ÄR TRÄFFYTAN, INTE BARA TECKNET, och det är ett val och
 * inte en genväg. `<summary>` är ETT element: ska frågetecknet vara den enda
 * klickytan måste texten ligga någon annanstans än inuti, och då är man tillbaka
 * i en egen knapp med eget state. Bytet är dessutom till användarens fördel på
 * telefon, där ett 20 px tecken är en dålig tumträff. Frågetecknet är det man
 * SER och siktar på; raden är det som tar emot.
 *
 * ⛔ ETT `<h1>` FÅR LIGGA I ETT `<summary>`. Innehållsmodellen tillåter
 * uttryckligen ett rubrikelement, så rubriken förblir en rubrik för den som
 * navigerar på rubriker.
 *
 * ⛔ INGET FRÅGETECKEN UTAN TEXT. Saknas `children` ritas rubriken naken, utan
 * `<details>`. En knapp som öppnar ingenting är ett löfte som inte infrias, och
 * det är samma regel som kalenderkortets chevron fick.
 *
 * ⛔ STÄNGD FRÅN START, ALLTID. Ett minne per webbläsare (`storageKey`, som
 * `OpsDisclosure` har) vore lätt att lägga till och fel: hjälptexten är något
 * man läser en gång. Mindes den sig öppen vore vi tillbaka i en mening som står
 * kvar för alltid, alltså precis det som skulle bort.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.rubrik Rubriken. Ett rubrikelement, inte en sträng.
 * @param {import("react").ReactNode} [props.children] Förklaringen. Saknas den ritas ingen knapp.
 * @param {string} [props.label] Skärmläsarens ord för tecknet.
 */
export function OpsHjalp({ rubrik, children, label = "Visa förklaring" }) {
  if (!children) return rubrik;

  return (
    <details className="group min-w-0">
      <summary
        className={cx(
          "flex min-h-11 cursor-pointer list-none items-center gap-2",
          // Native marker bort, den ligger annars kvar bredvid frågetecknet.
          "[&::-webkit-details-marker]:hidden",
          "rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        {rubrik}
        {/*
          ⛔ ETT TECKEN OCH INTE EN BILD. "?" betyder förklaring i varje
          gränssnitt som finns, och en ikon hade varit en bild till att ladda och
          en till att välja. Ringen gör det till en knapp för ögat.

          ⛔ `shrink-0` SÅ DET INTE KLÄMS. Utan den krymper cirkeln till en oval
          så fort rubriken är lång, och en oval frågetecken-knapp ser trasig ut.
        */}
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
            "border border-line text-sm font-bold text-ink-secondary",
            "transition-colors duration-(--duration-fast) ease-standard",
            "group-open:border-accent group-open:text-accent",
          )}
        >
          ?
        </span>
        <span className="sr-only">{label}</span>
      </summary>
      <div className="mt-1 text-base text-ink-secondary">{children}</div>
    </details>
  );
}
