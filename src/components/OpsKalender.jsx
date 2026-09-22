import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import {
  MANADSNAMN,
  datumnyckel,
  datumtext,
  idagsnyckel,
  manader,
  manadsrutnat,
  perDag,
  rullriktning,
} from "../lib/kalender.js";
import { OpsStatusDot } from "./OpsStatusDot.jsx";

/**
 * Kalender: en månad i taget, i en rulle, med det som faktiskt ligger på dagen.
 *
 * ══ ⛔ VAD DEN ÄR OCH VAD DEN INTE ÄR ═══════════════════════════════════
 *
 * CP 2026-09-22: "Jag vill ha en REN Enkel och strukturerad kalender i samma
 * utseende med så lite kod som möjligt. Absolut ingen overkill."
 *
 * Den ritar DATERADE POSTER. Den äger inte urvalet, vet inte var posterna kommer
 * ifrån och har ingen åsikt om vad de betyder. Appen skickar in en lista och får
 * ett rutnät.
 *
 * ⛔ INGEN DRAG-MARKERING, INGA LAGER, INGA AVATARER, INGEN EXPORT. Förebilden
 * (SessionStudios CalView) bär allt det, och den bär det för att den handlar om
 * grupper som ska hitta en tid ihop. Ett bolags kalender har en läsare. Allt
 * sådant som portats in hade varit kod som aldrig körs, och den sortens kod
 * upptäcks först när någon ska ändra något bredvid den.
 *
 * ══ ⛔ FORMEN ÄR LÅNAD, KODEN ÄR DET INTE ══════════════════════════════
 *
 * Fyra beslut är tagna ur SessionStudio, eftersom de är mätta där och inte
 * behöver mätas om:
 *
 *   1. EN RULLE, INTE EN SIDA PER MÅNAD. Man bläddrar inte mellan månader, man
 *      rullar förbi dem. Nästa månads början syns innan den här månaden tar slut.
 *   2. DEN ÖPPNAR PÅ IDAG. Utan det öppnar en kalender med historik på en tom
 *      ruta långt bak, och det ser ut som att posterna saknas.
 *   3. VECKODAGSRADEN ÄR KLISTRAD. Rullar man tre månader vet man annars inte
 *      längre vilken kolumn som är onsdag.
 *   4. EN FLYTANDE "IDAG"-KNAPP som dyker upp FÖRST när innevarande månad rullat
 *      ur bild, med en pil åt det håll man ska rulla.
 *
 * ⛔ TOKENS ÄR RAMVERKETS, INTE FÖREBILDENS. De två systemen delar inte ett enda
 * tokennamn (`--color-bg-card` mot `--color-raised`), så en kopierad klassrad
 * hade dragit in ett andra designspråk i appen. Formen bär över, färgerna gör det
 * inte.
 *
 * ══ ⛔ KALENDERN RULLAR I SIG SJÄLV, INTE I SIDAN ══════════════════════
 *
 * CP 2026-09-22, med bild: "Scrollningen tar med hela menyn och allt. Kan vi
 * göra så att vi scrollar kalendern så att jag inte behöver scrolla upp för att
 * komma tillbaka till idag."
 *
 * Första versionen låg i dokumentets flöde, och då är det SIDAN som rullar. Tre
 * följdfel, alla på bilden:
 *
 *   - `sticky top-0` på veckodagsraden nyper mot fönstrets överkant, alltså
 *     UNDER appens egen toppmeny, och raden försvann bakom den.
 *   - "Idag"-knappen låg `sticky bottom-4` i samma flöde och kunde bara nypa
 *     inom sin förälders rullsträcka, alltså inte där den behövdes.
 *   - Varje väg tillbaka till idag var en resa genom hela sidan.
 *
 * Nu äger rutnätet en egen rullbehållare med tak. Då nyper veckodagsraden mot
 * KALENDERNS överkant, "Idag" kan ligga absolut i kalenderns nedre hörn, och
 * appskalet står stilla medan man bläddrar genom månader.
 *
 * ⛔ `overscroll-contain` HÖR TILL SAMMA BESLUT. Utan den fortsätter rullningen
 * ut i sidan så fort man nått botten av kalendern, alltså exakt det som skulle
 * bort, fast en halv sekund senare.
 *
 * ⛔ TAKET ÄR `svh` OCH INTE `vh`. På en telefon krymper `vh` aldrig när
 * adressfältet fälls in, så en `vh`-höjd lägger kalenderns nederkant under
 * webbläsarens eget krom, och "Idag"-knappen hamnar under det man inte kan rulla
 * bort.
 *
 * ══ ⛔ DAGEN ÖPPNAS I EN FLYTANDE, INVERTERAD BUBBLA ═══════════════════
 *
 * CP 2026-09-22, med bild ur SessionStudio: "bubblorna måste vara flytande som
 * i SessionStudio. Lägg märke till det inverterade."
 *
 * Första versionen fällde ut dagen UNDER månadsrutnätet, med skälet att en
 * flytande ruta kostar positionering. Det var fel av ett skäl som bara syns i
 * bruk: utfällningen SKJUTER RESTEN AV RUTNÄTET NEDÅT. Man trycker på den 12:e,
 * och dagarna under 12:e flyttar sig, så nästa tryck landar på fel dag.
 *
 * Bubblan här kostar ingen kollisionshantering, för den är inte ankrad vid
 * fingret som förebilden. Den ligger `fixed` nära nederkanten, centrerad, precis
 * som `OpsFloatingSummary`, och skälet till `fixed` framför `sticky` står
 * utskrivet där: en sida som rullar i dokumentet har ingen andra behållare att
 * stå stilla i.
 *
 * ⛔ INVERTERAD MED `ops-contrast-panel`, alltså samma yta som laborera-popovern
 * och sifferbubblan. Den klassen remappar bläck, linjer och accent, så bubblan
 * håller kontrast i både ljust och mörkt läge utan en enda egen hex. En bubbla
 * som målats med `bg-ink` hade varit en fjärde mörk yta med sin egen ton.
 *
 * ⛔ TRE VÄGAR UT, för bubblan täcker en del av rutnätet: krysset, Escape, och
 * ett andra tryck på samma dag. En flytande ruta med bara ett litet kryss är den
 * ruta man till slut rullar ifrån i stället för att stänga.
 */

