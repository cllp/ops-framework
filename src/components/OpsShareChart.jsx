import { useId, useState } from "react";
import { cx } from "../lib/cx.js";
import { ChevronNedIkon } from "./icons.jsx";

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
 *
 * ── ⛔ EN BIT KAN FÄLLAS UT, OCH DÅ ÄR HELA RADEN KNAPPEN ────────────────
 *
 * En ring visar att Pension är 29 procent och kan omöjligt visa vilka
 * pensionsrader det är. Det svaret låg tidigare på en annan sida, alltså ett
 * sidbyte bort från frågan man just ställde.
 *
 * ⛔ Hela raden är knappen, inte en pil i en egen kolumn. En 44 px pil bredvid en
 * 28 px rad gör listan halvannan gång högre utan att säga något nytt, och på en
 * telefon är en rad man kan träffa med tummen värd mer än en pil man måste sikta
 * på. `OpsEventList` har pilen i egen kolumn eftersom raden DÄR redan är en länk
 * till ärendet: två saker att trycka på kräver två träffytor, en sak kräver en.
 *
 * ⛔ Knappen får INGET eget namn av typen "visa detaljer". Det som läses upp är
 * radens egen text, alltså "Pension, 5 285 733 kr, 29 procent", och
 * `aria-expanded` säger att den fälls ut. Ett påklistrat namn hade ersatt
 * siffrorna med ett verb.
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

/**
 * Bredden på allt som står EFTER värdet på en rad: andelen och chevronen.
 *
 * ⛔ ETT TAL, TVÅ ANVÄNDNINGAR, SKRIVNA BREDVID VARANDRA. Raden reserverar den
 * här bredden för svansen, och den utfällda panelen håller samma bredd fri till
 * höger. Utan det högerställs panelens belopp mot kortets kant medan radens
 * belopp står 68 px längre in, och skillnaden ser ut som ett fel.
 *
 * Mätt: andelen 44 px (`w-11`) + mellanrum 8 px + chevron 16 px = 68 px.
 *
 * ⛔ PANELENS MARGINAL ÄR 84 OCH INTE 68, och de 16 pixlarna är inte slarv.
 * Raden har `px-2` inuti sig och ett `gap-2` mellan värdet och svansen; panelen
 * ligger utanför båda, eftersom den börjar vid listans kant. Första försöket
 * satte 68 på båda och mätningen gav 531 mot 547, alltså sexton pixlars glapp
 * som ser ut precis som det fel raden skulle rätta.
 *
 * ⛔ Två Tailwind-klasser och inte ett räknat värde: Tailwind läser källkod som
 * text, så ett hopbyggt klassnamn genereras inte alls. Att de står på rad efter
 * varandra är det som gör att de inte glider isär.
 */
const SVANS = "w-[4.25rem]";
const SVANS_MARGINAL = "pr-[5.25rem]";

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
 * @property {import("react").ReactNode} [detaljer] Vad biten BESTÅR AV, t.ex. de enskilda innehaven i en tillgångsklass. Finns det inget att fälla ut ska fältet utelämnas, inte sättas till tom sträng: en pil som öppnar ingenting är ett löfte som inte infrias.
 */

/**
 * @param {object} props
 * @param {Andel[]} props.segments
 * @param {string} props.ariaLabel Vad ringen visar, för den som inte ser den.
 * @param {import("react").ReactNode} [props.empty] Visas när allt är noll eller listan är tom.
 */
