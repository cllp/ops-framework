import { useCallback } from "react";
import { useInloggad } from "../auth/auth.jsx";
import { personnamn, varnaNamnSaknas } from "../lib/personnamn.js";

/**
 * Löser en persons visningsnamn i en vy (0.40.1, #218): medlemskapets namn, annars den inloggades namn ur
 * inloggningen om raden är hens, annars "Namn saknas". Aldrig ett id. Se `lib/personnamn.js`.
 *
 * Fungerar utan `OpsAuthProvider` (då finns ingen inloggad att låna namn av), så en vy som ritas i ett prov eller
 * i en app utan ramverkets inloggning faller till "Namn saknas" i stället för att kasta.
 *
 * @returns {(namn: unknown, id?: string) => { text: string, saknas: boolean }}
 */
export function usePersonnamn() {
  const inloggad = useInloggad();
  return useCallback(
    (namn, id) => {
      const svar = personnamn(namn, { id, inloggad });
      if (svar.saknas && id) varnaNamnSaknas(id);
      return svar;
    },
    [inloggad],
  );
}