const VECKODAGAR = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

/** Hur många prickar en ruta ritar innan den börjar räkna i stället. */
const MAX_PRICKAR = 3;

/**
 * Millisekunder mellan två svepande element i dagspanelen.
 *
 * ⛔ 40 MS ÄR FÖREBILDENS TAL, avläst ur SessionStudios dagspanel
 * (`popIn 180ms ease-out ${idx * 40}ms both`). Trappan är det som gör att en
 * panel med sex kort läses som EN rörelse i stället för sex samtidiga.
 *
 * ⛔ OCH DEN TAS INTE UR LUFTEN IGEN. Skulle den ändras är det för att någon
 * mätt att den känns fel, inte för att ett annat tal råkade se rundare ut.
 */
const SVEPSTEG = 40;

/*
 * ══ ⛔ RUTNÄTETS PRICKAR BÄR "NÅGOT FINNS", INTE VILKEN STATUS ══════════
 *
 * Första utkastet satte en `OpsStatusDot` per post i dagsrutan, och ramverkets
 * egen vakt stoppade det: den kräver ett ord till varje färg, och ett ord per
 * prick hade blivit "Öppet Öppet Klart" i en ruta som är 44 px bred.
 *
 * Vakten hade rätt om mer än tillgängligheten. Tre statusfärger i en dagsruta
 * på en telefon är inte information, det är brus: man ser att något är rött men
 * inte vad, och måste öppna dagen ändå.
 *
 * Rutan svarar därför bara på "finns det något här, och hur mycket". STATUS,
 * MED SITT ORD, bor i dagsbubblan ett tryck bort, där det finns plats för både
 * färgen och ordet bredvid titeln. Det är samma arbetsdelning som `OpsEventList`
 * gör mellan pricken på raden och `Status` i utfällningen.
 */

/**
 * En dagsruta.
 *
 * ⛔ EN `<button>` OCH INTE EN `<div onClick>`, även för en tom dag. Tomma dagar
 * är inte tryckbara alls, och de som har något måste gå att nå med tangentbord.
 * En klickbar div gör ingetdera och ser likadan ut.
 *
 * ⛔ TRÄFFYTAN ÄR HELA RUTAN. En siffra är några pixlar bred, och en kalender man
 * missar med tummen är en kalender man slutar öppna.
 *
 * @param {{ dag: number | null, nyckel: string, poster: import("../lib/kalender.js").Kalenderpost[], arIdag: boolean, vald: boolean, onValj: (nyckel: string) => void }} props
 */
