import { useId, useState } from "react";
import { cx } from "../lib/cx.js";
import { bradska } from "../lib/handelser.js";
import { ChevronNedIkon } from "./icons.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsStatusDot } from "./OpsStatusDot.jsx";

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
 * ── ⛔ EN ÅTGÄRD PÅ RADEN KRÄVER ETT SVAR PÅ RADERNA UTAN ────────────────
 *
 * `atgard` är appens egen kontroll, till exempel en knapp som bockar av raden.
 * Ramverket ritar den och tolkar den aldrig.
 *
 * ⛔ SÅ SNART EN RAD HAR EN MÅSTE LISTAN FÖRKLARA DE SOM INTE HAR DET, i
 * `atgardsforklaring`. Det är inte artighet utan komponentens enda svar på ett
 * fel vi redan haft: en lista där vissa rader går att göra något åt och andra
 * ser likadana ut lär användaren att trycka på måfå. Den som tryckt förgäves en
 * gång slutar lita på hela listan, också de rader där knappen fanns.
 *
 * Orden är appens, för bara appen vet varför: "Bara påminnelser går att bocka
 * av" är sant i en app och nonsens i nästa. Att förklaringen FINNS är vårt, och
 * därför kastar komponenten.
 *
 * ⛔ EN GÅNG FÖR LISTAN OCH INTE EN GÅNG PER RAD, OCH DET ÄR MÄTT.
 *
 * Första versionen krävde en mening på varje rad utan knapp. Provkört mot Idag i
 * Chromium: tre av fyra rader var uppgifter, alltså stod "Försvinner när den är
 * gjord." tre gånger under varandra. Skälet är att det som saknar knapp saknar
 * den av SAMMA skäl, varje gång. Raderna växte från 64 till omkring 90 px och
 * listan blev en tredjedel längre för att upprepa en sanning.
 *
 * En rad som säger samma sak som raden ovanför slutar läsas, och då är
 * förklaringen borta i praktiken fast den står där.
 *
 * ⛔ PLATSEN PÅ RADEN RESERVERAS BARA NÄR RADEN HAR EN ÅTGÄRD, exakt som
 * chevronkolumnen bara finns när någon rad kan fällas ut. En lista utan
 * åtgärder ser ut precis som förut och betalar ingen höjd för en gest som inte
 * finns.
 *
 * ── ⛔ CHEVRONKOLUMNEN RESERVERAS BARA NÄR NÅGON RAD KAN FÄLLAS UT ────────
 *
 * Kolumnen är 44 px, alltså 11 procent av en 390 px bred telefon, och den tas
 * från titeln. Reserverades den alltid skulle varje lista utan utfällbara rader
 * betala för en gest som inte finns, och vi har redan en dyr läxa om exakt det:
 * titeln fick 178 px i samma komponent och blev oläslig.
 *
 * Därför frågar listan sina egna rader först. Har ingen `detaljer` finns ingen
 * kolumn. Har någon det får alla den, för ojämna vänsterkanter läses som slarv.
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
 * @param {string} [props.expandLabel] Verb för utfällningsknappens namn, följt av radens titel.
 * @param {import("react").ReactNode} [props.atgardsforklaring] En mening om VILKA rader som går
 *   att göra något åt. ⛔ KRÄVS så snart någon rad har en `atgard` och någon annan inte har det.
 * @param {{ oppet?: string, pagar?: string, vantar?: string, klart?: string, akut?: string }} [props.statusOrd]
 *   Orden för de fem statuslägena. ⛔ KRÄVS för varje status som faktiskt förekommer: en prick
 *   utan ord är en färg som bär betydelsen ensam, och det är osynligt för skärmläsaren och för
 *   ungefär var tjugonde man. Orden är appens, eftersom bara den vet vad `vantar` betyder hos
 *   just den: "väntar på motpart" i ett ops-flöde och "väntar på granskning" i nästa.
 */
