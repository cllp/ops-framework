import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cached, documentKey, throughCache, forget, listKey } from "./readCache.js";

/**
 * React-sidan av datalagret.
 *
 * ⛔ Hookarna skiljer alltid på TRE tillstånd: laddar, fel, och data.
 *
 * Den vanligaste genvägen är att bara ha `data` och låta tomt betyda både
 * "hämtar" och "hittade inget". Då visar appen "Inga kostnader" medan den
 * laddar, och "Inga kostnader" när servern svarade 500. Användaren drar en
 * slutsats om sin data som inte stämmer, och den slutsatsen är omöjlig att ta
 * tillbaka. `OpsEmpty` finns just för att göra skillnaden synlig.
 *
 * ⛔ Ingen realtid, med avsikt.
 *
 * Ett arbetsverktyg behöver färsk data när man tittar på det, inte data som
 * strömmar in medan man läser. Hämta om, alltså `update()`, är enklare att
 * resonera om och kan inte visa två sanningar samtidigt. Behövs realtid
 * någonstans är det en riktig fråga att ta då, inte en default.
 *
 * ⛔ HÄR STOD OCKSÅ "INGEN CACHE", OCH DEN MENINGEN VAR FÖR BRED.
 *
 * Avsikten bakom den var FÄRSKHET, och den gäller fortfarande. Det den råkade
 * förbjuda var något annat: att två hookar som frågar efter samma dokument i
 * samma renderpass betalar två gånger. Det är ingen färskhetsfråga, det är en
 * dubblett, och den kostade bolag-ops en helsidesspinner och en dubbel
 * pensionsläsning (#256).
 *
 * `useCollection` och `useDocument` läser därför genom `lascache.js`: en läsning
 * per unik fråga och källa, delad mellan hookar och behållen över ommontering.
 * `update()` glömmer nyckeln först, så den fortfarande går till servern.
 * Varför det inte finns någon tidsgräns, och vad som INTE är löst, står i
 * cachefilens huvud.
 *
 * ⛔ `useLiveCollection` RÖR INTE CACHEN. En ström är sin egen sanning.
 *
 * ⛔ FRÅGAN STÄLLDES, OCH SVARET ÄR `useLiveCollection`. INTE EN FLAGGA PÅ `useCollection`.
 *
 * En inkorg är motsatsen till en rapport: den finns för att något ska dyka upp
 * i den medan man tittar, och en agent som markerar en post hanterad är precis
 * det man väntar på. Där är ett omladdningsklick ingen enkelhet, bara en fråga
 * användaren måste ställa om och om igen.
 *
 * Det är ändå EN ANNAN HOOK och inte `useCollection(..., { live: true })`, och
 * skillnaden är hela poängen. En flagga i ett optionsobjekt kan komma från en
 * spread, en konstant eller en prop, och då står valet inte längre i vyn som
 * läser datan. Ett eget namn måste skrivas ut på anropsstället, syns i en diff,
 * och går att räkna: `grep useLiveCollection` svarar exakt vilka ytor som strömmar.
 *
 * Defaulten ovan är alltså oförändrad. Realtid är ett val man tar, en yta i
 * taget, och aldrig något som smyger in via en inställning.
 */

/** @type {import("react").Context<import("./contract.js").DataSource<any> | null>} */
const DataContext = createContext(/** @type {import("./contract.js").DataSource<any> | null} */ (null));

/**
 * @param {object} props
 * @param {import("./contract.js").DataSource<any>} props.source
 * @param {import("react").ReactNode} props.children
 */
export function OpsDataProvider({ source, children }) {
  return <DataContext.Provider value={source}>{children}</DataContext.Provider>;
}

/** @returns {import("./contract.js").DataSource<any>} */
export function useDataSource() {
  const source = useContext(DataContext);
  if (!source) {
    throw new Error(
      "useDataSource: ingen OpsDataProvider hittades. Lägg den högst upp i appen. Att returnera en tom källa hade gjort att varje läsning tyst gav noll rader.",
    );
  }
  return source;
}

/**
 * En samling.
 *
 * @template {{ id: string }} T
 * @param {string} collectionName
 * @param {import("./contract.js").Query} [query]
 * @returns {{ data: T[], loading: boolean, error: Error | null, update: () => void }}
 */
