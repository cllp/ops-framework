/**
 * Källkontraktet: hur en modul lämnar rader till ramverkets ytor.
 *
 * ══ ⛔ VARFÖR ETT KONTRAKT OCH INTE SEX GRÄNSSNITT (#129) ══════════════
 *
 * CP 2026-09-25 i cllp/bolag-ops#359, kalenderexemplet: en modul som synkar
 * iCloud ska kunna lägga rader i ramverkets kalender UTAN att ramverket vet
 * vad iCloud är, och modulbyggaren ska kunna göra det ur README utan att öppna
 * källkoden. Det kräver att kontraktet är litet, fast och dokumenterat.
 *
 * ⛔ RAMVERKET ANROPAR, MODULEN SVARAR. Aldrig tvärtom. En modul som kunde
 * skjuta in rader när den ville hade gjort ordningen på en yta till en fråga om
 * vem som hann först, och tomheten omöjlig att skilja från "inte klar än".
 *
 * ══ ⛔ VARJE ANROP BÄR EXAKT EN GRUPP ══════════════════════════════════
 *
 * Beslutet i #129:s tillägg efter Fas 2.5: en källa svarar alltid på "rader för
 * EN grupp". Ramverket bestämmer vilka grupper som frågas och slår ihop svaren
 * (#139), modulen ser aldrig fler än en per anrop och kan därför inte råka läsa
 * fel. Kravet ligger i typen och upprepas i körtid, av samma skäl som i
 * `gruppkalla.js`: ramverket konsumeras av appar som inte alla typkontrollerar.
 *
 * ══ ⛔ FORMEN PRÖVAS NÄR RADEN KOMMER, INTE NÄR MODULEN REGISTRERAS ════
 *
 * Ärendet säger "fel form kastar vid uppstart". Det som GÅR att avgöra vid
 * uppstart är manifestet, alltså att ytan finns och att modulen pekat ut en
 * funktion, och det gör `defineModule` redan. Vad funktionen RETURNERAR går
 * inte att veta förrän den anropats, och att låtsas annat vore en vakt som
 * utlovar ett skydd den inte har (arbetsreglernas punkt 4).
 *
 * ⛔ DÄRFÖR GRANSKAS VARJE RAD VID ANROPET, och felet namnger modulen och ytan.
 * Utan modulens id är ett formfel i en app med fem moduler en halvtimmes
 * letande, och det är precis den halvtimmen kontraktet finns för att slippa.
 *
 * ══ ⛔ TOMHET ÄR ETT SVAR ══════════════════════════════════════════════
 *
 * En källa som ger noll rader rapporteras som tom, aldrig som saknad. Skillnaden
 * mellan "modulen svarade inget" och "modulen frågades inte" är den som avgör
 * om en tom yta är ett lugnande besked eller en bugg.
 */

import { KALLTYPER } from "./modul.js";
import { byggNamn } from "./sprak.js";
import { validateKatalog } from "./katalog.js";

/**
 * Notisernas brådska. Tre, och samma ord som appens Inkorg använder.
 *
 * ⛔ INTE ETT TAL. En siffra hade krävt att varje läsare kom ihåg om högre är
 * mer brådskande eller tvärtom, och den frågan ställs varje gång någon läser
 * koden.
 */
export const NOTISPRIO = /** @type {const} */ (["hog", "normal", "lag"]);

/**
 * @typedef {object} Kallfraga
 * @property {string} groupId ⛔ Krävs. En källa svarar på rader för EN grupp.
 */

/**
 * @typedef {Kallfraga & { text: string }} Sokfraga
 * @typedef {Kallfraga & { route: string }} Hjalpfraga
 */

/**
 * @typedef {object} Sokträff
 * @property {string} id
 * @property {string} titel
 * @property {string} [text] Radtexten under titeln.
 * @property {string} [href] Vart träffen leder.
 */

/**
 * @typedef {object} Hjalptext
 * @property {import("./sprak.js").Namn} titel
 * @property {import("./sprak.js").Namn} text
 */

