/**
 * Modulmanifestet: vad en modul ÄR, och vad som avvisas vid uppstart.
 *
 * ══ ⛔ VARFÖR ETT MANIFEST OCH INTE SEX REGISTRERINGSANROP (#128) ══════
 *
 * Fas 3 i epiken cllp/ops-framework#92. En modul ska kunna lägga till nav,
 * vyer, egna samlingar och rader i ramverkets ytor. Med sex separata anrop går
 * en modul att registrera till hälften: nav finns, routen saknas, och appen
 * ritar en flik som leder till ingenting. Med ETT manifest är en modul
 * antingen hel eller avvisad, och den frågan avgörs vid uppstart.
 *
 * ══ ⛔ MANIFESTET ÄR DATA. BETEENDET REFERERAS UR DET ══════════════════
 *
 * Samma väg A som katalogerna (#111): komponenter, hanterare och källornas
 * funktioner BOR inte i manifestet, de pekas ut av det. Skälet är att data går
 * att läsa, jämföra och validera, medan en funktion bara går att köra. Ett
 * manifest som bär logik är ett manifest ingen vakt kan uttala sig om.
 *
 * ══ ⛔ VALIDERINGEN KÖRS VID UPPSTART, INTE VID FÖRSTA KLICK ══════════
 *
 * Samma form och samma skäl som `validateNav` och `byggKategori`: en trasig
 * modul som upptäcks när någon öppnar en vy är ett fel i knäet på användaren.
 * Vid uppstart är det ett fel för den som skrev modulen, och felet säger
 * vilket fält i vilken modul.
 *
 * ══ ⛔ TVÅ SPRÅK FRÅN DAG ETT, OCH HÄR UTAN TOLERANS ══════════════════
 *
 * `byggNamn` tar emot en sträng i katalogerna, och det är med flit: appens
 * listor var strängar och läsaren måste tåla båda formerna innan skrivarna
 * byter (#109). Ett modulmanifest har ingen sådan historia. Det finns inga
 * gamla manifest att migrera, så en sträng här är inte ett arv utan ett
 * nyskrivet fel, och att svälja det vore att föda en ny migrering samma dag
 * formen fastställs.
 *
 * ══ ⛔ RAMVERKET KÄNNER INTE PROJEKT-ID ELLER SAMLINGSROT ═════════════
 *
 * `CLAUDE.md`, "Appens domändata": modulen namnger sina samlingar RELATIVT och
 * appen skickar in roten. Det är den raden som gör att en kund senare kan bli
 * ett eget Firebase-projekt utan att datamodellen ändras. Därför avvisas ett
 * samlingsnamn som bär snedstreck: det är en sökväg, alltså någon annans
 * beslut skrivet i modulen.
 */

import { ID_FORM } from "./katalog.js";
import { validateNav } from "./nav.js";
import { byggNamn } from "./sprak.js";

/**
 * Fälten ett manifest får bära. Allt annat avvisas.
 *
 * ⛔ SAMMA SKÄL SOM `KATEGORIFALT` (#117): det tysta är värre än det som
 * saknas. Ett `ikoner`-fält som byggaren skrev högst upp och som ramverket
 * slängde utan ett ljud blir en modul som ser hel ut och saknar sin halva.
 */
const MODULFALT = ["id", "namn", "nav", "routes", "samlingar", "kallor"];

/** Fälten en route får bära. */
const ROUTEFALT = ["path", "vy"];

/**
 * Ytorna en modul kan fylla. Ramverkets, och de går inte att lägga till.
 *
 * ⛔ FORMEN PÅ VARJE KÄLLA FASTSTÄLLS I #129, INTE HÄR. Det här ärendet äger
 * manifestet, alltså vilka ytor som finns och att modulen pekar ut en funktion
 * per yta den fyller. Att låtsas validera radernas form redan nu vore en vakt
 * som utlovar ett skydd den inte har, och det är farligare än ingen vakt
 * (arbetsreglernas punkt 4).
 */
