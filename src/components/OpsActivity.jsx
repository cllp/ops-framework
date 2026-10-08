import { useState } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import * as Popover from "@radix-ui/react-popover";
import { cx } from "../lib/cx.js";
import { activityId, activityWindow, groupByDay, unread, unreadRows } from "../lib/aktivitet.js";
import { formatDateTime, formatRelativeDate, formatTime } from "../lib/format.js";
import { text } from "../lib/sprak.js";
import { radBehallare, radKlass } from "../lib/radKlass.js";
import { slagKant } from "../lib/slag.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsPanel } from "./OpsPanel.jsx";
import { ChevronNedIkon, MerIkon, ReglageIkon } from "./icons.jsx";
import { OpsCountBadge } from "./counter.jsx";

/**
 * Aktiviteten: vad som kördes, när, och vad det ändrade.
 *
 * ══ ⛔ VAD DEN SVARAR PÅ ════════════════════════════════════════════════
 *
 * CP (bolag-ops): "notiser i appen som visar aktivitet. När saker kördes och
 * hamnade där … En integration kördes mot LF och uppdaterade ekonomiposter."
 *
 * Frågan är inte "vad är sant nu", den ställer resten av appen. Den här ställer
 * **hände något, och gick det bra?** Utan svaret ser en app som hämtar i
 * bakgrunden likadan ut oavsett om hämtningen kördes i morse eller gick sönder
 * i förrgår, och ett tal som ser färskt ut går inte att skilja från ett som är
 * gammalt.
 *
 * ══ ⛔ #158, CP:S SKÄRMBILDSJÄMFÖRELSE MOT SESSIONSTUDIO 2026-09-28 ═════
 *
 * "I mobile ops står Aktivitet två gånger och känns bara inget najs. Filter
 * högerställt och fult. [...] med en chevron down (expand) för detalj eftersom
 * notisen inte leder någonstans om det inte är en länk."
 *
 * Fyra mätta skillnader mot SessionStudios `ActivityFeedPanel.jsx`, alla
 * åtgärdade i den här filen:
 *
 *   1. RUBRIKEN STOD TVÅ GÅNGER PÅ MOBIL. Roten i `OpsPanel` ritade sin egen
 *      `OpsPanelHeader` MED SAMMA TEXT som sheetens egen `Dialog.Title`, av
 *      samma skäl, samma ord ("Aktivitet"). Fixet ligger i `OpsPanel.jsx`
 *      (roten har ingen egen rubrik på smal skärm längre); den här filen
 *      förlitar sig på fixet i stället för att kompensera lokalt.
 *   2. "NY" VAR EN PILL, SESSIONSTUDIO ANVÄNDER EN PUNKT. En pill konkurrerar
 *      om samma uppmärksamhet som "Gick fel" gör med flit; en punkt är en
 *      status, inte ett larm.
 *   3. RADEN ÖPPNADE EN NY VY I EN STACK. Notisen leder ofta ingenstans (inget
 *      GitHub-ärende, ingen händelse att peka på), och en pil som lovar en
 *      sida man kan gå TILL är fel löfte då. En chevron ned faller ut detaljen
 *      PÅ PLATS, under raden, och en länk-knapp ritas bara när `handelse.lank`
 *      finns.
 *   4. FILTREN STOD OVANFÖR LISTAN, HÖGERSTÄLLDA. De flyttar bakom en
 *      filterknapp i huvudet (samma `ReglageIkon` som `OpsFilterChip`), och
 *      "Rensa" flyttar till en trepunktsmeny bredvid den. Ingendera syns
 *      förrän man tryckt på sin knapp.
 *
 * ══ ⛔ LISTA, SEDAN DETALJ, OCH DÅ ÄR DEN LÄST ══════════════════════════
 *
 * CP: "jag skall ju också kunna rensa loggen eller trycka på en notis/aktivitet
 * och markera som läst. Tänker en lista och sedan en detalj, då är den läst."
 *
 * ⛔ ATT ÖPPNA ÄR HANDLINGEN, INTE EN KRYSSRUTA. En egen "markera som läst"
 * bredvid varje rad är ett andra klick för något man just gjort, och listor med
 * den knappen lär folk att bocka av utan att läsa. Det gäller oförändrat även
 * när "öppna" numera betyder "fälla ut på plats" i stället för "byt vy".
 *
 * ══ ⛔ "LÄST" ÄR LÄSARENS EGENSKAP, MEN INTE NÖDVÄNDIGTVIS WEBBLÄSARENS ══
 *
 * Komponenten kan skötas på två sätt, och skillnaden är var läsningen bor:
 *
 *  - **Appen styr** (`lasning` + `onSeen`/`onRead`): läsningen ligger där appen
 *    lägger den, till exempel i databasen. Då följer den med mellan telefon och
 *    dator, vilket är vad man vill när samma människa använder båda.
 *  - **Komponenten sköter det själv** (`storageKey`): läsningen ligger i
 *    `localStorage`, alltså i EN webbläsare. Enklare, och fel så fort det finns
 *    två enheter.
 *
 * ⛔ Ramverket väljer INTE åt appen. Var läsningen hör hemma beror på om appen
 * har en plats att lägga den, och det vet bara appen. Den här delningen och
 * datamodellen (`lasning`, `onSeen`, `onRead`) är OFÖRÄNDRADE av #158: det
 * ärendet är ytan, inte källan.
 *
 * ⛔ `localStorage` KASTAR i privat läge och när webbplatsdata är blockerad.
 * Läses den utan try blir en notisikon anledningen att hela sidan vitnar, och
 * det är en dyr växel för en siffra på en prick.
 */