/**
 * @typedef {object} Notis
 * @property {string} id
 * @property {string} titel
 * @property {string} [text]
 * @property {"hog"|"normal"|"lag"} prio
 * @property {string} [href]
 */

/**
 * @typedef {object} Widget
 * @property {string} id
 * @property {import("./sprak.js").Namn} titel
 * @property {unknown} vy Komponenten. En referens, samma väg A som manifestet.
 */

/**
 * @typedef {object} Modulkatalog
 * @property {string} id
 * @property {import("./sprak.js").Namn} namn
 * @property {ReadonlyArray<import("./katalog.js").Kategori>} kategorier
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * @param {unknown} fraga
 * @param {string} vem
 * @returns {string}
 */
function kravGrupp(fraga, vem) {
  const g = fraga && typeof fraga === "object" ? rensa(/** @type {any} */ (fraga).groupId) : "";
  if (!g) {
    throw new Error(
      `${vem}: groupId krävs i frågan. En källa svarar på rader för EN grupp, och ett anrop utan grupp läser antingen någon annans rader eller inga alls. Ramverket avgör vilka grupper som frågas, se grupperAttFraga.`,
    );
  }
  return g;
}

/**
 * @param {unknown} rad
 * @param {string} modulId
 * @param {string} yta
 * @param {number} i
 * @returns {Record<string, any>}
 */
function somRad(rad, modulId, yta, i) {
  if (!rad || typeof rad !== "object" || Array.isArray(rad)) {
    throw new Error(`kallregister: modulen "${modulId}" gav ${JSON.stringify(rad)} som rad ${i} i ytan "${yta}". Varje rad är ett objekt.`);
  }
  return /** @type {Record<string, any>} */ (rad);
}

/**
 * @param {unknown} svar
 * @param {string} modulId
 * @param {string} yta
 * @returns {unknown[]}
 */
function somLista(svar, modulId, yta) {
  /*
   * ⛔ `undefined` ÄR INTE TOMHET, det är ett fel. En källa som råkar sakna
   * `return` ser annars ut som en källa utan rader, och då letar man i datan
   * efter något som aldrig lämnade koden.
   */
  if (!Array.isArray(svar)) {
    throw new Error(
      `kallregister: modulens "${modulId}" källa för "${yta}" gav ${svar === undefined ? "undefined" : typeof svar} i stället för en lista. Noll rader skrivs som [], eftersom tomhet är ett svar och en utebliven retur är ett fel.`,
    );
  }
  return svar;
}

/** @param {string} modulId @param {string} yta @param {number} i @param {string} skal */
const radfel = (modulId, yta, i, skal) => new Error(`kallregister: rad ${i} ur modulen "${modulId}" i ytan "${yta}" ${skal}`);

/**
 * Granskarna, en per yta. Varje returnerar raden i sin lästa form.
 *
 * ⛔ HÄNDELSERADEN HAR INGEN EGEN GRANSKARE UTÖVER DET SOM KRÄVS. Formen är
 * `OpsEvent`, alltså samma typ `OpsEventList` redan ritar, och en andra
 * uppsättning krav på samma rad vore två sanningar om samma faktum
 * (arbetsreglernas punkt 2). Det som prövas är det ytan inte klarar sig utan:
 * ett id och en titel.
 *
 * @type {Record<string, (rad: Record<string, any>, modulId: string, i: number) => Record<string, any>>}
 */
