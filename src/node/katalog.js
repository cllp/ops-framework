/**
 * Seedningen av gruppens kataloger, körd av `skapaGrupp` (#161, #162).
 *
 * ══ ⛔ VARFÖR DEN LIGGER PÅ NODSIDAN OCH INTE I `data/katalogkalla.js` ══
 *
 * `createCatalogSource(...).seeda()` gör redan hela jobbet för EN katalog: den
 * är per konstruktion bunden till EN grupp och EN samling. Den här filen är
 * bara TRÅDEN som binder ihop den funktionen med `skapaGrupp`: en ny grupp kan
 * ha flera kataloger (händelsetyper, statusar, sorter, ...), och `skapaGrupp`
 * ska kunna seeda alla i ett anrop utan att själv känna till
 * `createCatalogSource`s konfiguration för var och en.
 *
 * Den ligger i `src/node/` av samma skäl som `uppdateraProfil` och
 * `createInvitationService`: `skapaGrupp` körs med Admin SDK, utan skärm, och
 * en väg in för seedning som bara fanns i huvudingången hade dragit in React
 * för ett jobb som aldrig ritar något (samma mätning som `createActivityLog`,
 * se `src/node/index.js`).
 *
 * ══ Användning ═════════════════════════════════════════════════════════
 *
 *   import { seedaKataloger } from "@staiger/ops-framework/node";
 *
 *   const resultat = await seedaKataloger({
 *     kalla,
 *     groupId: nyGrupp.id,
 *     standardvarden: {
 *       // kort form: bara raderna, som `standard` till createCatalogSource.
 *       "handelsetyper": HANDELSETYPER_STANDARD,
 *
 *       // full form: samma nycklar som resten av createCatalogSource-config,
 *       // för en katalog som behöver ikoner/textnycklar/faser/farger.
 *       "arendekategorier": {
 *         standard: ARENDEKATEGORIER_STANDARD,
 *         ikoner: ARENDE_IKONER,
 *         textnycklar: ["titleHint"],
 *         faser: true,
 *         farger: true,
 *       },
 *     },
 *   });
 *   // resultat.handelsetyper -> { seedade: true, antal: 4 }
 *   // resultat.arendekategorier -> { seedade: true, antal: 6 }
 *
 * ══ ⛔ VARFÖR SIGNATUREN ÄR `{ kalla, groupId, standardvarden }`, INTE
 * EN LISTA `createCatalogSource`-INSTANSER ═════════════════════════════
 *
 * `skapaGrupp` känner en NY grupps id, inte en färdig `createCatalogSource`
 * per katalog (den byggs ju bara här, bundet till just den gruppen). Appen
 * skickar därför in RÅDATA (samma `standard`-form den redan bär i dag, som
 * `createCatalogSource`s eget `standard`-argument), och den här funktionen
 * bygger EN `createCatalogSource` per nyckel i `standardvarden`, med
 * `groupId` inbakat, och kör `.seeda()` på var och en.
 *
 * ⛔ VALIDERINGEN ÄR ALLTSÅ INTE DUBBLERAD HÄR. `byggKategori`/`validateKatalog`
 * körs precis en gång per katalog, INUTI `createCatalogSource`, av samma
 * konfiguration (`ikoner`, `textnycklar`, `faser`, `farger`) som appens egen
 * läsning (`las()`) sedan validerar mot. Två uppsättningar regler för samma
 * rad hade kunnat glida isär (arbetsreglernas punkt 2).
 */

import { createCatalogSource } from "../data/katalogkalla.js";

/**
 * @typedef {object} KatalogStandard
 * @property {ReadonlyArray<unknown>} standard Repots standardvärden för katalogen, samma form som `standard` till `createCatalogSource`.
 * @property {readonly string[]} [ikoner] Tillåtelselistan. Utelämnad: ingen kontroll mot en lista, se `byggKategori`.
 * @property {readonly string[]} [textnycklar] Texterna katalogen kräver.
 * @property {boolean} [faser] Förval `true`, se `byggKategori`.
 * @property {boolean} [farger] Förval `true`, se `byggKategori`.
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Normaliserar en katalogs konfiguration till dess fulla form.
 *
 * ⛔ EN LISTA ÄR EN GENVÄG, INTE EN ANDRA FORM ATT VALIDERA MOT. En app med en
 * enkel katalog (inga ikoner att begränsa, inga krävda texter) ska kunna
 * skicka bara raderna, precis som den redan gör till `createCatalogSource`.
 *
 * @param {unknown} konfig @param {string} namn @returns {KatalogStandard}
 */
