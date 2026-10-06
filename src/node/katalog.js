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
 *   import { seedaKataloger } from "ops-framework/node";
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

import { createCatalogSource, seedoperationer } from "../data/katalogkalla.js";
import { byggKategori, ID_FORM, katalognyckel, KATALOGAVGRANSARE } from "../lib/katalog.js";

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
export function somKatalogStandard(konfig, namn) {
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
 * ⛔ `skapaGrupp` ANROPAR DEN INTE LÄNGRE (0.33.0). Den seedar i sin egen batch,
 * så att gruppen och dess kataloger sparas allt eller inget. Den här finns kvar
 * för en app som vill seeda en befintlig grupp för sig, och den är vad
 * `bakfyllKatalogGrupp` gör för grupper som saknar kataloger, fast i en batch.
 *
 * ⛔ ANROPAS AV APPEN, INTE AUTOMATISKT. Ramverket vet inte NÄR
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

/**
 * @typedef {object} Bakfyllnadssvar
 * @property {boolean} torr Sant: ingenting skrevs, svaret är planen.
 * @property {Record<string, number>} flyttade Per samling: rader utan groupId som får `groupId` och nyckeln `groupId|id`.
 * @property {Record<string, Record<string, number>>} seedade Per samling och grupp: standardkategorier för en grupp som saknade katalogen.
 * @property {Record<string, number>} kvarUtanGrupp Per samling: rader utan groupId som FINNS KVAR efter körningen (torr: före). Skarp körning utan fel ger 0 överallt.
 * @property {string[]} fel Det som stoppade körningen. Tom lista betyder inga fel, aldrig "inte kontrollerat".
 * @property {number} skrivningar Antal skrivningar i batchen (planerade vid torr körning).
 */

/**
 * Den största batch Firestore tar emot. En katalog är liten, men en gräns som
 * inte står utskriven upptäcks i produktion.
 */
const STORSTA_BATCH = 500;

/**
 * Bakfyllnaden: ger katalograder utan grupp en grupp, och seedar grupper som
 * saknar kataloger (0.33.0, #162).
 *
 * ══ ⛔ VARFÖR RAMVERKET SPECIFICERAR OCH APPEN KÖR ═══════════════════════
 *
 * Skriptet som CP kör bor i APPEN (bolag-ops), med appens standardvärden och
 * appens grupp. Men vad en bakfylld rad ÄR (nyckeln `groupId|id`, formen
 * `byggKategori` kräver, att den gamla raden tas bort i samma batch) är
 * ramverkets modell, och en app som skrev det själv hade haft en andra sanning
 * om nyckeln. Därför är det här en funktion appens skript anropar, och
 * skriptet är tunt: läs flaggor, bygg Admin-källan, anropa, skriv ut svaret.
 *
 * ══ ⛔ VAD DEN GÖR ═══════════════════════════════════════════════════════
 *
 * 1. För varje samling i `samlingar`: varje rad UTAN groupId blir en rad med
 *    `groupId` och nyckeln `katalognyckel(groupId, id)`, och den gamla raden
 *    tas bort. Raden valideras med samma konfiguration som läsvägen, så en rad
 *    som inte skulle gå att läsa efteråt stoppar körningen FÖRE första
 *    skrivningen.
 * 2. För varje grupp i `grupper`-samlingen som saknar rader i en katalog:
 *    standardvärdena seedas. Det täcker en grupp som skapats med 0.32.x, där
 *    `skapaGrupp` inte seedade i samma batch.
 * 3. ALLT I EN BATCH. Faller den finns inget halvt läge: antingen har varje rad
 *    flyttats och varje grupp fått sina kataloger, eller ingenting.
 *
 * ⛔ TORRKÖRNING ÄR FÖRVAL. En Admin-källa går förbi reglerna helt, så förvalet
 * ska vara det som inte kan göra skada. `torr: false` skriver.
 *
 * ⛔ DEN SKRIVER INTE ÖVER. Finns redan en rad med den nya nyckeln (någon har
 * redan sparat kategorin i gruppens katalog) är det en konflikt och inte något
 * att avgöra här: vilken av de två som är den rätta vet bara den som ändrade.
 * Konflikten står i `fel`, och ingenting skrivs.
 *
 * ⛔ OMKÖRBAR. En andra skarp körning hittar inga rader utan grupp och inga
 * grupper utan kataloger, och svarar med nollor. Det är också kontrollen före
 * regeldeployen: torrkörningen ska svara `kvarUtanGrupp: 0` i varje samling.
 *
 * @param {object} b
 * @param {import("../data/contract.js").DataSource<any>} b.kalla En källa med `batch` (Admin SDK: `db.batch()`).
 * @param {Record<string, ReadonlyArray<unknown> | KatalogStandard>} b.samlingar Samma form som `kataloger` till
 *   `createGroupService`: en nyckel per katalogsamling, med standardvärden och katalogens konfiguration.
 * @param {string} b.groupId Gruppen raderna utan grupp tillhör. Appens påstående, se `gruppensRader`.
 * @param {boolean} [b.torr] Förval `true`.
 * @param {string} [b.grupper] Gruppsamlingens namn, förval `groups`. Grupperna som ska ha kataloger.
 * @returns {Promise<Bakfyllnadssvar>}
 */
export async function bakfyllKatalogGrupp(b) {
  const { kalla, samlingar, groupId: groupIdIn, torr = true, grupper = "groups" } = b ?? /** @type {any} */ ({});
  if (!kalla || typeof kalla.list !== "function" || typeof kalla.batch !== "function") {
    throw new Error("bakfyllKatalogGrupp: en datakälla med list och batch krävs. Flytten är allt eller inget, och en källa utan batch kan lämna en rad både kvar och flyttad.");
  }
  const groupId = rensa(groupIdIn);
  if (!ID_FORM.test(groupId)) {
    throw new Error(`bakfyllKatalogGrupp: groupId krävs och måste ha id-formen. Fick "${groupId}". Det är appens grupp, den som raderna utan grupp tillhör.`);
  }
  if (!samlingar || typeof samlingar !== "object" || Array.isArray(samlingar) || Object.keys(samlingar).length === 0) {
    throw new Error("bakfyllKatalogGrupp: samlingar krävs, en nyckel per katalogsamling. En tom lista hade gett ett svar med nollor som ser ut som en lyckad bakfyllnad.");
  }

  /** @type {Bakfyllnadssvar} */
  const svar = { torr: Boolean(torr), flyttade: {}, seedade: {}, kvarUtanGrupp: {}, fel: [], skrivningar: 0 };
  /** @type {any[]} */
  const ops = [];

  const gruppIdn = (await kalla.list(grupper)).map((g) => rensa(g && g.id)).filter(Boolean);
  // Appens grupp finns alltid med, också om grupprader saknas (en app vars grupp skapades för hand).
  if (!gruppIdn.includes(groupId)) gruppIdn.push(groupId);

  for (const samling of Object.keys(samlingar)) {
    const { standard, ikoner, textnycklar, faser, farger } = somKatalogStandard(samlingar[samling], samling);
    const konfig = { ikoner, textnycklar, faser, farger, katalog: samling };
    const rader = await kalla.list(samling);
    const nycklar = new Set(rader.map((r) => String(r && r.id)));
    /** @type {Set<string>} grupper som har minst en rad i samlingen, efter flytten */
    const harRader = new Set();
    let flyttade = 0;

    for (const rad of rader) {
      const radensGrupp = rensa(rad && rad.groupId);
      if (radensGrupp) {
        harRader.add(radensGrupp);
        continue;
      }
      const id = String(rad && rad.id);
      if (id.includes(KATALOGAVGRANSARE)) {
        svar.fel.push(`${samling}/${id}: nyckeln har en grupps form men raden saknar groupId. Rätta raden för hand, bakfyllnaden gissar inte vems den är.`);
        continue;
      }
      let byggd;
      try {
        const { id: _nyckel, ...falt } = rad;
        byggd = byggKategori({ ...falt, id, groupId }, konfig);
      } catch (e) {
        svar.fel.push(`${samling}/${id}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const ny = katalognyckel(groupId, byggd.id);
      if (nycklar.has(ny)) {
        svar.fel.push(`${samling}/${id}: ${ny} finns redan. Två versioner av samma kategori, och bara den som ändrade vet vilken som gäller. Ta bort den ena för hand och kör igen.`);
        continue;
      }
      ops.push({ op: "create", collection: samling, data: { ...byggd, id: ny } });
      ops.push({ op: "remove", collection: samling, id });
      harRader.add(groupId);
      flyttade += 1;
    }
    svar.flyttade[samling] = flyttade;

    /** @type {Record<string, number>} */
    const seedade = {};
    for (const gid of gruppIdn) {
      if (harRader.has(gid)) continue;
      try {
        const seed = seedoperationer({ collection: samling, groupId: gid, standard, ikoner, textnycklar, faser, farger, namn: samling });
        if (seed.length === 0) continue;
        ops.push(...seed);
        seedade[gid] = seed.length;
      } catch (e) {
        svar.fel.push(`${samling}, grupp ${gid}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    svar.seedade[samling] = seedade;
  }

  svar.skrivningar = ops.length;
  if (ops.length > STORSTA_BATCH) {
    svar.fel.push(`${ops.length} skrivningar, och en batch tar högst ${STORSTA_BATCH}. Kör en samling i taget.`);
  }

  /*
   * ⛔ ETT FEL STOPPAR ALLT, OCKSÅ DET SOM GICK ATT FLYTTA. En halv bakfyllnad
   * är det läge ordningen i CHANGELOG 0.33.0 inte tål: reglerna kan inte bytas
   * medan en enda rad saknar grupp. Hellre ingenting och ett fel som säger vad.
   */
  const skriv = !svar.torr && svar.fel.length === 0 && ops.length > 0;
  if (skriv) {
    await /** @type {NonNullable<typeof kalla.batch>} */ (kalla.batch).call(kalla, ops);
  }
  for (const samling of Object.keys(samlingar)) {
    const kvar = (await kalla.list(samling)).filter((r) => !rensa(r && r.groupId)).length;
    svar.kvarUtanGrupp[samling] = kvar;
  }
  return svar;
}