const GRANSKARE = {
  handelser(rad, modulId, i) {
    if (!rensa(rad.id)) throw radfel(modulId, "handelser", i, "saknar id. Utan det kan ytan inte hålla isär två rader, och nycklarna i listan blir ordningen.");
    if (!rensa(rad.title)) throw radfel(modulId, "handelser", i, 'saknar title. Formen är OpsEvent, alltså samma som OpsEventList ritar: { id, title, daysLeft }.');
    if (!("daysLeft" in rad)) {
      throw radfel(modulId, "handelser", i, "saknar daysLeft. Skriv null för odaterat: skillnaden mellan odaterat och nolldagar är hela poängen med fältet.");
    }
    return rad;
  },

  sok(rad, modulId, i) {
    if (!rensa(rad.id)) throw radfel(modulId, "sok", i, "saknar id.");
    if (!rensa(rad.titel)) throw radfel(modulId, "sok", i, "saknar titel. En träff utan titel går inte att välja mellan.");
    return rad;
  },

  hjalp(rad, modulId, i) {
    try {
      return { titel: byggNamn(rad.titel), text: byggNamn(rad.text) };
    } catch (fel) {
      throw radfel(modulId, "hjalp", i, `har fel form: ${fel instanceof Error ? fel.message : String(fel)}. En hjälptext är { titel: { sv, en }, text: { sv, en } }.`);
    }
  },

  notiser(rad, modulId, i) {
    if (!rensa(rad.id)) throw radfel(modulId, "notiser", i, "saknar id.");
    if (!rensa(rad.titel)) throw radfel(modulId, "notiser", i, "saknar titel.");
    const prio = rensa(rad.prio) || "normal";
    if (!(/** @type {readonly string[]} */ (NOTISPRIO).includes(prio))) {
      throw radfel(modulId, "notiser", i, `har prion "${rad.prio}", som inte finns. Giltiga: ${NOTISPRIO.join(", ")}.`);
    }
    return { ...rad, prio };
  },

  widgets(rad, modulId, i) {
    if (!rensa(rad.id)) throw radfel(modulId, "widgets", i, "saknar id.");
    let titel;
    try {
      titel = byggNamn(rad.titel);
    } catch (fel) {
      throw radfel(modulId, "widgets", i, `har en titel som inte är { sv, en }: ${fel instanceof Error ? fel.message : String(fel)}`);
    }
    /*
     * ⛔ SAMMA SKÄL SOM I `defineModule`: `memo`, `forwardRef` och `lazy` ger
     * objekt, alltså är kravet att något är utpekat och inte vilken form React
     * råkar ge det.
     */
    if (rad.vy === undefined || rad.vy === null) {
      throw radfel(modulId, "widgets", i, "saknar vy. En widget utan vy är ett tomt kort på Översikt.");
    }
    return { ...rad, titel };
  },

  kataloger(rad, modulId, i) {
    const id = rensa(rad.id);
    if (!id) throw radfel(modulId, "kataloger", i, "saknar id.");
    let namn;
    try {
      namn = byggNamn(rad.namn);
    } catch (fel) {
      throw radfel(modulId, "kataloger", i, `har ett namn som inte är { sv, en }: ${fel instanceof Error ? fel.message : String(fel)}`);
    }
    /*
     * ⛔ KATEGORIERNA GRANSKAS AV `validateKatalog` OCH INTE AV EN KOPIA HÄR.
     * Katalogmotorn äger den formen sedan #111, och två uppsättningar krav på
     * samma rad glider isär.
     */
    try {
      validateKatalog(rad.kategorier, { katalog: `modulen "${modulId}": katalogen "${id}"` });
    } catch (fel) {
      throw radfel(modulId, "kataloger", i, `bär kategorier som inte håller: ${fel instanceof Error ? fel.message : String(fel)}`);
    }
    return { ...rad, id, namn };
  },
};

/**
 * Bygger registret som ramverkets ytor frågar.
 *
 * ⛔ REGISTRET ÄR BYGGT EN GÅNG, INTE PER ANROP. Modullistan valideras här, och
 * en yta som frågar ska inte kunna få ett annat svar för att registreringen
 * hunnit ändras mellan två renderingar.
 *
 * @param {ReadonlyArray<import("./modul.js").Modul>} moduler Ur `validateModuler`.
 */
