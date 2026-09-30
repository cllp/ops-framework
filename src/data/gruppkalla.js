/**
 * Frågor som alltid bär sin grupp.
 *
 * ══ ⛔ VARFÖR EN EGEN INGÅNG OCH INTE BARA EN KONVENTION (#139) ════════
 *
 * Kontraktet i `contract.js` vet ingenting om grupper, och ska inte veta det:
 * `tam` har inga. Men i en app som HAR grupper är en fråga utan `groupId` ett
 * läckage, alltså en vy som visar någon annans rader eller en som visar inget
 * och skyller på behörigheter. Den sortens fel syns inte i koden, bara i datan.
 *
 * ⛔ DÄRFÖR ÄR GRUPPEN ETT KRAV I TYPEN OCH INTE EN RAD I EN README. En
 * konvention håller tills någon har bråttom. `check-gruppfraga` kör tsc mot en
 * fråga utan grupp och kräver rött, alltså är kravet mätt och inte påstått.
 *
 * ⛔ OCH KRAVET UPPREPAS I KÖRTID. Ramverket konsumeras som ett paket av appar
 * som inte alla typkontrollerar sin egen kod, och för dem är typen bara en
 * kommentar. Ett kast säger samma sak på den enda plats de läser.
 *
 * ══ ⛔ INGEN SAMMANSLAGNING ÖVER FLERA GRUPPER (0.35.0, #190) ═══════════
 *
 * Här stod `listaPerGrupp`, som frågade varje grupp för sig och lade ihop
 * svaren för läget "Alla mina grupper". Läget är borttaget, och CP rättade
 * samma dag premissen för en läsning över flera grupper: Privat, Företag och
 * Samlat är flikar över data i EN grupp. Ingen konsument använde funktionen,
 * så den togs bort i stället för att stå kvar som en väg förbi den aktiva
 * gruppen. Den aktiva gruppen läggs på varje läsväg av `medAktivGrupp`.
 */

/**
 * En fråga som bär sin grupp.
 *
 * ⛔ `groupId` ÄR OBLIGATORISK, och det är hela vakten. Görs den valfri blir
 * `check-gruppfraga` röd, eftersom provfrågan utan grupp då kompilerar.
 *
 * @typedef {object} GruppFraga
 * @property {string} groupId Gruppen raderna tillhör. Ett värde, aldrig en lista.
 * @property {Record<string, unknown>} [where] Övriga likhetsvillkor.
 * @property {string} [sortBy]
 * @property {"asc" | "desc"} [direction]
 * @property {number} [limit]
 */

/**
 * ⛔ BÅDA ANROPEN ÄR `async`, OCH DET ÄR ETT PROVFYND. De kastade först
 * synkront medan de returnerade ett löfte, alltså gick felet inte att fånga
 * med `.catch()` på anropet. Ett anropsställe som gjorde allt rätt hade fått
 * ett ohanterat undantag, och det är precis den sortens halvhet reglerna
 * kallar en tyst nedsläppsväg: felet finns, men inte där någon letar.
 *
 * @param {GruppFraga} fraga
 * @param {string} vem Namnet i felmeddelandet.
 * @returns {string}
 */
function kravGrupp(fraga, vem) {
  const g = fraga && typeof fraga.groupId === "string" ? fraga.groupId.trim() : "";
  if (!g) {
    throw new Error(
      `${vem}: groupId krävs i frågan. En fråga utan grupp läser antingen någon annans rader eller inga alls, och båda ser ut som ett tomt svar. Det finns alltid exakt en aktiv grupp, och det är den frågan ska bära.`,
    );
  }
  return g;
}

/**
 * Rader för EN grupp.
 *
 * @template {{ id: string }} T
 * @param {import("./contract.js").DataSource<T>} kalla
 * @param {string} samling
 * @param {GruppFraga} fraga
 * @returns {Promise<T[]>}
 */
export async function gruppLista(kalla, samling, fraga) {
  const groupId = kravGrupp(fraga, "gruppLista");
  const { where, sortBy, direction, limit } = fraga;
  /*
   * ⛔ GRUPPEN LÄGGS TILL SIST I `where`, så att en anropare som skickar med
   * `groupId` i `where` inte kan skriva över den med en annan. Vore ordningen
   * omvänd vore kravet ovan en formalitet som gick att kringgå i samma anrop.
   */
  return kalla.list(samling, { where: { ...(where ?? {}), groupId }, sortBy, direction, limit });
}

/**
 * Skapar en rad i en grupp.
 *
 * ⛔ ATT SKAPA KRÄVER EN GRUPP, och sedan 0.35.0 (#190) är det alltid den
 * aktiva: det finns ingen gruppväljare före ett formulär. En rad utan grupp
 * finns inte i modellen, och reglerna hade avvisat den ändå, fast med
 * "insufficient permissions" i stället för ett svar.
 *
 * @template {{ id: string }} T
 * @param {import("./contract.js").DataSource<T>} kalla
 * @param {string} samling
 * @param {Partial<T> & { groupId: string }} data
 * @returns {Promise<T>}
 */
export async function gruppSkapa(kalla, samling, data) {
  const groupId = kravGrupp(/** @type {GruppFraga} */ (/** @type {unknown} */ (data)), "gruppSkapa");
  return kalla.create(samling, { ...data, groupId });
}
