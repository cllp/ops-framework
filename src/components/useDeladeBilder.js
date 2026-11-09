import { useCallback, useMemo, useRef } from "react";
import { bildAdressUrBilder } from "../lib/markdown.js";

/**
 * `bildAdress` och `onBildFel` för `OpsMarkdown` när en anteckning bär sina bilder som signerade adresser (`bilder`, 0.207.0, cllp/lifehub.app#696 skiva 2): en delad anteckning
 * (`OpsDelad`), en anteckning i en delad lista (`DeladLista`) och gästens bibliotek (`OpsBibliotek` utan `bildIAnteckningAdress`). Ett hem för alla tre (regel 2).
 *
 * ⛔ EN ADRESS SOM GÅTT UT. Adresserna gäller i 15 minuter (`SIGNERAD_SEKUNDER`). En bild som inte laddas ber vyn om ett nytt svar med samma väg som en fil (`onNyUrl`): appen hämtar
 * länken igen och ger ett nytt `bilder`, och den nya adressen ritas. ⛔ EN GÅNG PER BILD: laddas inte heller den nya adressen ber bilden inte igen (en loop mot servern är värre än en
 * bild som inte kom), och raden säger "Ladda om sidan för att se bilden.". Flera bilder som faller samtidigt (alla gick ut på en gång) delar EN hämtning. Utan `onNyUrl` (gästens vy)
 * står raden direkt.
 *
 * @param {unknown} bilder Postens `bilder`, eller inget.
 * @param {(() => void | Promise<void>) | undefined} [onNyUrl] Vyns väg till ett nytt svar.
 * @returns {{ bildAdress: ((namn: string) => string) | undefined, onBildFel: (namn: string) => boolean | Promise<boolean> }}
 */
export function useDeladeBilder(bilder, onNyUrl) {
  const bildAdress = useMemo(() => bildAdressUrBilder(bilder), [bilder]);
  const bedda = useRef(/** @type {Set<string>} */ (new Set()));
  const pagar = useRef(/** @type {Promise<boolean> | null} */ (null));
  const onBildFel = useCallback(
    (/** @type {string} */ namn) => {
      if (typeof onNyUrl !== "function" || bedda.current.has(namn)) return false;
      bedda.current.add(namn);
      if (!pagar.current) {
        const p = Promise.resolve()
          .then(() => onNyUrl())
          .then(
            () => true,
            () => false,
          );
        pagar.current = p;
        p.finally(() => {
          if (pagar.current === p) pagar.current = null;
        });
      }
      return pagar.current;
    },
    [onNyUrl],
  );
  return { bildAdress, onBildFel };
}
