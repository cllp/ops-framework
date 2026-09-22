import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { MANADSNAMN, datumnyckel, datumtext, idagsnyckel, manader, manadsrutnat, perDag } from "../lib/kalender.js";
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

/**
 * En dags poster i bubblan, med sitt datum över sig när det behövs.
 *
 * ⛔ EN POST MED `url` BLIR EN LÄNK, resten blir text. En rad som ser tryckbar ut
 * och inte är det är ett löfte som inte infrias, och i en kalender över stängda
 * ärenden är länken hela poängen: man öppnar dagen för att komma vidare.
 *
 * ⛔ DATUMRUBRIKEN RITAS BARA NÄR FLERA DAGAR ÄR VALDA, och det är inte snålhet.
 * Är EN dag vald står datumet redan i bubblans egen rubrik, och samma datum två
 * gånger med tio pixlar emellan får läsaren att leta efter skillnaden. Är flera
 * valda är datumet tvärtom det enda som skiljer posterna åt.
 *
 * @param {{ nyckel: string, poster: import("../lib/kalender.js").Kalenderpost[], statusOrd: Record<string, string>, visaDatum: boolean }} props
 */
function Dagsgrupp({ nyckel, poster, statusOrd, visaDatum }) {
  return (
    <div className="flex flex-col gap-1">
      {visaDatum ? (
        <h5 className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">{datumtext(nyckel)}</h5>
      ) : null}
      {poster.map((p) => (
        <div key={p.id} className="flex items-baseline gap-2">
          {/* ⛔ HÄR får pricken finnas, för här finns plats för ordet bredvid.
              Saknar appen ordet för ett läge kastar `OpsStatusDot`, och det är
              rätt: en färg utan ord är inget besked. */}
          {p.status ? (
            <span className="shrink-0 translate-y-0.5">
              <OpsStatusDot status={p.status} label={statusOrd[p.status] || ""} />
            </span>
          ) : null}
          <span className="min-w-0">
            {p.url ? (
              <a
                className="font-semibold text-accent underline decoration-from-font underline-offset-2 hover:text-accent-hover"
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {p.titel}
              </a>
            ) : (
              <span className="font-semibold text-ink">{p.titel}</span>
            )}
            {p.not ? <span className="block text-sm text-ink-secondary">{p.not}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * De valda dagarnas poster, i en flytande inverterad bubbla.
 *
 * ══ ⛔ FLERA DAGAR I SAMMA BUBBLA, INTE EN BUBBLA PER DAG ═══════════════
 *
 * CP 2026-09-22: "jag kan markera flera som gör listan i bubblorna scrollbar och
 * datumen finns med på denna tryckt på."
 *
 * En bubbla per vald dag hade krävt att de staplas eller läggs bredvid varandra,
 * alltså positionering och kollisionshantering, och på en telefon hade den andra
 * täckt den första. EN bubbla som växer inuti sig själv har inget av det: den
 * står på samma plats hur många dagar man än markerar.
 *
 * ⛔ RUBRIKEN BYTER FRÅGA MED ANTALET. En dag: "12 oktober", alltså vilken ruta
 * man träffade. Flera: "3 dagar", alltså hur mycket man samlat, eftersom varje
 * grupp då bär sitt eget datum längre ner och ett av tre datum i rubriken hade
 * varit godtyckligt.
 *
 * ══ ⛔ LISTAN RULLAR, INTE BUBBLAN ═════════════════════════════════════
 *
 * Rubriken och krysset ligger UTANFÖR den rullande delen. Rullade hela bubblan
 * skulle krysset rulla ur bild så fort man markerat fyra dagar, alltså skulle
 * vägen ut försvinna precis när man börjat behöva den.
 *
 * ⛔ `min-h-0` PÅ LISTAN ÄR INTE PRYDNAD. En flexbarnnod vägrar krympa under sitt
 * innehåll som standard, så utan den växer listan förbi bubblans tak och
 * `overflow-y-auto` får aldrig något att göra: bubblan hade svällt ut ur fönstret
 * i stället för att rulla.
 *
 * @param {{ dagar: { nyckel: string, poster: import("../lib/kalender.js").Kalenderpost[] }[], statusOrd: Record<string, string>, onStang: () => void }} props
 */
function Dagsbubbla({ dagar, statusOrd, onStang }) {
  const flera = dagar.length > 1;
  const rubrik = flera ? `${dagar.length} dagar` : datumtext(dagar[0].nyckel);
  const namn = flera ? `Poster för ${dagar.length} valda dagar` : `Poster den ${rubrik}`;

  /*
   * ⛔ ESCAPE STÄNGER, och den lyssnaren sitter på fönstret och inte på bubblan.
   * Fokus ligger kvar på dagsrutan man tryckte på, alltså utanför bubblan, så en
   * lyssnare på bubblans egen nod hade aldrig hört tangenten.
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
    /*
     * ⛔ `pointer-events-none` på omslaget och `pointer-events-auto` på bubblan,
     * precis som i `OpsFloatingSummary`. Omslaget spänner hela bredden för att
     * kunna centrera, och utan det hade den osynliga remsan ätit varje tryck
     * längs nederkanten, alltså också trycken på kalenderdagarna under den.
     */
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--safe-bottom)+var(--bottom-nav-overhang)+0.75rem)] z-(--z-sticky) flex justify-center px-5 md:bottom-[calc(var(--safe-bottom)+1.25rem)]">
      <section
        aria-label={namn}
        className="ops-contrast-panel pointer-events-auto flex max-h-[50svh] w-full max-w-sm flex-col rounded-3xl border border-line bg-contrast-panel py-3 pl-4 pr-3 shadow-lg"
      >
        {/* ⛔ RUBRIKRADEN LIGGER UTANFÖR RULLNINGEN, se doktexten: krysset får
            inte rulla ur bild när man markerat fyra dagar. */}
        <div className="flex shrink-0 items-start gap-2">
          <h4 className="m-0 flex-1 text-sm font-semibold text-ink">{rubrik}</h4>
          {/* ⛔ KRYSSET BÄR RUBRIKEN I SITT NAMN. "Stäng" ensamt säger inte vad
              som stängs för den som lyssnar sig igenom sidan. */}
          <button
            type="button"
            onClick={onStang}
            aria-label={`Stäng ${rubrik}`}
            className={cx(
              "-mt-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-secondary",
              "hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            )}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pt-2">
          {dagar.map((d) => (
            <Dagsgrupp key={d.nyckel} nyckel={d.nyckel} poster={d.poster} statusOrd={statusOrd} visaDatum={flera} />
          ))}
        </div>
      </section>
    </div>
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

  useEffect(() => {
    const el = idagRef.current;
    const rulle = rulleRef.current;
    if (!el || !rulle || typeof IntersectionObserver !== "function") return undefined;
    const obs = new IntersectionObserver(
      ([traff]) => {
        setVisaTillbaka(!traff.isIntersecting);
        if (traff.isIntersecting) return;
        // Pilen pekar åt det håll man ska rulla för att nå idag.
        const topp = traff.rootBounds ? traff.rootBounds.top : 0;
        setRiktning(traff.boundingClientRect.bottom <= topp ? "upp" : "ner");
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
    <section aria-label={ariaLabel} className="relative">
      {/* ⛔ TAKET GÖR KALENDERN TILL SIN EGEN RULLE. Se filens huvud: utan det
          rullar sidan, veckodagsraden nyper under appens toppmeny och vägen
          tillbaka till idag går genom hela vyn.

          ⛔ `relative` ÄR INTE PRYDNAD. Månadsblocken mäter sin plats med
          `offsetTop`, alltså mot närmaste positionerade förälder, och utan den
          här klassen räknas de mot sidan och rullningen landar fel. */}
      <div
        ref={rulleRef}
        className="relative max-h-[60svh] overflow-y-auto overscroll-contain rounded-md border border-line bg-canvas px-1"
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

      {/* ⛔ `absolute` I KALENDERNS EGET HÖRN, inte `sticky` i flödet. Knappen
          hör till rutnätet och ska stå still medan det rullar under den, och
          `sticky` kunde bara nypa inom sin förälders rullsträcka. */}
      {visaTillbaka ? (
        <button
          type="button"
          onClick={() => tillIdag("smooth")}
          className={cx(
            "absolute right-4 bottom-4 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-raised px-4 text-sm font-semibold text-ink shadow-md",
            "hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <span aria-hidden="true">{riktning === "upp" ? "↑" : "↓"}</span>
          Idag
        </button>
      ) : null}

      {/* ⛔ KRYSSET OCH ESCAPE TÖMMER HELA URVALET och inte den översta dagen.
          Bubblan är ETT objekt på skärmen, så en stängning som lämnade två av
          tre dagar kvar hade sett ut som att knappen inte fungerade. Enskilda
          dagar tas bort där de valdes, med ett andra tryck i rutnätet. */}
      {dagar.length > 0 ? (
        <Dagsbubbla dagar={dagar} statusOrd={statusOrd} onStang={() => setValda([])} />
      ) : null}
    </section>
  );
}
