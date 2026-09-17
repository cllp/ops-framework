import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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
 * ⛔ Ingen cache och ingen realtid, med avsikt.
 *
 * Ett arbetsverktyg behöver färsk data när man tittar på det, inte data som
 * strömmar in medan man läser. Hämta om vid fokus, alltså `uppdatera()`, är
 * enklare att resonera om och kan inte visa två sanningar samtidigt. Behövs
 * realtid någonstans är det en riktig fråga att ta då, inte en default.
 *
 * ⛔ FRÅGAN STÄLLDES, OCH SVARET ÄR `useSamlingLive`. INTE EN FLAGGA PÅ `useSamling`.
 *
 * En inkorg är motsatsen till en rapport: den finns för att något ska dyka upp
 * i den medan man tittar, och en agent som markerar en post hanterad är precis
 * det man väntar på. Där är ett omladdningsklick ingen enkelhet, bara en fråga
 * användaren måste ställa om och om igen.
 *
 * Det är ändå EN ANNAN HOOK och inte `useSamling(..., { live: true })`, och
 * skillnaden är hela poängen. En flagga i ett optionsobjekt kan komma från en
 * spread, en konstant eller en prop, och då står valet inte längre i vyn som
 * läser datan. Ett eget namn måste skrivas ut på anropsstället, syns i en diff,
 * och går att räkna: `grep useSamlingLive` svarar exakt vilka ytor som strömmar.
 *
 * Defaulten ovan är alltså oförändrad. Realtid är ett val man tar, en yta i
 * taget, och aldrig något som smyger in via en inställning.
 */

/** @type {import("react").Context<import("./kontrakt.js").Datakalla<any> | null>} */
const DataContext = createContext(/** @type {import("./kontrakt.js").Datakalla<any> | null} */ (null));

/**
 * @param {object} props
 * @param {import("./kontrakt.js").Datakalla<any>} props.kalla
 * @param {import("react").ReactNode} props.children
 */
export function OpsDataProvider({ kalla, children }) {
  return <DataContext.Provider value={kalla}>{children}</DataContext.Provider>;
}

/** @returns {import("./kontrakt.js").Datakalla<any>} */
export function useDatakalla() {
  const kalla = useContext(DataContext);
  if (!kalla) {
    throw new Error(
      "useDatakalla: ingen OpsDataProvider hittades. Lägg den högst upp i appen. Att returnera en tom källa hade gjort att varje läsning tyst gav noll rader.",
    );
  }
  return kalla;
}

/**
 * En samling.
 *
 * @template {{ id: string }} T
 * @param {string} samling
 * @param {import("./kontrakt.js").Fraga} [fraga]
 * @returns {{ data: T[], laddar: boolean, fel: Error | null, uppdatera: () => void }}
 */