export function useCollection(collectionName, query) {
  const source = useDataSource();

  // ⛔ Frågan jämförs på innehåll, inte på referens. Ett objektliteral i en vy
  // är ett nytt objekt vid varje rendering, och utan det här hade hooken hämtat
  // om i en oändlig loop. Den buggen ser ut som ett prestandaproblem och är ett
  // jämförelseproblem.
  const key = listKey(collectionName, query);

  /*
   * ⛔ CACHEN LÄSES REDAN I `useState`, INTE FÖRST I EFFEKTEN.
   *
   * En effekt kör efter första målningen. Sattes `loading` till true tills den
   * hunnit titta i cachen skulle varje ommontering blinka till en spinner för
   * data som redan ligger i minnet, och det är precis det blinkandet som gör
   * att en sida känns långsam fast ingenting hämtas.
   */
  const first = cached(source, key);
  const [data, setData] = useState(/** @type {T[]} */ (first.has ? first.value : []));
  const [loading, setLoading] = useState(!first.has);
  const [error, setError] = useState(/** @type {Error | null} */ (null));

  const [count, setCount] = useState(0);
  /*
   * ⛔ `update()` GLÖMMER FÖRST OCH HÄMTAR SEDAN. Utan glömskan skulle den
   * bara be om samma cachade svar en gång till, alltså en knapp som ser ut att
   * fungera medan ingenting händer. Det är hela vägen tillbaka till servern, och
   * den som skriver något ska anropa den.
   */
  const update = useCallback(() => {
    forget(source, key);
    setCount((n) => n + 1);
  }, [source, key]);

  // Räknare för att kasta svar som hunnit bli inaktuella. Utan den kan ett
  // långsamt äldre svar landa efter ett snabbare nyare och skriva över det.
  const latest = useRef(0);

  useEffect(() => {
    const mine = (latest.current += 1);
    let aborted = false;

    // ⛔ Titten görs OM här, och inte bara i `useState` ovan. Samlingen kan byta
    // under en levande hook, och då är det första värdet svaret på en annan fråga.
    const hit = cached(source, key);
    if (hit.has) {
      setData(hit.value);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    throughCache(source, key, () => source.list(collectionName, query))
      .then((rows) => {
        if (aborted || mine !== latest.current) return;
        setData(rows);
      })
      .catch((e) => {
        if (aborted || mine !== latest.current) return;
        // ⛔ Data nollställs INTE vid fel. Att tömma listan hade sett ut som att
        // datan försvunnit, vilket är ett annat och mycket värre besked än att
        // en hämtning misslyckades.
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (aborted || mine !== latest.current) return;
        setLoading(false);
      });

    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, collectionName, key, count]);

  return useMemo(() => ({ data, loading, error, update }), [data, loading, error, update]);
}

/**
 * En samling som uppdaterar sig själv när källan kan det.
 *
 * Samma retur som `useCollection`, plus `realtime`. Ett anropsställe kan alltså byta
 * ett ord och få strömmen, och behöver inte skriva om något annat.
 *
 * ⛔ `realtime` SÄGER OM DU FAKTISKT FICK DET DU BAD OM. Källor som inte kan
 * prenumerera (JSON i repot, minnesadaptern i tester) hämtar en gång, precis som
 * `useCollection`, och då står det `false`. Utan det fältet hade en app som tror sig
 * strömma sett exakt likadan ut som en som gör det, och skillnaden hade upptäckts
 * först när någon undrade varför en post aldrig dök upp.
 *
 * ⛔ DEN KASTAR INTE när källan saknar `subscribe`. Att kasta hade gjort varje
 * test med en minneskälla till ett krascher, och tvingat fram en andra kodväg i
 * appen just för tester. En ärlig tillbakafallning som SÄGER att den föll
 * tillbaka är både mindre och sannare.
 *
 * ⛔ `update()` STARTAR OM PRENUMERATIONEN, den hämtar inte vid sidan av.
 * Firestore återansluter inte av sig själv efter ett avvisat lyssnande, så efter
 * ett fel är det enda som hjälper en ny prenumeration. En engångshämtning hade
 * gett en bild som genast slutar uppdateras igen, alltså sett ut som att felet
 * gick över.
 *
 * @template {{ id: string }} T
 * @param {string} collectionName
 * @param {import("./contract.js").Query} [query]
 * @returns {{ data: T[], loading: boolean, error: Error | null, update: () => void, realtime: boolean }}
 */
export function useLiveCollection(collectionName, query) {
  const source = useDataSource();
  const [data, setData] = useState(/** @type {T[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {Error | null} */ (null));

  // Samma innehållsjämförelse som `useCollection`. Ett objektliteral i en vy är ett
  // nytt objekt vid varje rendering, och utan detta hade prenumerationen rivits
  // och satts upp igen i en oändlig loop. Dyrare här än där: varje varv är en
  // ny lyssnare mot servern.
  const queryKey = JSON.stringify(query ?? null);

  const [count, setCount] = useState(0);
  const update = useCallback(() => setCount((n) => n + 1), []);

  /*
   * ⛔ FRÅGAN STÄLLS PER SAMLING NÄR KÄLLAN KAN SVARA PÅ DET.
   *
   * `typeof source.subscribe === "function"` är ett sant svar om EN källa och en
   * lögn om en routande: den kan strömma `chat` via Firestore och inte `kostnader`
   * via en JSON-fil, alltså har frågan två svar.
   *
   * `createRoutingSource` svarar per samling med `canSubscribe`. Utan den här
   * raden hade hooken tagit strömvägen för varje samling så snart NÅGON källa
   * kunde strömma, och sedan kastat på den som inte kan. Med den faller den
   * tillbaka på `list` och rapporterar `realtime: false`, alltså det ärliga
   * svaret i stället för det tysta.
   */
  const canStream =
    typeof source.subscribe === "function" &&
    (typeof (/** @type {any} */ (source).canSubscribe) === "function"
      ? Boolean(/** @type {any} */ (source).canSubscribe(collectionName))
      : true);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);

    if (!canStream) {
      source
        .list(collectionName, query)
        .then((rows) => {
          if (aborted) return;
          setData(rows);
        })
        .catch((e) => {
          // ⛔ Data nollställs INTE vid fel, av samma skäl som i `useCollection`:
          // en tömd lista ser ut som att datan försvunnit.
          if (aborted) return;
          setError(e instanceof Error ? e : new Error(String(e)));
        })
        .finally(() => {
          if (aborted) return;
          setLoading(false);
        });
      return () => {
        aborted = true;
      };
    }

    const unsubscribe = /** @type {NonNullable<typeof source.subscribe>} */ (source.subscribe)(collectionName, query, {
      onData: (rows) => {
        if (aborted) return;
        setData(rows);
        // ⛔ Felet nollställs vid varje lyckad leverans. Ett fel som ligger kvar
        // ovanför färsk data påstår att något är trasigt medan man tittar på
        // beviset för motsatsen.
        setError(null);
        setLoading(false);
      },
      onError: (e) => {
        if (aborted) return;
        setError(e);
        setLoading(false);
      },
    });

    return () => {
      aborted = true;
      // ⛔ Utan den här raden lever lyssnaren vidare efter att vyn stängts, och
      // varje besök lägger till en till. Det syns inte i UI:t, bara i notan och
      // till slut i minnet.
      if (typeof unsubscribe === "function") unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, collectionName, queryKey, count, canStream]);

  return useMemo(
    () => ({ data, loading, error, update, realtime: canStream }),
    [data, loading, error, update, canStream],
  );
}

