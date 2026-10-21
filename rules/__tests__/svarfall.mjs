/**
 * Tabellen över ett svar på en händelse (0.132.0, cllp/lifehub.app#389, skiva 2): SAMMA fall prövas av två prov.
 *
 *   - `rules/__tests__/gaster-grupp.test.mjs` kör dem mot de riktiga reglerna som MEDLEM (`medlem`), i emulatorn.
 *   - `src/__tests__/gast-grupp-tjanst.test.js` kör dem mot servern som GÄST (`gast`).
 *
 * ⛔ SERVERN FÅR ALDRIG VARA LÖSARE ÄN REGLERNA. En gäst får svara bara där en medlem får (`gast` implicerar `medlem`), och provet kontrollerar det för varje rad. Servern får vara STRÄNGARE:
 * medlemsregeln frågar inte efter `arkiverad`, men en gäst svarar aldrig på en arkiverad händelse. Raden `arkiverad` är den enda där de två skiljer sig, och den står utskriven.
 *
 * Händelserna (alla i gruppen Källan utom `f-annan`, som tillhör en annan grupp): `f-ja` ber om svar, `f-nej` har `kravSvar: false`, `f-utan` saknar fältet, `f-arkiv` är arkiverad och ber om
 * svar, `f-annan` ber om svar men ligger i en annan grupp, och `finns-inte` finns inte.
 */

/** @type {ReadonlyArray<{ namn: string, handelse: string, val: unknown, medlem: boolean, gast: boolean }>} */
export const SVARFALL = Object.freeze([
  { namn: "Kommer på en händelse som ber om svar", handelse: "f-ja", val: "kommer", medlem: true, gast: true },
  { namn: "Kommer inte på en händelse som ber om svar", handelse: "f-ja", val: "kommerInte", medlem: true, gast: true },
  { namn: "Kanske är inget svar på kommer du", handelse: "f-ja", val: "kanske", medlem: false, gast: false },
  { namn: "Ett tomt värde", handelse: "f-ja", val: "", medlem: false, gast: false },
  { namn: "Inget värde", handelse: "f-ja", val: undefined, medlem: false, gast: false },
  { namn: "Ett tal i stället för ett värde", handelse: "f-ja", val: 3, medlem: false, gast: false },
  { namn: "Versaler är ett annat värde", handelse: "f-ja", val: "KOMMER", medlem: false, gast: false },
  { namn: "Ett blanksteg efter värdet", handelse: "f-ja", val: "kommer ", medlem: false, gast: false },
  { namn: "En händelse med kravSvar false", handelse: "f-nej", val: "kommer", medlem: false, gast: false },
  { namn: "En händelse som saknar kravSvar", handelse: "f-utan", val: "kommer", medlem: false, gast: false },
  { namn: "En arkiverad händelse som ber om svar (servern är strängare)", handelse: "f-arkiv", val: "kommer", medlem: true, gast: false },
  { namn: "En händelse i en annan grupp", handelse: "f-annan", val: "kommer", medlem: false, gast: false },
  { namn: "En händelse som inte finns", handelse: "finns-inte", val: "kommer", medlem: false, gast: false },
  { namn: "Kommer inte på en annan grupps händelse", handelse: "f-annan", val: "kommerInte", medlem: false, gast: false },
]);
