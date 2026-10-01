import { useId, useState } from "react";
import { cx } from "../lib/cx.js";
import { slagText } from "../lib/slag.js";
import { urgency } from "../lib/events.js";
import { formatDagOchKlockslag } from "../lib/format.js";
import { laesSkapare } from "../lib/skapare.js";
import { useHandelseOppnare } from "../lib/handelsekontext.js";
import { HandelseLank } from "./HandelseLank.jsx";
import { ChevronNedIkon } from "./icons.jsx";
import { OpsCard } from "./OpsCard.jsx";
import { OpsProvenance } from "./OpsProvenance.jsx";
import { ROLLMARKE_MATT } from "./OpsRollmarke.jsx";
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
 * `actionHint`. Det är inte artighet utan komponentens enda svar på ett
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
 * ⛔ PLATSEN PÅ RADEN RESERVERAS BARA NÄR RADEN HAR EN ÅTGÄRD. En lista utan
 * åtgärder ser ut precis som förut och betalar ingen höjd för en gest som inte
 * finns.
 *
 * ── ⛔ CHEVRONEN TAR INGEN KOLUMN (0.32.1) ───────────────────────────────
 *
 * Fram till 0.32.0 låg chevronen i en egen kolumn på 44 px, 11 procent av en
 * 390 px bred telefon, tagen från titeln: 251 px mot SessionStudios 301 och en
 * rad extra i titeln (CP 2026-09-30 08:04, "Matchar inte det vi har i
 * SessionStudio"). Nu ligger knappen absolut i kortets övre högra hörn, med
 * samma 44 px träffyta, och bara kortets första rad ger plats åt den.
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
 * @param {import("../lib/events.js").OpsEvent[]} props.events
 * @param {(href: string, event: any) => void} [props.onNavigate] Anropas i stället för webbläsarens navigering.
 * @param {string} [props.ariaLabel]
 * @param {{ forsenat?: string, pagar?: string, framat?: string, odaterat?: string }} [props.labels] Orden för de fyra lägena.
 * @param {import("react").ReactNode} [props.empty] Vad som visas när listan är tom. ⛔ Skicka alltid något: tom lista och "allt är gjort" betyder motsatta saker.
 * @param {string} [props.expandLabel] Verb för utfällningsknappens namn, följt av radens titel.
 * @param {import("react").ReactNode} [props.actionHint] En mening om VILKA rader som går
 *   att göra något åt. ⛔ KRÄVS så snart någon rad har en `atgard` och någon annan inte har det.
 * @param {string} [props.skapadAvEtikett] (0.30.0, #173) Orden före namnet i "Skapad av Namn, 29 sep 09:12". Förval "Skapad av".
 * @param {string} [props.sprak] Språket för månadsnamnet i den raden ("sv" eller "en"). Förval "sv".
 * @param {(id: string) => void} [props.onOppnaHandelse] (0.40.0, #214) Vad ett tryck på en rad med `handelseId` gör. Utelämnad: skalets
 *   händelsepanel (`OpsAppShell` `handelsepanel`) öppnas. ⛔ Finns varken propen eller ett skal med panel kastar listan för en rad med `handelseId`:
 *   en rad som ser tryckbar ut och inte gör något är värre än ett fel.
 * @param {{ oppet?: string, pagar?: string, vantar?: string, klart?: string, akut?: string }} [props.statusWords]
 *   Orden för de fem statuslägena. ⛔ KRÄVS för varje status som faktiskt förekommer: en prick
 *   utan ord är en färg som bär betydelsen ensam, och det är osynligt för skärmläsaren och för
 *   ungefär var tjugonde man. Orden är appens, eftersom bara den vet vad `waiting` betyder hos
 *   just den: "väntar på motpart" i ett ops-flöde och "väntar på granskning" i nästa.
 */
export function OpsEventList({
  events,
  onNavigate,
  ariaLabel,
  labels = {},
  empty = null,
  expandLabel = "Visa detaljer för",
  actionHint = null,
  skapadAvEtikett = "Skapad av",
  sprak = "sv",
  statusWords = {},
  onOppnaHandelse,
}) {
  // ⛔ BARA FÖRSENAT FÅR ETT ORD SOM STANDARD, och det följer direkt av
  // TONER ovan: försenat är det enda läget som lånar larmfärgen, alltså det
  // enda där färgen skulle bära betydelse ensam.
  //
  // De andra tre får sitt sammanhang ur `when` ("Pågår (15-20)", "Om 3 dagar").
  // Första versionen satte `pagar: "Nu"`, och raden sade då både "Nu" och
  // "Pågår (15-20)" bredvid varandra: samma faktum två gånger, vilket får
  // läsaren att leta efter skillnaden.
  //
  // En app som VILL ha ett ord på de andra skickar det själv.
  const word = {
    forsenat: labels.forsenat ?? "Försenat",
    pagar: labels.pagar ?? "",
    framat: labels.framat ?? "",
    odaterat: labels.odaterat ?? "",
  };

  const [open, setOpen] = useState(/** @type {string[]} */ ([]));
  const idBas = useId();
  const oppnaHandelse = useHandelseOppnare(onOppnaHandelse);

  // ⛔ FÖRE `events`-vakten, för hookar får inte hoppas över. Låg `useState`
  // efter den tidiga returen skulle React se olika många hookar beroende på om
  // listan är tom, och kasta första gången en lista fylls på.
  if (!events || events.length === 0) return empty;

  // Frågar raderna själva i stället för att ta en prop.
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
   * Orden kan inte ha ett standardvärde här. `waiting` betyder "hos en motpart"
   * i ett ops-flöde och "hos en granskare" i nästa, och ett ramverksord hade
   * blivit fel i den ena appen utan att någon märkte det.
   */
  /** @type {("oppet"|"pagar"|"vantar"|"klart"|"akut")[]} */
  const statusar = [];
  for (const e of events) if (e && e.status) statusar.push(e.status);
  const withoutWords = [...new Set(statusar)].filter((st) => !statusWords[st]);
  if (withoutWords.length > 0) {
    throw new Error(
      `OpsEventList: rader har status ${withoutWords.join(", ")} men statusWords saknar ordet. En färgad prick utan ord bär betydelsen ensam, och då är statusen osynlig för skärmläsaren.`,
    );
  }

  if (nagonHarAtgard && events.some((e) => e && !e.atgard) && !actionHint) {
    throw new Error(
      "OpsEventList: några rader har en action och andra inte, men listan saknar actionHint. En lista där vissa rader går att göra något åt och andra ser likadana ut lär den som läser att trycka på måfå.",
    );
  }

  const utanOppnare = events.filter((e) => e && e.handelseId && !oppnaHandelse);
  if (utanOppnare.length > 0) {
    throw new Error(
      `OpsEventList: ${utanOppnare.length} rad(er) har handelseId men det finns ingenting som öppnar en händelse. Skicka \`handelsepanel\` till OpsAppShell, eller \`onOppnaHandelse\` till listan. Raden ser tryckbar ut, och en rad som inte gör något lär den som tryckt att inget i listan gör något.`,
    );
  }

  /** @param {string} id */
  const vaxlaOppen = (id) => setOpen((f) => (f.indexOf(id) >= 0 ? f.filter((x) => x !== id) : [...f, id]));

  // ⛔ VARJE HÄNDELSE ÄR ETT EGET OpsCard, inte en divider-rad i ett delat
  // kort. CP (bolag-ops Idag): två kundfakturor i "kräver dig nu" låg i ETT
  // mörkt kort med streck emellan; Inkorg har redan ett kort per post med
  // gap-3. Samma mönster här så Idag/Kommande och Inkorg läses likadant.
  const list = (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label={ariaLabel}>
      {events.map((h) => {
        const state = urgency(h);
        const marke = word[state];
        // ⛔ Bunden till en const och inte läst som `h.url` i klickhanteraren:
        // TypeScript smalnar inte av ett fält inuti en closure, så `h.url` är
        // `string | undefined` där även om raden bara renderas när den finns.
        const url = h.url;
        const oppen = open.indexOf(h.id) >= 0;
        const panelId = `${idBas}-${h.id}`;
        const harDetaljer = Boolean(h.details);
        // 0.32.1: chevronen tar ingen kolumn längre, så en rad utan detaljer behöver ingen tom plats.
        const harChevron = harDetaljer;
        const harPillrad = Boolean(h.status || h.role || marke || h.kind);
        const harDatumrad = Boolean(h.when || h.deadline || h.updatedAt || url);
        // ⛔ Samma ton som kortets kant och kalenderns prick, ur en källa.
        const slagfarg = slagText(h.slag, h.slagLabel, "OpsEventList");

        return (
          <li key={h.id}>
            {/*
              ⛔ EN BUBBLA OCH INTE EN RUTA. CP 2026-09-22: "Samma mjuka
              SS-rundning på alla händelsebubblor." En händelse är ett objekt i
              en ström, inte en panel på en sida, och 24 px mot 8 säger det utan
              ett ord.

              ⛔ CP 2026-09-30 valde 24 px som SS. `bubbla` hade hunnit bli 28 px
              (`rounded-3xl`) medan SS kort är `--radius-card`, 24 px (`.rounded-app
              .rounded-2xl`, SS `index.css:228`), och kortets förval `kort` bär just
              `--radius-card`. Därför inget `rounding` här längre. Radien mäts i
              check-skalyta avsnitt 25 (24 +- 0,5).

              ⛔ KANTEN SLÄPPS IGENOM, DEN BYGGS INTE HÄR. `OpsCard` har haft en
              färgad vänsterkant hela tiden, med kravet på ett ord inbyggt.
              Listan gjorde den bara inte nåbar, så varje yta som ville visa
              slaget som en kant hade fått rita sin egen. Att lägga till två
              rader här är hela skillnaden.
            */}
            <OpsCard edge={h.edge} edgeLabel={h.edgeLabel} slag={h.slag} slagLabel={h.slagLabel}>
            {/*
              ⛔ 0.32.1: INGEN CHEVRONKOLUMN. CP 2026-09-30 08:04: "Kolla storleken och fint på texten i händelserna.
              Matchar inte det vi har i SessionStudio." Titeln var redan 18/700 som SS, felet låg i kompositionen: en
              44 px bred chevronkolumn till höger tog bredden från hela kortet, så titeln fick 251 px mot SS 301 vid
              390 px och en rad extra. Nu ligger knappen absolut i kortets övre högra hörn (samma 44 px träffyta, men
              ingen layoutbredd), och bara den första raden ger plats åt den (`pr-9`). Titeln har kortets hela innerbredd.
            */}
            <div className="relative flex min-w-0 flex-col gap-y-0.5">
              {/* Pillraden: status, roll, brådska och slag. Korta märken som tål att trängas. SS har ingen sådan rad
                  (ramverkets tillägg, se docs/jamforelser/0.32.1). */}
              {harPillrad ? (
              <div className={cx("flex flex-wrap items-center gap-x-2 gap-y-1", harChevron && "pr-9")}>
                {/* ⛔ FÖRST I RADEN, OCH DEN SYNS ÄVEN NÄR KORTET ÄR IHOPFÄLLT.
                    CP (bolag-ops #249): status ska vara en färgprick i kortets
                    header. Ligger den i utfällningen svarar den bara den som
                    redan öppnat kortet, och frågan "vad väntar på någon annan"
                    ställs när man SKUMMAR listan, inte när man läser en rad.

                    Före rollen, eftersom ögat läser vänsterifrån och pricken är
                    det grövsta beskedet: vad som händer med raden alls, före vem
                    som ska göra något åt den. */}
                {/* ⛔ `|| ""` är inte en nedsläppsväg: vakten ovanför har redan
                    kastat om ordet saknas. Den står här för att `statusWords` är
                    en valfri karta i typen, och en tom sträng får `OpsStatusDot`
                    att kasta i stället för att rita en stum prick, om någon
                    skulle ta bort vakten. */}
                {h.status ? <OpsStatusDot status={h.status} label={statusWords[h.status] || ""} /> : null}

                {h.role ? <span className="shrink-0 text-meta">{h.role}</span> : null}

                {/* ⛔ BRÅDSKAN HAR SAMMA MÅTT SOM ROLLMÄRKET (`ROLLMARKE_MATT`, 0.32.1): de står bredvid varandra. */}
                {marke ? <span className={cx(ROLLMARKE_MATT, TONER[state])}>{marke}</span> : null}

                {/* ⛔ SLAGET ÄR TEXT, INTE ETT TREDJE FÄRGAT MÄRKE.
                    Raden bär redan en rollbadge och ibland ett brådskemärke. Ett
                    tredje piller hade gjort den till ett klistermärkesalbum där
                    ögat inte vet vilket märke som betyder mest, och brådskan är det
                    enda som ska kunna ta uppmärksamhet.
                    Dämpad färg av samma skäl: slaget är sammanhang, inte larm. */}
                {/* ⛔ IKONEN FÖRE ORDET, OCH BARA NÄR APPEN SKICKAT EN.
                    CP 2026-09-24: "Bra om ikonen syns i listan också, både på
                    ärenden och i inkorg på samma sätt."

                    Ikonen är samma som står i filtrets meny för samma slag, och
                    det är hela poängen: man ska känna igen det man filtrerade
                    fram utan att läsa. Ordet står kvar bredvid, eftersom en
                    ensam ikon är en gåta för den som inte lärt sig den.

                    ⛔ FÄRGEN KOMMER UR SLAGET, inte ur en klass appen hittar på.
                    Samma ton som kortets kant och kalenderns prick, ur
                    `lib/slag.js`. Skiljer de sig säger vyn emot sig själv. */}
                {h.kind ? (
                  <span className="flex min-w-0 shrink-0 items-center gap-1 text-meta text-ink-muted">
                    {h.kindIcon ? (
                      <span aria-hidden="true" className={cx("flex shrink-0 items-center", slagfarg)}>
                        {h.kindIcon}
                      </span>
                    ) : null}
                    <span className="min-w-0 truncate">{h.kind}</span>
                  </span>
                ) : null}

              </div>
              ) : null}

              {/* ⛔ DATUMRADEN FÖRE TITELN OCH VÄNSTERSTÄLLD, SOM SS (0.32.1, `TodayView.jsx:527`: `text-xs sm:text-sm`,
                  dämpad, direkt ovanför titeln). Före 0.32.1 var den en `ml-auto`-grupp i pillraden, och när den bröt till
                  en egen rad vid 390 px hamnade den högerställd och såg indragen ut. Den får aldrig vara högerställd.

                  ⛔ NÄR OCH DEADLINE HÅLLS IHOP I ETT ELEMENT: de svarar på samma fråga ur två håll ("hur långt bort"
                  och "vilken dag"). `tabular-nums` så att siffrorna inte hoppar i sidled mellan rader.

                  ⛔ Lös aldrig trängsel med `flex-nowrap` och trunkering: text får plats eller får en rad till. */}
              {h.when || h.deadline || h.updatedAt || url ? (
                <div className={cx("flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta tabular-nums text-ink-muted", harChevron && !harPillrad && "pr-9")} data-datumrad="">
                  {h.when ? <span>{h.when}</span> : null}
                  {h.deadline ? <span>{h.deadline}</span> : null}
                  {h.updatedAt ? <span>{h.updatedAt}</span> : null}
                    {url ? (
                      <a
                        href={url}
                        onClick={(e) => onNavigate?.(url, e)}
                        target={onNavigate ? undefined : "_blank"}
                        rel={onNavigate ? undefined : "noopener noreferrer"}
                        className={cx(
                          "relative z-10 shrink-0 rounded-sm text-meta text-accent underline underline-offset-2 hover:no-underline",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        )}
                      >
                        {/* ⛔ Synlig text är `urlLabel` (#183) eller "Öppna".
                            Skärmläsarnamnet tar alltid med titeln så tio länkar
                            inte uppläses som samma ord. */}
                        <span aria-hidden="true">{h.urlLabel || "Öppna"}</span>
                        <span className="sr-only">
                          {h.urlLabel ? `${h.urlLabel} ${h.title}` : `Öppna ${h.title}`}
                        </span>
                      </a>
                    ) : null}
                </div>
              ) : null}

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
              {/* ⛔ 0.33.1: BESLUTET ÄNDRAT, OCH VARFÖR. CP 2026-09-30 i #187: "Textstorlek och typsnitt på händelserna ska matcha det inkorgen
                  har nu, inte ett eget större/tyngre utseende." Titeln var 18/700 (SS `TodayView.jsx:89`, 0.31.2 och 0.32.1) och är nu 14/500
                  (`text-etikett font-medium`), datumraden 12 (`text-meta`) i alla bredder, pillren 10/500 (`OpsPill size="liten"`, `ROLLMARKE_MATT`).
                  Det är inkorgsradens skala (bolag-ops `InboxView.jsx`, SS `ChatInboxPanel.jsx:735-745`). CP:s önskan går före SS-förebilden
                  i den här punkten; raderna nedanför står kvar som historik (metaregeln), men gäller inte längre. Titelns fulla bredd,
                  datumraden först och radien 24 är oförändrade. */}
              {/* ⛔ 0.31.2: SS `text-lg sm:text-xl font-bold` (`TodayView.jsx:89`): 18 px under sm, 20 px från sm (`titel` och `sida`). Metaraden ovanför är SS `text-xs sm:text-sm` (`:83/86`): 12 px under sm, 14 px från sm. */}
              {/* ⛔ 0.31.2: SS `text-lg sm:text-xl font-bold` (`TodayView.jsx:89`): 18 px under sm, 20 px från sm (`titel` och `sida`). */}
              {/* ⛔ 0.40.0 (#214): EN RAD SOM ÄR EN HÄNDELSE ÄR HELA KORTET SOM EN LÄNK, och länken är TITELN. Det är SS beteende (`TodayView.jsx`: kortet är
                  tryckbart och öppnar händelsen) utan att kortet blir en knapp med knappar inuti: en länk i titeln har ett riktigt namn (titeln), en
                  riktig adress (`?handelse=<id>`, går att öppna i en ny flik) och sin egen fokusring. Dess `::after` täcker hela kortet (`-inset` lika med
                  kortets padding), så ett tryck var som helst på kortet öppnar. Kontrollerna på kortet (åtgärden, utfällningen, länken) har `z-10` och tar
                  sina egna tryck. Utan `handelseId` är titeln text som förut. */}
              <span className={cx("text-etikett font-medium text-ink", harChevron && !harPillrad && !harDatumrad && "pr-9")} data-titel="">
                {h.handelseId && oppnaHandelse ? (
                  <HandelseLank id={h.handelseId} oppna={oppnaHandelse} tacker="after:-inset-(--card-padding) after:rounded-[var(--radius-card)]">
                    {h.title}
                  </HandelseLank>
                ) : (
                  h.title
                )}
              </span>

              {/* ⛔ VEM OCH NÄR, OM BÅDA FINNS (0.30.0, #173, CP 2026-09-29: "vem
                  som skapade"). Under titeln och inte i detaljraden ovanför: det
                  är inte ett tillstånd (brådska, status) utan ett faktum om
                  posten, och det ska stå kvar även när kortet är hoppfällt.
                  ⛔ EN MÄNNISKA OCH EN AGENT SER OLIKA UT, med orden (`OpsProvenance`
                  skriver ut dem): "Skapad av" följt av ett namn läses annars som
                  en människa, och en agent som skapat 40 poster i natt är just det
                  man vill kunna se på en gång. En okänd sorts skapare (`okand`,
                  äldre rader) är vanlig text, inte en påhittad roll. */}
              {skapadRad(h, skapadAvEtikett, sprak)}

              {/* ⛔ EGEN RAD UNDER TITELN, INTE BREDVID DEN: en knapp på 90 px bredvid titeln tar bredden titeln en
                  gång flyttades ut för att få.

                  ⛔ HÖGERSTÄLLD, så att ögat hittar samma kolumn på varje rad som har en knapp.

                  ⛔ VILLKORET ÄR RADENS EGEN `atgard` OCH INTE `nagonHarAtgard`. Frågade platsen listan skulle varje rad
                  utan knapp rita en tom `div`, alltså betala marginal för något som aldrig syns. */}
              {h.atgard ? <div className="relative z-10 mt-1 flex justify-end">{h.atgard}</div> : null}

              {harChevron ? (
                <button
                  type="button"
                  onClick={() => vaxlaOppen(h.id)}
                  aria-expanded={oppen}
                  aria-controls={panelId}
                  className={cx(
                    // ⛔ 44 px träffyta som förut, men absolut: den tar ingen bredd från titeln. Negativ förskjutning så
                    // att ikonen (16 px) linjerar med pillradens högerkant och inte hamnar 14 px in i kortet.
                    "absolute -top-3 -right-3 z-10 flex size-11 cursor-pointer items-center justify-center rounded-md text-ink-muted",
                    "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  )}
                >
                  <span className="sr-only">
                    {expandLabel} {h.title}
                  </span>
                  <span aria-hidden="true" className={cx("transition-transform duration-(--duration-fast)", oppen && "rotate-180")}>
                    <ChevronNedIkon size={16} />
                  </span>
                </button>
              ) : null}
            </div>

            {/* ⛔ PANELEN under raden, full bredd. */}
            {harDetaljer ? (
              <div id={panelId} hidden={!oppen} className="mt-2 text-etikett text-ink-secondary">
                {h.details}
              </div>
            ) : null}
            </OpsCard>
          </li>
        );
      })}
    </ul>
  );

  if (!actionHint) return list;

  /*
   * ⛔ ÖVER LISTAN OCH INTE UNDER DEN. Förklaringen är något man behöver INNAN
   * man börjar leta efter knappar, och under en lista med tjugo rader hade den
   * lästs av den som redan gett upp.
   */
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-etikett text-ink-muted">{actionHint}</p>
      {list}
    </div>
  );
}


/**
 * Raden "Skapad av Namn, 29 sep 09:12", eller `null` när posten saknar någon av delarna.
 * @param {import("../lib/events.js").OpsEvent} h
 * @param {string} etikett
 * @param {string} sprak
 */
function skapadRad(h, etikett, sprak) {
  if (!h.skapadAv || !h.skapad) return null;
  const skapare = laesSkapare(h.skapadAv);
  if (!skapare.namn) return null;
  const rad = `${etikett} ${skapare.namn}, ${formatDagOchKlockslag(h.skapad, { locale: sprak })}`;
  if (skapare.typ === "manniska" || skapare.typ === "agent") {
    return (
      <span className="mt-0.5 flex">
        <OpsProvenance kind={skapare.typ === "agent" ? "agent" : "human"} label={rad} />
      </span>
    );
  }
  return <span className="text-hjalp text-ink-muted">{rad}</span>;
}
