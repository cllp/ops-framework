/**
 * Lagringens kontrakt: bilduppladdning, bredvid `kalla`.
 *
 * ══ ⛔ VARFÖR ETT EGET KONTRAKT OCH INTE EN METOD PÅ `kalla` (#156) ═════
 *
 * `kalla` (se `contract.js`) svarar på "läs och skriv ett dokument". En
 * uppladdad fil är inte ett dokument: den har inget query-språk, inget
 * `where`, och den kommer tillbaka som en URL, inte som ett objekt med `id`.
 * Att klämma in `laddaUpp`/`taBort` i `DataSource` hade gjort varje
 * dokumentkälla (JSON-filen, minnet) tvungen att också låtsas vara en
 * fillagring, eller kasta på metoder ingen kallar.
 *
 * ⛔ SAMMA FYRA REGLER SOM `contract.js`, ÅTERANVÄNDA OCH INTE UPPFUNNA IGEN:
 *
 *   1. Allt är asynkront, även minnesadaptern.
 *   2. Fel kastas, de returneras aldrig som tomhet.
 *   3. `laddaUpp` svarar `{ url, sokvag }`. `sokvag` är inte kosmetik: det är
 *      det enda som gör `taBort` möjlig utan att fråga lagringen "vilken fil
 *      var det här" (en Storage-URL är inte alltid reversibel till sin
 *      sökväg utan ett eget anrop).
 *   4. Ramverket importerar ingen lagrings-SDK. Adaptern skickas in, precis
 *      som för `kalla`.
 *
 * ⛔ RAMVERKET KÄNNER INTE BUCKETEN ELLER PREFIXET. `sokvag` byggs av appen
 * (eller av den komponent som anropar `laddaUpp`) utifrån vad DEN vet: vems
 * profil det är och var profilbilder ska ligga. Ramverket tar emot en sökväg,
 * det gissar ingen.
 */

/** De operationer varje lagringsadapter måste ha. */
export const STORAGE_OPERATIONS = ["laddaUpp", "taBort"];

/**
 * @typedef {object} UppladdadFil
 * @property {string} url Vad som ska sparas i dokumentet (t.ex. `users/{uid}.bild`).
 * @property {string} sokvag Vad `taBort` tar emot. Se filhuvudet: URL:en ensam räcker inte.
 */

/**
 * @typedef {object} StorageSource
 * @property {(input: { sokvag: string, fil: unknown }) => Promise<UppladdadFil>} laddaUpp
 * @property {(sokvag: string) => Promise<void>} taBort
 */

/**
 * Tar emot en adapter och ger tillbaka en lagringskälla.
 *
 * ⛔ Kontrollen är inte ceremoni, av samma skäl som `createDataSource`: en
 * adapter som saknar en metod ger annars `undefined is not a function` först
 * den dag någon råkar anropa just den, och det felet pekar mot anropsstället
 * i stället för mot adaptern.
 *
 * @param {Partial<StorageSource> & { name?: string }} adapter
 * @returns {StorageSource}
 */
export function createStorageSource(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new Error("createStorageSource: en adapter krävs. Se createMemoryStorage eller createFirebaseStorageSource för exempel.");
  }
  const missing = STORAGE_OPERATIONS.filter((op) => typeof (/** @type {any} */ (adapter)[op]) !== "function");
  if (missing.length > 0) {
    throw new Error(
      `createStorageSource: adaptern "${adapter.name ?? "namnlös"}" saknar ${missing.join(", ")}. ` +
        "En halv adapter kraschar först den dag någon anropar just den metoden, och felet pekar då mot anropsstället i stället för hit.",
    );
  }
  return /** @type {StorageSource} */ (adapter);
}