/**
 * En post.
 *
 * `data` är `null` när posten inte finns, vilket INTE är ett fel. Skillnaden
 * mellan "finns inte" och "kunde inte fråga" måste gå att hantera olika.
 *
 * @template {{ id: string }} T
 * @param {string} collectionName
 * @param {string | undefined} id
 * @returns {{ data: T | null, loading: boolean, error: Error | null, update: () => void }}
 */
export function useDocument(collectionName, id) {
  const source = useDataSource();

  /*
   * ⛔ SAMMA CACHE SOM `useCollection`, OCH DET ÄR HÄR #256 FAKTISKT BOR.
   * `data/pension` lästes av två hookar på samma mount, en i översiktens
   * beräkning och en i pensionsvyn. Med en delad nyckel blir det en läsning, och
   * den andra hooken får svaret utan att fråga.
   */
  const key = id ? documentKey(collectionName, id) : "";
  const first = id ? cached(source, key) : { has: false, value: undefined };

  const [data, setData] = useState(/** @type {T | null} */ (first.has ? first.value : null));
  const [loading, setLoading] = useState(Boolean(id) && !first.has);
  const [error, setError] = useState(/** @type {Error | null} */ (null));
  const [count, setCount] = useState(0);
  const update = useCallback(() => {
    if (key) forget(source, key);
    setCount((n) => n + 1);
  }, [source, key]);
  const latest = useRef(0);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    const hit = cached(source, key);
    if (hit.has) {
      setData(hit.value);
      setError(null);
      setLoading(false);
      return;
    }

    const mine = (latest.current += 1);
    setLoading(true);
    setError(null);

    throughCache(source, key, () => source.read(collectionName, id))
      .then((entry) => {
        if (mine !== latest.current) return;
        setData(entry);
      })
      .catch((e) => {
        if (mine !== latest.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (mine !== latest.current) return;
        setLoading(false);
      });
  }, [source, collectionName, id, key, count]);

  return useMemo(() => ({ data, loading, error, update }), [data, loading, error, update]);
}
