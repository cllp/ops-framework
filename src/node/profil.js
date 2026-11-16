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
 *   import { uppdateraProfil } from "ops-framework/node";
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

  /*
   * ⛔ ETT TOMT NAMN SKRIVER ALDRIG ÖVER ETT BEFINTLIGT (0.234.0, cllp/lifehub.app#861).
   *
   * HÄNDELSEN: granskningen av "Namn saknas" 2026-11-16 såg att appen anropar hit med inloggningens namn och bild, och att
   * en token med bild men utan namn (Identitys första token efter en registrering) gav `{ namn: "", bild }`. Då skrevs
   * `users.namn` och VARJE medlemskap om med en tom sträng, och ett namn som fanns försvann ur alla grupper. CP samma kväll:
   * "Det får ALDRIG stå namn saknas." Ett tomt namn i ändringen betyder därför "inget namn att ge", och fältet lämnas orört,
   * både i `users` och i medlemskapen. Bilden skrivs som förut.
   */
  /*
   * ⛔ ETT NAMN SOM INTE ÄR EN STRÄNG KASTAR (granskningen av cllp/ops-framework#608). Ett tal, `null` eller ett objekt i `namn` är ett
   * fel hos anroparen, inte "inget namn att ge", och att tyst ta bort det hade dolt felet (regel 5). Bara den tomma strängen betyder
   * "inget namn": det är vad en token utan namn ger.
   */
  if (andring && "namn" in andring && typeof andring.namn !== "string") {
    throw new Error(`uppdateraProfil: namn ska vara en sträng, fick ${andring.namn === null ? "null" : typeof andring.namn}. En tom sträng betyder "inget namn att ge" och lämnar namnet orört.`);
  }
  const namnIn = andring && "namn" in andring ? /** @type {string} */ (andring.namn).trim() : undefined;
  /** @type {{ namn?: string, bild?: string }} */
  const giltig = { ...(andring || {}) };
  if (namnIn === "") delete giltig.namn;

  // ⛔ VALIDERAD FÖRE SKRIVNINGEN, precis som sparaInstallningar: en trasig
  // rad ska stoppas här, inte hos den som läser den härnäst.
  const nasta = byggAnvandare({ ...befintlig, id: uid, ...giltig });
  /** @type {Record<string, string>} */
  const skriv = {};
  if ("namn" in giltig) skriv.namn = nasta.namn;
  if ("bild" in giltig) skriv.bild = nasta.bild;
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
      /*
       * ⛔ NAMNET SKRIVS BARA NÄR DET FINNS (0.234.0). Före 0.234.0 skrevs `namn: nasta.namn` på varje rad, också när profilen
       * saknade namn, och raden fick `namn: ""`. Nu behåller raden det den hade när profilen saknar ett: sitt eget namn, eller
       * inget, och då visas adressen (`personnamn`). Bilden skrivs som förut.
       */
      const uppdaterat = byggMedlemskap({ ...m, ...(nasta.namn ? { namn: nasta.namn } : {}), bild: nasta.bild });
      /** @type {Record<string, string>} */
      const patch = { bild: uppdaterat.bild };
      if (nasta.namn && uppdaterat.namn) patch.namn = uppdaterat.namn;
      await kalla.update(MEDLEMSKAP, uppdaterat.id, patch);
      medlemskapUppdaterade += 1;
    }
  }

  return { anvandare: nasta, medlemskapUppdaterade };
}

