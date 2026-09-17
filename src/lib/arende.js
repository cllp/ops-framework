/**
 * Ärendets form. Strukturen är ramverkets, taxonomin är appens.
 *
 * ══ ⛔ VAR GRÄNSEN GÅR, OCH VARFÖR DEN GÅR DÄR ═══════════════════════════
 *
 * Ramverket äger MEKANIKEN: att en post har en sort och en prioritet, att den
 * bär vem som skickade in den och när, att `status` och `resultat` tillhör
 * servern och aldrig klienten, att etiketterna är basen plus sorten plus prion,
 * och att validering svarar med SKÄL i stället för ett ja eller nej.
 *
 * Appen äger VÄRDENA: vilka sorter som finns, vad de heter, vad de är till för,
 * vilken etikett de får, vilka extra fält just den sorten kräver, och vilken
 * text som visas när något saknas.
 *
 * ⛔ ETT ORD SOM "KVITTO" FÅR ALDRIG STÅ I DEN HÄR FILEN. Ett kvitto är ett
 * bokföringsbegrepp i en viss verksamhet, inte en egenskap hos ärenden. Står det
 * här har ramverket tagit ställning till vad plattformen handlar om, och nästa
 * app som vill ha en femte sort måste antingen leva med vår vokabulär eller
 * bygga sin egen modell vid sidan av. Det är precis den duplicering gränsen
 * finns för att stoppa.
 *
 * ══ ⛔ VAD SOM INTE FLYTTADE HIT, OCH VARFÖR ═════════════════════════════
 *
 * Fältet `kvitto` med belopp, datum och moms stannar i appen, som `extraFalt`.
 * Samma sak med taket för bilagan: det följer av LAGRINGEN (ett Firestore-
 * dokument får vara 1 048 576 byte) och inte av vad ett ärende är. En app som
 * lagrar i Postgres har ett helt annat tak, och en konstant här hade gällt båda.
 */

/**
 * @typedef {object} Sort
 * @property {string} value Nyckeln som lagras.
 * @property {string} label Vad människor kallar den.
 * @property {string} etikett Vad som skickas vidare, till exempel till ett ärendesystem.
 * @property {(utkast: any) => string[]} [krav] Extra villkor för just den här sorten.
 *   Returnerar skälen som saknas, tom lista när allt är på plats.
 *   ⛔ EN FUNKTION OCH INTE FLAGGOR. Flaggor (`kraverBelopp: true`) tvingar ramverket
 *   att veta vad ett belopp är, och då står appens ord här igen.
 * @property {(utkast: any) => Record<string, unknown>} [extraFalt] App-specifika fält
 *   som ska med i dokumentet för just den sorten.
 */

/**
 * @typedef {object} Prio
 * @property {string} value
 * @property {string} label
 * @property {string} etikett
 */

/**
 * @typedef {object} Arendekonfig
 * @property {Sort[]} sorter
 * @property {Prio[]} prioer
 * @property {string} basetikett Etiketten varje ärende bär, oavsett sort.
 * @property {number} [maxRubrik] Standard 120.
 */

/** Rubriken blir en titel i en lista, och en titel som inte ryms är ingen titel. */
const MAX_RUBRIK_STANDARD = 120;

/**
 * Bygger modellen ur appens konfiguration.
 *
 * ⛔ KONTROLLERAR KONFIGURATIONEN VID UPPSTART, inte vid första användningen.
 * En sort utan `etikett` ger annars ett ärende som saknar sin märkning, och det
 * felet syns först i ärendesystemet: posten skapades, den hamnade bara aldrig
 * där någon letar. Samma skäl som `skapaDatakalla` kontrollerar sin adapter.
 *
 * @param {Arendekonfig} konfig
 */