export const KALLTYPER = /** @type {const} */ (["handelser", "sok", "hjalp", "notiser", "widgets", "kataloger"]);

/**
 * @typedef {object} ModulRoute
 * @property {string} path Börjar med snedstreck. Appen monterar den.
 * @property {unknown} vy Komponenten. En referens, se filhuvudet om väg A.
 */

/**
 * @typedef {object} Modul
 * @property {string} id Maskinnyckeln. Samma form som ett kategori-id.
 * @property {import("./sprak.js").Namn} namn Det som visas.
 * @property {ReadonlyArray<import("./nav.js").NavPost>} nav Nav-poster, EN nivå barn.
 * @property {ReadonlyArray<ModulRoute>} routes Vyerna modulen bidrar med.
 * @property {ReadonlyArray<string>} samlingar Samlingarna modulen äger, relativa namn.
 * @property {Readonly<Record<string, Function>>} kallor Ytor modulen fyller, en funktion per yta.
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Bygger en modul ur sitt manifest, eller kastar med skälet.
 *
 * ⛔ VARJE FÄLT KRÄVS, ÄVEN DE TOMMA, och det är arbetsreglernas punkt 5 i
 * praktiken: tomhet är ett svar och inte en utelämnad rubrik. En modul utan
 * `routes` och en modul som glömt `routes` ser likadana ut om fältet är
 * valfritt, och den första är vanlig medan den andra är ett fel. Ett utskrivet
 * `routes: []` är ett påstående. En avsaknad är en gissning.
 *
 * @param {Record<string, any>} manifest
 * @returns {Modul}
 */
