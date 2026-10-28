import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rapporteraFel } from "./felrapport.js";
import {
  aterstallKalenderSynlighet,
  arEnsamSynlig,
  arForvaldSynlighet,
  arKalenderSynlig,
  doldaKalenderIds,
  harKalenderVal,
  kalenderSynlighetNyckel,
  kalenderValForManga,
  MAX_KALENDERVAL,
  kalenderVisning,
  lasKalenderSynlighet,
  rensaKalenderSynlighet,
  sattKalenderVisning,
  skrivKalenderSynlighet,
  synligaKalenderRader,
  TOM_SYNLIGHET,
  vaxlaKalenderSynlighet,
  visaBaraKalender,
} from "./kalendersynlighet.js";
import { delaPosterPaSynlighet, forvaldKalenderId } from "./calendar.js";

/**
 * Lagringen som den ser ut för den som läser: `getItem` och `setItem`. `setItem` får svara med ett löfte (en app som sparar på en server), men
 * ingenting i kalendern väntar på det.
 * @typedef {{ getItem: (n: string) => string | null, setItem: (n: string, v: string) => void | Promise<unknown> }} Kalenderlagring
 */

/**
 * Kontot som valen också bor på (0.151.0): två funktioner, båda får svara med ett löfte. `las` ger dokumentet (formen i `kalenderValDokument`) eller `null` när kontot inte har något än,
 * och KASTAR när det inte gick att fråga ("fanns inget" och "kunde inte fråga" är olika saker). `skriv` får hela minnet (`KalenderSynlighet`) och ersätter dokumentet.
 * `createKalendervalskalla(...).konto(uid, gruppId)` är Firestore-vägen; en app utan Firebase skickar sin egen, eller ingen alls.
 * @typedef {{ las: () => Promise<unknown> | unknown, skriv: (val: import("./kalendersynlighet.js").KalenderSynlighet) => Promise<unknown> | unknown }} Kalenderkonto
 */