export function skapaKallregister(moduler) {
  if (!Array.isArray(moduler)) {
    throw new Error(`skapaKallregister: moduler måste vara en lista, inte ${typeof moduler}. En app utan moduler skickar [], eftersom tomhet är ett svar.`);
  }

  moduler.forEach((m, i) => {
    if (!m || typeof m !== "object" || !rensa(m.id) || !m.kallor) {
      throw new Error(
        `skapaKallregister: moduler[${i}] är inte en byggd modul. Skicka resultatet av defineModule eller validateModuler, inte ett manifest: en modul som inte gått genom valideringen kan sakna vad som helst.`,
      );
    }
  });

  /**
   * @param {string} namnet
   * @returns {(fraga: any) => Promise<Record<string, any>[]>}
   */
  const yta = (namnet) => async (/** @type {any} */ fraga) => {
    kravGrupp(fraga, `kallregister.${namnet}`);
    /** @type {Record<string, any>[]} */
    const alla = [];
    /*
     * ⛔ EN MODUL I TAGET, I REGISTRERINGSORDNING, och inte `Promise.all`.
     * Ordningen på en yta ska vara ett beslut appen fattat genom sin
     * modullista, inte en följd av vilken modul som råkade svara först.
     */
    for (const modul of moduler) {
      const kalla = modul.kallor[namnet];
      if (typeof kalla !== "function") continue;
      const svar = somLista(await kalla(fraga), modul.id, namnet);
      svar.forEach((rad, i) => {
        const granskad = GRANSKARE[namnet](somRad(rad, modul.id, namnet, i), modul.id, i);
        /*
         * ⛔ `modulId` STÄMPLAS AV REGISTRET, det tas inte från raden. En modul
         * som kunde sätta det själv kunde sätta någon annans, och ytans svar på
         * "vem bidrog med den här raden" vore då modulens påstående.
         */
        alla.push({ ...granskad, modulId: modul.id });
      });
    }
    return alla;
  };

  /** @type {Record<string, (fraga: any) => Promise<Record<string, any>[]>>} */
  const register = {};
  for (const namnet of KALLTYPER) register[namnet] = yta(namnet);

  /*
   * ⛔ FRYST. Ett register som går att utöka efter uppstart är ett register
   * valideringen inte längre uttalar sig om, samma skäl som manifestet.
   */
  return Object.freeze(/** @type {Record<string, (fraga: any) => Promise<Record<string, any>[]>> & { modulerFor: (namnet: string) => string[], modulNamn: (modulId: string) => import("./sprak.js").Namn | null }} */ ({
    ...register,
    /**
     * Modulerna som fyller en yta. ⛔ Finns för att en tom yta ska kunna säga
     * VARFÖR den är tom: ingen modul fyller den, eller ingen modul hade rader.
     * @param {string} namnet
     */
    modulerFor(namnet) {
      return moduler.filter((m) => typeof m.kallor[namnet] === "function").map((m) => m.id);
    },
    /**
     * Modulens visningsnamn, ur samma manifest raderna stämplas med (#164).
     *
     * ⛔ FINNS FÖR ATT EN RAD BARA BÄR `modulId`, INTE MODULENS NAMN. Registret
     * stämplar `modulId` på varje rad i `yta()` ovan, av samma skäl som gör att
     * en modul inte kan sätta det själv: det är registrets påstående, inte
     * modulens. En yta som vill visa VEM som lämnat en rad, som
     * `OpsModulKataloger`:s "Används i" (#164), behöver därför fråga registret
     * i stället för att gissa på id:t.
     *
     * `null` och inte id:t som fallback: en yta som inte hittar namnet ska
     * kunna skilja "modulen finns inte längre" från "modulen heter bokstavligen
     * sitt id", och gissa aldrig en text åt appen. Det är appens/ytans sak att
     * bestämma vad ett uteblivet namn visas som.
     *
     * @param {string} modulId
     */
    modulNamn(modulId) {
      return moduler.find((m) => m.id === modulId)?.namn ?? null;
    },
  }));
}

/*
 * ⛔ HÄR LÅG EN `hjalpForRoute` SOM INTE GJORDE NÅGOT, och noten ovanför den
 * påstod att ramverket filtrerar på route medan koden skickade vidare den till
 * modulen. Ett skäl som inte stämmer är värre än inget skäl, så båda ströks.
 *
 * ⛔ ROUTEN GÅR TILL MODULEN, och det är avsiktligt: bara modulen vet vilka av
 * sina sidor den har hjälp för. Ramverket kan inte veta det utan att känna
 * modulens vyer, vilket är precis det kontraktet finns för att slippa.
 * Anropet är `register.hjalp({ groupId, route })`.
 */
