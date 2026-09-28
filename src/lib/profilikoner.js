import { PROFILIKONER } from "./grupp.js";
import { PersonIkon, StjarnaIkon, HjartaIkon, BlixtIkon, LeendeIkon, KronaIkon } from "../components/icons.jsx";

/**
 * Kartan från ett sparat ikon-id (`PROFILIKONER` i `grupp.js`) till komponenten
 * som ritar det. En egen fil, inte inline i `OpsProfil.jsx`, av samma skäl som
 * `identity.js`: en ren funktion (här en uppslagstabell) går att pröva utan att
 * montera en vy, och `OpsMeny`/framtida ytor som också vill visa profilikonen
 * (t.ex. avatarlänken i README-exemplet) importerar samma karta i stället för
 * att gissa vilken Lucide-komponent id:t "person" betydde.
 *
 * ⛔ ORDNINGEN ÄR RADENS ORDNING I VÄLJAREN, INTE ALFABETISK. `PROFILIKONER`
 * (grupp.js) äger ordningen; den här filen följer, den bestämmer inte.
 */
export const PROFILIKON_KOMPONENT = /** @type {const} */ ({
  person: PersonIkon,
  stjarna: StjarnaIkon,
  hjarta: HjartaIkon,
  blixt: BlixtIkon,
  leende: LeendeIkon,
  krona: KronaIkon,
});

if (Object.keys(PROFILIKON_KOMPONENT).length !== PROFILIKONER.length) {
  throw new Error(
    "profilikoner.js: PROFILIKON_KOMPONENT täcker inte exakt PROFILIKONER (grupp.js). En ikon utan komponent är ett id ingen kan rita.",
  );
}