export function defineModule(manifest) {
  const d = manifest && typeof manifest === "object" && !Array.isArray(manifest) ? manifest : null;
  if (!d) {
    throw new Error(`defineModule: manifestet måste vara ett objekt, inte ${Array.isArray(manifest) ? "en lista" : typeof manifest}.`);
  }

  const id = rensa(d.id);
  if (!id) throw new Error("defineModule: id krävs. Det är nyckeln varje yta pekar tillbaka på när den frågar vem som bidrog med en rad.");
  if (!ID_FORM.test(id)) {
    throw new Error(
      `defineModule: id "${id}" får bara innehålla små bokstäver, siffror, bindestreck och understreck. En punkt blir en sökväg i en Firestore-regel, och versaler gör två id som ser lika ut till olika nycklar.`,
    );
  }

  /** @param {string} falt @param {string} skal */
  const var_ = (falt, skal) => new Error(`modul "${id}": ${falt} ${skal}`);

  /*
   * ⛔ OKÄNDA FÄLT FÖRST, precis som i `byggKategori`. Har någon skrivit
   * `ikoner` högst upp är det den upplysningen hen behöver, och inte att
   * `samlingar` också saknas i det utkast hen höll på att skriva.
   */
  const okanda = Object.keys(d).filter((n) => !MODULFALT.includes(n));
  if (okanda.length > 0) {
    throw var_(`fälten ${okanda.join(", ")}`, `känns inte igen. Ett manifest bär ${MODULFALT.join(", ")}. Beteende hör inte hemma i manifestet, det pekas ut av det.`);
  }

  if (typeof d.namn === "string") {
    throw var_(
      "namn",
      'är en sträng. Ett namn är { sv, en }, alltså namn: { sv: "..." }. Katalogerna tar emot en sträng under en migrering som modulerna inte har: det finns inga gamla manifest att migrera, så en sträng här är ett nyskrivet fel.',
    );
  }
  let namn;
  try {
    namn = byggNamn(d.namn && typeof d.namn === "object" ? d.namn : {});
  } catch (fel) {
    throw var_("namn", fel instanceof Error ? fel.message.replace(/^byggNamn: /, "") : String(fel));
  }

  /*
   * ⛔ NAV VALIDERAS AV `validateNav` OCH INTE AV EN KOPIA HÄR. En andra
   * uppsättning regler för samma form är två sanningar om samma faktum
   * (arbetsreglernas punkt 2), och den dag "en nivå barn" ändras hade bara den
   * ena flyttat med.
   */
  /*
   * ⛔ INGEN EGEN KONTROLL AV ATT `nav` ÄR EN LISTA, OCH DET ÄR ETT
   * MUTATIONSFYND. Här stod först ett `Array.isArray`-kast med sin egen text.
   * Svepet slog ut det och ingenting blev rött: `validateNav` kastar redan med
   * "nav krävs och måste vara en lista av { href, label }", alltså samma
   * besked genom samma prefix. Kontrollen var ett andra uttryck för samma
   * regel, och den sortens dubblett är precis vad arbetsreglernas punkt 2
   * varnar för. Den togs bort i stället för att få ett eget prov.
   *
   * ⛔ ATT FÄLTET KRÄVS ÄVEN TOMT GÄLLER ÄNDÅ. `validateNav` kastar på
   * `undefined`, så `nav: []` måste skrivas ut precis som `routes: []`.
   */
  validateNav(d.nav, `modul "${id}"`);

  if (!Array.isArray(d.routes)) {
    throw var_("routes", "krävs och måste vara en lista, även när den är tom. Se noten om tomhet i defineModule.");
  }
  /** @type {ModulRoute[]} */
  const routes = [];
  /** @type {Set<string>} */
  const sedda = new Set();
  d.routes.forEach((/** @type {any} */ r, /** @type {number} */ i) => {
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      throw var_(`routes[${i}]`, "måste vara ett objekt { path, vy }.");
    }
    const okandaRoute = Object.keys(r).filter((n) => !ROUTEFALT.includes(n));
    if (okandaRoute.length > 0) {
      throw var_(`fälten ${okandaRoute.join(", ")} i routes[${i}]`, `känns inte igen. En route bär ${ROUTEFALT.join(", ")}.`);
    }
    const path = rensa(r.path);
    if (!path) throw var_(`routes[${i}].path`, "krävs.");
    if (!path.startsWith("/")) {
      throw var_(`routes[${i}].path "${path}"`, "måste börja med snedstreck. En relativ sökväg betyder olika saker beroende på var appen monterar modulen, och då kan nav-posten inte peka på den.");
    }
    if (sedda.has(path)) {
      throw var_(`routes[${i}].path "${path}"`, "står två gånger. Vilken av vyerna som vinner avgörs då av ordningen i listan, alltså av en slump.");
    }
    sedda.add(path);
    /*
     * ⛔ EN KOMPONENT ÄR INTE ALLTID EN FUNKTION. `memo`, `forwardRef` och
     * `lazy` ger objekt, så ett `typeof === "function"` här hade avvisat tre
     * fullt vanliga sätt att skriva en vy. Kravet är alltså att något är
     * utpekat, inte vilken form React råkar ge det.
     */
    if (r.vy === undefined || r.vy === null) {
      throw var_(`routes[${i}].vy`, `krävs för "${path}". En route utan vy är en flik som leder till en tom sida.`);
    }
    routes.push({ path, vy: r.vy });
  });

  if (!Array.isArray(d.samlingar)) {
    throw var_("samlingar", "krävs och måste vara en lista, även när den är tom. En modul utan egna samlingar är vanlig, och den ska säga det.");
  }
  /** @type {string[]} */
  const samlingar = [];
  d.samlingar.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
    const namnet = rensa(s);
    if (!namnet) throw var_(`samlingar[${i}]`, "måste vara ett namn som sträng.");
    if (namnet.includes("/")) {
      throw var_(
        `samlingar[${i}] "${namnet}"`,
        "är en sökväg och inte ett namn. Modulen namnger sina samlingar relativt och appen skickar in roten, se filhuvudet: det är den raden som gör att en kund kan bli ett eget projekt utan att datamodellen ändras.",
      );
    }
    if (!ID_FORM.test(namnet)) {
      throw var_(`samlingar[${i}] "${namnet}"`, "får bara innehålla små bokstäver, siffror, bindestreck och understreck. Samma skäl som för id.");
    }
    if (samlingar.includes(namnet)) {
      throw var_(`samlingar[${i}] "${namnet}"`, "står två gånger.");
    }
    samlingar.push(namnet);
  });

  if (!d.kallor || typeof d.kallor !== "object" || Array.isArray(d.kallor)) {
    throw var_("kallor", `krävs och måste vara ett objekt, även när det är tomt. Ytorna är ${KALLTYPER.join(", ")}, och en modul som inte fyller någon skriver kallor: {}.`);
  }
  /** @type {Record<string, Function>} */
  const kallor = {};
  for (const [yta, fn] of Object.entries(/** @type {Record<string, unknown>} */ (d.kallor))) {
    if (!(/** @type {readonly string[]} */ (KALLTYPER).includes(yta))) {
      throw var_(`kallan "${yta}"`, `finns inte. Ytorna är ramverkets och går inte att lägga till: ${KALLTYPER.join(", ")}.`);
    }
    if (typeof fn !== "function") {
      throw var_(`kallan "${yta}"`, `måste vara en funktion, inte ${fn === null ? "null" : typeof fn}. Ramverket anropar, modulen svarar.`);
    }
    kallor[yta] = fn;
  }

  /*
   * ⛔ FRYST, av samma skäl som katalogen: ett manifest som går att ändra efter
   * uppstart är ett manifest valideringen inte längre uttalar sig om.
   */
  return Object.freeze({
    id,
    namn,
    /*
     * ⛔ EN KOPIA OCH INTE ANROPARENS LISTA. Fryser vi listan vi fick tillbaka
     * fryser vi något som fortfarande ligger i anroparens modulfil, och den
     * som sedan skriver till den får ett fel på en rad som ser oskyldig ut.
     */
    nav: Object.freeze(d.nav.slice()),
    routes: Object.freeze(routes),
    samlingar: Object.freeze(samlingar),
    kallor: Object.freeze(kallor),
  });
}