export function OpsEventList({
  events,
  onNavigate,
  ariaLabel,
  labels = {},
  empty = null,
  expandLabel = "Visa detaljer för",
  atgardsforklaring = null,
  statusOrd = {},
}) {
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

  const [oppna, setOppna] = useState(/** @type {string[]} */ ([]));
  const idBas = useId();

  // ⛔ FÖRE `events`-vakten, för hookar får inte hoppas över. Låg `useState`
  // efter den tidiga returen skulle React se olika många hookar beroende på om
  // listan är tom, och kasta första gången en lista fylls på.
  if (!events || events.length === 0) return empty;

  // Frågar raderna själva i stället för att ta en prop: en app som glömmer
  // flaggan men skickar `detaljer` skulle annars få en pil som inte syns.
  const nagonHarDetaljer = events.some((e) => Boolean(e && e.detaljer));

  // Samma fråga för åtgärder, och av samma skäl.
  const nagonHarAtgard = events.some((e) => Boolean(e && e.atgard));

  /*
   * ⛔ KASTAR HELLRE ÄN RITAR EN LISTA SOM INTE FÖRKLARAR SIG.
   *
   * En tyst nedsläppsväg hade varit sämre än felet: raderna ritas utan knapp,
   * ser ut som de med, och den som trycker förgäves slutar lita på listan. Det
   * är hela skälet till att propen finns, så den provas i stället för att hoppas
   * på.
   *
   * ⛔ VILLKORET ÄR "NÅGON HAR OCH NÅGON SAKNAR". En lista där ALLA rader har en
   * åtgärd behöver ingen förklaring: då finns ingen tyst rad att undra över.
   */
  /*
   * ⛔ EN STATUS UTAN ORD KASTAR, PRECIS SOM EN ÅTGÄRD UTAN FÖRKLARING.
   *
   * Pricken är en färg, och en färg går inte att läsa upp och är osynlig för
   * ungefär var tjugonde man. Utan ordet är raden alltså tom för dem, och det
   * syns inte på skärmen hos den som byggde den: felet är osynligt just för den
   * som inte drabbas.
   *
   * Orden kan inte ha ett standardvärde här. `vantar` betyder "hos en motpart"
   * i ett ops-flöde och "hos en granskare" i nästa, och ett ramverksord hade
   * blivit fel i den ena appen utan att någon märkte det.
   */
  /** @type {("oppet"|"pagar"|"vantar"|"klart"|"akut")[]} */
  const statusar = [];
  for (const e of events) if (e && e.status) statusar.push(e.status);
  const utanOrd = [...new Set(statusar)].filter((st) => !statusOrd[st]);
  if (utanOrd.length > 0) {
    throw new Error(
      `OpsEventList: rader har status ${utanOrd.join(", ")} men statusOrd saknar ordet. En färgad prick utan ord bär betydelsen ensam, och då är statusen osynlig för skärmläsaren.`,
    );
  }

  if (nagonHarAtgard && events.some((e) => e && !e.atgard) && !atgardsforklaring) {
    throw new Error(
      "OpsEventList: några rader har en atgard och andra inte, men listan saknar atgardsforklaring. En lista där vissa rader går att göra något åt och andra ser likadana ut lär den som läser att trycka på måfå.",
    );
  }

  /** @param {string} id */
  const vaxlaOppen = (id) => setOppna((f) => (f.indexOf(id) >= 0 ? f.filter((x) => x !== id) : [...f, id]));

  // ⛔ VARJE HÄNDELSE ÄR ETT EGET OpsCard, inte en divider-rad i ett delat
  // kort. CP (bolag-ops Idag): två kundfakturor i "kräver dig nu" låg i ETT
  // mörkt kort med streck emellan; Inkorg har redan ett kort per post med
  // gap-3. Samma mönster här så Idag/Kommande och Inkorg läses likadant.
  const lista = (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label={ariaLabel}>
      {events.map((h) => {
        const lage = bradska(h);
        const marke = ord[lage];
        // ⛔ Bunden till en const och inte läst som `h.url` i klickhanteraren:
        // TypeScript smalnar inte av ett fält inuti en closure, så `h.url` är
        // `string | undefined` där även om raden bara renderas när den finns.
        const url = h.url;
        const oppen = oppna.indexOf(h.id) >= 0;
        const panelId = `${idBas}-${h.id}`;
        const harDetaljer = Boolean(h.detaljer);

        return (
          <li key={h.id}>
            <OpsCard>
            {/* ⛔ Chevron HÖGER, samma sida som OpsDisclosure/Inkorg (CP 2026-09-21). */}
            <div className="flex items-start gap-1">
              <div className="flex min-w-0 flex-1 flex-col gap-y-0.5">
              {/* Detaljraden: vem, hur bråttom, när, och länken. Korta saker som
                  tål att trängas. */}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {/* ⛔ FÖRST I RADEN, OCH DEN SYNS ÄVEN NÄR KORTET ÄR IHOPFÄLLT.
                    CP (bolag-ops #249): status ska vara en färgprick i kortets
                    header. Ligger den i utfällningen svarar den bara den som
                    redan öppnat kortet, och frågan "vad väntar på någon annan"
                    ställs när man SKUMMAR listan, inte när man läser en rad.

                    Före rollen, eftersom ögat läser vänsterifrån och pricken är
                    det grövsta beskedet: vad som händer med raden alls, före vem
                    som ska göra något åt den. */}
                {/* ⛔ `|| ""` är inte en nedsläppsväg: vakten ovanför har redan
                    kastat om ordet saknas. Den står här för att `statusOrd` är
                    en valfri karta i typen, och en tom sträng får `OpsStatusDot`
                    att kasta i stället för att rita en stum prick, om någon
                    skulle ta bort vakten. */}
                {h.status ? <OpsStatusDot status={h.status} label={statusOrd[h.status] || ""} /> : null}

                {h.roll ? <span className="shrink-0">{h.roll}</span> : null}

                {marke ? (
                  <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", TONER[lage])}>{marke}</span>
                ) : null}

                {/* ⛔ SLAGET ÄR TEXT, INTE ETT TREDJE FÄRGAT MÄRKE.
                    Raden bär redan en rollbadge och ibland ett brådskemärke. Ett
                    tredje piller hade gjort den till ett klistermärkesalbum där
                    ögat inte vet vilket märke som betyder mest, och brådskan är det
                    enda som ska kunna ta uppmärksamhet.
                    Dämpad färg av samma skäl: slaget är sammanhang, inte larm. */}
                {h.slag ? <span className="min-w-0 truncate text-sm text-ink-muted">{h.slag}</span> : null}

                {/* ⛔ NÄR OCH DEADLINE HÅLLS IHOP I ETT ELEMENT, inte som två
                    syskon i flexraden. De svarar på samma fråga ur två håll ("hur
                    långt bort" och "vilken dag"), och skulle de wrappa var för sig
                    hamnar datumet på en egen rad under rollbadgen där det läses som
                    ett tredje, obesläktat fält.

                    ⛔ `tabular-nums`: utan den hoppar datumkolumnen i sidled mellan
                    rader, eftersom siffrorna har olika bredd i de flesta typsnitt.
                    Det syns inte på en rad och är omöjligt att sluta se på tio.

                    ⛔ KLUSTRET FÅR EN EGEN RAD PÅ SMALA SKÄRMAR, OCH DET ÄR RÄTT.
                    Mätt i Chromium: vid 390 px har raden ~280 px efter
                    chevronkolumnen (höger), och rollbadge plus slag plus "Om 4 veckor
                    Senast 12 okt" kräver omkring 357. Fyra upplysningar ryms inte,
                    punkt. Vid 768 px och uppåt ryms de och står på en rad.

                    ⛔ Lös det ALDRIG med `flex-nowrap` och trunkering. Räknat på
                    samma mätning får slaget då 31 px, alltså två tecken plus
                    ellips, och en etikett kapad till "Dr..." är sämre än en rad
                    till. Samma avvägning som titeln nedan: text får plats eller får
                    en egen rad, den kapas inte. */}
                {/* ⛔ HÖGERKLUSTRET: när/deadline, uppdaterad, länk. Ett ml-auto
                    för hela gruppen så datum och #183 landar uppe till höger i
                    den kompakta raden (CP: uppdaterad top-right, ärendenummer
                    i stället för "Öppna"). */}
                {h.nar || h.deadline || h.uppdaterad || url ? (
                  <span className="ml-auto flex shrink-0 flex-wrap items-baseline justify-end gap-x-2 gap-y-1 text-sm tabular-nums text-ink-secondary">
                    {h.nar ? <span>{h.nar}</span> : null}
                    {/* ⛔ Dämpad, inte framhävd. Deadline är ett faktum man skriver
                        in i en kalender, inte ett larm: brådskan är redan sagd av
                        märket till vänster, och skulle datumet också ta
                        uppmärksamhet konkurrerar två fält om samma roll. */}
                    {h.deadline ? <span className="text-ink-muted">{h.deadline}</span> : null}
                    {h.uppdaterad ? <span className="text-ink-muted">{h.uppdaterad}</span> : null}
                    {url ? (
                      <a
                        href={url}
                        onClick={(e) => onNavigate?.(url, e)}
                        target={onNavigate ? undefined : "_blank"}
                        rel={onNavigate ? undefined : "noopener noreferrer"}
                        className={cx(
                          "shrink-0 rounded-sm text-sm text-accent underline underline-offset-2 hover:no-underline",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        )}
                      >
                        {/* ⛔ Synlig text är `urlLabel` (#183) eller "Öppna".
                            Skärmläsarnamnet tar alltid med titeln så tio länkar
                            inte uppläses som samma ord. */}
                        <span aria-hidden="true">{h.urlLabel || "Öppna"}</span>
                        <span className="sr-only">
                          {h.urlLabel ? `${h.urlLabel} ${h.titel}` : `Öppna ${h.titel}`}
                        </span>
                      </a>
                    ) : null}
                  </span>
                ) : null}
              </div>

              {/* ⛔ TITELN PÅ EGEN RAD, MED HELA BREDDEN. LÄS DET HÄR INNAN DU
                  LÄGGER TILLBAKA DEN I RADEN OVAN.

                  Den låg förut i samma flexrad som allt annat, med `flex-1`. Det
                  låter rimligt tills man mäter: `flex-1` betyder "ta det som blir
                  över", och det som blev över efter en rollbadge, ett brådskemärke
                  och en datumkolumn var 178 till 196 px av en 390 px bred telefon.
                  Alltså under halva skärmen, för radens enda innehåll som faktiskt
                  är en mening.

                  Följden var att "Attest större leverantörsfakturor" bröts i tre
                  rader à två ord medan halva raden stod tom, och en lista med tio
                  sådana går inte att läsa.

                  ⛔ Detaljerna är korta och tål att trängas. Löptext gör det inte.
                  Därför äger den sin egen rad på ALLA bredder, inte bara under en
                  brytpunkt: en titel som får halva bredden på en smal skärm och
                  hela på en bred är samma komponent med två utseenden, och det är
                  den sortens skillnad som gör att bara den ena blir provad. */}
              <span className="text-ink">{h.titel}</span>

              {/* ⛔ EGEN RAD UNDER TITELN, INTE BREDVID DEN. Samma mätning som
                  titeln bygger på: vid 390 px finns ~280 px kvar efter
                  chevronkolumnen (höger), och en knapp på 90 px hade lämnat 190 px åt
                  titeln. Det var precis det felet titeln en gång flyttades ut ur.

                  ⛔ HÖGERSTÄLLD, så att ögat hittar samma kolumn på varje rad
                  som har en knapp.

                  ⛔ VILLKORET ÄR RADENS EGEN `atgard` OCH INTE `nagonHarAtgard`.
                  Frågade platsen listan skulle varje rad utan knapp rita en tom
                  `div`, alltså betala marginal för något som aldrig syns. */}
              {h.atgard ? <div className="mt-1 flex justify-end">{h.atgard}</div> : null}
              </div>

              {nagonHarDetaljer ? (
                harDetaljer ? (
                  <button
                    type="button"
                    onClick={() => vaxlaOppen(h.id)}
                    aria-expanded={oppen}
                    aria-controls={panelId}
                    className={cx(
                      "flex min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted",
                      "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    )}
                  >
                    <span className="sr-only">
                      {expandLabel} {h.titel}
                    </span>
                    <span aria-hidden="true" className={cx("transition-transform duration-(--duration-fast)", oppen && "rotate-180")}>
                      <ChevronNedIkon size={16} />
                    </span>
                  </button>
                ) : (
                  // ⛔ Tom yta och INTE en utgråad pil (samma regel som vänster var).
                  <span aria-hidden="true" className="w-11 shrink-0" />
                )
              ) : null}
            </div>

            {/* ⛔ PANELEN under raden, full bredd. Chevron står till HÖGER (CP),
                så ingen pl-12-indrag från vänsterkolumn. */}
            {harDetaljer ? (
              <div id={panelId} hidden={!oppen} className="mt-2 text-sm text-ink-secondary">
                {h.detaljer}
              </div>
            ) : null}
            </OpsCard>
          </li>
        );
      })}
    </ul>
  );

  if (!atgardsforklaring) return lista;

  /*
   * ⛔ ÖVER LISTAN OCH INTE UNDER DEN. Förklaringen är något man behöver INNAN
   * man börjar leta efter knappar, och under en lista med tjugo rader hade den
   * lästs av den som redan gett upp.
   */
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-sm text-ink-muted">{atgardsforklaring}</p>
      {lista}
    </div>
  );
}