/** @param {string | undefined} key */
function lastSedd(key) {
  if (!key) return null;
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** @param {string | undefined} key @param {string} value */
function sparaSedd(key, value) {
  if (!key) return;
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // ⛔ Tyst med flit. Att märket inte minns är en olägenhet; att sidan faller
    // för att en webbläsare blockerar lagring är ett fel.
  }
}

/**
 * En rad i listan.
 *
 * ⛔ BÅDE RELATIV OCH EXAKT TID. "för 2 timmar sedan" är det man läser, och det
 * går inte att jämföra med något: den som undrar om importen kördes före eller
 * efter en ändring behöver klockslaget.
 *
 * ⛔ "OLÄST" ÄR EN PUNKT OCH INTE ETT ORD I EN PILL (#158). SessionStudio
 * ritar en punkt vid raden, inte en etikett. Ordet finns kvar, men bara för
 * skärmläsaren (`sr-only`): en färgad prick ensam är osynlig för den som
 * lyssnar, och arbetsreglernas egen regel ("ordet och inte bara en färg")
 * gäller lika mycket för "oläst" som för "Gick fel" på raden nedanför.
 *
 * ⛔ HELA RADEN ÄR KNAPPEN, och den fäller ut detaljen PÅ PLATS i stället för
 * att byta vy (#158, punkt 3 ovan). Chevronen roterar med samma mönster som
 * `OpsFilterChip` redan använder, så "öppen" ser likadant ut överallt i
 * ramverket.
 *
 * @param {{ handelse: any, slagord: string, marke?: string | null, slagIkon?: import("react").ReactNode, ny?: boolean, onOpen?: () => void }} props
 */