/** @returns {Kalenderlagring | undefined} */
function webblasarlagring() {
  // `window.localStorage` KAN KASTA bara genom att läsas (SecurityError i ett blockerat läge), och då ska kalendern fungera utan minne.
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {Kalenderlagring | undefined} lager
 * @param {string} nyckel
 */
function lasFran(lager, nyckel) {
  if (!nyckel || !lager) return lasKalenderSynlighet(null);
  try {
    return lasKalenderSynlighet(lager.getItem(nyckel));
  } catch (fel) {
    rapporteraFel(fel, { yta: "useKalenderSynlighet", steg: "läsa synlighet" });
    return lasKalenderSynlighet(null);
  }
}

/**
 * Vilka kalendrar som syns och hur de visas, ur ETT minne per person och grupp (0.134.0, cllp/lifehub.app#402). `OpsCalendar` använder den själv;
 * en vy som ska följa samma val (Idag) anropar den med SAMMA `minne` och samma `kalendrar`.
 *
 * ══ ⛔ ETT TRYCK ÄNDRAR TILLSTÅNDET DIREKT, OCH SPARAR SEN ═══════════════════════════════════════════════════════════
 *
 * CP 2026-10-21: "Utan fördröjning. Ett tryck ändrar kalendern direkt ur det som redan är laddat, och valet sparas i bakgrunden."
 * Valet är React-tillstånd och ändras i samma tryck; sparandet är en effekt EFTER att det ritats. Det väntar aldrig på `setItem`, och svarar
 * den med ett löfte som aldrig löses (en server som inte svarar) ändras kalendern ändå. Det finns ingen hämtning här att vänta på:
 * kalendern filtrerar posterna den redan har. Ett fel vid sparandet rapporteras (`rapporteraFel`) men rullar inte tillbaka valet: det som
 * ritades är det personen bad om, och att det inte sparades syns vid nästa besök.
 *
 * ⛔ UTAN `minne` GÄLLER VALET BARA DEN HÄR VISNINGEN. Ramverket känner inte personen eller gruppen; en app som inte skickar `minne` får
 * listan men inget som överlever en omladdning, och det är dokumenterat och inte ett fel.
 *
 * ══ ⛔ KONTOT ÄR HEMMET, WEBBLÄSAREN ÄR EN FÖRHANDSCACHE (0.151.0) ═══════════════════════════════════════════════════
 *
 * CP 2026-10-28: "Väljer jag ram i mobilen syns det inte på datorn." Med `konto` (se `Kalenderkonto`) följer valen personen mellan enheterna:
 *
 *   - KALENDERN RITAS DIREKT med det lokala minnet, som förut. Kontots värde hämtas efteråt och ERSÄTTER det när det kommer (och skrivs till det lokala minnet, så att nästa
 *     besök på den här enheten börjar med det som gäller).
 *   - ETT TRYCK SOM GJORDES MEDAN KONTOT HÄMTADES FÖRLORAS INTE: det spelas upp igen ovanpå kontots värde. Personens senaste tryck vinner över det hon inte hunnit se.
 *   - FÖRSTA GÅNGEN (kontot har inget dokument alls) lyfts de lokala valen upp en gång, om det finns några, så att ingen förlorar det hen redan valt. Ett tomt lokalt minne
 *     skriver ingenting: ett dokument som bara säger "förval" är inte ett val. Ett dokument som finns vinner alltid, också ett tomt (det är "Alla kalendrar" på en annan enhet).
 *   - ETT TRYCK SKRIVS DIREKT OCH OPTIMISTISKT. ⛔ HÖGST EN SKRIVNING ÄR PÅGÅENDE, och snabba tryck i följd samlas: medan en skrivning väntar markeras bara att något nyare finns,
 *     och när den är klar skrivs det SENASTE en gång. Tävlande skrivningar kan komma fram i fel ordning, och då hade ett äldre val stått kvar på kontot. Den sista vinner.
 *   - ⛔ FELET SYNS, ALDRIG TYST: `kontoFel` är "las" (kontot gick inte att läsa, det som visas är den här enhetens) "skriv" (valet sparades inte på kontot) eller "formanga" (valen har fler poster än kontot får bära, `MAX_KALENDERVAL`: inget försöks skrivas, felet rapporteras en gång och går över när valen åter ryms).
 *     Listan skriver ut det med en knapp, `sparaIgen`. Ett nytt val försöker igen av sig själv. Valet rullas aldrig tillbaka: det som ritades är det personen bad om.
 *   - ⛔ EN LÄSNING SOM MISSLYCKADES SKRIVER INGET: kontots värde är okänt, och att skriva den här enhetens val över det hade kunnat ta bort det en annan enhet valt. Nästa val
 *     försöker läsa igen först.
 *   - ⛔ EN FLIK SOM BLIR SYNLIG LÄSER OM KONTOT (`visibilitychange`) och tar det om det ändrats på en annan enhet och fliken inte har något osparat. Annars skriver en flik som stått öppen
 *     sedan i går sitt gamla läge över det som valts i mobilen sedan dess. Ingen lyssnare medan fliken är öppen: en ändring på en annan enhet syns när man kommer tillbaka, inte medan man tittar.
 *   - UTAN `konto` (en app utan Firebase) är allt som förut, bara det lokala minnet. Kärnan ska gå att använda utan Firebase.
 *
 * ⛔ `konto` BYTS INTE UT UNDER LIVET: den gäller för det `minne` den skickades med, och en app som byter grupp byter både `minne` och `konto`. Ändras bara `konto`
 * (ett nytt objekt för samma minne, som en app som inte `useMemo`:ar det) läses inget om, och den gamla gäller tills `minne` byts.
 *
 * @param {object} props
 * @param {string} [props.minne] Vem och vilken grupp valet gäller, appens val. Sparas under `kalenderSynlighetNyckel(minne)`.
 * @param {ReadonlyArray<{ id: string, avFranStart?: boolean }>} [props.kalendrar] Raderna. Utan dem finns inget att välja.
 * @param {Kalenderlagring} [props.lagring] Förval `window.localStorage` när den går att läsa.
 * @param {Kalenderkonto} [props.konto] (0.151.0) Kontot valen också bor på. Utan: bara det lokala minnet.
 * @param {(ids: string[]) => void} [props.onSynliga] Id:n som syns, i radernas ordning, en gång vid start och varje gång mängden ändras.
 */
export function useKalenderSynlighet({ minne = "", kalendrar, lagring, konto, onSynliga }) {
  const lager = lagring || webblasarlagring();
  const nyckel = minne ? kalenderSynlighetNyckel(minne) : "";
  const [state, setState] = useState(() => ({ nyckel, val: lasFran(lager, nyckel) }));
  // Byter appen minne (en annan grupp) läses det nya under samma ritning. Ett `useEffect` hade ritat en gång med den förra gruppens val.
  let aktuell = state;
  if (state.nyckel !== nyckel) {
    aktuell = { nyckel, val: lasFran(lager, nyckel) };
    setState(aktuell);
  }
  const val = aktuell.val;
  const valRef = useRef(val);
  valRef.current = val;

  const kontoRef = useRef(konto);
  kontoRef.current = konto;
  const harKonto = Boolean(konto) && nyckel !== "";
  /** @type {import("react").MutableRefObject<Kontostyrning | null>} */
  const styr = useRef(null);
  const [kontoFel, setKontoFel] = useState(/** @type {null | "las" | "skriv" | "formanga"} */ (null));

  const andra = useCallback(
    /** @param {(v: import("./kalendersynlighet.js").KalenderSynlighet) => import("./kalendersynlighet.js").KalenderSynlighet} fn */
    (fn) => {
      setState((s) => (s.nyckel === nyckel ? { nyckel, val: fn(s.val) } : s));
      // ⛔ Medan kontot hämtas (eller inte gick att hämta) sparas varje tryck som en funktion, och spelas upp ovanpå kontots värde när det kommer.
      const c = styr.current;
      // ⛔ Också medan kontot LÄSES OM (`omlaser`): ett tryck innan svaret kommit köas och spelas upp ovanpå svaret, som under första hämtningen (kontrollgranskningen av PR 458, fynd 1).
      if (c && c.nyckel === nyckel && (c.status !== "klar" || c.omlaser)) {
        c.ops.push(fn);
        if (c.status === "lasfel") ladda(c, setState, setKontoFel, valRef);
      }
    },
    [nyckel],
  );

  // Kontot: hämta en gång per minne, och sluta lyssna när minnet byts eller vyn försvinner.
  useEffect(() => {
    if (!harKonto) {
      styr.current = null;
      setKontoFel(null);
      return;
    }
    const c = /** @type {Kontostyrning} */ ({ nyckel, konto: /** @type {Kalenderkonto} */ (kontoRef.current), status: "laser", ops: [], kontoText: null, onskadVal: null, onskadText: null, iflygning: false, avslutad: false, omlaser: false, forManga: false });
    styr.current = c;
    setKontoFel(null);
    ladda(c, setState, setKontoFel, valRef);
    return () => {
      c.avslutad = true;
      if (styr.current === c) styr.current = null;
    };
  }, [nyckel, harKonto]);

  // ⛔ EN FLIK SOM BLIR SYNLIG LÄSER OM KONTOT. Utan det skriver en flik som stått öppen sedan i går sitt GAMLA läge över det personen valt i mobilen sedan dess (ett dokument per grupp, den sista
  // skrivningen vinner): hela poängen med att valen följer kontot hade blivit en källa till förlorade val. Det kostar en läsning när fliken blir synlig, inte en lyssnare medan den är öppen.
  // Kontots nya värde tas bara när fliken inte har något osparat: ett val som inte nått kontot (ett skrivfel) skrivs aldrig över av en omläsning.
  useEffect(() => {
    if (!harKonto || typeof document === "undefined") return;
    const vidSynlig = () => {
      if (document.visibilityState !== "visible") return;
      const c = styr.current;
      if (c && c.nyckel === nyckel && c.status === "klar" && !c.iflygning) lasaOm(c, setState, valRef, setKontoFel);
    };
    document.addEventListener("visibilitychange", vidSynlig);
    return () => document.removeEventListener("visibilitychange", vidSynlig);
  }, [nyckel, harKonto]);

  // Sparandet, efter ritningen. `sparat` är det som redan ligger i lagringen eller just lästes därifrån, så att ett byte av minne inte skriver.
  const sparat = useRef({ nyckel, text: skrivKalenderSynlighet(val) });
  useEffect(() => {
    const text = skrivKalenderSynlighet(val);
    if (sparat.current.nyckel !== nyckel) {
      sparat.current = { nyckel, text };
      return;
    }
    if (sparat.current.text === text) return;
    sparat.current = { nyckel, text };
    if (!nyckel || !lager) return;
    try {
      const svar = lager.setItem(nyckel, text);
      if (svar && typeof (/** @type {Promise<unknown>} */ (svar)).then === "function") {
        /** @type {Promise<unknown>} */ (svar).then(undefined, (fel) => rapporteraFel(fel, { yta: "useKalenderSynlighet", steg: "spara synlighet" }));
      }
    } catch (fel) {
      rapporteraFel(fel, { yta: "useKalenderSynlighet", steg: "spara synlighet" });
    }
  }, [val, nyckel, lager]);

  // Och till kontot, när det är läst och valet skiljer sig från det som står där. ⛔ Kontots eget värde som just lästs skrivs inte tillbaka (`kontoText` är det).
  useEffect(() => {
    const c = styr.current;
    if (!c || c.nyckel !== nyckel || c.status !== "klar") return;
    // ⛔ Under en omläsning skrivs ingenting: trycken är köade och spelas upp ovanpå kontots svar, och en skrivning av det GAMLA läget med trycket ovanpå skulle ta bort det som valts på en annan enhet.
    if (c.omlaser) return;
    const text = skrivKalenderSynlighet(val);
    // ⛔ Medan en skrivning väntar räknas också ett val som är lika med det som stod där SIST: personen kan ha ändrat tillbaka, och då ska det gamla skrivas igen när den väntande är klar.
    // (`forManga`: felet "för många val" ska också släckas när valen åter är de som redan står på kontot.)
    if (text === kontoBas(c) && !c.iflygning && !c.forManga) return;
    planera(c, val, text, setKontoFel);
  }, [val, nyckel, harKonto]);

  const rader = useMemo(() => (kalendrar || []).filter((r) => r && typeof r.id === "string" && r.id.length > 0), [kalendrar]);
  const synliga = useMemo(() => synligaKalenderRader(rader, val).map((r) => r.id), [rader, val]);
  const dolda = useMemo(() => doldaKalenderIds(rader, val), [rader, val]);
  const forvaldId = useMemo(() => forvaldKalenderId(/** @type {any} */ (kalendrar)), [kalendrar]);

  // Bara när det finns rader: en app utan kalendrar har inget att följa. Samma nyckel två gånger ger inget anrop.
  const onSynligaRef = useRef(onSynliga);
  onSynligaRef.current = onSynliga;
  const senast = useRef(/** @type {string | null} */ (null));
  useEffect(() => {
    if (!kalendrar) {
      senast.current = null;
      return;
    }
    const k = synliga.join("\0");
    if (senast.current === k) return;
    senast.current = k;
    onSynligaRef.current?.(synliga);
  }, [kalendrar, synliga]);

  const radPerId = useMemo(() => new Map(rader.map((r) => [r.id, r])), [rader]);
  return {
    /** Id:n som syns, i radernas ordning. */
    synliga,
    /** (0.151.0) Id:n som INTE syns, i radernas ordning. Det Dagen frågar efter, via `dela`. */
    dolda,
    /** Personens egna visningsval, `{ [id]: "ram" | "bada" }`. En rad som inte står här visas som händelser. Samma objekt tills något ändras. */
    visningar: val.visning,
    /** @param {string} id */
    arSynlig: (id) => {
      const r = radPerId.get(id);
      return r ? arKalenderSynlig(r, val) : true;
    },
    /** @param {string} id */
    visning: (id) => {
      const r = radPerId.get(id);
      return r ? kalenderVisning(r, val) : "handelser";
    },
    /** Allt som det var från början: varje rad har sitt förval. */
    arForval: arForvaldSynlighet(rader, val),
    /** @param {string} id */
    vaxla: (id) => {
      const r = radPerId.get(id);
      if (r) andra((v) => vaxlaKalenderSynlighet(r, v));
    },
    /** @param {string} id @param {import("./kalendersynlighet.js").Kalendervisning} visning */
    valjVisning: (id, visning) => {
      const r = radPerId.get(id);
      if (r) andra((v) => sattKalenderVisning(r, visning, v));
    },
    /**
     * (0.151.0) "Visa bara den här": raden blir ensam synlig. Samma val en gång till, när den redan är det, tar tillbaka valen som gällde före (`visaBaraKalender`).
     * @param {string} id
     */
    visaBara: (id) => {
      const r = radPerId.get(id);
      if (r) andra((v) => visaBaraKalender(r, rader, v));
    },
    /** (0.151.0) Är det här den enda raden som syns? Då är "Visa bara den här" ett återtag. @param {string} id */
    arEnsam: (id) => {
      const r = radPerId.get(id);
      return r ? arEnsamSynlig(r, rader, val) : false;
    },
    /** (0.151.0) Finns det mer än en rad? Med en enda kalender betyder "visa bara den här" ingenting. */
    kanVisaBara: rader.length > 1,
    /**
     * (0.151.0) Delar poster i de som syns och de som är dolda av kalenderlistan, samma avgörande som månadsvyns snabbtitt. För appens Dagen: visa de dolda blekta (`DOLD_RAD_KLASS`)
     * och märkta (`OpsDoldMarke`) på ett tryck, utan att ändra valen.
     * @template {{ kalender?: { id: string } | null }} T
     * @param {readonly T[]} poster
     */
    dela: (poster) => delaPosterPaSynlighet(poster, { dolda, forvaldId }),
    /** (0.151.0) Vad som gick fel mot kontot: "las" (kontot gick inte att läsa) "skriv" (valet sparades inte där) eller "formanga" (för många val sparade för kontot). `null` när allt är som det ska. */
    kontoFel,
    /** (0.151.0) Försök igen: läser kontot om det inte gick, annars skrivs det senaste valet. Gör ingenting utan konto. */
    sparaIgen: () => {
      const c = styr.current;
      if (!c || c.nyckel !== nyckel || c.omlaser) return;
      if (c.status === "lasfel") ladda(c, setState, setKontoFel, valRef);
      else if (c.status === "klar") planera(c, valRef.current, skrivKalenderSynlighet(valRef.current), setKontoFel, true);
    },
    aterstall: () => andra(aterstallKalenderSynlighet),
  };
}

/**
 * Styrningen mot kontot för ETT minne. Ett nytt objekt för varje minne, så att ett svar som kommer efter ett byte av grupp aldrig skrivs in i fel grupp.
 * @typedef {object} Kontostyrning
 * @property {string} nyckel
 * @property {Kalenderkonto} konto
 * @property {"laser" | "klar" | "lasfel"} status
 * @property {Array<(v: import("./kalendersynlighet.js").KalenderSynlighet) => import("./kalendersynlighet.js").KalenderSynlighet>} ops Tryck som gjorts innan kontots värde var känt, i ordning.
 * @property {string | null} kontoText Texten som står på kontot (läst eller skriven). `null`: kontot har inget dokument.
 * @property {import("./kalendersynlighet.js").KalenderSynlighet | null} onskadVal Det senaste valet, som ska ligga på kontot.
 * @property {boolean} omlaser Kontot läses om just nu: trycken köas i `ops` och ingenting skrivs.
 * @property {boolean} forManga Valen har fler poster än kontot får bära (`kalenderValForManga`): inget försöks skrivas och felet är rapporterat.
 * @property {string | null} onskadText
 * @property {boolean} iflygning En skrivning väntar på svar. Högst en.
 * @property {boolean} avslutad Vyn försvann eller minnet byttes: inget tillstånd rörs mer, men en skrivning som redan går avslutas.
 */

/** Texten för ett tomt val: vad kontot "har" när det inte har något dokument. En flik utan val och ett konto utan dokument är samma läge. */
const TOMTEXT = skrivKalenderSynlighet(TOM_SYNLIGHET);

/**
 * Texten som står på kontot, och TOMTEXT när det inte har något dokument (`kontoText` är `null`). ⛔ Jämförelser går mot den här och aldrig mot `null` (granskningen av PR 458, fynd 1):
 * mot `null` är varje text "olika", och en flik utan val mot ett konto utan dokument trodde sig ha något osparat och tog aldrig upp en annan enhets val.
 * @param {Kontostyrning} c
 */
const kontoBas = (c) => c.kontoText ?? TOMTEXT;

/**
 * Hämtar kontots värde. Kallas vid start och när en läsning som misslyckats ska försökas igen.
 * @param {Kontostyrning} c
 * @param {import("react").Dispatch<import("react").SetStateAction<{ nyckel: string, val: import("./kalendersynlighet.js").KalenderSynlighet }>>} setState
 * @param {(f: null | "las" | "skriv" | "formanga") => void} setKontoFel
 * @param {import("react").MutableRefObject<import("./kalendersynlighet.js").KalenderSynlighet>} valRef
 */
function ladda(c, setState, setKontoFel, valRef) {
  c.status = "laser";
  /** @type {Promise<unknown>} */
  let lopp;
  try {
    lopp = Promise.resolve(c.konto.las());
  } catch (fel) {
    lopp = Promise.reject(fel);
  }
  lopp.then(
    (data) => {
      if (c.avslutad) return;
      c.status = "klar";
      setKontoFel(null);
      const kontots = data === null || data === undefined ? null : rensaKalenderSynlighet(data);
      if (kontots) {
        c.kontoText = skrivKalenderSynlighet(kontots);
        const ny = c.ops.reduce((v, fn) => fn(v), kontots);
        c.ops = [];
        setState((s) => (s.nyckel === c.nyckel ? { nyckel: c.nyckel, val: ny } : s));
        return;
      }
      // Kontot har inget dokument: det lokala är det enda som finns, och lyfts upp en gång om det är något.
      c.kontoText = null;
      c.ops = [];
      const lokalt = valRef.current;
      if (harKalenderVal(lokalt)) planera(c, lokalt, skrivKalenderSynlighet(lokalt), setKontoFel);
    },
    (fel) => {
      if (c.avslutad) return;
      c.status = "lasfel";
      rapporteraFel(fel, { yta: "useKalenderSynlighet", steg: "läsa synlighet från kontot" });
      setKontoFel("las");
    },
  );
}

/**
 * Läser kontot igen och tar dess värde om det ändrats på en annan enhet och den här fliken inte har något osparat. Ett fel rapporteras men syns inte i listan: det är en bakgrundsläsning
 * personen inte bad om, och det hon ser är fortfarande det hon har.
 *
 * ⛔ ETT TRYCK MEDAN SVARET VÄNTAR KÖAS OCH SPELAS UPP OVANPÅ SVARET (kontrollgranskningen av PR 458, fynd 1, CP:s eget fall). Telefonen döljer Styrelsen. Datorns flik blir synlig, och personen trycker
 * innan svaret kommit. Förut släpptes svaret och trycket skrevs ovanpå det GAMLA läget, så telefonens val försvann från kontot. Nu läggs trycket i `ops` (`omlaser`) och ingenting skrivs under
 * läsningen; när svaret kommer tas kontots värde, trycken spelas upp ovanpå det (som `ladda` gör med trycken under första hämtningen) och resultatet skrivs.
 * @param {Kontostyrning} c
 * @param {import("react").Dispatch<import("react").SetStateAction<{ nyckel: string, val: import("./kalendersynlighet.js").KalenderSynlighet }>>} setState
 * @param {import("react").MutableRefObject<import("./kalendersynlighet.js").KalenderSynlighet>} valRef
 * @param {(f: null | "las" | "skriv" | "formanga") => void} setKontoFel
 */
function lasaOm(c, setState, valRef, setKontoFel) {
  // Ett osparat val (ett skrivfel) skrivs aldrig över av en omläsning, och då behövs ingen läsning alls.
  if (skrivKalenderSynlighet(valRef.current) !== kontoBas(c)) return;
  c.omlaser = true;
  c.ops = [];
  /** @type {Promise<unknown>} */
  let lopp;
  try {
    lopp = Promise.resolve(c.konto.las());
  } catch (fel) {
    lopp = Promise.reject(fel);
  }
  /** Läsningen är slut: trycken som köades under den, och köandet av nya upphör. */
  const klar = () => {
    c.omlaser = false;
    const ops = c.ops;
    c.ops = [];
    return ops;
  };
  lopp.then(
    (data) => {
      const ops = klar();
      // Vyn kan ha försvunnit. Ingen skrivning kan ha startat under läsningen: `omlaser` stoppar både effekten och Försök igen.
      if (c.avslutad || c.status !== "klar") return;
      const kontots = data === null || data === undefined ? null : rensaKalenderSynlighet(data);
      if (ops.length === 0) {
        // Inga tryck: bara kontots nya värde (det lokala är oförändrat sedan läsningen startade, annars hade ett tryck köats).
        if (!kontots) return;
        const text = skrivKalenderSynlighet(kontots);
        if (text === kontoBas(c)) return;
        c.kontoText = text;
        setState((s) => (s.nyckel === c.nyckel ? { nyckel: c.nyckel, val: kontots } : s));
        return;
      }
      if (!kontots) {
        // Kontot har inget dokument: trycken gäller ovanpå det lokala, och skrivs.
        planera(c, valRef.current, skrivKalenderSynlighet(valRef.current), setKontoFel);
        return;
      }
      // Trycken ovanpå kontots värde. Effekten som skriver till kontot ser det nya valet och skriver det.
      c.kontoText = skrivKalenderSynlighet(kontots);
      const ny = ops.reduce((v, fn) => fn(v), kontots);
      setState((s) => (s.nyckel === c.nyckel ? { nyckel: c.nyckel, val: ny } : s));
    },
    (fel) => {
      const ops = klar();
      rapporteraFel(fel, { yta: "useKalenderSynlighet", steg: "läsa om synlighet från kontot" });
      // Trycken gäller på den här enheten som de är, och skrivs som vanligt.
      if (!c.avslutad && ops.length > 0) planera(c, valRef.current, skrivKalenderSynlighet(valRef.current), setKontoFel);
    },
  );
}

/**
 * Anmäler att `val` ska ligga på kontot. Medan en skrivning väntar markeras bara det nyaste; när den är klar skrivs det en gång.
 * @param {Kontostyrning} c
 * @param {import("./kalendersynlighet.js").KalenderSynlighet} val
 * @param {string} text
 * @param {(f: null | "las" | "skriv" | "formanga") => void} setKontoFel
 * @param {boolean} [tvinga] Skriv också när texten redan är den som står där (Försök igen efter ett fel).
 */
function planera(c, val, text, setKontoFel, tvinga = false) {
  c.onskadVal = val;
  c.onskadText = text;
  if (c.iflygning) return;
  kor(c, setKontoFel, tvinga);
}

/**
 * @param {Kontostyrning} c
 * @param {(f: null | "las" | "skriv" | "formanga") => void} setKontoFel
 * @param {boolean} [tvinga]
 */
function kor(c, setKontoFel, tvinga = false) {
  const val = c.onskadVal;
  const text = c.onskadText;
  if (!val || text === null) return;
  // ⛔ FÖR MÅNGA VAL (kontrollgranskningen av PR 458, fynd 6): taket prövas INNAN skrivningen. Det är ett känt läge med eget besked ("formanga"), inte ett skrivfel som kommer tillbaka vid varje
  // tryck: ingen skrivning försöks och felet rapporteras en gång, tills valen åter ryms (då skrivs de och felet försvinner).
  if (kalenderValForManga(val)) {
    if (!c.forManga) {
      c.forManga = true;
      rapporteraFel(new Error("useKalenderSynlighet: för många val för kontot (högst " + MAX_KALENDERVAL + " per lista)."), { yta: "useKalenderSynlighet", steg: "spara synlighet på kontot" });
    }
    if (!c.avslutad) setKontoFel("formanga");
    return;
  }
  if (c.forManga) {
    c.forManga = false;
    if (!c.avslutad) setKontoFel(null);
  }
  if (!tvinga && text === kontoBas(c)) return;
  c.iflygning = true;
  /** @type {Promise<unknown>} */
  let lopp;
  try {
    lopp = Promise.resolve(c.konto.skriv(val));
  } catch (fel) {
    lopp = Promise.reject(fel);
  }
  lopp.then(
    () => {
      c.iflygning = false;
      c.kontoText = text;
      if (!c.avslutad) setKontoFel(null);
      // Något nyare kom medan den här väntade: nu skrivs det, en gång.
      if (c.onskadText !== text) kor(c, setKontoFel);
    },
    (fel) => {
      c.iflygning = false;
      rapporteraFel(fel, { yta: "useKalenderSynlighet", steg: "spara synlighet på kontot" });
      if (!c.avslutad) setKontoFel("skriv");
    },
  );
}
