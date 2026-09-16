import { cx } from "../lib/cx.js";
import { bradska } from "../lib/handelser.js";

/**
 * Lista över händelser: vem, vad, och hur bråttom.
 *
 * ── ⛔ VARFÖR EN EGEN PRIMITIV OCH INTE BARA `OpsList` ────────────────────
 *
 * `OpsList` är en tom form: den vet ingenting om sina rader och låter appen
 * bestämma allt. Det är rätt för en lista över vad som helst, och fel här, för
 * en händelselista har EN sak som inte får vara appens beslut: hur brådska
 * visas.
 *
 * Varje app som ritar sina egna försenat-rader kommer välja sin egen röda, sin
 * egen ordning och sin egen formulering, och två plattformar kommer visa samma
 * läge på två sätt. Det är precis den drift ramverket finns för att stoppa.
 *
 * ⛔ Appen äger VAD som står i raden. Ramverket äger hur brådskan ser ut.
 *
 * ── ⛔ FÄRGEN BÄR INTE BETYDELSEN ────────────────────────────────────────
 *
 * En försenad rad är röd OCH säger "Försenat". Samma regel som `OpsCard`s
 * kantfärger och `OpsProvenance`: en färg går inte att läsa upp och är osynlig
 * för var tjugonde man. Ordet kommer ur `labels`, så appen kan skriva sitt eget
 * språk, men det går inte att få bort det.
 */

const TONER = {
  // ⛔ `danger`, och det är den ENDA brådskan som får låna larmfärgen. Är två
  // av tre lägen röda lär sig ögat att rött betyder "en rad", inte "något är
  // fel", och då tappar det verkliga larmet sin kraft.
  forsenat: "bg-danger-bg text-danger",
  pagar: "bg-accent-subtle text-ink",
  framat: "bg-sunken text-ink-secondary",
  odaterat: "bg-sunken text-ink-muted",
};

/**
 * @param {object} props
 * @param {import("../lib/handelser.js").Handelse[]} props.events
 * @param {(href: string, event: any) => void} [props.onNavigate] Anropas i stället för webbläsarens navigering.
 * @param {string} [props.ariaLabel]
 * @param {{ forsenat?: string, pagar?: string, framat?: string, odaterat?: string }} [props.labels] Orden för de fyra lägena.
 * @param {import("react").ReactNode} [props.empty] Vad som visas när listan är tom. ⛔ Skicka alltid något: tom lista och "allt är gjort" betyder motsatta saker.
 */
export function OpsEventList({ events, onNavigate, ariaLabel, labels = {}, empty = null }) {
  // ⛔ BARA FÖRSENAT FÅR ETT ORD SOM STANDARD, och det följer direkt av
  // TONER ovan: försenat är det enda läget som lånar larmfärgen, alltså det
  // enda där färgen skulle bära betydelse ensam.
  //
  // De andra tre får sitt sammanhang ur `nar` ("Pågår (15-20)", "Om 3 dagar").
  // Första versionen satte `pagar: "Nu"`, och raden sade då både "Nu" och
  // "Pågår (15-20)" bredvid varandra: samma faktum två gånger, vilket får
  // läsaren att leta efter skillnaden.
  //
  // En app som VILL ha ett ord på de andra skickar det själv.
  const ord = {
    forsenat: labels.forsenat ?? "Försenat",
    pagar: labels.pagar ?? "",
    framat: labels.framat ?? "",
    odaterat: labels.odaterat ?? "",
  };

  if (!events || events.length === 0) return empty;

  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-divider p-0" aria-label={ariaLabel}>
      {events.map((h) => {
        const lage = bradska(h);
        const marke = ord[lage];
        // ⛔ Bunden till en const och inte läst som `h.url` i klickhanteraren:
        // TypeScript smalnar inte av ett fält inuti en closure, så `h.url` är
        // `string | undefined` där även om raden bara renderas när den finns.
        const url = h.url;
        return (
          <li key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2">
            {h.roll ? <span className="shrink-0">{h.roll}</span> : null}

            {marke ? (
              <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", TONER[lage])}>{marke}</span>
            ) : null}

            <span className="min-w-0 flex-1 text-ink">{h.titel}</span>

            {/* ⛔ `tabular-nums`: utan den hoppar datumkolumnen i sidled mellan
                rader, eftersom siffrorna har olika bredd i de flesta typsnitt.
                Det syns inte på en rad och är omöjligt att sluta se på tio. */}
            {h.nar ? <span className="shrink-0 text-sm tabular-nums text-ink-secondary">{h.nar}</span> : null}

            {url ? (
              <a
                href={url}
                onClick={(e) => onNavigate?.(url, e)}
                target={onNavigate ? undefined : "_blank"}
                rel={onNavigate ? undefined : "noopener noreferrer"}
                className="shrink-0 rounded-sm text-sm text-accent underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {/* Namnet säger vad man öppnar, inte bara "Öppna": med tio rader
                    läser en skärmläsare annars upp samma ord tio gånger. */}
                <span aria-hidden="true">Öppna</span>
                <span className="sr-only">Öppna {h.titel}</span>
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