function Dagsruta({ dag, nyckel, poster, arIdag, vald, onValj }) {
  if (dag === null) return <div aria-hidden="true" />;

  const antal = poster.length;
  const etikett = antal === 0 ? `${dag}` : `${dag}, ${antal} ${antal === 1 ? "post" : "poster"}`;

  return (
    <button
      type="button"
      disabled={antal === 0}
      aria-pressed={vald}
      aria-label={etikett}
      onClick={() => onValj(nyckel)}
      className={cx(
        "flex min-h-14 flex-col items-center gap-1 rounded-md px-1 pt-1.5 pb-1 text-sm transition-colors duration-(--duration-fast) ease-standard",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        antal === 0 ? "cursor-default text-ink-muted" : "cursor-pointer text-ink hover:bg-accent-faint",
        vald && "bg-accent-subtle",
        // ⛔ Idag är en RING och inte en fylld yta. Fylld krockar med markeringen
        // för vald dag, och då går det inte att se vilken av de två man tittar på.
        arIdag && "ring-2 ring-accent ring-inset font-bold",
      )}
    >
      <span className="tabular-nums">{dag}</span>
      {/* ⛔ Dekor, och läses inte upp: antalet står redan i knappens namn. */}
      <span aria-hidden="true" className="flex min-h-2 items-center gap-0.5">
        {poster.slice(0, MAX_PRICKAR).map((p) => (
          <span key={p.id} className="size-1.5 rounded-full bg-accent" />
        ))}
        {antal > MAX_PRICKAR ? <span className="text-xs tabular-nums text-ink-muted">+{antal - MAX_PRICKAR}</span> : null}
      </span>
    </button>
  );
}

