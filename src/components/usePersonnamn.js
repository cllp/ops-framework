import { useCallback } from "react";
import { useInloggad } from "../auth/auth.jsx";
import { NAMN_RESERV, personnamn, varnaNamnSaknas } from "../lib/personnamn.js";
import { useOpsSprak } from "./OpsSprak.jsx";

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
 * ⛔ `laddar` (0.240.0): sant medan vyn hämtar namn eller adresser. Raden säger då "Hämtar namn …" och ingen varning
 * skrivs, eftersom inget saknas än. CP 2026-11-18: "Namn Saknas skall aldrig finnas inte ens under progress."
 * Reservorden följer appens språk (`useOpsSprak`).
 *
 * @returns {(namn: unknown, id?: string, epost?: unknown, laddar?: boolean) => { text: string, saknas: boolean, laddar?: boolean }}
 */
export function usePersonnamn() {
  const inloggad = useInloggad();
  const sprak = useOpsSprak();
  return useCallback(
    (namn, id, epost, laddar = false) => {
      const ord = NAMN_RESERV[sprak === "en" ? "en" : "sv"];
      const svar = personnamn(namn, { id, inloggad, epost, laddar, saknas: ord.saknas, laddas: ord.laddar });
      if (svar.saknas && !svar.laddar && id) varnaNamnSaknas(id);
      return svar;
    },
    [inloggad, sprak],
  );
}
