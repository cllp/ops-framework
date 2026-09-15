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