export function OpsShareChart({ segments, ariaLabel, empty = null }) {
  const [aktiv, setAktiv] = useState(/** @type {string | null} */ (null));
  const [oppna, setOppna] = useState(/** @type {string[]} */ ([]));
  // ⛔ Krokarna står FÖRE den tidiga returen för tomt läge. En krok efter en
  // return körs inte i alla renderingar, och React räknar krokar på ordning:
  // listan skulle byta betydelse den rendering datan kommer in.
  const idBas = useId();

  const poster = (segments || []).filter((s) => s && typeof s.value === "number" && Number.isFinite(s.value) && s.value > 0);

  if (poster.length > MAX_BITAR) {
    throw new Error(
      `OpsShareChart: ${poster.length} bitar, högst ${MAX_BITAR}. En sjunde färg skulle behöva genereras, och en genererad färg är omätt. ` +
        "Slå ihop svansen till en restpost i appen (ordet är ditt, inte ramverkets), dela upp i flera ringar, eller visa en tabell.",
    );
  }

  const summa = poster.reduce((s, p) => s + p.value, 0);
  if (summa <= 0) return empty;

  // ⛔ EN FRÅGA FÖR HELA LISTAN, inte per rad. Vet listan att någon rad kan
  // fällas ut reserverar alla rader pilens bredd, och procentkolumnen står kvar
  // på samma ställe oavsett vilken rad man tittar på. Utan det hoppar kolumnen
  // in och ut beroende på om just den raden har något att visa.
  const nagonHarDetaljer = poster.some((p) => Boolean(p.detaljer));

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
        {bitar.map((b) => {
          const oppen = oppna.indexOf(b.id) >= 0;
          const panelId = `${idBas}-${b.id}`;
          const harDetaljer = Boolean(b.detaljer);

          const innehall = (
            <>
              <span aria-hidden="true" className={cx("size-2.5 shrink-0 translate-y-px rounded-full", PRICK[b.i])} />
              <span className="min-w-0 flex-1 truncate text-left text-sm text-ink">{b.label}</span>
              {b.text === undefined || b.text === null ? null : (
                <span className="shrink-0 text-sm tabular-nums text-ink-secondary">{b.text}</span>
              )}
              {/* Svansen: andel och chevron i ETT block med den bredd panelen
                  nedanför håller fri. Andelen räknas här och inte av appen: den
                  följer direkt av geometrin, och två uträkningar av samma tal
                  glider isär. */}
              <span className={cx("flex shrink-0 items-center justify-end gap-2", nagonHarDetaljer ? SVANS : "w-11")}>
                <span className="text-right text-sm tabular-nums text-ink-muted">{Math.round(b.andel * 100)} %</span>
                {nagonHarDetaljer ? (
                  harDetaljer ? (
                    <span
                      aria-hidden="true"
                      className={cx(
                        "text-ink-muted transition-transform duration-(--duration-fast) ease-standard",
                        oppen && "rotate-180",
                      )}
                    >
                      <ChevronNedIkon size={16} />
                    </span>
                  ) : (
                    // ⛔ Tom yta och INTE en utgråad pil, samma regel som i
                    // OpsEventList: en pil som inte öppnar något är ett löfte som
                    // inte infrias, och den som tryckt en gång utan att något hände
                    // slutar lita på de andra pilarna.
                    <span aria-hidden="true" className="w-4" />
                  )
                ) : null}
              </span>
            </>
          );

          // ⛔ Samma radhöjd i hela listan när NÅGON rad går att fälla ut. Bara
          // de fällbara raderna kan inte vara 44 px höga: då blir listan ojämn
          // och ojämnheten ser ut som att raderna betyder olika mycket.
          const radklass = cx(
            "flex w-full items-center gap-2 rounded-md px-2 transition-colors duration-(--duration-fast) ease-standard",
            nagonHarDetaljer ? "min-h-11 py-2" : "py-1",
            aktiv === b.id && "bg-sunken",
          );

          return (
            <li key={b.id} onMouseEnter={() => setAktiv(b.id)} onMouseLeave={() => setAktiv(null)}>
              {harDetaljer ? (
                <button
                  type="button"
                  onClick={() => setOppna((f) => (f.indexOf(b.id) >= 0 ? f.filter((x) => x !== b.id) : [...f, b.id]))}
                  aria-expanded={oppen}
                  aria-controls={panelId}
                  className={cx(
                    radklass,
                    "cursor-pointer hover:bg-sunken",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  )}
                >
                  {innehall}
                </button>
              ) : (
                <div className={radklass}>{innehall}</div>
              )}

              {/* ⛔ `hidden` och inte villkorlig rendering: `aria-controls` pekar
                  på ett id, och ett id som bara finns ibland är en trasig
                  referens i uppläsningen varje gång raden är stängd.

                  ⛔ Indraget är en kantlinje och inte ett pixelmått som låtsas
                  linjera med etiketten. Ett mått som "nästan" linjerar ser ut som
                  ett fel; en linje säger "det här hör till raden ovanför". */}
              {harDetaljer ? (
                <div
                  id={panelId}
                  hidden={!oppen}
                  className={cx("mt-1 mb-2 ml-3 border-l-2 border-line pl-3 text-sm text-ink-secondary", SVANS_MARGINAL)}
                >
                  {b.detaljer}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
