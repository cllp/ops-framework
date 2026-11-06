import { lasBibliotekslank } from "../lib/postkommentar.js";

/**
 * Kortets ritning (`postkortFor`, med bibliotekets rubrik, typetikett och ikon) hämtas först när ett kort slås upp (0.191.0, granskningen av PR 526). Uppslaget är asynkront ändå, så
 * importen kostar ingen väntan utöver den första, och chattens startfil bär bara adressens tolkning. Mätt (Vite mot det byggda paketet, en startfil som importerar `bibliotekPostkort`,
 * minifierad): 6 447 byte (2 845 gzip) med ritningen statisk, se CHANGELOG 0.191.0 för siffran efter.
 */
const laddaVisning = () => import("./bibliotekPostkortVisning.jsx");

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
      return (await laddaVisning()).postkortFor(post, sprak);
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