export function skapaArendemodell(konfig) {
  if (!konfig || !Array.isArray(konfig.sorter) || konfig.sorter.length === 0) {
    throw new Error("skapaArendemodell: minst en sort krävs. Sorterna är appens taxonomi, inte ramverkets.");
  }
  if (!Array.isArray(konfig.prioer) || konfig.prioer.length === 0) {
    throw new Error("skapaArendemodell: minst en prio krävs.");
  }
  if (!konfig.basetikett) {
    throw new Error(
      "skapaArendemodell: basetikett krävs. Utan den saknar ärendet den märkning som gör att det syns där någon letar, och det felet ser ut som att ärendet aldrig skapades.",
    );
  }

  for (const lista of [
    { namn: "sorter", rader: konfig.sorter },
    { namn: "prioer", rader: konfig.prioer },
  ]) {
    for (const rad of /** @type {Record<string, any>[]} */ (lista.rader)) {
      for (const falt of ["value", "label", "etikett"]) {
        if (!rad || !rad[falt]) {
          throw new Error(`skapaArendemodell: ${lista.namn} saknar "${falt}" på ${JSON.stringify(rad)}.`);
        }
      }
    }
  }

  const maxRubrik = konfig.maxRubrik ?? MAX_RUBRIK_STANDARD;
  /** @param {string | undefined} v */
  const sort = (v) => konfig.sorter.find((s) => s.value === v);
  /** @param {string | undefined} v */
  const prio = (v) => konfig.prioer.find((p) => p.value === v);

  return {
    sorter: konfig.sorter,
    prioer: konfig.prioer,
    basetikett: konfig.basetikett,
    maxRubrik,

    /**
     * Etiketterna ett ärende ska bära: basen, sorten, prion.
     *
     * ⛔ EN FUNKTION OCH INTE EN LISTA I DOKUMENTATIONEN. Vyn visar dem och den
     * som skapar ärendet sätter dem. Står de på två ställen glider de isär den
     * dag en sort läggs till.
     */
    /** @param {{ typ?: string, prio?: string } | null | undefined} post @returns {string[]} */
    etiketter(post) {
      const ut = [konfig.basetikett];
      const s = sort((post || {}).typ);
      if (s) ut.push(s.etikett);
      const p = prio((post || {}).prio);
      if (p) ut.push(p.etikett);
      return ut;
    },

    /** Sortens namn för människor. Tom sträng när sorten är okänd, aldrig en gissning. */
    /** @param {string | undefined} v */
    sortnamn(v) {
      return (sort(v) || {}).label || "";
    },

    /** Prions namn för människor. */
    /** @param {string | undefined} v */
    prionamn(v) {
      return (prio(v) || {}).label || "";
    },

    /**
     * Vad som saknas för att posten ska gå att skicka.
     *
     * ⛔ RETURNERAR SKÄLEN, inte ett booleskt värde. Ett formulär som bara säger
     * "kan inte sparas" tvingar användaren att gissa vilket fält som är fel, och
     * det är den sortens gissning som gör att folk slutar rapportera saker.
     *
     * ⛔ SORTENS EGNA KRAV LÄSES UR SORTEN och står inte som en gren här. En ny
     * sort med egna villkor blir då en rad i appens register, inte en ändring i
     * ramverket som någon måste be om.
     */
    /** @param {Record<string, any>} [utkast] @returns {string[]} */
    saknas(utkast = {}) {
      const fel = [];
      const s = sort(utkast.typ);
      if (!s) fel.push("Välj vad det gäller.");

      const rubrik = String(utkast.rubrik || "").trim();
      if (!rubrik) fel.push("Skriv en rubrik.");
      else if (rubrik.length > maxRubrik) fel.push(`Rubriken får vara högst ${maxRubrik} tecken.`);

      if (!prio(utkast.prio)) fel.push("Välj hur bråttom det är.");

      if (s && typeof s.krav === "function") {
        const egna = s.krav(utkast);
        if (Array.isArray(egna)) fel.push(...egna);
      }

      return fel;
    },

    /**
     * Bygger dokumentet som skrivs. Ren funktion, så formen går att prova utan
     * databas.
     *
     * ⛔ FÄLTEN PLOCKAS ETT OCH ETT, posten sprids inte in med `...`. En
     * filväljare eller ett formulär får gärna lägga till ett fält i sin retur,
     * och då ska det inte tyst hamna i databasen utan att någon bestämt att det
     * hör hemma där.
     *
     * ⛔ `status` SÄTTS EN GÅNG, TILL "ny". Därefter är fältet serverns, precis
     * som `resultat`. Skrev båda sidor samma fält vore det två sanningar om
     * samma sak, och den som förlorar är den som skrev sist.
     */
    /**
     * @param {Record<string, any>} utkast
     * @param {{ epost?: string, nu?: () => string }} [sammanhang]
     */
    byggPost(utkast, { epost = "", nu = () => new Date().toISOString() } = {}) {
      const s = sort(utkast.typ);
      return {
        typ: utkast.typ,
        prio: utkast.prio,
        rubrik: String(utkast.rubrik || "").trim(),
        text: String(utkast.text || "").trim(),
        bilaga: utkast.bilaga
          ? {
              dataUrl: utkast.bilaga.dataUrl,
              namn: utkast.bilaga.namn,
              typ: utkast.bilaga.typ,
              tecken: utkast.bilaga.tecken,
              bredd: utkast.bilaga.bredd ?? null,
              hojd: utkast.bilaga.hojd ?? null,
            }
          : null,
        // ⛔ Appens extra fält skrivs BARA för en sort som har dem. Ett tomt
        // fältblock på en sort som inte handlar om det ser ut som något någon
        // glömt fylla i.
        ...(s && typeof s.extraFalt === "function" ? s.extraFalt(utkast) : {}),
        skapad: nu(),
        skapadAv: epost,
        status: "ny",
        resultat: null,
      };
    },
  };
}