/** Krysset, i två storlekar. En svg på tre ställen är tre ställen att rätta. */
function Kryss({ stor = false }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={stor ? "size-3.5" : "size-2.5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

/**
 * Ett piller per vald dag.
 *
 * ⛔ DATUMET STÅR HÄR, ÖVER KORTEN, OCH INTE SOM EN RUBRIK INUTI PANELEN.
 * Förebilden (SessionStudios dagspanel) radar upp de valda datumen som piller
 * överst, och pillren är samtidigt kontrollen som tar bort en dag ur urvalet.
 * Ett datum som bara är en rubrik är en upplysning; ett datum som är ett piller
 * är en upplysning man kan göra något åt.
 *
 * ⛔ KRYSSET I PILLRET FINNS BARA NÄR FLERA DAGAR ÄR VALDA, precis som i
 * förebilden. Med en enda dag gör pillrets kryss exakt samma sak som panelens
 * stängkryss två centimeter till höger, och två knappar med samma verkan får
 * läsaren att leta efter skillnaden.
 *
 * @param {{ nyckel: string, kanTasBort: boolean, onTaBort: (nyckel: string) => void, ordning: number }} props
 */
function Datumpiller({ nyckel, kanTasBort, onTaBort, ordning }) {
  const text = datumtext(nyckel);
  return (
    <span
      style={{ animationDelay: `${ordning * SVEPSTEG}ms` }}
      className="ops-contrast-panel inline-flex animate-svep items-center gap-1.5 rounded-full bg-contrast-panel py-1 pr-2 pl-2.5 text-xs font-semibold text-ink shadow-md"
    >
      {text}
      {kanTasBort ? (
        <button
          type="button"
          onClick={() => onTaBort(nyckel)}
          aria-label={`Ta bort ${text}`}
          className="flex cursor-pointer items-center text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Kryss />
        </button>
      ) : null}
    </span>
  );
}

/**
 * En post, som ett eget kort.
 *
 * ══ ⛔ ETT KORT PER POST, INTE EN LISTA I ETT KORT ══════════════════════
 *
 * CP 2026-09-22, med bild ur SessionStudio: "Det finns ingen separator med flera
 * händelser i bubblan."
 *
 * Första versionen la posterna som rader i EN bubbla, och fyra påminnelser i rad
 * blev då en vägg av fet text utan något som skiljer dem åt. Förebilden gör
 * tvärtom: varje post är ett eget `rounded-xl`-kort med egen skugga, staplade
 * med luft emellan. Luften ÄR avdelaren, och den behöver därför ingen linje.
 *
 * ⛔ DATUMET ÅTERKOMMER PÅ KORTET, under titeln, och det är inte en upprepning
 * av pillret ovanför. Pillren säger vilka dagar urvalet består av; kortets rad
 * säger vilken av dem just den här posten tillhör. Med tre dagar valda är det
 * enda som skiljer två likadana påminnelser åt.
 *
 * @param {{ nyckel: string, post: import("../lib/kalender.js").Kalenderpost, statusOrd: Record<string, string>, ordning: number }} props
 */
function Postkort({ nyckel, post, statusOrd, ordning }) {
  const meta = post.not ? `${datumtext(nyckel)} · ${post.not}` : datumtext(nyckel);

  return (
    <div
      style={{ animationDelay: `${ordning * SVEPSTEG}ms` }}
      className="ops-contrast-panel flex animate-svep items-start gap-2 rounded-xl bg-contrast-panel p-2.5 shadow-md"
    >
      {/* ⛔ HÄR får pricken finnas, för här finns plats för ordet bredvid.
          Saknar appen ordet för ett läge kastar `OpsStatusDot`, och det är rätt:
          en färg utan ord är inget besked. */}
      {post.status ? (
        <span className="mt-1 shrink-0">
          <OpsStatusDot status={post.status} label={statusOrd[post.status] || ""} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {/* ⛔ EN POST MED `url` BLIR EN LÄNK, resten blir text. En rad som ser
            tryckbar ut och inte är det är ett löfte som inte infrias, och i en
            kalender över stängda ärenden är länken hela poängen. */}
        {post.url ? (
          <a
            className="font-semibold text-accent underline decoration-from-font underline-offset-2 hover:text-accent-hover"
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {post.titel}
          </a>
        ) : (
          <span className="font-semibold text-ink">{post.titel}</span>
        )}
        <p className="m-0 text-xs text-ink-secondary">{meta}</p>
      </div>
    </div>
  );
}

/**
 * De valda dagarnas poster: piller överst, ett kort per post under.
 *
 * ══ ⛔ VAR DEN LIGGER, OCH VARFÖR DET ÄR TVÅ OLIKA SVAR ════════════════
 *
 * CP 2026-09-22: "Se var bubblorna är i web där det finns utrymme och se var de
 * finns i mobil och hur det ser ut."
 *
 * Förebilden avgör det med en enda rad, `showSidePanel = !isPhone`:
 *
 *   SMALT: en remsa längst ner, över rutnätet. Det finns ingen bredd att ta av.
 *   BRETT: en egen kolumn BREDVID rutnätet, i flödet, 300 px från 1024 px och
 *   360 px från 1280 px.
 *
 * ⛔ GRÄNSEN GICK FÖRST VID 768 px, OCH DET KLÄMDE IHOP KALENDERN. CP
 * 2026-09-22, med bild: "I web-vyn har du tryckt ihop kalendern. Se
 * sessionstudio, bubblorna får utrymme till höger om panelen när skärmen ger
 * tillåtelse."
 *
 * Räknat: en app-vy på 768 px har 736 px innanför sin sidomarginal. Drar man
 * 300 px till en kolumn återstår 436 px åt sju dagsrutor, alltså 62 px styck.
 * Det är smalare än träffytan de ska ha. Vid 1024 px blir samma räkning 99 px
 * och vid 1280 px omkring 127 px, alltså först då finns utrymmet att ta av.
 *
 * ⛔ OCH DET ÄR FÖREBILDENS EGEN REGEL, inte en ny. `showSidePanel = !isPhone`
 * är bara halva den: `showSplitChrome = !isPhone && isLandscape`, med
 * kommentaren "iPad Chrome stående: samma «mobil»-chrome som telefon (kalender:
 * dagpanel under rutnät)". En surfplatta i stående läge får alltså remsan, och
 * en stående iPad är 768 till 834 px bred. 1024 px är den bredd där en
 * surfplatta ligger ner.
 *
 * ⛔ KOLUMNEN RESERVERAS ÄVEN NÄR INGEN DAG ÄR VALD, och det följer av samma
 * rad: `showSidePanel` frågar efter skärmbredden, aldrig efter urvalet. Dök
 * kolumnen upp först vid ett tryck skulle rutnätet krympa under fingret, och
 * nästa tryck landa på fel dag. Det är exakt det fel utfällningen under månaden
 * en gång hade, fast i sidled.
 *
 * ⛔ PÅ TELEFON BOTTNAR DEN PÅ BOTTENRADEN, utan luft under. CP: "Bottendelen
 * skall inte vara med. Den kan gå ända ner." Här låg `--bottom-nav-overhang`
 * plus 0,75 rem, alltså plats för en rund plusknapp som sticker upp ur baren i
 * andra vyer och inte finns i den här. Marginalen betalade för något som inte
 * var där.
 *
 * ⛔ PILLERRADEN RULLAR MED, precis som i förebilden, där den ligger inuti samma
 * `max-h`-behållare som korten. Escape och ett andra tryck i rutnätet är vägar
 * ut som inte kan rulla bort.
 *
 * @param {{ dagar: { nyckel: string, poster: import("../lib/kalender.js").Kalenderpost[] }[], statusOrd: Record<string, string>, onStang: () => void, onTaBort: (nyckel: string) => void }} props
 */
function Dagspanel({ dagar, statusOrd, onStang, onTaBort }) {
  const flera = dagar.length > 1;
  const rubrik = flera ? `${dagar.length} dagar` : datumtext(dagar[0].nyckel);
  const namn = flera ? `Poster för ${dagar.length} valda dagar` : `Poster den ${rubrik}`;

  /*
   * ⛔ ESCAPE STÄNGER, och den lyssnaren sitter på fönstret och inte på panelen.
   * Fokus ligger kvar på dagsrutan man tryckte på, alltså utanför panelen, så en
   * lyssnare på panelens egen nod hade aldrig hört tangenten.
   */
  useEffect(() => {
    /** @param {KeyboardEvent} e */
    const vid = (e) => {
      if (e.key === "Escape") onStang();
    };
    window.addEventListener("keydown", vid);
    return () => window.removeEventListener("keydown", vid);
  }, [onStang]);

  return (
    <section
      aria-label={namn}
      className="pointer-events-auto flex max-h-[45svh] w-full max-w-sm flex-col gap-2 overflow-y-auto overscroll-contain lg:max-h-[70svh] lg:max-w-none"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {dagar.map((d, i) => (
          <Datumpiller key={d.nyckel} nyckel={d.nyckel} kanTasBort={flera} onTaBort={onTaBort} ordning={i} />
        ))}
        {/* ⛔ KRYSSET BÄR RUBRIKEN I SITT NAMN. "Stäng" ensamt säger inte vad som
            stängs för den som lyssnar sig igenom sidan. */}
        <button
          type="button"
          onClick={onStang}
          aria-label={`Stäng ${rubrik}`}
          className={cx(
            "ops-contrast-panel ml-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-contrast-panel text-ink shadow-md",
            "hover:text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <Kryss stor />
        </button>
      </div>

      {/* ⛔ TRAPPAN RÄKNAS ÖVER HELA PANELEN och inte per dag. Räknades den om
          för varje dag skulle första kortet under varje datum svepa in
          samtidigt, och det som ska läsas som en rörelse blir tre. */}
      {dagar.flatMap((d, di) =>
        d.poster.map((p, pi) => (
          <Postkort
            key={`${d.nyckel}-${p.id}`}
            nyckel={d.nyckel}
            post={p}
            statusOrd={statusOrd}
            ordning={dagar.length + dagar.slice(0, di).reduce((n, x) => n + x.poster.length, 0) + pi}
          />
        )),
      )}
    </section>
  );
}

/**
 * @param {object} props
 * @param {import("../lib/kalender.js").Kalenderpost[]} props.poster Daterade poster. Odaterat hör inte hemma här.
 * @param {string} props.ariaLabel ⛔ Krävs: ett rutnät med tal är osynligt för den som inte ser det.
 * @param {Record<string, string>} [props.statusOrd] Appens ord per läge, som i `OpsEventList`.
 *   ⛔ Ramverket äger färgerna och appen orden: bara appen vet vad `vantar` betyder hos just den.
 * @param {number} [props.manaderBakat] Standard 1. ⛔ Inte tolv: en bolagskalender har få poster bakåt,
 *   och varje månad är ett rutnät till att rita och rulla förbi.
 * @param {number} [props.manaderFramat] Standard 3.
 * @param {Date} [props.idag] Bara för prov. Produktionen har en klocka.
 * @param {import("react").ReactNode} [props.tomtText] Vad som står när ingen post har datum.
 */
export function OpsKalender({ poster = [], ariaLabel, statusOrd = {}, manaderBakat = 1, manaderFramat = 3, idag, tomtText }) {
  if (!ariaLabel) {
    throw new Error("OpsKalender: ariaLabel krävs. Ett rutnät med tal är osynligt för den som inte ser det.");
  }

  const nu = idag || new Date();
  const idagNyckel = idagsnyckel(nu);
  /*
   * ⛔ FLERA VALDA DAGAR, OCH DÄRFÖR EN LISTA OCH INTE ETT VÄRDE. CP 2026-09-22:
   * "jag kan markera flera". Ett enda `vald` hade gjort varje nytt tryck till ett
   * byte i stället för ett tillägg, alltså exakt det man inte vill när man
   * jämför två dagar med varandra.
   *
   * ⛔ EN ARRAY OCH INTE ETT `Set`. React jämför med identitet, och ett `Set`
   * som muteras på plats ger samma referens tillbaka, alltså ingen omrendering.
   * Det felet ser ut som att knappen inte fungerar.
   */
  const [valda, setValda] = useState(/** @type {string[]} */ ([]));

  const karta = useMemo(() => perDag(poster), [poster]);
  const lista = useMemo(() => manader(nu, manaderBakat, manaderFramat), [nu, manaderBakat, manaderFramat]);

  const rulleRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const huvudRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const idagRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [visaTillbaka, setVisaTillbaka] = useState(false);
  const [riktning, setRiktning] = useState(/** @type {"upp" | "ner"} */ ("upp"));

  /**
   * Rullar behållaren till innevarande månad.
   *
   * ⛔ `scrollTop` OCH INTE `scrollIntoView`. Den senare rullar ALLA rullbara
   * förfäder, alltså också sidan, och då gör den vid montering precis det CP bad
   * att slippa: hela vyn hoppar.
   *
   * ⛔ VECKODAGSRADENS HÖJD DRAS BORT. Raden är klistrad överst i behållaren, så
   * en rullning till månadens exakta överkant lägger månadsrubriken UNDER den.
   * Höjden läses av noden i stället för att skrivas som ett tal, eftersom talet
   * hade blivit fel den dag typsnittet ändras.
   *
   */
  const tillIdag = useCallback((/** @type {ScrollBehavior} */ beteende = "auto") => {
    const rulle = rulleRef.current;
    const manad = idagRef.current;
    if (!rulle || !manad) return;
    const huvud = huvudRef.current ? huvudRef.current.offsetHeight : 0;
    rulle.scrollTo({ top: Math.max(0, manad.offsetTop - huvud), behavior: beteende });
  }, []);

  /*
   * ⛔ ETT HOPP UTAN ANIMERING VID MONTERING. Med historik bakåt ligger den
   * innevarande månaden en bit ner i rullen, och utan det här öppnar kalendern
   * på en månad som passerat: rutnätet är tomt och posterna ser ut att saknas.
   *
   * `didRef` finns för att det ska ske EN gång. Utan den hoppar vyn tillbaka
   * till idag varje gång posterna uppdateras, mitt i att någon rullar.
   */
  const didRef = useRef(false);
  useEffect(() => {
    if (didRef.current) return;
    didRef.current = true;
    tillIdag();
  }, [tillIdag]);

  /*
   * ══ ⛔ RULLYTAN GÅR HELA VÄGEN NER, OCH DÄRFÖR MÄTS DEN ════════════════
   *
   * CP 2026-09-22, med bild: "Börja med att ta bort botten och låt den gå ända
   * ner."
   *
   * Taket var `max-h-[60svh]`, ett tal taget ur luften. Följden syns på bilden:
   * rutnätet tar slut en bit ner på skärmen, med en ram under sig och en stor
   * tom yta därefter. Man rullar alltså i en liten lucka mitt på en sida som
   * mest består av ingenting.
   *
   * Förebilden har varken tak eller ram. Dess rullyta är `flex-1 min-h-0
   * overflow-y-auto`, alltså "ta resten av höjden", för den bor i en kolumn med
   * känd höjd. Här gör den inte det: kalendern sitter mitt i en sida som skalet
   * rullar, så det finns ingen förälder att ta resten av.
   *
   * ⛔ DÄRFÖR MÄTS AVSTÅNDET TILL FÖNSTRETS ÖVERKANT, en gång, och läggs i en
   * CSS-variabel. Höjden räknas sedan i CSS, vilket är det enda sättet att få
   * BÅDE en mätning och en brytpunkt: en inline-stil kan inte ha en media-fråga,
   * och en klass kan inte veta var elementet hamnade.
   *
   * ⛔ DOKUMENTETS OFFSET OCH INTE RUTANS. `getBoundingClientRect().top` ensamt
   * är avståndet till fönstrets överkant PRECIS NU, alltså ett annat tal så fort
   * sidan rullats. Med `scrollY` adderat blir det avståndet vid sidans topp, och
   * det är ett fast tal som inte ruttnar.
   *
   * ⛔ OMMÄTS VID RESIZE, alltså också när telefonen vrids. Utan det blir höjden
   * kvar från stående läge i liggande, och då sticker rutnätet ut under skärmen.
   */
  const [topp, setTopp] = useState(0);
  useEffect(() => {
    const el = rulleRef.current;
    if (!el) return undefined;
    const mat = () => {
      const rect = el.getBoundingClientRect();
      setTopp(Math.max(0, Math.round(rect.top + (window.scrollY || 0))));
    };
    mat();
    window.addEventListener("resize", mat);
    return () => window.removeEventListener("resize", mat);
  }, []);

  useEffect(() => {
    const el = idagRef.current;
    const rulle = rulleRef.current;
    if (!el || !rulle || typeof IntersectionObserver !== "function") return undefined;
    const obs = new IntersectionObserver(
      ([traff]) => {
        setVisaTillbaka(!traff.isIntersecting);
        if (traff.isIntersecting) return;
        // ⛔ Beslutet bor i `rullriktning` och inte här, se den funktionen: den
        // gamla jämförelsen var hårfin på just den pixel där observatören
        // svarar, så pilen pekade nedåt så gott som alltid.
        setRiktning(rullriktning(traff.boundingClientRect, traff.rootBounds));
      },
      // ⛔ `root` ÄR RULLBEHÅLLAREN OCH INTE FÖNSTRET. Utan den mäts synligheten
      // mot viewporten, och eftersom hela kalendern ryms där skulle månaden
      // räknas som synlig hur långt bort man än rullat inuti den: knappen hade
      // aldrig dykt upp.
      { root: rulle, threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const harPoster = karta.size > 0;

  /*
   * ⛔ SORTERAT PÅ DATUM OCH INTE PÅ TRYCKORDNING. Markerar man den 25:e och
   * sedan den 12:e läser man ändå bubblan uppifrån och ner, och en lista i
   * tryckordning hade visat oktober efter november utan att något sagt varför.
   * Att en ren strängsortering RÄCKER är hela skälet till att nycklarna skrivs
   * `YYYY-MM-DD` med två siffror.
   *
   * ⛔ DAGAR SOM BLIVIT TOMMA FALLER BORT. Filtreras posterna om medan bubblan
   * är öppen kan en markerad dag bli tom, och en datumrubrik utan rader under
   * ser ut som att något gick sönder.
   */
  const dagar = useMemo(
    () =>
      [...valda]
        .sort()
        .map((nyckel) => ({ nyckel, poster: karta.get(nyckel) || [] }))
        .filter((d) => d.poster.length > 0),
    [valda, karta],
  );

  return (
    /*
     * ⛔ EN RAD PÅ BREDA SKÄRMAR, EN SPALT PÅ SMALA, och det är förebildens
     * `showSidePanel = !isPhone`. Se `Dagspanel` för hela resonemanget: på allt
     * utom telefon finns bredd att lägga dagens poster BREDVID rutnätet, och då
     * behöver ingenting läggas ovanpå något annat.
     */
    <section aria-label={ariaLabel} className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="relative min-w-0 flex-1">
      {/* ⛔ TAKET GÖR KALENDERN TILL SIN EGEN RULLE. Se filens huvud: utan det
          rullar sidan, veckodagsraden nyper under appens toppmeny och vägen
          tillbaka till idag går genom hela vyn.

          ⛔ `relative` ÄR INTE PRYDNAD. Månadsblocken mäter sin plats med
          `offsetTop`, alltså mot närmaste positionerade förälder, och utan den
          här klassen räknas de mot sidan och rullningen landar fel. */}
      <div
        ref={rulleRef}
        /* ⛔ Kastad till `CSSProperties`, eftersom TypeScript inte känner till
           egna CSS-variabler i ett stilobjekt. Det är typsystemets lucka och
           inte en osäkerhet i koden: webbläsaren tar emot `--kalender-topp`
           precis som vilken annan deklaration som helst. */
        style={/** @type {import("react").CSSProperties} */ ({ "--kalender-topp": `${topp}px` })}
        className={cx(
          "relative overflow-y-auto overscroll-contain bg-canvas px-1",
          /* ⛔ INGEN RAM OCH INGEN RUNDNING. En ram runt något som når skärmens
             underkant läses som en ruta som blivit avhuggen, inte som en ruta.
             Förebilden har ingen heller: dess rullyta är bara `overflow-y-auto`.
             Veckodagsraden är klistrad och målad, så överkanten syns ändå. */
          /* ⛔ HÖJDEN RÄKNAS I CSS UR DEN MÄTTA VARIABELN, se effekten ovan.
             På telefon dras bottenraden bort, annars ligger sista veckan under
             den; från 768 px finns ingen bottenrad, och då är det bara skärmens
             säkra kant som ska undantas. */
          "h-[calc(100svh_-_var(--kalender-topp)_-_var(--bottom-nav-h)_-_var(--safe-bottom))]",
          "md:h-[calc(100svh_-_var(--kalender-topp)_-_var(--safe-bottom))]",
          /* ⛔ ETT GOLV, för den dag kalendern hamnar långt ner på en kort sida.
             Utan det kan uttrycket bli noll eller negativt, och då försvinner
             rutnätet helt i stället för att bli obekvämt litet. */
          "min-h-60",
        )}
      >
        {/* ⛔ Klistrad veckodagsrad. Efter tre månaders rullning är kolumnernas
            betydelse borta, och man räknar sig fram i stället för att läsa. */}
        <div ref={huvudRef} className="sticky top-0 z-(--z-sticky) grid grid-cols-7 gap-1 bg-canvas pt-1 pb-2">
          {VECKODAGAR.map((d) => (
            <span key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {d}
            </span>
          ))}
        </div>

        {!harPoster && tomtText ? <p className="m-0 pb-3 text-sm text-ink-muted">{tomtText}</p> : null}

        <div className="flex flex-col gap-6 pb-4">
          {lista.map(({ ar, manad }) => {
            const arIdagsManad = ar === nu.getFullYear() && manad === nu.getMonth();
            const rader = manadsrutnat(ar, manad);

            return (
              <div key={`${ar}-${manad}`} ref={arIdagsManad ? idagRef : null}>
                <h3 className="m-0 mb-2 text-lg font-bold capitalize text-ink font-display">
                  {MANADSNAMN[manad]} {ar}
                </h3>

                <div className="grid grid-cols-7 gap-1">
                  {rader.map((rad, i) =>
                    rad.map((dag, j) => {
                      const nyckel = dag === null ? `tom-${i}-${j}` : datumnyckel(ar, manad, dag);
                      return (
                        <Dagsruta
                          key={nyckel}
                          dag={dag}
                          nyckel={nyckel}
                          poster={dag === null ? [] : karta.get(nyckel) || []}
                          arIdag={nyckel === idagNyckel}
                          vald={valda.indexOf(nyckel) >= 0}
                          onValj={(n) =>
                            setValda((forra) => (forra.indexOf(n) >= 0 ? forra.filter((x) => x !== n) : [...forra, n]))
                          }
                        />
                      );
                    }),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⛔ `absolute` I RUTNÄTETS EGET HÖRN, inte `sticky` i flödet. Knappen
          hör till rutnätet och ska stå still medan det rullar under den, och
          `sticky` kunde bara nypa inom sin förälders rullsträcka. */}
      {visaTillbaka ? (
        <button
          type="button"
          onClick={() => tillIdag("smooth")}
          className={cx(
            "absolute right-4 bottom-4 min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-raised px-4 text-sm font-semibold text-ink shadow-md",
            "hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            /* ⛔ PÅ TELEFON VIKER DEN FÖR DAGSPANELEN. Sedan rullytan går ända
               ner bottnar båda på samma linje, och två flytande kontroller ovanpå
               varandra i underkanten är en av dem man inte kommer åt. Panelen är
               det man läser just då; Idag-knappen är ett hjälpmedel medan man
               rullar. Från 768 px bor panelen i egen kolumn och krocken finns
               inte. */
            dagar.length > 0 ? "hidden lg:flex" : "flex",
          )}
        >
          <span aria-hidden="true">{riktning === "upp" ? "↑" : "↓"}</span>
          Idag
        </button>
      ) : null}
      </div>

      {/*
        ⛔ SAMMA NOD I BÅDA LÄGENA, med brytpunkten som enda skillnad. Två
        renderingar av samma panel hade betytt två ställen att rätta, och den ena
        hade varit den som ingen tittar på.

        TELEFON: `fixed` längst ner, ovanpå rutnätet, utan luft under.
        `pointer-events-none` på omslaget så den osynliga remsan inte äter tryck
        på dagarna under; panelen själv tar tillbaka dem.

        FRÅN 768 px: en vanlig kolumn i raden, 300 px, och 360 px från 1024 px.
        Förebildens egna tal.
      */}
      <div
        className={cx(
          "pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom))] z-(--z-sticky) flex justify-center px-4",
          "lg:pointer-events-auto lg:static lg:z-auto lg:block lg:w-75 lg:shrink-0 lg:px-0 xl:w-90",
        )}
      >
        {/* ⛔ KRYSSET OCH ESCAPE TÖMMER HELA URVALET och inte den översta dagen.
            Panelen är ETT objekt på skärmen, så en stängning som lämnade två av
            tre dagar kvar hade sett ut som att knappen inte fungerade. Enskilda
            dagar tas bort på sitt eget piller, eller med ett andra tryck i
            rutnätet. */}
        {dagar.length > 0 ? (
          <Dagspanel
            dagar={dagar}
            statusOrd={statusOrd}
            onStang={() => setValda([])}
            onTaBort={(n) => setValda((forra) => forra.filter((x) => x !== n))}
          />
        ) : (
          /* ⛔ BARA PÅ BREDA SKÄRMAR. Kolumnen finns redan där och är tom, så en
              rad om vad den är till för kostar ingenting. På telefon finns ingen
              kolumn att förklara, och en ruta längst ner som säger «tryck på en
              dag» hade legat i vägen för dagarna man ska trycka på. */
          <p className="m-0 hidden rounded-md border border-dashed border-line p-3 text-sm text-ink-muted lg:block">
            Tryck på en dag för att se vad som ligger där. Tryck på fler för att samla dem.
          </p>
        )}
      </div>
    </section>
  );
}