function Rad({ handelse, slagord, marke, slagIkon, ny, onOpen }) {
  const [expanderad, setExpanderad] = useState(false);
  const trasig = handelse.resultat === "fel";

  /** Fäller ut/in. Markerar läst bara när raden ÖPPNAS, inte när den stängs. */
  function vaxla() {
    const nasta = !expanderad;
    setExpanderad(nasta);
    if (nasta) onOpen?.();
  }

  const innehall = (
    <>
      {/* ⛔ RUBRIKEN BÄR VIKTEN ENSAM. CP 2026-09-25: "Rubrik, undertext och
          metarad har för lika vikt; raderna blir en vägg." Tre nivåer nu:
          `text-sm font-semibold ink`, `text-sm ink-secondary`, `text-xs
          ink-muted`. Samma skala som resten av ramverket. */}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {ny ? (
          <>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
            <span className="sr-only">Oläst.</span>
          </>
        ) : null}
        {/* ⛔ ORDET OCH INTE BARA EN FÄRG. Ett misslyckande som bara syns som en
            röd ton går inte att läsa upp och är osynligt för var tjugonde man. */}
        {trasig ? <span className="text-meta font-semibold text-danger">Gick fel</span> : null}
        <span className="text-etikett font-semibold text-ink">{handelse.rubrik}</span>
      </span>

      {handelse.detalj ? <span className="text-etikett text-ink-secondary">{handelse.detalj}</span> : null}
      {trasig && handelse.fel ? <span className="text-etikett text-danger">{handelse.fel}</span> : null}

      <span className="flex flex-wrap items-center gap-x-2 text-meta text-ink-secondary">
        {/* ⛔ GRUPPEN SOM `OpsIdentity`, INTE SOM RÅ TEXT (#158). SessionStudios
            metarad bär en GroupMark bredvid gruppnamnet; `OpsIdentity` är
            ramverkets motsvarighet och redan använd för precis den rollen i
            `OpsMeny`. */}
        {handelse.grupp ? (
          <span className="flex items-center gap-1">
            <OpsIdentity name={handelse.grupp.namn} seed={handelse.grupp.id || handelse.grupp.namn} imageUrl={handelse.grupp.bild} size="sm" />
            {handelse.grupp.namn}
          </span>
        ) : null}
        {handelse.aktor ? <span>{handelse.aktor}</span> : null}
        {/* ⛔ KLOCKSLAG, INTE "I DAG". Raden står redan under en dagsrubrik, så
            dagen är sagd. Med "i dag" på varje rad går två poster samma dag inte
            att ordna, vilket är just det man vill veta. Det exakta datumet finns
            kvar i `title` för den som hovrar. */}
        <time dateTime={handelse.nar} title={formatDateTime(handelse.nar)}>
          {formatTime(handelse.nar)}
        </time>
        {slagord ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{slagord}</span>
          </>
        ) : null}
        {/* ⛔ MÄRKET FÖR EN MODULS SLAG (0.55.0, #244 beslut A): «från Ekonomi», så att en körning en modul gjort inte kan
            förväxlas med ett av gruppens egna slag. Samma tydlighetsregel som typbidragen, och märket härleds av appen med
            `typmarke`, aldrig skrivet för hand. */}
        {marke ? (
          <>
            <span aria-hidden="true">·</span>
            <span data-aktivitet-marke="">{marke}</span>
          </>
        ) : null}
      </span>
    </>
  );

  /* ⛔ MATT VÄNSTERKANT PER SLAG, samma som hubbens händelsebubblor. Ett fyllt
     chip hade krävt en egen ytfärg per slag med godkänd kontrast mot sin text,
     alltså sex tokens till; kanten bär samma upplysning med noll nya. */
  const kant = handelse.slag && handelse.slagPlats
    ? slagKant(handelse.slagPlats, slagord || handelse.slag, "OpsActivityList")
    : null;

  return (
    <li className={cx("border-t border-divider first:border-t-0", kant && cx("border-l-2 pl-2", kant))}>
      <div className="flex w-full items-start gap-2 py-2.5">
        {/* ⛔ IKONEN I EN RUND PLATTA (#158). SessionStudios rad börjar med
            händelsens slag som en ikon i en rund platta, avläst ur
            `kindIcon`, appens motsvarighet till `kindLabel`. Saknas ikonen
            ritas ingen platta: en tom cirkel hade varit dekor utan betydelse. */}
        {slagIkon ? (
          <span aria-hidden="true" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
            {slagIkon}
          </span>
        ) : null}
        <button
          type="button"
          onClick={vaxla}
          aria-expanded={expanderad}
          className={cx(
            "flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-sm px-1 text-left",
            "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">{innehall}</span>
          <span aria-hidden="true" className={cx("mt-1 flex shrink-0 items-center text-ink-muted transition-transform duration-(--duration-fast)", expanderad && "rotate-180")}>
            <ChevronNedIkon size={16} />
          </span>
        </button>
      </div>
      {expanderad ? (
        <div className="border-t border-divider py-3 pr-1 pl-1">
          <OpsActivityDetail handelse={handelse} slagord={slagord} marke={marke} />
        </div>
      ) : null}
    </li>
  );
}

/**
 * En rad i sin helhet: allt som står på dokumentet, utan kapning.
 *
 * ⛔ DETALJEN FINNS FÖR ATT LISTAN INTE FÅR VARA HELA SANNINGEN. Listan är kort
 * med flit, och det som inte ryms där, alltså källan, det exakta klockslaget och
 * hela feltexten, är precis det man behöver den dag något gick sönder.
 *
 * ⛔ LÄNK-KNAPPEN RITAS BARA NÄR HÄNDELSEN BÄR EN LÄNK (#158). CP: "eftersom
 * notisen inte leder någonstans om det inte är en länk till händelse, inkorg
 * eller GitHub-ärende." En rad utan `handelse.lank` visar sitt innehåll här och
 * lämnar ingenstans, och säger det inte heller: den ritar bara det den har.
 *
 * @param {{ handelse: any, slagord: string, marke?: string | null, nu?: Date | number }} props
 */
export function OpsActivityDetail({ handelse, slagord, marke, nu }) {
  const h = handelse || {};
  const trasig = h.resultat === "fel";

  const fakta = [
    ["När", formatDateTime(h.nar)],
    ["Sedan dess", formatRelativeDate(h.nar, nu ? { now: nu } : undefined)],
    ["Slag", [slagord || h.slag || "", marke || ""].filter(Boolean).join(", ")],
    ["Jobb", h.kalla || ""],
    // ⛔ UTFALLET STÅR BARA NÄR DET GICK BRA. Ett misslyckande säger det redan
    // med rött ord överst och med feltexten i rutan; en tredje "Gick fel" i
    // faktalistan är samma besked en gång för mycket, och den som läser upp
    // sidan hör det tre gånger.
    ...(trasig ? [] : [["Utfall", "Gick igenom"]]),
  ].filter(([, v]) => String(v || "").trim());

  return (
    <div className="flex flex-col gap-4">
      {/* ⛔ RUBRIK OCH DETALJ RITAS INTE HÄR (0.87.0, #321). CP 2026-10-07, lifehub.app#119: "När man expanderar en post
          i aktivitet så står rubrik och text dubbelt." Raden ovanför visar redan båda. Utfällningen är det raden inte
          har: exakt tid, källa, utfall, felrutan och länken. */}
      {trasig ? <span className="text-etikett font-semibold text-danger">Gick fel</span> : null}

      {trasig && h.fel ? (
        /* ⛔ FELTEXTEN I SIN HELHET OCH I EN KODRUTA. Den kommer ordagrant från
           ett API eller ett undantag, och den som ska söka på den behöver den
           oförvanskad. Kapad i en lista är den en ledtråd; hel här är den ett
           svar. */
        <pre className="m-0 overflow-x-auto rounded-md bg-sunken p-3 text-etikett whitespace-pre-wrap text-danger">{h.fel}</pre>
      ) : null}

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-etikett">
        {fakta.map(([namn, varde]) => (
          <div key={namn} className="contents">
            <dt className="text-ink-secondary">{namn}</dt>
            <dd className="m-0 text-ink-secondary">{varde}</dd>
          </div>
        ))}
      </dl>

      {h.lank ? (
        <div>
          <OpsButton href={h.lank.href} newTab variant="secondary" size="sm">
            {h.lank.etikett}
          </OpsButton>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Listan, utan knapp och utan ruta.
 *
 * ⛔ EXPORTERAS SEPARAT så en app kan lägga aktiviteten på en egen sida i
 * stället för bakom ikonen. Knappen är ett sätt att komma åt listan, inte
 * listans enda hem.
 *
 * ⛔ DELAS I IDAG, IGÅR, DENNA VECKA OCH ÄLDRE (#158). Skälet i sin helhet står
 * vid `groupByDay`. Kort: ett nattligt jobb skriver en rad om dagen, och efter
 * en månad är en platt lista trettio likadana rader.
 *
 * @param {object} props
 * @param {any[]} props.entries Nyast först. ⛔ Appen sorterar: den vet vilken klocka som gäller.
 * @param {(slag: string) => string} [props.kindLabel]
 * @param {(slag: string) => string | null} [props.kindMarke] (0.55.0, #244) Märket för ett slag en modul bidragit med, «från Ekonomi».
 *   `null` för gruppens egna slag. Appen härleder det med `typmarke(typenForRad(slag, "aktivitet", ctx))`.
 * @param {(slag: string) => import("react").ReactNode} [props.kindIcon] Ikonen i den runda plattan (#158).
 *   Saknas den för ett slag ritas ingen platta på just den raden.
 * @param {import("react").ReactNode} [props.empty]
 * @param {{ sedd?: string | null, lasta?: Iterable<string> | null }} [props.lasning] Vad som räknas som läst.
 * @param {(handelse: any) => void} [props.onOpen] Utan den går raderna inte att fälla ut som lästa.
 * @param {number} [props.fler] Hur många som ligger bakom "Hämta fler". Noll döljer knappen.
 * @param {() => void} [props.onMore]
 * @param {Date | number} [props.now] Bara för prov.
 * @param {string} [props.sprak] Språket avsnittsrubrikerna (Idag, Igår, ...) ritas på.
 *   ⛔ SAMMA PROP SOM `OpsProfil` TAR, av samma skäl: `ACTIVITY_SECTIONS` är
 *   ramverkets egna ord sedan #109/#157/#158-passet, ett `{ sv, en }` per
 *   avsnitt, och `text()` läser ut rätt språk. Standardar till svenska, precis
 *   som `text()` själv gör.
 */
export function OpsActivityList({ entries, kindLabel, kindMarke, kindIcon, empty, lasning, onOpen, fler = 0, onMore, now, sprak: sprakProp }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const rader = entries || [];

  if (rader.length === 0) {
    /* ⛔ TOM LOGG OCH "INGET HAR KÖRTS" ÄR SAMMA SAK HÄR, och det är sant: raden
       skrivs när jobbet kört. Appen får säga det med egna ord, för vad tomt
       BETYDER beror på vilka jobb den har. */
    return empty ?? <OpsEmpty title="Inget har hänt än" description="Här står vad som kördes och när, så fort något gjort det." />;
  }

  const avsnitt = groupByDay(rader, now ? { nu: now } : undefined);

  return (
    <div className="flex flex-col gap-5">
      {avsnitt.map((a) => (
        <section key={a.value}>
          {/* ⛔ EN RIKTIG RUBRIK OCH INTE EN FET RAD. Den som hoppar mellan
              rubriker i en skärmläsare ska kunna gå till "Idag" direkt. */}
          <h3 className="mb-2 text-etikett font-semibold text-ink-secondary">{text(a.label, sprak)}</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {a.rader.map((h) => (
              <Rad
                key={activityId(h)}
                handelse={h}
                slagord={kindLabel ? kindLabel(h.slag) : ""}
                marke={kindMarke ? kindMarke(h.slag) : null}
                slagIkon={kindIcon ? kindIcon(h.slag) : null}
                ny={lasning ? unread(h, lasning) : false}
                onOpen={onOpen ? () => onOpen(h) : undefined}
              />
            ))}
          </ul>
        </section>
      ))}

      {fler > 0 && onMore ? (
        /* ⛔ ANTALET STÅR PÅ KNAPPEN. "Hämta fler" ensamt säger inte om det är
           tre rader eller trehundra kvar, och den skillnaden avgör om man orkar
           trycka. */
        <OpsButton variant="ghost" onClick={onMore}>{`Hämta fler (${fler})`}</OpsButton>
      ) : null}
    </div>
  );
}

/**
 * Filter- och mer-knapparna i panelens huvud.
 *
 * ⛔ #158: "Filtren flyttar in bakom filterknappen i högerkanten, som en meny
 * [...] 'Rensa' flyttar till trepunktsmenyn." Båda är popovrar av samma sort
 * som `OpsFilterChip` redan använder, bara utan pillrets text: knapparna
 * sitter i ett panelhuvud, inte bredvid en lista, och ska vara lika kompakta
 * som huvudets övriga ikoner.
 *
 * ⛔ RAMVERKET KÄNNER INTE APPENS FILTER. `filter` är fortfarande appens egen
 * `ReactNode` (grupp, slag, period, "visa systemhändelser", vad appen nu vill),
 * ramverket bestämmer bara VAR den dyker upp: bakom knappen, aldrig synlig
 * förrän man tryckt.
 *
 * ⛔ EXPORTERAD (#166), TIDIGARE PRIVAT. `OpsActivityButton` byggde den här och
 * la den som `action` på `OpsPanel`. Öppnar en app aktiviteten via en
 * `undervy`-rad i skalets meny i stället (`OpsActivityList` direkt, utan
 * `OpsActivityButton`) finns ingen `OpsPanel` som gör det åt den: appen sätter
 * samma knappar själv som `MenyRad.undervyAction`, med SAMMA komponent.
 *
 * @param {object} props
 * @param {import("react").ReactNode} [props.filter]
 * @param {string} [props.filterLabel]
 * @param {() => void} [props.onClear]
 * @param {string} [props.clearLabel]
 */
export function OpsActivityListActions({ filter, filterLabel = "Filter", onClear, clearLabel = "Rensa" }) {
  const [filterOppen, setFilterOppen] = useState(false);
  const [menyOppen, setMenyOppen] = useState(false);

  const ikonknapp = "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-secondary transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <div className="flex items-center gap-0.5">
      {filter ? (
        <Popover.Root open={filterOppen} onOpenChange={setFilterOppen}>
          <Popover.Trigger aria-label={filterLabel} aria-pressed={filterOppen} className={cx(ikonknapp, filterOppen && "bg-accent-subtle text-accent")}>
            <ReglageIkon size={18} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={4} className={cx("z-(--z-dropdown) min-w-52 p-2", radBehallare())}>
              {filter}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : null}
      {onClear ? (
        <Popover.Root open={menyOppen} onOpenChange={setMenyOppen}>
          <Popover.Trigger aria-label="Mer" className={ikonknapp}>
            <MerIkon size={18} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={4} className={cx("z-(--z-dropdown) min-w-40 p-1", radBehallare())}>
              <button
                type="button"
                onClick={() => {
                  setMenyOppen(false);
                  onClear();
                }}
                className={radKlass()}
              >
                {clearLabel}
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : null}
    </div>
  );
}

/**
 * Klockikonen med sitt märke, listan bakom den, och detaljen på plats i raden.
 *
 * ⛔ EN PANEL OCH INTE EN MODAL. CP 2026-09-25: "Navigeringen är inte bra att
 * det kommer upp en detalj mitt i skärmen det skall kännas som att man är i
 * samma panel." En modal mörklägger sidan, flyttar fokus och döljer bakgrunden
 * för skärmläsare. Efter #158 gäller det argumentet ÄNNU starkare: detaljen
 * öppnas numera inline i samma rad, så den knuffar aldrig undan resten av
 * listan över huvud taget.
 *
 * ⛔ MÄRKET VISAR ETT ANTAL OCH INTE BARA EN PRICK. "Något har hänt" säger inte
 * om det är värt att öppna; tre säger det. Över nittionio står "99+", eftersom
 * bredden annars skjuter ut ikonen ur sin rad.
 *
 * ⛔ ANTALET STÅR I KNAPPENS NAMN. En prick är dekor och läses inte upp, så utan
 * namnet vet den som lyssnar inte att det finns något nytt alls.
 *
 * ⛔ OCH DE RADER SIFFRAN RÄKNADE ÄR MÄRKTA I LISTAN. Se noten i `oppna`: utan
 * frysningen försvinner märkningen i samma ögonblick som panelen öppnas, och
 * knappens siffra saknar motsvarighet i det man ser.
 *
 * ⛔ #158: PANELEN GÅR OCKSÅ ATT ÖPPNA UTIFRÅN, T.EX. FRÅN EN RAD I
 * `OpsMeny` ("Aktivitet" med chevron). `open`/`onOpenChange` styr då
 * i stället för knappens egen state, och `renderTrigger={false}` döljer
 * klockan helt när appen bara vill nå panelen via menyn. Utan styrning sköter
 * knappen sig själv precis som förut, bakåtkompatibelt.
 *
 * @param {object} props
 * @param {any[]} props.entries Nyast först.
 * @param {(slag: string) => string} [props.kindLabel]
 * @param {(slag: string) => string | null} [props.kindMarke] Vidarebefordras till `OpsActivityList`.
 * @param {(slag: string) => import("react").ReactNode} [props.kindIcon]
 * @param {string} [props.title] Panelens rubrik.
 * @param {string} [props.label] Knappens namn för skärmläsare, utan antalet.
 * @param {{ sedd?: string | null, lasta?: Iterable<string> | null, rensatTill?: string | null }} [props.lasning]
 *   Appens läsning. Utan den sköter komponenten det själv via `storageKey`.
 * @param {(nar: string) => void} [props.onSeen] Kallas när panelen öppnas.
 * @param {(handelse: any) => void} [props.onRead] Kallas när en rad fälls ut.
 * @param {() => void} [props.onClear] Finns den ritas "Rensa" i trepunktsmenyn.
 * @param {number} [props.dagar] Fönstret bakåt. Olästa slipper det.
 * @param {number} [props.sida] Hur många som ritas åt gången.
 * @param {string} [props.storageKey] Bara när appen INTE styr läsningen.
 * @param {import("react").ReactNode} [props.icon]
 * @param {import("react").ReactNode} [props.empty]
 * @param {import("react").ReactNode} [props.filter] Ritas BAKOM filterknappen (#158), inte ovanför listan.
 *   ⛔ Ramverket vet inte vad som är värt att filtrera bort; appen gör det.
 * @param {string} [props.filterLabel] Skärmläsarnamn på filterknappen.
 * @param {boolean} [props.open] Styrd öppning. Utan den sköter knappen det själv.
 * @param {(open: boolean) => void} [props.onOpenChange]
 * @param {boolean} [props.renderTrigger] Falskt döljer klockan. Kräver då `open`+`onOpenChange`.
 * @param {Date | number} [props.now] Bara för prov.
 * @param {string} [props.sprak] Vidarebefordras till `OpsActivityList`, se dess prop.
 */
export function OpsActivityButton({
  entries,
  kindLabel,
  kindMarke,
  kindIcon,
  title = "Aktivitet",
  label = "Aktivitet",
  lasning,
  onSeen,
  onRead,
  onClear,
  dagar,
  sida,
  storageKey,
  icon,
  empty,
  filter,
  filterLabel = "Filter",
  open,
  onOpenChange,
  renderTrigger = true,
  now,
  sprak: sprakProp,
}) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  if (!renderTrigger && (typeof open !== "boolean" || !onOpenChange)) {
    throw new Error(
      "OpsActivityButton: renderTrigger={false} kräver open OCH onOpenChange. Utan en synlig klocka måste NÅGON annan yta (t.ex. en rad i OpsMeny) styra öppningen, annars går panelen inte att nå alls.",
    );
  }

  const rader = entries || [];
  const styrd = Boolean(lasning);

  const [egenSedd, setEgenSedd] = useState(() => (styrd ? null : lastSedd(storageKey)));
  const [vidOppning, setVidOppning] = useState(/** @type {any} */ (undefined));
  const [egetOppet, setEgetOppet] = useState(false);
  const [sidor, setSidor] = useState(1);

  const oppetStyrt = typeof open === "boolean";
  const oppetVarde = oppetStyrt ? open : egetOppet;

  // ⛔ EN GÅNG, MED `?.`, I STÄLLET FÖR TRE GÅNGER MED `styrd`. `styrd` är
  // sanningen om att `lasning` finns, men typkontrollen ser inte sambandet, och
  // en variabel som säger en sak till läsaren och en annan till kompilatorn är
  // en variabel någon till slut litar fel på.
  const sedd = lasning ? lasning.sedd ?? null : egenSedd;
  const lasta = lasning?.lasta ?? null;
  const rensatTill = lasning?.rensatTill ?? null;

  const olasta = unreadRows(rader, { sedd, lasta }).length;

  // ⛔ FÖNSTRET RÄKNAS UR DEN FRUSNA LÄSNINGEN medan panelen är öppen, så en rad
  // man just öppnat inte hoppar ur listan under fingret.
  const fryst = vidOppning === undefined ? { sedd, lasta } : vidOppning;
  const { rader: visade, fler } = activityWindow(rader, {
    dagar,
    sida: typeof sida === "number" ? sida * sidor : undefined,
    rensatTill,
    sedd: fryst.sedd,
    lasta: fryst.lasta,
    ...(now ? { nu: now } : {}),
  });

  /** @param {boolean} nytt */
  function oppna(nytt) {
    if (!oppetStyrt) setEgetOppet(nytt);
    onOpenChange?.(nytt);
    if (!nytt) {
      // ⛔ SIDORNA NOLLSTÄLLS VID STÄNGNING. Öppnar man igen vill man se listan
      // från början, inte den sida man råkade bläddra till sist.
      setSidor(1);
      return;
    }

    // ⛔ VILKA SOM VAR OLÄSTA FRYSES INNAN LÄSNINGEN FLYTTAS FRAM. Märket på
    // knappen räknar olästa, listan visar alla, och tidpunkten flyttas fram i
    // samma ögonblick som panelen öppnas. Utan frysningen är därför allt redan
    // läst vid första renderingen: knappen sa tre, och listan märker noll.
    setVidOppning({ sedd, lasta: lasta ? [...lasta] : null });

    if (rader.length === 0) return;
    const senaste = rader[0].nar;
    if (styrd) onSeen?.(senaste);
    else {
      sparaSedd(storageKey, senaste);
      setEgenSedd(senaste);
    }
  }

  /** @param {any} handelse */
  function las(handelse) {
    // ⛔ ATT FÄLLA UT ÄR ATT LÄSA. Appen får veta vilken rad det gäller och
    // lägger den där läsningen bor; utan `onRead` är detaljen bara en vy.
    onRead?.(handelse);
  }

  /*
   * ⛔ TRIGGERN ÄR EN EGEN KNAPP SOM PANELEN TAR ÖVER. `OpsPanel` sätter
   * `asChild`, så Radix lägger sina egna attribut på just det här elementet.
   * En `<div>` här hade gett en öppnare som inte går att nå med tangentbordet.
   *
   * ⛔ `renderTrigger={false}`: KNAPPEN FINNS ÄNDÅ, MEN OSYNLIG OCH DOLD FÖR
   * SKÄRMLÄSARE. `OpsPanel` kräver ett riktigt element att sätta `asChild`-
   * attributen på; utan ett sådant kastar Radix. Den enda vägen in är då
   * `open`/`onOpenChange`, t.ex. en rad i `OpsMeny`.
   */
  const klocka = renderTrigger ? (
    <button
      type="button"
      aria-label={olasta > 0 ? `${label}, ${olasta} nya` : label}
      className={cx(
        "relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-secondary",
        "transition-colors duration-(--duration-fast) ease-standard hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {icon ?? <KlockIkon />}
      {/* ⛔ SAMMA MÄRKE SOM INKORGENS, `OpsCountBadge` (#97). Här stod en egen
          pill med fet 12 px-siffra och luft runt, som blev en klump över halva
          klockan; före det `bg-accent`, alltså kräm i mörkt tema. Namnet på
          knappen bär redan antalet, så märkets skärmläsartext utelämnas. */}
      {olasta > 0 ? (
        <span aria-hidden="true">
          <OpsCountBadge count={olasta} placement="icon" />
        </span>
      ) : null}
    </button>
  ) : (
    /* ⛔ `opacity-0`, INTE `hidden` (`display: none`). Radix Popover/Dialog
     * positionerar sin ruta mot triggerns egen ruta i layouten (Floating UI),
     * och ett element utan layout-ruta ger ingen plats att peka mot: panelen
     * hade riskerat att aldrig synas alls när den styrs utifrån. `opacity-0`
     * plus `pointer-events-none` gör knappen osynlig och onåbar utan att ta
     * bort dess plats i flödet.
     */
    <button type="button" tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute size-px opacity-0" />
  );

  return (
    <OpsPanel
      trigger={klocka}
      label={title}
      title={title}
      open={oppetVarde}
      onOpenChange={oppna}
      action={
        filter || (onClear && visade.length > 0) ? (
          <OpsActivityListActions filter={filter} filterLabel={filterLabel} onClear={onClear && visade.length > 0 ? onClear : undefined} />
        ) : null
      }
    >
      {() => (
        <OpsActivityList
          entries={visade}
          kindLabel={kindLabel}
          kindMarke={kindMarke}
          kindIcon={kindIcon}
          empty={empty}
          lasning={fryst}
          onOpen={(h) => las(h)}
          fler={fler}
          onMore={() => setSidor((n) => n + 1)}
          now={now}
          sprak={sprak}
        />
      )}
    </OpsPanel>
  );
}

/** Klockan, som svg och inte som beroende. En ikon till att ladda är en för mycket. */
function KlockIkon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </svg>
  );
}