/**
 * Validerar en lista moduler och kastar på den första som är fel, plus på två
 * moduler som gör anspråk på samma sak.
 *
 * ⛔ KROCKARNA GÅR INTE ATT SE I ETT MANIFEST, BARA MELLAN TVÅ. Två moduler med
 * samma `id`, samma route eller samma samling är var för sig giltiga och
 * tillsammans ett fel: den ena skriver över den andra, och vilken avgörs av
 * registreringsordningen. Det är precis den sortens fel som uppträder som
 * "ibland" och tar en eftermiddag att hitta.
 *
 * @param {Record<string, any>[]} manifest
 * @returns {Modul[]}
 */
export function validateModuler(manifest) {
  if (!Array.isArray(manifest)) {
    throw new Error(`validateModuler: moduler måste vara en lista, inte ${typeof manifest}.`);
  }
  const moduler = manifest.map((m) => defineModule(m));

  /** @type {Map<string, string>} */
  const routeAgare = new Map();
  /** @type {Map<string, string>} */
  const samlingsAgare = new Map();
  /** @type {Set<string>} */
  const idn = new Set();

  for (const modul of moduler) {
    if (idn.has(modul.id)) {
      throw new Error(`validateModuler: två moduler har id "${modul.id}". Ett id pekar ut vem som bidrog med en rad, så två med samma gör den frågan obesvarbar.`);
    }
    idn.add(modul.id);

    for (const route of modul.routes) {
      const agare = routeAgare.get(route.path);
      if (agare) {
        throw new Error(`validateModuler: modulerna "${agare}" och "${modul.id}" gör båda anspråk på routen "${route.path}". Vilken vy som visas skulle avgöras av registreringsordningen.`);
      }
      routeAgare.set(route.path, modul.id);
    }

    for (const samling of modul.samlingar) {
      const agare = samlingsAgare.get(samling);
      if (agare) {
        throw new Error(
          `validateModuler: modulerna "${agare}" och "${modul.id}" gör båda anspråk på samlingen "${samling}". Ramverket äger inte modulernas data, så det finns ingen som kan medla mellan två skrivare.`,
        );
      }
      samlingsAgare.set(samling, modul.id);
    }
  }

  return moduler;
}
