/**
 * Smart länk i Biblioteket: vilken källa en adress kommer från, och hur rubriken byggs ur titel och artist (0.128.0, cllp/lifehub.app#378).
 *
 * ══ ⛔ VAD CP BESLÖT (2026-10-20, "Går på dina rekommendationer", sedan "Inget avancerat men smart länk. Kör!") ════════════════
 *
 * Ingen ny app och ingen ny låttyp. Länken blir smart: servern hämtar låtnamn och artist från Spotify, YouTube, Apple Music och SoundCloud,
 * och posten får källans ikon och omslag. Rubriken går att ändra, och ett tryck öppnar låten direkt. Inget mer: ingen inbäddad spelare, ingen
 * förhandsvisning utöver ikon och omslag, och inga fler källor än de fyra.
 *
 * ══ ⛔ EN FUNKTION SVARAR PÅ "VILKEN KÄLLA" (regel 2) ═══════════════════════════════════════════════════════════════════
 *
 * Posten sparar `kalla` (`spotify`, `youtube`, `applemusic`, `soundcloud` eller `annat`), men värdet är ALLTID härlett ur adressen av `lankKalla`
 * och aldrig något en klient väljer. Tre ställen läser samma lista av värdar (`LANKKALLOR`): modellen (`byggPost`, `postFel`), Firestore-regeln
 * (`lankkallaRegel`, som skriver samma uttryck som `matches()`) och nodsidans vitlista (`lankInfoUrOembed`, som bara går mot de här värdarna). En fjärde
 * värd läggs till på ETT ställe, och en post vars `kalla` inte stämmer med sin adress nekas både av modellen och av regeln.
 *
 * ⛔ BARA https. En http-adress ger `annat`: nodsidan går bara mot https (inget SSRF mot en intern adress), och en källa som inte kan slås upp ska
 * inte få en ikon som lovar det. Värden jämförs mot HELA värddelen, så `https://open.spotify.com.evil.se/` och `https://open.spotify.com@evil.se/`
 * båda blir `annat` (efter värden kommer `/`, `?`, `#` eller slut, inget annat).
 *
 * Filen importerar ingenting: den delas av klienten, reglerna och nodsidan.
 */

/**
 * De fyra källorna och värdarna adressen måste ha. `namn` är det som visas i en etikett.
 * @type {ReadonlyArray<Readonly<{ kalla: "spotify" | "youtube" | "applemusic" | "soundcloud", namn: string, vardar: readonly string[] }>>}
 */
export const LANKKALLOR = Object.freeze([
  Object.freeze({ kalla: /** @type {const} */ ("spotify"), namn: "Spotify", vardar: Object.freeze(["open.spotify.com"]) }),
  Object.freeze({
    kalla: /** @type {const} */ ("youtube"),
    namn: "YouTube",
    vardar: Object.freeze(["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]),
  }),
  Object.freeze({ kalla: /** @type {const} */ ("applemusic"), namn: "Apple Music", vardar: Object.freeze(["music.apple.com"]) }),
  Object.freeze({ kalla: /** @type {const} */ ("soundcloud"), namn: "SoundCloud", vardar: Object.freeze(["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com"]) }),
]);

/** Värdena `kalla` kan ha på en post. `annat` är varje adress som inte är en av de fyra. */
export const KALLOR = /** @type {const} */ (["spotify", "youtube", "applemusic", "soundcloud", "annat"]);

/** @typedef {typeof KALLOR[number]} Lankkalla */

/**
 * Uttrycket en adress i en känd källa måste uppfylla: `https://`, en av källans värdar, och sedan `/`, `?`, `#` eller slut. Punkterna är `[.]` och inte `\.`,
 * eftersom regelns `matches()` (`regelRegex`) inte tar emot omvända snedstreck. Samma uttryck skrivs in i Firestore-regeln.
 *
 * @param {Lankkalla} kalla
 * @returns {RegExp}
 */
export function lankkallaForm(kalla) {
  const k = LANKKALLOR.find((x) => x.kalla === kalla);
  if (!k) throw new Error(`lankkallaForm: "${kalla}" är ingen av de fyra källorna (${LANKKALLOR.map((x) => x.kalla).join(", ")}). \`annat\` har ingen form: det är alla andra adresser.`);
  const vardar = k.vardar.map((v) => v.replace(/\./g, "[.]")).join("|");
  return new RegExp(`^https://(${vardar})([/?#][!-~]*)?$`);
}

/**
 * Vilken källa adressen kommer från. `annat` för allt som inte är en av de fyra, och för det som inte är en adress alls.
 *
 * ⛔ GEMENER I VÄRDEN OCH SCHEMA ÄR NORMALISERAT AV `normaliseraAdress` INNAN POSTEN SKRIVS. Här prövas texten som den är, utan att tolka den: samma uttryck som
 * regeln prövar, så att modellen och regeln inte kan säga olika om samma rad.
 *
 * @param {unknown} url
 * @returns {Lankkalla}
 */
export function lankKalla(url) {
  if (typeof url !== "string") return "annat";
  for (const k of LANKKALLOR) if (lankkallaForm(k.kalla).test(url)) return k.kalla;
  return "annat";
}

/**
 * Etiketten för en källa ("Spotify"), eller `null` för `annat`.
 * @param {unknown} kalla
 * @returns {string | null}
 */
export function lankKallnamn(kalla) {
  return LANKKALLOR.find((k) => k.kalla === kalla)?.namn ?? null;
}

/**
 * Rubriken ur titel och artist: "Titel, Artist". Bara titeln när artisten saknas, bara artisten när titeln saknas, tom sträng när ingen finns.
 * Dubbla blanksteg och ändarnas blanksteg tas bort, och en artist som redan står sist i titeln läggs inte till en gång till
 * ("Låt - Artist" från YouTube ska inte bli "Låt - Artist, Artist").
 *
 * @param {{ titel?: unknown, artist?: unknown } | null | undefined} info
 * @returns {string}
 */
export function lankRubrik(info) {
  const rent = (/** @type {unknown} */ v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
  const titel = rent(info?.titel);
  const artist = rent(info?.artist);
  if (!titel) return artist;
  if (!artist) return titel;
  if (titel.toLowerCase().includes(artist.toLowerCase())) return titel;
  return `${titel}, ${artist}`;
}
