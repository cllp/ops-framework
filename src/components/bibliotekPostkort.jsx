import { lasBibliotekslank } from "../lib/postkommentar.js";
import { TypIkon, typEtikett } from "./BibliotekPostvisning.jsx";
import { kortRubrik } from "./OpsBibliotek.jsx";

/**
 * Kortet för en bibliotekspost i chatten: titel, typ och ikon, ur posten som den är nu (0.191.0, cllp/lifehub.app#663). Samma rubrik, typetikett och ikon som listan i biblioteket
 * (`kortRubrik`, `typEtikett`, `TypIkon`), så att kortet och listan inte kan säga olika saker om samma post (regel 2).
 *
 * @param {{ typ: string, rubrik?: string, fil?: { namn?: string, mime?: string } }} post
 * @param {string} [sprak]
 * @returns {{ titel: string, undertitel: string, ikon: import("react").ReactNode }}
 */
export function postkortFor(post, sprak = "sv") {
  return { titel: kortRubrik(post), undertitel: typEtikett(post, sprak), ikon: <TypIkon post={post} /> };
}

/**
 * Chattens `postkort` för länkar till appens bibliotek (0.191.0, cllp/lifehub.app#663). En länk som `bibliotekslank` gav (`<bas>?plats=<p>&post=<id>`) slås upp med appens `hamta`
 * när kortet ritas, och ritas som posten ser ut NU. ⛔ TITELN LAGRAS ALDRIG (se `Postkort` i `OpsMeddelanden`): en post som bytt namn visar det nya namnet, och en post som är
 * borttagen, eller som personen inte får läsa (`hamta` svarar `null` eller kastar ett nej från regeln), ger bara texten.
 *
 * ⛔ GE SAMMA OBJEKT VARJE GÅNG (`useMemo`). Chatten minns uppslagen per `slaUpp`, och en ny funktion vid varje ritning slår upp varje kort igen.
 *
 * @param {object} konfig
 * @param {string} konfig.bas Appens adress till biblioteket, samma som till `createPostkommentarer` och gästtjänstens `grupp.bibliotekBas`.
 * @param {(d: { plats: string, postId: string }) => Promise<({ id: string, typ: string, rubrik?: string, fil?: { namn?: string, mime?: string } }) | null | undefined>} konfig.hamta
 *   Appens uppslag: posten med id:t på platsen, genom samma källa som biblioteket läser (så att reglerna avgör), eller `null` när den inte finns eller inte går att läsa.
 *   ⛔ Ett nej från reglerna är inget fel att visa: personen får inte se posten, och kortet ska då inte finnas. Svara `null` för det. Ett annat fel får kasta, och kortet säger det.
 * @param {(d: { plats: string, postId: string }, e: import("react").MouseEvent) => void} [konfig.onOppna] Appens navigering till posten. Utelämnad: en vanlig länk.
 * @param {string} [konfig.sprak]
 * @returns {import("./OpsMeddelanden.jsx").Postkort}
 */
export function bibliotekPostkort({ bas, hamta, onOppna, sprak = "sv" }) {
  // Prövar basen direkt: en felaktig bas är ett fel när kortet byggs, inte ett kort som aldrig visas.
  lasBibliotekslank(bas, "");
  if (typeof hamta !== "function") throw new Error("bibliotekPostkort: hamta krävs, appens uppslag av en post på en plats.");
  /** @type {import("./OpsMeddelanden.jsx").Postkort} */
  const kort = {
    async slaUpp(url) {
      const d = lasBibliotekslank(bas, url);
      if (!d) return null;
      const post = await hamta(d);
      if (!post || post.id !== d.postId) return null;
      return postkortFor(post, sprak);
    },
  };
  if (typeof onOppna === "function") {
    kort.onOppna = (url, e) => {
      const d = lasBibliotekslank(bas, url);
      if (d) onOppna(d, e);
    };
  }
  return kort;
}
