import { useState } from "react";
import { cx } from "../lib/cx.js";
import { activityId, activityWindow, groupByDay, unread, unreadRows } from "../lib/aktivitet.js";
import { formatDateTime, formatRelativeDate, formatTime } from "../lib/format.js";
import { slagKant } from "../lib/slag.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsPanel } from "./OpsPanel.jsx";

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
 * ══ ⛔ LISTA, SEDAN DETALJ, OCH DÅ ÄR DEN LÄST ══════════════════════════
 *
 * CP: "jag skall ju också kunna rensa loggen eller trycka på en notis/aktivitet
 * och markera som läst. Tänker en lista och sedan en detalj, då är den läst."
 *
 * ⛔ ATT ÖPPNA ÄR HANDLINGEN, INTE EN KRYSSRUTA. En egen "markera som läst"
 * bredvid varje rad är ett andra klick för något man just gjort, och listor med
 * den knappen lär folk att bocka av utan att läsa.
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
 * har en plats att lägga den, och det vet bara appen.
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
 * ⛔ "NY" STÅR SOM ETT ORD OCH INTE SOM EN TON. Samma skäl som "Gick fel": en
 * rad som bara är lite ljusare än grannen är ingen skillnad alls för den som
 * lyssnar, och knappt någon för den som ser.
 *
 * ⛔ HELA RADEN ÄR KNAPPEN NÄR DEN GÅR ATT ÖPPNA, inte en pil i kanten. På en
 * telefon är ett 12 px stort mål i högerkanten det säkraste sättet att göra en
 * lista som inte går att använda med tummen.
 *
 * @param {{ handelse: any, slagord: string, ny?: boolean, onOpen?: () => void }} props
 */
function Rad({ handelse, slagord, ny, onOpen }) {
  const trasig = handelse.resultat === "fel";

  const innehall = (
    <>
      {/* ⛔ RUBRIKEN BÄR VIKTEN ENSAM. CP 2026-09-25: "Rubrik, undertext och
          metarad har för lika vikt; raderna blir en vägg." Tre nivåer nu:
          `text-sm font-semibold ink`, `text-sm ink-secondary`, `text-xs
          ink-muted`. Samma skala som resten av ramverket. */}
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {ny ? (
          /* ⛔ `bg-badge` OCH INTE `bg-accent`. Det finns en token just för
             olästa, och den bär sin egen textfärg med godkänd kontrast i båda
             teman. Den gamla varianten skrev `text-on-accent`, en token som
             ALDRIG FUNNITS: Tailwind skrev `color: var(--color-on-accent)`,
             vilket resolvar till ingenting, så texten ärvde. På krämfärgad
             accent i mörkt tema blev den osynlig, och det var precis det CP
             rapporterade som "ljust chip med nästan osynlig text". */
          <span className="rounded-full bg-badge px-1.5 py-px text-xs font-bold text-badge-contrast">Ny</span>
        ) : null}
        {/* ⛔ ORDET OCH INTE BARA EN FÄRG. Ett misslyckande som bara syns som en
            röd ton går inte att läsa upp och är osynligt för var tjugonde man. */}
        {trasig ? <span className="text-xs font-semibold text-danger">Gick fel</span> : null}
        <span className="text-sm font-semibold text-ink">{handelse.rubrik}</span>
      </span>

      {handelse.detalj ? <span className="text-sm text-ink-secondary">{handelse.detalj}</span> : null}
      {trasig && handelse.fel ? <span className="text-sm text-danger">{handelse.fel}</span> : null}

      <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-secondary">
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
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className={cx(
            "flex w-full cursor-pointer flex-col gap-0.5 rounded-sm px-1 py-2.5 text-left",
            "transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
          )}
        >
          {innehall}
        </button>
      ) : (
        <span className="flex flex-col gap-0.5 px-1 py-2.5">{innehall}</span>
      )}
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
 * @param {{ handelse: any, slagord: string, nu?: Date | number }} props
 */
