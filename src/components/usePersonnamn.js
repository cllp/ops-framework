import { useCallback } from "react";
import { useInloggad } from "../auth/auth.jsx";
import { personnamn, varnaNamnSaknas } from "../lib/personnamn.js";

/**
 * Löser en persons visningsnamn i en vy (0.40.1, #218): medlemskapets namn, annars den inloggades namn ur
 * inloggningen om raden är hens, annars hens e-post, annars radens egen e-post (`epost`, 0.234.0,
 * cllp/lifehub.app#861), annars "Namn saknas". Ett namn som är uid:t räknas som saknat (lifehub.app#714). Aldrig
 * ett id. Se `lib/personnamn.js`.
 *
 * ⛔ SKICKA RADENS `epost` NÄR DEN FINNS. CP 2026-11-16: "Det får ALDRIG stå namn saknas. Det måste alltid finnas en
 * fallback på eposten." En vy som bara skickar namnet och id:t ritar "Namn saknas" för den vars namn saknas, fast
 * medlemskapet bar adressen.
 *
 * Fungerar utan `OpsAuthProvider` (då finns ingen inloggad att låna namn av), så en vy som ritas i ett prov eller
 * i en app utan ramverkets inloggning faller till "Namn saknas" i stället för att kasta.
 *
 * @returns {(namn: unknown, id?: string, epost?: unknown) => { text: string, saknas: boolean }}
 */
export function usePersonnamn() {
  const inloggad = useInloggad();
  return useCallback(
    (namn, id, epost) => {
      const svar = personnamn(namn, { id, inloggad, epost });
      if (svar.saknas && id) varnaNamnSaknas(id);
      return svar;
    },
    [inloggad],
  );
}