export function useSamling(samling, fraga) {
  const kalla = useDatakalla();
  const [data, setData] = useState(/** @type {T[]} */ ([]));
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));

  // ⛔ Frågan jämförs på innehåll, inte på referens. Ett objektliteral i en vy
  // är ett nytt objekt vid varje rendering, och utan det här hade hooken hämtat
  // om i en oändlig loop. Den buggen ser ut som ett prestandaproblem och är ett
  // jämförelseproblem.
  const fraganyckel = JSON.stringify(fraga ?? null);

  const [rakna, setRakna] = useState(0);
  const uppdatera = useCallback(() => setRakna((n) => n + 1), []);

  // Räknare för att kasta svar som hunnit bli inaktuella. Utan den kan ett
  // långsamt äldre svar landa efter ett snabbare nyare och skriva över det.
  const senaste = useRef(0);

  useEffect(() => {
    const mitt = (senaste.current += 1);
    let avbruten = false;
    setLaddar(true);
    setFel(null);

    kalla
      .lista(samling, fraga)
      .then((rader) => {
        if (avbruten || mitt !== senaste.current) return;
        setData(rader);
      })
      .catch((e) => {
        if (avbruten || mitt !== senaste.current) return;
        // ⛔ Data nollställs INTE vid fel. Att tömma listan hade sett ut som att
        // datan försvunnit, vilket är ett annat och mycket värre besked än att
        // en hämtning misslyckades.
        setFel(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (avbruten || mitt !== senaste.current) return;
        setLaddar(false);
      });

    return () => {
      avbruten = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, samling, fraganyckel, rakna]);

  return useMemo(() => ({ data, laddar, fel, uppdatera }), [data, laddar, fel, uppdatera]);
}

/**
 * En samling som uppdaterar sig själv när källan kan det.
 *
 * Samma retur som `useSamling`, plus `realtid`. Ett anropsställe kan alltså byta
 * ett ord och få strömmen, och behöver inte skriva om något annat.
 *
 * ⛔ `realtid` SÄGER OM DU FAKTISKT FICK DET DU BAD OM. Källor som inte kan
 * prenumerera (JSON i repot, minnesadaptern i tester) hämtar en gång, precis som
 * `useSamling`, och då står det `false`. Utan det fältet hade en app som tror sig
 * strömma sett exakt likadan ut som en som gör det, och skillnaden hade upptäckts
 * först när någon undrade varför en post aldrig dök upp.
 *
 * ⛔ DEN KASTAR INTE när källan saknar `prenumerera`. Att kasta hade gjort varje
 * test med en minneskälla till ett krascher, och tvingat fram en andra kodväg i
 * appen just för tester. En ärlig tillbakafallning som SÄGER att den föll
 * tillbaka är både mindre och sannare.
 *
 * ⛔ `uppdatera()` STARTAR OM PRENUMERATIONEN, den hämtar inte vid sidan av.
 * Firestore återansluter inte av sig själv efter ett avvisat lyssnande, så efter
 * ett fel är det enda som hjälper en ny prenumeration. En engångshämtning hade
 * gett en bild som genast slutar uppdateras igen, alltså sett ut som att felet
 * gick över.
 *
 * @template {{ id: string }} T
 * @param {string} samling
 * @param {import("./kontrakt.js").Fraga} [fraga]
 * @returns {{ data: T[], laddar: boolean, fel: Error | null, uppdatera: () => void, realtid: boolean }}
 */
export function useSamlingLive(samling, fraga) {
  const kalla = useDatakalla();
  const [data, setData] = useState(/** @type {T[]} */ ([]));
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));

  // Samma innehållsjämförelse som `useSamling`. Ett objektliteral i en vy är ett
  // nytt objekt vid varje rendering, och utan detta hade prenumerationen rivits
  // och satts upp igen i en oändlig loop. Dyrare här än där: varje varv är en
  // ny lyssnare mot servern.
  const fraganyckel = JSON.stringify(fraga ?? null);

  const [rakna, setRakna] = useState(0);
  const uppdatera = useCallback(() => setRakna((n) => n + 1), []);

  /*
   * ⛔ FRÅGAN STÄLLS PER SAMLING NÄR KÄLLAN KAN SVARA PÅ DET.
   *
   * `typeof kalla.prenumerera === "function"` är ett sant svar om EN källa och en
   * lögn om en routande: den kan strömma `chat` via Firestore och inte `kostnader`
   * via en JSON-fil, alltså har frågan två svar.
   *
   * `skapaRoutingKalla` svarar per samling med `kanPrenumerera`. Utan den här
   * raden hade hooken tagit strömvägen för varje samling så snart NÅGON källa
   * kunde strömma, och sedan kastat på den som inte kan. Med den faller den
   * tillbaka på `lista` och rapporterar `realtid: false`, alltså det ärliga
   * svaret i stället för det tysta.
   */
  const kanStromma =
    typeof kalla.prenumerera === "function" &&
    (typeof (/** @type {any} */ (kalla).kanPrenumerera) === "function"
      ? Boolean(/** @type {any} */ (kalla).kanPrenumerera(samling))
      : true);

  useEffect(() => {
    let avbruten = false;
    setLaddar(true);
    setFel(null);

    if (!kanStromma) {
      kalla
        .lista(samling, fraga)
        .then((rader) => {
          if (avbruten) return;
          setData(rader);
        })
        .catch((e) => {
          // ⛔ Data nollställs INTE vid fel, av samma skäl som i `useSamling`:
          // en tömd lista ser ut som att datan försvunnit.
          if (avbruten) return;
          setFel(e instanceof Error ? e : new Error(String(e)));
        })
        .finally(() => {
          if (avbruten) return;
          setLaddar(false);
        });
      return () => {
        avbruten = true;
      };
    }

    const avsluta = /** @type {NonNullable<typeof kalla.prenumerera>} */ (kalla.prenumerera)(samling, fraga, {
      vidData: (rader) => {
        if (avbruten) return;
        setData(rader);
        // ⛔ Felet nollställs vid varje lyckad leverans. Ett fel som ligger kvar
        // ovanför färsk data påstår att något är trasigt medan man tittar på
        // beviset för motsatsen.
        setFel(null);
        setLaddar(false);
      },
      vidFel: (e) => {
        if (avbruten) return;
        setFel(e);
        setLaddar(false);
      },
    });

    return () => {
      avbruten = true;
      // ⛔ Utan den här raden lever lyssnaren vidare efter att vyn stängts, och
      // varje besök lägger till en till. Det syns inte i UI:t, bara i notan och
      // till slut i minnet.
      if (typeof avsluta === "function") avsluta();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, samling, fraganyckel, rakna, kanStromma]);

  return useMemo(
    () => ({ data, laddar, fel, uppdatera, realtid: kanStromma }),
    [data, laddar, fel, uppdatera, kanStromma],
  );
}

/**
 * En post.
 *
 * `data` är `null` när posten inte finns, vilket INTE är ett fel. Skillnaden
 * mellan "finns inte" och "kunde inte fråga" måste gå att hantera olika.
 *
 * @template {{ id: string }} T
 * @param {string} samling
 * @param {string | undefined} id
 * @returns {{ data: T | null, laddar: boolean, fel: Error | null, uppdatera: () => void }}
 */
export function useDokument(samling, id) {
  const kalla = useDatakalla();
  const [data, setData] = useState(/** @type {T | null} */ (null));
  const [laddar, setLaddar] = useState(Boolean(id));
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));
  const [rakna, setRakna] = useState(0);
  const uppdatera = useCallback(() => setRakna((n) => n + 1), []);
  const senaste = useRef(0);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLaddar(false);
      return;
    }
    const mitt = (senaste.current += 1);
    setLaddar(true);
    setFel(null);

    kalla
      .las(samling, id)
      .then((post) => {
        if (mitt !== senaste.current) return;
        setData(post);
      })
      .catch((e) => {
        if (mitt !== senaste.current) return;
        setFel(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (mitt !== senaste.current) return;
        setLaddar(false);
      });
  }, [kalla, samling, id, rakna]);

  return useMemo(() => ({ data, laddar, fel, uppdatera }), [data, laddar, fel, uppdatera]);
}
