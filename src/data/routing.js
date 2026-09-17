/**
 * En datakälla som väljer källa per samling.
 *
 * ══ ⛔ VARFÖR SÖMMEN FINNS FÖRE DEN BEHÖVS ═══════════════════════════════
 *
 * Doktrinen är två databaser parallellt för olika ändamål, aldrig samma entitet i
 * två. Realtidskänsligt och identitet i en, relationsdata i en annan. Den
 * fördelningen går per SAMLING, inte per app, och kontraktet hade ingen plats att
 * uttrycka den på: `OpsDataProvider` tar en källa, och den gäller allt.
 *
 * Följden var att ett byte av lagring för EN samling krävde att alla flyttade
 * samtidigt. Sömmen gör flytten till en rad per samling.
 *
 * ══ ⛔ REALTID BLIR EN FRÅGA PER SAMLING, OCH DET ÄR DET SVÅRA ═══════════
 *
 * `prenumerera` är frivillig i kontraktet (regel 5), och den som vill veta frågar
 * källan: `typeof kalla.prenumerera === "function"`. Det svaret är sant om en
 * källa och blir en LÖGN om en routande källa: den kan strömma `chat` via
 * Firestore och inte `kostnader` via en JSON-fil, och frågan har alltså två svar.
 *
 * ⛔ TVÅ UTVÄGAR ÄR FEL, OCH BÅDA ÄR FRESTANDE:
 *
 *   exponera `prenumerera` bara om ALLA kan     en enda långsam källa släcker
 *                                               realtiden överallt, tyst
 *   exponera den alltid och gör inget för de     lyssnaren sätts upp, data kommer
 *   samlingar som inte kan                       aldrig, och det ser ut som att
 *                                               ingenting händer i systemet
 *
 * Det andra är det farliga: en app som TROR sig ha realtid ser exakt likadan ut
 * som en som har det, ända tills någon undrar varför en post inte dök upp.
 *
 * Därför finns `kanPrenumerera(samling)`, som svarar per samling, och
 * `prenumerera` KASTAR med samlingens namn för en samling som inte kan. Att kasta
 * är inte ett brott mot regel 5: regeln avvisar en metod som *aldrig* går att
 * anropa. Den här går att anropa, för den som frågar först, och `useSamlingLive`
 * frågar.
 */

import { OPERATIONER, skapaDatakalla } from "./kontrakt.js";

/**
 * @template T
 * @typedef {object} Routingkonfig
 * @property {import("./kontrakt.js").Datakalla<T>} standard Källan för allt som inte står i `rutter`.
 * @property {Record<string, import("./kontrakt.js").Datakalla<T>>} [rutter] Samling till källa.
 */

/**
 * Bygger den routande källan.
 *
 * ⛔ KRÄVER EN STANDARD, OCH DET ÄR INTE BEKVÄMLIGHET. Utan den skulle en samling
 * som glömts i `rutter` behöva ett fel vid varje läsning, alltså ett fel som dyker
 * upp först den dag någon råkar öppna just den vyn. Med en standard är en glömd
 * rutt inte ett haveri utan ett medvetet "allt annat bor här", vilket också är det
 * som gör steg ett möjligt: allt pekar på en källa, och samlingar flyttar en åt
 * gången.
 *
 * ⛔ KONTROLLERAR VARJE RUTT VID UPPSTART. En rutt som pekar på något som inte är
 * en datakälla ger annars `undefined is not a function` först den dag samlingen
 * läses, och felet pekar mot vyn i stället för mot uppsättningen.
 *
 * @template T
 * @param {Routingkonfig<T>} konfig
 * @returns {import("./kontrakt.js").Datakalla<T> & { kanPrenumerera: (samling: string) => boolean, kallaFor: (samling: string) => import("./kontrakt.js").Datakalla<T> }}
 */
export function skapaRoutingKalla(konfig) {
  if (!konfig || !konfig.standard) {
    throw new Error(
      "skapaRoutingKalla: standard krävs. Utan den blir en glömd rutt ett fel som dyker upp först den dag någon öppnar just den vyn.",
    );
  }

  const rutter = konfig.rutter || {};

  for (const [samling, kalla] of Object.entries(rutter)) {
    if (!kalla || typeof kalla !== "object") {
      throw new Error(`skapaRoutingKalla: rutten "${samling}" pekar inte på en datakälla.`);
    }
    const saknas = OPERATIONER.filter((op) => typeof (/** @type {any} */ (kalla)[op]) !== "function");
    if (saknas.length > 0) {
      throw new Error(
        `skapaRoutingKalla: källan för "${samling}" saknar ${saknas.join(", ")}. ` +
          "En halv adapter kraschar först den dag någon anropar just den metoden, och felet pekar då mot vyn i stället för hit.",
      );
    }
  }

  /** @param {string} samling */
  const valj = (samling) => rutter[samling] || konfig.standard;

  /** @param {string} samling */
  const kanPrenumerera = (samling) => typeof valj(samling).prenumerera === "function";

  /**
   * ⛔ EXPONERAS BARA OM NÅGON KÄLLA KAN. Annars hade den routande källan påstått
   * en förmåga ingen av dess källor har, och `useSamlingLive` hade tagit
   * strömvägen för att sedan kasta på första samlingen.
   */
  const nagonKanStromma =
    typeof konfig.standard.prenumerera === "function" ||
    Object.values(rutter).some((k) => typeof k.prenumerera === "function");

  /** @type {Record<string, any>} */
  const kalla = {
    namn: "routing",
    kanPrenumerera,

    /**
     * Vilken källa en samling faktiskt hamnar hos.
     *
     * ⛔ FINNS FÖR ATT KUNNA MÄTA UPPSÄTTNINGEN, inte för att kringgå sömmen. En
     * routing man inte kan inspektera är en routing man får gissa om, och den
     * gissningen står sedan i ett dokument som ruttnar.
     */
    kallaFor: valj,

    /** @param {string} samling @param {string} id */
    las: (samling, id) => valj(samling).las(samling, id),
    /** @param {string} samling @param {import("./kontrakt.js").Fraga} [fraga] */
    lista: (samling, fraga) => valj(samling).lista(samling, fraga),
    /** @param {string} samling @param {any} data */
    skapa: (samling, data) => valj(samling).skapa(samling, data),
    /** @param {string} samling @param {string} id @param {any} data */
    uppdatera: (samling, id, data) => valj(samling).uppdatera(samling, id, data),
    /** @param {string} samling @param {string} id */
    taBort: (samling, id) => valj(samling).taBort(samling, id),
  };

  if (nagonKanStromma) {
    /**
     * @param {string} samling
     * @param {import("./kontrakt.js").Fraga | undefined} fraga
     * @param {import("./kontrakt.js").Lyssnare<T>} lyssnare
     */
    kalla.prenumerera = (samling, fraga, lyssnare) => {
      const mal = valj(samling);
      if (typeof mal.prenumerera !== "function") {
        // ⛔ KASTAR MED SAMLINGENS NAMN. Alternativet vore att sätta upp en
        // lyssnare som aldrig levererar, alltså en vy som väntar för alltid och
        // ser ut som att ingenting händer i systemet. Frågan går att ställa i
        // förväg med `kanPrenumerera`, och `useSamlingLive` ställer den.
        throw new Error(
          `skapaRoutingKalla: källan för "${samling}" kan inte prenumerera. ` +
            `Fråga kanPrenumerera("${samling}") först, eller läs med lista.`,
        );
      }
      return mal.prenumerera(samling, fraga, lyssnare);
    };
  }

  return /** @type {any} */ (skapaDatakalla(/** @type {any} */ (kalla)));
}
