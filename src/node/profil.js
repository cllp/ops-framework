/**
 * Namn och bild, skrivna atomiskt in i `users` OCH varje medlemskap (#156).
 *
 * ══ ⛔ VARFÖR DEN LIGGER PÅ NODSIDAN OCH INTE I `sparaInstallningar` ═════
 *
 * `memberships` skrivs aldrig av en klient (#136): reglerna säger
 * `allow write: if false`. `sparaInstallningar` (`src/lib/profil.js`) kan
 * alltså bara skriva `users/{uid}`, oavsett vilket fält som ändras. Ändras
 * namnet eller bilden lämnas de denormaliserade kopiorna i `memberships`
 * (#138) då kvar med det gamla värdet, och personens namn i en medlemslista
 * glider isär från namnet på hennes egen profilsida.
 *
 * `uppdateraProfil` är den ENDA platsen som får rätta det: den kör med
 * Admin SDK (precis som `createInvitationService`) och skriver `users` och
 * ALLA medlemskap för samma uid i samma steg, så de två aldrig syns i olika
 * tillstånd av varandra.
 *
 * ══ ⛔ ANROPAS AV EN CALLABLE APPEN REGISTRERAR, INTE AUTOMATISKT ═══════
 *
 * Ramverket vet inte NÄR en app vill propagera en namnändring; det vet bara
 * HUR. Precis som `accepteraInbjudningar` måste anropas vid inloggning,
 * måste `uppdateraProfil` anropas av appens egen callable när `OpsProfil`s
 * `onSpara` ser att namn eller bild ändrats.
 *
 * ══ Användning ══════════════════════════════════════════════════════════
 *
 *   import { uppdateraProfil } from "@staiger/ops-framework/node";
 *
 *   await uppdateraProfil({ kalla, uid, andring: { namn: "Nytt namn" } });
 */

import { byggAnvandare, byggMedlemskap } from "../lib/grupp.js";

/**
 * @typedef {object} Samlingar
 * @property {string} [anvandare] Förval `users`.
 * @property {string} [medlemskap] Förval `memberships`.
 */

/**
 * @param {object} b
 * @param {import("../data/contract.js").DataSource<any>} b.kalla
 * @param {string} b.uid
 * @param {{ namn?: string, bild?: string }} b.andring Bara `namn` och/eller `bild`.
 *   ⛔ INGA ANDRA FÄLT. Telefon, stad, presentation, länkar och bildSokvag är
 *   inte denormaliserade någonstans (#138 beslut A: e-posten och resten av de
 *   privata fälten lämnar aldrig `users`), så de har ingen medlemskapsrad att
 *   synas i. Ett fält som ändå skickas in här hade fått funktionen att låtsas
 *   göra ett jobb den inte gör.
 * @param {Samlingar} [b.samlingar]
 * @returns {Promise<{ anvandare: import("../lib/grupp.js").Anvandare, medlemskapUppdaterade: number }>}
 */
export async function uppdateraProfil(b) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, SAMMA SKÄL SOM `createInvitationService`
   * (#129 punkt 5): `({ kalla })` i signaturen kraschar på destrukturen innan
   * valideringen hinner tala.
   */
  const { kalla, uid: uidIn, andring, samlingar = {} } = b ?? {};
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.update !== "function" || typeof kalla.list !== "function") {
    throw new Error("uppdateraProfil: en datakälla med read, update och list krävs. Ramverket känner ingen databas.");
  }
  const uid = typeof uidIn === "string" ? uidIn.trim() : "";
  if (!uid) throw new Error("uppdateraProfil: uid krävs.");

  const okanda = Object.keys(andring || {}).filter((n) => n !== "namn" && n !== "bild");
  if (okanda.length > 0) {
    throw new Error(
      `uppdateraProfil: fälten ${okanda.join(", ")} går inte att spara här. Bara namn och bild är denormaliserade i memberships (#138); resten sparas med sparaInstallningar mot users direkt.`,
    );
  }

  const ANVANDARE = samlingar.anvandare ?? "users";
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";

  const befintlig = await kalla.read(ANVANDARE, uid);
  if (!befintlig) throw new Error(`uppdateraProfil: ingen användare "${uid}" finns. sakerstallAnvandare måste ha kört först.`);

  // ⛔ VALIDERAD FÖRE SKRIVNINGEN, precis som sparaInstallningar: en trasig
  // rad ska stoppas här, inte hos den som läser den härnäst.
  const nasta = byggAnvandare({ ...befintlig, id: uid, ...andring });
  /** @type {Record<string, string>} */
  const skriv = {};
  if ("namn" in (andring || {})) skriv.namn = nasta.namn;
  if ("bild" in (andring || {})) skriv.bild = nasta.bild;
  await kalla.update(ANVANDARE, uid, skriv);

  /*
   * ⛔ MEDLEMSKAPEN SKRIVS BARA OM NAMN ELLER BILD FAKTISKT VAR MED I
   * ANDRINGEN. Ett anrop som bara sätter t.ex. inget alls (tomt objekt) ska
   * inte göra ett skrivanrop per grupp för ingenting.
   */
  let medlemskapUppdaterade = 0;
  if (skriv.namn !== undefined || skriv.bild !== undefined) {
    const mina = await kalla.list(MEDLEMSKAP, { where: { userId: uid } });
    for (const m of mina) {
      /*
       * ⛔ SKRIVEN GENOM byggMedlemskap, INTE SOM ETT RÅTT PATCH-OBJEKT. Den
       * validerar formen (roll, typ, status) på samma sätt som all annan kod
       * som skriver medlemskap, så en trasig rad i databasen upptäcks här och
       * inte tystnar in i ett `update` som bara rör två fält.
       */
      const uppdaterat = byggMedlemskap({ ...m, namn: nasta.namn, bild: nasta.bild });
      await kalla.update(MEDLEMSKAP, uppdaterat.id, { namn: uppdaterat.namn, bild: uppdaterat.bild });
      medlemskapUppdaterade += 1;
    }
  }

  return { anvandare: nasta, medlemskapUppdaterade };
}