export function OpsActivityDetail({ handelse, slagord, nu }) {
  const h = handelse || {};
  const trasig = h.resultat === "fel";

  const fakta = [
    ["När", formatDateTime(h.nar)],
    ["Sedan dess", formatRelativeDate(h.nar, nu ? { now: nu } : undefined)],
    ["Slag", slagord || h.slag || ""],
    ["Jobb", h.kalla || ""],
    // ⛔ UTFALLET STÅR BARA NÄR DET GICK BRA. Ett misslyckande säger det redan
    // med rött ord överst och med feltexten i rutan; en tredje "Gick fel" i
    // faktalistan är samma besked en gång för mycket, och den som läser upp
    // sidan hör det tre gånger.
    ...(trasig ? [] : [["Utfall", "Gick igenom"]]),
  ].filter(([, v]) => String(v || "").trim());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {trasig ? <span className="text-sm font-semibold text-danger">Gick fel</span> : null}
        <span className="text-lg font-semibold text-ink">{h.rubrik}</span>
        {h.detalj ? <span className="text-ink-secondary">{h.detalj}</span> : null}
      </div>

      {trasig && h.fel ? (
        /* ⛔ FELTEXTEN I SIN HELHET OCH I EN KODRUTA. Den kommer ordagrant från
           ett API eller ett undantag, och den som ska söka på den behöver den
           oförvanskad. Kapad i en lista är den en ledtråd; hel här är den ett
           svar. */
        <pre className="m-0 overflow-x-auto rounded-md bg-sunken p-3 text-sm whitespace-pre-wrap text-danger">{h.fel}</pre>
      ) : null}

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {fakta.map(([namn, varde]) => (
          <div key={namn} className="contents">
            <dt className="text-ink-secondary">{namn}</dt>
            <dd className="m-0 text-ink-secondary">{varde}</dd>
          </div>
        ))}
      </dl>
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
 * ⛔ DELAS I IDAG, I GÅR, SENASTE VECKAN OCH ÄLDRE. Skälet i sin helhet står vid
 * `groupByDay`. Kort: ett nattligt jobb skriver en rad om dagen, och efter en
 * månad är en platt lista trettio likadana rader.
 *
 * @param {object} props
 * @param {any[]} props.entries Nyast först. ⛔ Appen sorterar: den vet vilken klocka som gäller.
 * @param {(slag: string) => string} [props.kindLabel]
 * @param {import("react").ReactNode} [props.empty]
 * @param {{ sedd?: string | null, lasta?: Iterable<string> | null }} [props.lasning] Vad som räknas som läst.
 * @param {(handelse: any) => void} [props.onOpen] Utan den går raderna inte att öppna.
 * @param {number} [props.fler] Hur många som ligger bakom "Hämta fler". Noll döljer knappen.
 * @param {() => void} [props.onMore]
 * @param {Date | number} [props.now] Bara för prov.
 */
export function OpsActivityList({ entries, kindLabel, empty, lasning, onOpen, fler = 0, onMore, now }) {
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
          <h3 className="mb-2 text-sm font-semibold text-ink-secondary">{a.label}</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {a.rader.map((h) => (
              <Rad
                key={activityId(h)}
                handelse={h}
                slagord={kindLabel ? kindLabel(h.slag) : ""}
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
 * Klockikonen med sitt märke, listan bakom den, och detaljen bakom listan.
 *
 * ⛔ EN PANEL OCH INTE EN MODAL, och det är en rättelse av mitt eget beslut.
 * Första versionen valde `OpsModal` med argumentet att en egen panel måste
 * återuppfinna fokusfällan, Escape och klick-utanför. Premissen var riktig,
 * slutsatsen fel: `OpsPanel` står på samma Radix-primitiv som menyn och får
 * alltihop gratis.
 *
 * CP 2026-09-25: "Navigeringen är inte bra att det kommer upp en detalj mitt i
 * skärmen det skall kännas som att man är i samma panel." En modal mörklägger
 * sidan, flyttar fokus och döljer bakgrunden för skärmläsare. Att göra det för
 * att visa att ett jobb kört i natt är att avbryta någon för något som inte
 * kräver ett svar.
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
 * @param {object} props
 * @param {any[]} props.entries Nyast först.
 * @param {(slag: string) => string} [props.kindLabel]
 * @param {string} [props.title] Modalens rubrik.
 * @param {string} [props.label] Knappens namn för skärmläsare, utan antalet.
 * @param {{ sedd?: string | null, lasta?: Iterable<string> | null, rensatTill?: string | null }} [props.lasning]
 *   Appens läsning. Utan den sköter komponenten det själv via `storageKey`.
 * @param {(nar: string) => void} [props.onSeen] Kallas när panelen öppnas.
 * @param {(handelse: any) => void} [props.onRead] Kallas när en detalj öppnas.
 * @param {() => void} [props.onClear] Finns den ritas "Rensa".
 * @param {number} [props.dagar] Fönstret bakåt. Olästa slipper det.
 * @param {number} [props.sida] Hur många som ritas åt gången.
 * @param {string} [props.storageKey] Bara när appen INTE styr läsningen.
 * @param {import("react").ReactNode} [props.icon]
 * @param {import("react").ReactNode} [props.empty]
 * @param {import("react").ReactNode} [props.filter] Ritas UNDER huvudet och ovanför listan.
 *   ⛔ Ramverket vet inte vad som är värt att filtrera bort; appen gör det.
 * @param {Date | number} [props.now] Bara för prov.
 */
export function OpsActivityButton({
  entries,
  kindLabel,
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
  now,
}) {
  const rader = entries || [];
  const styrd = Boolean(lasning);

  const [egenSedd, setEgenSedd] = useState(() => (styrd ? null : lastSedd(storageKey)));
  const [vidOppning, setVidOppning] = useState(/** @type {any} */ (undefined));
  const [open, setOpen] = useState(false);
  const [sidor, setSidor] = useState(1);

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
    setOpen(nytt);
    if (!nytt) {
      // ⛔ DETALJEN OCH SIDORNA NOLLSTÄLLS VID STÄNGNING. Öppnar man igen vill
      // man se listan från början, inte den rad man råkade läsa sist.
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
    // ⛔ ATT ÖPPNA ÄR ATT LÄSA. Appen får veta vilken rad det gäller och lägger
    // den där läsningen bor; utan `onRead` är detaljen bara en vy.
    onRead?.(handelse);
  }

  /*
   * ⛔ TRIGGERN ÄR EN EGEN KNAPP SOM PANELEN TAR ÖVER. `OpsPanel` sätter
   * `asChild`, så Radix lägger sina egna attribut på just det här elementet.
   * En `<div>` här hade gett en öppnare som inte går att nå med tangentbordet.
   */
  const klocka = (
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
      {olasta > 0 ? (
        <span
          aria-hidden="true"
          /* ⛔ `bg-badge` / `text-badge-contrast`, tokens som finns och bär
             godkänd kontrast. Stod tidigare `bg-accent text-on-accent`, och
             den senare har aldrig funnits som token. */
          className={cx(
            "absolute top-1 right-1 min-w-4 rounded-full bg-badge px-1",
            "text-center text-xs font-bold tabular-nums text-badge-contrast",
          )}
        >
          {olasta > 99 ? "99+" : olasta}
        </span>
      ) : null}
    </button>
  );

  return (
    <OpsPanel
      trigger={klocka}
      label={title}
      title={title}
      open={open}
      onOpenChange={oppna}
      action={
        onClear && visade.length > 0 ? (
          /* ⛔ RENSA LIGGER I HUVUDET, INTE SIST I LISTAN. Den gäller hela
             listan, och en knapp som gäller allt hör hemma där allt börjar.
             Längst ned låg den dessutom där tummen råkar vara på väg efter en
             rullning. */
          <OpsButton variant="ghost" size="sm" onClick={onClear}>
            Rensa
          </OpsButton>
        ) : null
      }
    >
      {(nav) => (
        <>
          {/* ⛔ FILTRET LIGGER OVANFÖR LISTAN OCH INTE I HUVUDET. Det styr vad
              man ser, och en kontroll som styr ett urval hör hemma intill
              urvalet. I huvudet hade den konkurrerat med Rensa, som gäller
              något helt annat. */}
          {filter ? <div className="mb-2 flex items-center justify-end">{filter}</div> : null}
          <OpsActivityList
            entries={visade}
            kindLabel={kindLabel}
            empty={empty}
            lasning={fryst}
            onOpen={(h) => {
            las(h);
            /* ⛔ DETALJEN ÄR EN VY I SAMMA PANEL, inte en ruta över sidan.
               Skälet i sin helhet står överst i `OpsPanel`. */
            nav.push({
              key: `detalj-${activityId(h)}`,
              title: "Aktivitet",
              content: <OpsActivityDetail handelse={h} slagord={kindLabel ? kindLabel(h.slag) : ""} nu={now} />,
            });
          }}
            fler={fler}
            onMore={() => setSidor((n) => n + 1)}
            now={now}
          />
        </>
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
