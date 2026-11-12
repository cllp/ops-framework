import { TypIkon, typEtikett } from "./BibliotekPostvisning.jsx";
import { kortRubrik } from "../lib/bibliotek.js";

/**
 * Kortet för en bibliotekspost i chatten: titel, typ och ikon, ur posten som den är nu (0.191.0, cllp/lifehub.app#663). Samma rubrik, typetikett och ikon som listan i biblioteket
 * (`kortRubrik`, `typEtikett`, `TypIkon`), så att kortet och listan inte kan säga olika saker om samma post (regel 2).
 *
 * ⛔ EN EGEN MODUL (granskningen av PR 526): `bibliotekPostkort` och gästens chatt hämtar den med en dynamisk import när ett kort slås upp, så att chattens startfil inte bär bibliotekets
 * ritning för ett kort som kanske aldrig visas.
 *
 * @param {{ typ: string, rubrik?: string, fil?: { namn?: string, mime?: string } }} post
 * @param {string} [sprak]
 * @returns {{ titel: string, undertitel: string, ikon: import("react").ReactNode }}
 */
export function postkortFor(post, sprak = "sv") {
  return { titel: kortRubrik(post), undertitel: typEtikett(post, sprak), ikon: <TypIkon post={post} /> };
}