/**
 * @typedef {object} BakfyllnadSvar
 * @property {boolean} skarpt Sant: raderna skrevs. Falskt: svaret är planen, ingenting skrevs.
 * @property {number} lasta Medlemskap lästa, alla typer.
 * @property {number} saknar Personmedlemskap utan namn (av `lasta`). Agenter räknas inte, de har inget namn hos Google.
 * @property {number} attFylla Av `saknar`: de som GÅR att fylla, ur profilraden eller ur reserven.
 * @property {number} franReserv Av `attFylla`: de vars namn kom ur `reserv` (0.234.0), alltså inte ur profilraden. `0` utan reserv.
 * @property {number} fyllda Medlemskap som fick ett namn. Alltid 0 vid torrkörning, och `attFylla` efter en skarp körning utan fel.
 * @property {number} utanProfilnamn Av `saknar`: profilraden finns men har inget namn, och reserven gav inget. Går inte att fylla, personen måste spara sitt namn.
 * @property {number} utanAnvandare Av `saknar`: det finns ingen profilrad alls för personen, och reserven gav inget.
 * @property {Array<{ id: string, userId: string, skal: "utan-profilnamn" | "utan-anvandare" }>} kvar De som INTE gick att fylla, med skälet, så listan går att agera på.
 * @property {string[]} fel Det som stoppade enskilda rader. Tom lista är svaret "inga fel", aldrig "inte kontrollerat".
 */

/**
 * Bakfyllnaden: ger varje personmedlemskap som saknar `namn` det namn profilraden har (0.40.1, #218).
 *
 * ══ ⛔ VARFÖR DEN FINNS, OCH VARFÖR RAMVERKET SPECIFICERAR OCH APPEN KÖR ═══════════════════════════════
 *
 * CP 2026-10-01, med en skärmbild från telefonen: "Till" i "Nytt ärende" visade den inloggade som ett uid. Hens
 * medlemskap saknade `namn`. Ramverket skriver nu alltid ett namn när det finns ett (`skapaGrupp`, `bjudIn`,
 * `accepteraInbjudningar`, `uppdateraProfil`), men medlemskap som skrevs INNAN dess, eller av appens egna
 * migreringsskript (`skapa-grupp.mjs --agare <uid>` skriver en rad utan namn), rättas inte av det. Den här gör det,
 * en gång, ur samma källa som alla andra skrivningar: `users/{uid}.namn`.
 *
 * ⛔ BARA TOMMA NAMN FYLLS. Ett medlemskap som redan har ett namn rörs aldrig, också när det skiljer sig från
 * profilens: det är `uppdateraProfil`s sak att rätta ett inaktuellt namn, och en bakfyllnad som skrev över vore den
 * andra uppfattningen om vilket namn som gäller.
 *
 * ⛔ TORRKÖRNING ÄR FÖRVAL (`skarpt: false`). Den skriver bara med `skarpt: true`. En Admin-källa går förbi reglerna
 * helt, så förvalet är det som inte kan göra skada.
 *
 * ⛔ SVARAR ALLTID MED ALLA RADERNA, också när de är 0 (arbetsreglernas punkt 5). "0 utan profilnamn" och "inte
 * räknat" ska inte gå att förväxla. Omkörbar: en andra skarp körning ger `saknar` = `utanProfilnamn` + `utanAnvandare`.
 *
 * ══ ⛔ RESERVEN (0.234.0, cllp/lifehub.app#861) ══════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-16: "När Collan hade loggat in stod hans namn som Namn Saknas innan han gick ut och sparade om sin profil."
 * Hans profilrad saknade också namn, eftersom den speglade samma token utan namn. Profilen kunde alltså inte fylla hans
 * medlemskap, men Identity hade namnet hela tiden (`displayName`). `reserv` är appens väg dit: en funktion som får ett uid
 * och svarar med ett namn, eller tomt. Den frågas bara när profilraden saknar namn eller inte finns, en gång per person,
 * också vid torrkörning (den läser bara), så att planen säger hur många som går att fylla. Ramverket känner inte Identity:
 * appen ger funktionen. Kastar den blir det ett fel i `fel`, och raden räknas som ej fylld med sitt skäl.
 *
 * @param {object} b
 * @param {import("../data/contract.js").DataSource<any>} b.kalla Med list, read och update.
 * @param {boolean} [b.skarpt] Förval falskt.
 * @param {(uid: string) => (string | null | undefined | Promise<string | null | undefined>)} [b.reserv] Namnet när profilraden
 *   saknar ett, till exempel `displayName` ur Identity. Ett tomt svar är "inget namn".
 * @param {Samlingar} [b.samlingar]
 * @returns {Promise<BakfyllnadSvar>}
 */