function somKatalogStandard(konfig, namn) {
  if (Array.isArray(konfig)) return { standard: konfig };
  if (konfig && typeof konfig === "object" && Array.isArray(/** @type {any} */ (konfig).standard)) {
    return /** @type {KatalogStandard} */ (konfig);
  }
  throw new Error(
    `seedaKataloger: standardvarden["${namn}"] måste vara en lista rader, eller ett objekt med { standard: [...] }. Fick ${Array.isArray(konfig) ? "en tom lista" : typeof konfig}.`,
  );
}

/**
 * Seedar en nyskapad grupps kataloger, en per nyckel i `standardvarden`.
 *
 * ⛔ ANROPAS AV `skapaGrupp` (#161), INTE AUTOMATISKT. Ramverket vet inte NÄR
 * en grupp behöver sina kataloger seedade, bara HUR. Precis som
 * `uppdateraProfil` måste anropas av appens egen callable, måste `skapaGrupp`
 * anropa den här efter att gruppen och dess första medlemskap skrivits.
 *
 * ⛔ SVARAR MED VAD SOM HÄNDE, PER KATALOG, ALDRIG MED INGENTING. `{ [namn]:
 * { seedade, antal, orsak? } }`, ur `createCatalogSource(...).seeda()`
 * oförändrad, så den som ropar kan se PRECIS vilken katalog som seedades och
 * vilken som redan hade värden, i stället för en enda sammanslagen bool.
 *
 * ⛔ EN KATALOGS SEEDNING PÅVERKAR INTE EN ANNANS. Katalogerna seedas i
 * TURORDNING (`for...of`, inte `Promise.all`), av samma skäl som
 * `skapaKallregister`: ordningen på en lista fel ska vara förutsägbar, inte en
 * följd av vilken skrivning som råkade svara först. Faller en, kastar
 * `createCatalogSource("").seeda()` upp genom den här funktionen (den kastar
 * aldrig SJÄLV, men `byggKategori` gör det på en trasig mall, se filhuvudets
 * not om att valideringen inte är dubblerad): resten av katalogerna seedas
 * INTE, och den som ropar ser vilken som var sist att lyckas i det delvisa
 * svaret genom att fånga felet och läsa vad som redan skrevs innan dess.
 *
 * @param {object} b
 * @param {import("../data/contract.js").DataSource<any>} b.kalla
 * @param {string} b.groupId Den nyskapade gruppens id.
 * @param {Record<string, ReadonlyArray<unknown> | KatalogStandard>} b.standardvarden
 *   En nyckel per katalog: samlingens namn. Värdet är antingen en lista rader
 *   (genväg för `{ standard: rader }`) eller katalogens fulla `createCatalogSource`-
 *   konfiguration (`standard`, `ikoner`, `textnycklar`, `faser`, `farger`).
 * @returns {Promise<Record<string, { seedade: boolean, antal: number, orsak?: string }>>}
 */
export async function seedaKataloger(b) {
  /*
   * ⛔ DESTRUKTURERINGEN LIGGER I KROPPEN, samma skäl som överallt annars i
   * nodsidan: `({ kalla })` i signaturen kraschar på destrukturen innan
   * valideringen hinner tala.
   */
  const { kalla, groupId: groupIdIn, standardvarden } = b ?? /** @type {any} */ ({});

  if (!kalla || typeof kalla.list !== "function" || typeof kalla.create !== "function") {
    throw new Error("seedaKataloger: en datakälla med list och create krävs. Ramverket känner ingen databas.");
  }
  const groupId = rensa(groupIdIn);
  if (!groupId) {
    throw new Error("seedaKataloger: groupId krävs. Katalogerna är gruppens egna (#162), och utan ett vet ingen vems kopia som skrivs.");
  }
  if (!standardvarden || typeof standardvarden !== "object" || Array.isArray(standardvarden)) {
    throw new Error(
      `seedaKataloger: standardvarden krävs och måste vara ett objekt, en nyckel per katalog (samlingens namn). Fick ${Array.isArray(standardvarden) ? "en lista" : typeof standardvarden}.`,
    );
  }
  const namn = Object.keys(standardvarden);
  if (namn.length === 0) {
    throw new Error(
      "seedaKataloger: standardvarden är tomt. En app utan kataloger anropar inte den här funktionen alls, i stället för att ge den ett tomt objekt: annars ser ett missat register likadant ut som ett medvetet val.",
    );
  }

  /** @type {Record<string, { seedade: boolean, antal: number, orsak?: string }>} */
  const resultat = {};
  for (const collection of namn) {
    const { standard, ikoner, textnycklar, faser, farger } = somKatalogStandard(standardvarden[collection], collection);
    const kalla_ = createCatalogSource({ source: kalla, collection, groupId, standard, ikoner, textnycklar, faser, farger, namn: collection });
    resultat[collection] = await kalla_.seeda();
  }
  return resultat;
}
