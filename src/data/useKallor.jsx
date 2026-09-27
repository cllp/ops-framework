import { useEffect, useState } from "react";

/**
 * Hämtar en ytas rader ur källregistret.
 *
 * ══ ⛔ TRE TILLSTÅND, INTE TVÅ (#129) ══════════════════════════════════
 *
 * `tomt` är inte samma sak som `!rader.length`. En yta måste kunna säga
 * skillnad på "ingen modul fyller den här ytan", "modulerna svarade men hade
 * inga rader" och "vi har inte hämtat än", eftersom de tre kräver var sin text
 * på skärmen. Slås de ihop ritar appen "Inget att göra" medan hämtningen
 * pågår, och det är ett lugnande besked om något man inte vet.
 *
 * ⛔ FEL RETURNERAS, DET SVÄLJS INTE. En källa som kastar ger `fel`, och ytan
 * ritar det. Ett tyst `catch` hade gjort ett trasigt kontrakt till en tom lista,
 * alltså den falska grönheten arbetsreglernas punkt 5 handlar om.
 *
 * ⛔ FRÅGAN JÄMFÖRS PÅ INNEHÅLL, INTE PÅ REFERENS, av samma skäl som i
 * `useCollection`: ett objektliteral i en vy är ett nytt objekt vid varje
 * rendering, och utan det här hämtar hooken om i en oändlig loop. Den buggen
 * ser ut som ett prestandaproblem och är ett jämförelseproblem.
 */

/**
 * @param {ReturnType<typeof import("../lib/kallor.js").skapaKallregister> | null | undefined} register
 * @param {string} yta En av `KALLTYPER`.
 * @param {{ groupId: string } & Record<string, unknown>} fraga
 */
export function useKallor(register, yta, fraga) {
  const nyckel = JSON.stringify([yta, fraga]);

  const [läge, setLäge] = useState(
    /** @type {{ rader: Record<string, any>[], laddar: boolean, fel: Error | null }} */ ({ rader: [], laddar: true, fel: null }),
  );

  useEffect(() => {
    if (!register) {
      /*
       * ⛔ INGET REGISTER ÄR INTE ETT FEL OCH INTE HELLER TOMHET. Appen kan
       * rita ytan innan modulerna hunnit registreras, och då är svaret "vi vet
       * inte än", alltså laddar.
       */
      setLäge({ rader: [], laddar: true, fel: null });
      return undefined;
    }

    let levande = true;
    setLäge((f) => ({ ...f, laddar: true, fel: null }));

    Promise.resolve()
      .then(() => register[yta](fraga))
      .then((rader) => {
        if (levande) setLäge({ rader, laddar: false, fel: null });
      })
      .catch((fel) => {
        if (levande) setLäge({ rader: [], laddar: false, fel: fel instanceof Error ? fel : new Error(String(fel)) });
      });

    /*
     * ⛔ SVARET KASTAS OM KOMPONENTEN HUNNIT FÖRSVINNA. Utan flaggan skriver en
     * långsam källa in rader i en avmonterad vy, och i värsta fall en gammal
     * grupps rader i den nya gruppens lista.
     */
    return () => {
      levande = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, nyckel]);

  const fyller = register ? register.modulerFor(yta) : [];

  return {
    ...läge,
    /** Modulerna som alls fyller ytan. Tom lista betyder "ingen modul bidrar hit". */
    fyller,
    /** Sant när hämtningen är klar, gick bra och gav noll rader. */
    tomt: !läge.laddar && !läge.fel && läge.rader.length === 0,
  };
}