export async function bakfyllMedlemsnamn(b) {
  const { kalla, skarpt = false, samlingar = {}, reserv } = b ?? /** @type {any} */ ({});
  if (!kalla || typeof kalla.read !== "function" || typeof kalla.update !== "function" || typeof kalla.list !== "function") {
    throw new Error("bakfyllMedlemsnamn: en datakälla med read, update och list krävs. Ramverket känner ingen databas.");
  }
  if (reserv !== undefined && typeof reserv !== "function") {
    throw new Error("bakfyllMedlemsnamn: reserv ska vara en funktion (uid) => namn, eller utelämnas. Ett värde som tyst ignorerades hade gett en plan utan reserven.");
  }
  const ANVANDARE = samlingar.anvandare ?? "users";
  const MEDLEMSKAP = samlingar.medlemskap ?? "memberships";

  const alla = await kalla.list(MEDLEMSKAP);
  /** @type {BakfyllnadSvar} */
  const svar = { skarpt: skarpt === true, lasta: alla.length, saknar: 0, attFylla: 0, franReserv: 0, fyllda: 0, utanProfilnamn: 0, utanAnvandare: 0, kvar: [], fel: [] };
  /** @type {Map<string, string | null>} uid -> profilens namn, `null` om raden saknas. Varje profil läses en gång. */
  const namnen = new Map();
  /** @type {Map<string, string>} uid -> reservens namn, `""` när den inte gav något. Varje person frågas en gång. */
  const reservnamn = new Map();
  /** @param {string} uid @param {string} radId */
  const franReserven = async (uid, radId) => {
    if (typeof reserv !== "function") return "";
    if (!reservnamn.has(uid)) {
      let n = "";
      try {
        const v = await reserv(uid);
        n = typeof v === "string" ? v.trim() : "";
      } catch (fel) {
        svar.fel.push(`${radId}: reserven för "${uid}" kastade: ${fel instanceof Error ? fel.message : String(fel)}`);
      }
      reservnamn.set(uid, n);
    }
    return reservnamn.get(uid) ?? "";
  };

  for (const m of alla) {
    if ((m?.typ ?? "person") !== "person") continue;
    if (typeof m?.userId !== "string" || !m.userId) continue;
    if (typeof m.namn === "string" && m.namn.trim()) continue;
    svar.saknar += 1;
    if (!namnen.has(m.userId)) {
      const rad = await kalla.read(ANVANDARE, m.userId);
      namnen.set(m.userId, rad ? (typeof rad.namn === "string" ? rad.namn.trim() : "") : null);
    }
    const profilnamn = namnen.get(m.userId);
    let namn = profilnamn ?? "";
    if (!namn) {
      namn = await franReserven(m.userId, m.id);
      if (namn) svar.franReserv += 1;
    }
    if (!namn && profilnamn === null) {
      svar.utanAnvandare += 1;
      svar.kvar.push({ id: m.id, userId: m.userId, skal: "utan-anvandare" });
      continue;
    }
    if (!namn) {
      svar.utanProfilnamn += 1;
      svar.kvar.push({ id: m.id, userId: m.userId, skal: "utan-profilnamn" });
      continue;
    }
    svar.attFylla += 1;
    if (!skarpt) continue;
    try {
      // Genom byggMedlemskap, som uppdateraProfil: en trasig rad stoppas här och blir ett fel i listan, inte ett tyst patch.
      const byggd = byggMedlemskap({ ...m, namn });
      await kalla.update(MEDLEMSKAP, byggd.id, { namn: byggd.namn });
      svar.fyllda += 1;
    } catch (fel) {
      svar.fel.push(`${m.id}: ${fel instanceof Error ? fel.message : String(fel)}`);
    }
  }
  return svar;
}
