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
import { byggModulTyper } from "./modultyper.js";
import { validateNav } from "./nav.js";
import { byggNamn } from "./sprak.js";
import { PLATSER } from "./tillagg.js";

/**
 * Fälten ett manifest får bära. Allt annat avvisas.
 *
 * ⛔ SAMMA SKÄL SOM `KATEGORIFALT` (#117): det tysta är värre än det som
 * saknas. Ett `ikoner`-fält som byggaren skrev högst upp och som ramverket
 * slängde utan ett ljud blir en modul som ser hel ut och saknar sin halva.
 */
const MODULFALT = ["id", "namn", "nav", "routes", "samlingar", "kallor", "skapar", "hubb", "typer", "tillagg"];

/**
 * Fälten ett tillägg får bära (0.60.0, #251). Allt annat avvisas, av samma skäl som `MODULFALT`.
 *
 * ⛔ INGA PROPS. Komponenten får `{ handelse, grupp }` av ytan och inget annat, och ett fält som lät manifestet skicka egna värden
 * hade gjort tillägget till något ytan inte längre kan uttala sig om.
 */
const TILLAGGSFALT = ["plats", "id", "etikett", "komponent"];

/**
 * Fälten modulens kort i hubben får bära (0.37.0, #184).
 *
 * ⛔ `hubb` KRÄVS ÄVEN NÄR MODULEN INTE HAR NÅGOT KORT, och då är den `null`.
 * Samma skäl som `katalog: null` i en skapa-registrering: en modul som GLÖMT
 * sitt kort och en modul som inte ska ha något ser likadana ut om fältet är
 * valfritt, och den första är ett fel som syns först när ägaren letar efter
 * modulen i gruppens inställningar och inte hittar den.
 */
const HUBBFALT = ["ikon", "rutt", "startsida", "delar"];

/** Fälten en del av modulens insida får bära. */
const DELFALT = ["id", "namn", "ikon", "rutt"];

/** Fälten en route får bära. */
const ROUTEFALT = ["path", "vy"];

/** Fälten en samling får bära i sin utskrivna form. */
const SAMLINGSFALT = ["namn", "falt", "agareKravsForSkrivning"];

/**
 * Fälten en skapa-registrering får bära (#150).
 *
 * ⛔ `katalog` KRÄVS ÄVEN NÄR DEN ÄR `null`, och det är arbetsreglernas punkt 5
 * en gång till. Ett kvitto har ingen typ att välja, och en registrering som
 * GLÖMT sin katalog ser likadan ut som en som inte har någon om fältet är
 * valfritt. Den första är ett fel och den andra är vanlig.
 */
const SKAPARFALT = ["id", "namn", "ikon", "katalog", "form"];

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
 * @typedef {object} Samling
 * @property {string} namn Relativt namn, aldrig en sökväg.
 * @property {ReadonlyArray<string> | null} falt Fälten en rad får bära, för `keys().hasOnly`. `null` = ingen formvalidering.
 * @property {boolean} agareKravsForSkrivning Sant när bara ägare får skriva.
 */

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
 * @property {ReadonlyArray<Samling>} samlingar Samlingarna modulen äger. ⛔ Alltid i utskriven form, även när manifestet skrev en sträng.
 * @property {Readonly<Record<string, Function>>} kallor Ytor modulen fyller, en funktion per yta.
 * @property {ReadonlyArray<Skaparregistrering>} skapar Vad modulen kan skapa, det plusset erbjuder.
 * @property {Hubbkort | null} hubb (0.37.0) Modulens kort i hubben och dess insida, eller `null` när modulen inte är ett kort.
 * @property {Readonly<Record<import("./modultyper.js").Typyta, ReadonlyArray<import("./modultyper.js").Modultyp>>>} typer (0.42.0, #217) Typerna modulen bidrar med till inkorgen, kalendern och händelserna. ⛔ Alltid alla tre listorna i utskriven form, även när manifestet utelämnade fältet. Se `modultyper.js`.
 * @property {ReadonlyArray<Tillagg>} tillagg (0.60.0, #251) Det modulen pluggar in på ramverkets ytor. ⛔ Alltid en lista, tom när manifestet utelämnade fältet. Se `tillagg.js`.
 */

/**
 * @typedef {object} Tillagg
 * @property {string} plats En av ramverkets platser (`HANDELSE_PLATSER`).
 * @property {string} id Maskinnyckeln. Unik inom modulen.
 * @property {{ sv: string, en: string }} etikett Det användaren ser: sektionens rubrik, åtgärdens namn. Båda språken krävs.
 * @property {unknown} komponent Komponenten ytan ritar med `{ handelse, grupp }`. En referens, se filhuvudet om väg A.
 */

/**
 * @typedef {object} Hubbkort
 * @property {unknown} ikon Ett React-element, till exempel `<Wallet size={20} />`. En referens, se filhuvudet om väg A.
 * @property {string} rutt Modulens adress, till exempel `/ekonomi`. Kortet leder hit, och adressen visar startsidan.
 * @property {string} startsida Id på den del som visas när modulen öppnas.
 * @property {ReadonlyArray<Moduldel>} delar Modulens insida, i den ordning navigationen visar dem. Minst en.
 */

/**
 * @typedef {object} Moduldel
 * @property {string} id Maskinnyckeln. Unik inom modulen.
 * @property {import("./sprak.js").Namn} namn Det som står i modulens navigation.
 * @property {unknown} ikon Ett React-element.
 * @property {string} rutt Delens adress. Ligger alltid under modulens: `${rutt}/...`.
 */

/**
 * @typedef {object} Skaparregistrering
 * @property {string} id Maskinnyckeln. Unik inom hela modullistan, inte bara inom modulen.
 * @property {import("./sprak.js").Namn} namn Det som står på fliken.
 * @property {string} ikon Namn ur appens tillåtelselista, samma lista som katalogens.
 * @property {string | null} katalog Katalogen typen väljs ur, eller `null` när registreringen inte har någon typ.
 * @property {unknown} form Komponenten som ritar formuläret. En referens, se filhuvudet om väg A.
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
  /** @type {Samling[]} */
  const samlingar = [];
  d.samlingar.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
    /*
     * ⛔ TVÅ FORMER HÄR, TILL SKILLNAD MOT `namn`, OCH SKILLNADEN ÄR EN RIKTIG
     * MIGRERING. Filhuvudet säger att modulerna inte har någon historia att
     * migrera, och det var sant när det skrevs. Sedan 0.25.0 finns
     * `samlingar: ["matningar"]` i en utgiven version, alltså finns historien
     * nu, och samma resonemang som gav katalogen sin strängtolerans (#109)
     * gäller här: läsaren måste tåla båda formerna innan skrivarna byter.
     *
     * ⛔ EN STRÄNG BETYDER "INGEN FORMVALIDERING", inte "inga fält". #130
     * genererar `keys().hasOnly` ur `falt`, och en samling utan fältlista får
     * ett block utan den raden i stället för ett block som låser allt ute.
     * Tomhet är ett svar: `falt: []` säger uttryckligen att raden ska vara tom.
     */
    const rad = typeof s === "string" ? { namn: s } : s;
    if (!rad || typeof rad !== "object" || Array.isArray(rad)) {
      throw var_(`samlingar[${i}]`, `måste vara ett namn som sträng eller { namn, falt }, inte ${Array.isArray(rad) ? "en lista" : typeof rad}.`);
    }
    const okandaSamling = Object.keys(rad).filter((n) => !SAMLINGSFALT.includes(n));
    if (okandaSamling.length > 0) {
      throw var_(`fälten ${okandaSamling.join(", ")} i samlingar[${i}]`, `känns inte igen. En samling bär ${SAMLINGSFALT.join(", ")}.`);
    }
    const namnet = rensa(rad.namn);
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
    if (samlingar.some((x) => x.namn === namnet)) {
      throw var_(`samlingar[${i}] "${namnet}"`, "står två gånger.");
    }

    /** @type {string[] | null} */
    let falt = null;
    if (rad.falt !== undefined) {
      if (!Array.isArray(rad.falt)) {
        throw var_(`samlingar[${i}].falt för "${namnet}"`, `måste vara en lista fältnamn, inte ${typeof rad.falt}. Utelämna den helt om samlingen inte ska formvalideras.`);
      }
      falt = [];
      rad.falt.forEach((/** @type {any} */ f, /** @type {number} */ k) => {
        const faltnamn = rensa(f);
        if (!faltnamn) throw var_(`samlingar[${i}].falt[${k}] för "${namnet}"`, "måste vara ett fältnamn som sträng.");
        if (/** @type {string[]} */ (falt).includes(faltnamn)) throw var_(`samlingar[${i}].falt[${k}] "${faltnamn}"`, `står två gånger i "${namnet}".`);
        /** @type {string[]} */ (falt).push(faltnamn);
      });
    }

    samlingar.push(Object.freeze({ namn: namnet, falt: falt === null ? null : Object.freeze(falt), agareKravsForSkrivning: rad.agareKravsForSkrivning === true }));
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
   * ⛔ SKAPA-REGISTRERINGARNA ÄR SPEGELBILDEN AV KÄLLORNA (#150). En källa
   * läser IN i en av ramverkets ytor, en registrering skriver UT ur plusset.
   * Formen valideras här och beteendet pekas bara ut, precis som en route.
   */
  if (!Array.isArray(d.skapar)) {
    throw var_("skapar", "krävs och måste vara en lista, även när den är tom. En modul som inte kan skapa något skriver skapar: [].");
  }
  /** @type {Skaparregistrering[]} */
  const skapar = [];
  d.skapar.forEach((/** @type {any} */ rad, /** @type {number} */ i) => {
    if (!rad || typeof rad !== "object" || Array.isArray(rad)) {
      throw var_(`skapar[${i}]`, `måste vara ett objekt med ${SKAPARFALT.join(", ")}.`);
    }
    const okandaS = Object.keys(rad).filter((n) => !SKAPARFALT.includes(n));
    if (okandaS.length > 0) {
      throw var_(`skapar[${i}]`, `bär fälten ${okandaS.join(", ")} som inte känns igen. En registrering bär ${SKAPARFALT.join(", ")}.`);
    }

    const sid = rensa(rad.id);
    if (!sid) throw var_(`skapar[${i}].id`, "krävs. Det är nyckeln fliken ritas med och som svaret pekar tillbaka på.");
    if (!ID_FORM.test(sid)) throw var_(`skapar[${i}].id "${sid}"`, "får bara innehålla små bokstäver, siffror, bindestreck och understreck.");
    if (skapar.some((r) => r.id === sid)) throw var_(`skapar[${i}].id "${sid}"`, "står två gånger i samma modul.");

    let snamn;
    try {
      snamn = byggNamn(rad.namn);
    } catch (fel) {
      throw var_(`skapar[${i}].namn för "${sid}"`, fel instanceof Error ? fel.message.replace(/^byggNamn: /, "") : String(fel));
    }

    const sikon = rensa(rad.ikon);
    if (!sikon) throw var_(`skapar[${i}].ikon för "${sid}"`, "krävs. En flik utan ikon blir ett hål i en rad som har ikoner överallt annars.");

    /*
     * ⛔ `katalog` SKILJER null FRÅN SAKNAD. `undefined` är ett fel, `null` är
     * ett svar. Se SKAPARFALT om varför.
     */
    if (!("katalog" in rad)) {
      throw var_(`skapar[${i}].katalog för "${sid}"`, "krävs. Skriv katalogens id, eller null när registreringen inte har någon typ att välja.");
    }
    let skatalog = null;
    if (rad.katalog !== null) {
      skatalog = rensa(rad.katalog);
      if (!skatalog) throw var_(`skapar[${i}].katalog för "${sid}"`, `måste vara ett katalog-id eller null, inte ${JSON.stringify(rad.katalog)}.`);
      if (!ID_FORM.test(skatalog)) throw var_(`skapar[${i}].katalog "${skatalog}" för "${sid}"`, "har fel form för ett katalog-id.");
    }

    /*
     * ⛔ ATT KATALOGEN FINNS GÅR INTE ATT AVGÖRA HÄR, och det är en avvikelse
     * från ärendets ord "kastar vid uppstart". Kataloger kommer ur `kallor.kataloger`,
     * alltså ur en FUNKTION som frågas per grupp, och ingen lista finns förrän
     * den frågats. Kontrollen bor i `kontrolleraSkaparkataloger` och körs så
     * tidigt den kan: när gruppens kataloger är lästa. Att låtsas kontrollera
     * den här hade varit en vakt som utlovar ett skydd den inte har.
     */

    /*
     * ⛔ `typeof === "function"` DUGER INTE, OCH DET ÄR ETT MÄTT FYND. Ett
     * `lazy()`-inslag är ett OBJEKT, inte en funktion, och exempelmodulen
     * MÅSTE ladda sitt formulär lat: manifestet läses av regelgeneratorn i ett
     * vanligt Node-skript, och Node kan inte importera JSX. En strängare
     * kontroll hade alltså gjort det enda rätta sättet att skriva modulen
     * omöjligt, och felet hade pekat på formuläret i stället för på kontrollen.
     *
     * Samma skäl som `routes[].vy` bara kräver att den finns: vad en giltig
     * React-komponent är kan ramverket inte avgöra utan att kopiera Reacts
     * egen lista, och den kopian hade ruttnat vid nästa React-version.
     */
    if (rad.form === undefined || rad.form === null) {
      throw var_(`skapar[${i}].form för "${sid}"`, "krävs. Ramverket äger panelen, modulen äger formuläret, och en registrering utan formulär är en flik som öppnar en tom yta.");
    }

    skapar.push(Object.freeze({ id: sid, namn: snamn, ikon: sikon, katalog: skatalog, form: rad.form }));
  });

  const hubb = byggHubb(d, var_);

  /*
   * ⛔ TYPERNA ÄR ETT BIDRAG OCH SKRIVS UT I FULL FORM (0.42.0, #217). Fältet är valfritt i manifestet
   * (ett krav hade fällt varje redan skriven modul på en minorversion) men den byggda modulen bär
   * alltid tre listor. Formen, id-formen och varför ett bidrags värde är `modul:id` står i
   * `modultyper.js`.
   */
  const typer = byggModulTyper(d.typer, var_);

  const tillagg = byggTillagg(d.tillagg, var_);

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
    skapar: Object.freeze(skapar),
    hubb,
    typer,
    tillagg,
  });
}

/**
 * Bygger modulens tillägg, eller kastar med skälet (0.60.0, #251, beslut 0003).
 *
 * ⛔ VALFRITT I MANIFESTET, ALLTID EN LISTA I MODULEN. Samma avvägning som `typer`: ett krav hade fällt varje redan skriven modul på
 * en minorversion, men den som läser modulen ska aldrig behöva fråga om fältet finns.
 *
 * ⛔ EN OKÄND PLATS AVVISAS. Platserna är ramverkets, och ett tillägg på en plats ingen yta ritar är ett tillägg som försvinner tyst.
 *
 * ⛔ ETIKETTEN KRÄVER BÅDA SPRÅKEN, strängare än `byggNamn`, som nöjer sig med svenska. Ett tillägg är nytt och har inga gamla manifest
 * att tåla (filhuvudet), och en etikett som saknar engelska ritas på svenska i en engelsk app.
 *
 * @param {unknown} varde
 * @param {(falt: string, skal: string) => Error} var_
 * @returns {ReadonlyArray<Tillagg>}
 */
function byggTillagg(varde, var_) {
  if (varde === undefined) return Object.freeze([]);
  if (!Array.isArray(varde)) {
    throw var_("tillagg", `måste vara en lista, inte ${varde === null ? "null" : typeof varde}. En modul utan tillägg utelämnar fältet eller skriver tillagg: [].`);
  }
  /** @type {Tillagg[]} */
  const ut = [];
  varde.forEach((/** @type {any} */ t, /** @type {number} */ i) => {
    if (!t || typeof t !== "object" || Array.isArray(t)) {
      throw var_(`tillagg[${i}]`, `måste vara ett objekt { ${TILLAGGSFALT.join(", ")} }.`);
    }
    const okanda = Object.keys(t).filter((n) => !TILLAGGSFALT.includes(n));
    if (okanda.length > 0) {
      throw var_(`tillagg[${i}]`, `bär fälten ${okanda.join(", ")} som inte känns igen. Ett tillägg bär ${TILLAGGSFALT.join(", ")}, och komponenten får { handelse, grupp } av ytan.`);
    }
    const plats = rensa(t.plats);
    if (!PLATSER.includes(plats)) {
      throw var_(
        `tillagg[${i}].plats ${JSON.stringify(t.plats)}`,
        `finns inte. Platserna är ramverkets och namnges av ramverket: ${PLATSER.join(", ")}. Saknas platsen öppnar ramverket den, en gång, för alla appar (beslut 0003).`,
      );
    }
    const tid = rensa(t.id);
    if (!tid || !ID_FORM.test(tid)) {
      throw var_(`tillagg[${i}].id ${JSON.stringify(t.id)}`, "måste vara ett id med små bokstäver, siffror, bindestreck och understreck. Ytan ritar tillägget med det som nyckel.");
    }
    if (ut.some((x) => x.id === tid)) throw var_(`tillagg[${i}].id "${tid}"`, "står två gånger i samma modul. Två tillägg med samma nyckel ritas som ett, och vilket avgörs av ordningen.");
    const e = t.etikett && typeof t.etikett === "object" && !Array.isArray(t.etikett) ? t.etikett : null;
    const sv = rensa(e?.sv);
    const en = rensa(e?.en);
    if (!sv || !en) {
      throw var_(
        `tillagg[${i}].etikett för "${tid}"`,
        `måste vara { sv, en } med båda språken, och ${!sv && !en ? "båda saknas" : !sv ? "sv saknas" : "en saknas"}. Ett tillägg är nytt och har ingen gammal form att tåla.`,
      );
    }
    if (t.komponent === undefined || t.komponent === null) {
      throw var_(`tillagg[${i}].komponent för "${tid}"`, "krävs. Ramverket äger platsen, modulen äger det som ritas i den, och ett tillägg utan komponent är en tom sektion.");
    }
    /*
     * ⛔ EN KOMPONENT ÄR EN FUNKTION ELLER ETT OBJEKT. React memo och forwardRef ger objekt, så objekt släpps in. En sträng eller ett tal
     * hade klarat kontrollen ovan och först fallit när ytan försökte rita det, hos användaren i stället för vid uppstart (PR 258).
     */
    if (typeof t.komponent !== "function" && (typeof t.komponent !== "object" || Array.isArray(t.komponent))) {
      throw var_(`tillagg[${i}].komponent för "${tid}"`, `måste vara en React-komponent, alltså en funktion eller ett objekt från memo eller forwardRef, och ${typeof t.komponent === "object" ? "en lista" : `en ${typeof t.komponent === "string" ? "sträng" : typeof t.komponent}`} går inte att rita.`);
    }
    ut.push(Object.freeze({ plats, id: tid, etikett: Object.freeze({ sv, en }), komponent: t.komponent }));
  });
  return Object.freeze(ut);
}

/**
 * Ett React-element och inte en komponent, en sträng eller ingenting.
 *
 * ⛔ UTAN ATT IMPORTERA REACT. Manifestet läses av regelgeneratorn i ett vanligt
 * Node-skript (se `skapar[].form`), och `isValidElement` hade gjort den här
 * filen beroende av att React finns där. Ett element är ett objekt med
 * `$$typeof` OCH `props`; `memo` och `lazy` har det första men inte det andra,
 * och de är komponenter, inte något som går att rita som det är.
 *
 * @param {unknown} v
 */
const arElement = (v) => typeof v === "object" && v !== null && "$$typeof" in v && "props" in v;

/**
 * En adress: börjar med snedstreck, slutar inte med ett, och har inget
 * frågetecken eller brädgård. `/` ensam är hubbens eller Idags, aldrig en moduls.
 * @param {string} r
 */
const arRutt = (r) => /^\/[^?#\s]*[^/?#\s]$/.test(r);

/**
 * Bygger modulens kort i hubben, eller kastar med skälet (0.37.0, #184).
 *
 * ══ ⛔ VARFÖR KORTET BOR I MANIFESTET OCH INTE I ETT EGET REGISTER ═════
 *
 * `groups.moduler` pekar på modul-id i samma form som `defineModule` (se
 * `byggGrupp`). Ett andra register med egna id för hubbens kort hade gett två
 * listor över vilka moduler som finns, och den dag de glider isär väljer ägaren
 * en modul som hubben inte kan rita (arbetsreglernas punkt 2).
 *
 * ⛔ DELARNAS ADRESSER LIGGER UNDER MODULENS. `/ekonomi/inkomster` och aldrig
 * `/inkomster`: en del som inte bär sin moduls adress går inte att härleda
 * tillbaka till modulen, och då vet navigationen inte vilken flik som är aktiv
 * eller vart tillbaka-länken ska. De gamla adresserna lever vidare som
 * omdirigeringar (`byggOmdirigeringar`), inte som delar.
 *
 * ⛔ STARTSIDAN ÄR EN AV DELARNA OCH INTE EN EGEN SIDA. CP 2026-09-30 om
 * Ekonomi: "ekonomi-översikt är det som är översikten i den modulen". En
 * startsida som inte står i navigationen är en sida man bara når en gång.
 *
 * @param {Record<string, any>} d
 * @param {(falt: string, skal: string) => Error} var_
 * @returns {Hubbkort | null}
 */
function byggHubb(d, var_) {
  if (!("hubb" in d)) {
    throw var_("hubb", "krävs. Skriv modulens kort i hubben ({ ikon, rutt, startsida, delar }), eller null när modulen inte är ett kort. Se HUBBFALT om varför null och inte ingenting.");
  }
  const h = d.hubb;
  if (h === null) return null;
  if (!h || typeof h !== "object" || Array.isArray(h)) {
    throw var_("hubb", `måste vara ett objekt { ${HUBBFALT.join(", ")} } eller null, inte ${Array.isArray(h) ? "en lista" : typeof h}.`);
  }
  const okanda = Object.keys(h).filter((n) => !HUBBFALT.includes(n));
  if (okanda.length > 0) {
    throw var_(`fälten ${okanda.join(", ")} i hubb`, `känns inte igen. Kortet bär ${HUBBFALT.join(", ")}.`);
  }
  if (!arElement(h.ikon)) {
    throw var_("hubb.ikon", "måste vara ett React-element, till exempel <Wallet size={20} />. Ett namn eller en komponent går inte att rita som det är.");
  }
  const rutt = rensa(h.rutt);
  if (!arRutt(rutt)) {
    throw var_(`hubb.rutt ${JSON.stringify(h.rutt)}`, "måste vara en adress som börjar med snedstreck och inte slutar med ett, till exempel /ekonomi. Kortet leder dit.");
  }
  if (!Array.isArray(h.delar) || h.delar.length === 0) {
    throw var_("hubb.delar", "krävs och måste ha minst en del. Startsidan är en av delarna, och en modul utan delar har ingen insida att öppna.");
  }
  /** @type {Moduldel[]} */
  const delar = [];
  h.delar.forEach((/** @type {any} */ del, /** @type {number} */ i) => {
    if (!del || typeof del !== "object" || Array.isArray(del)) {
      throw var_(`hubb.delar[${i}]`, `måste vara ett objekt { ${DELFALT.join(", ")} }.`);
    }
    const okandaDel = Object.keys(del).filter((n) => !DELFALT.includes(n));
    if (okandaDel.length > 0) {
      throw var_(`hubb.delar[${i}]`, `bär fälten ${okandaDel.join(", ")} som inte känns igen. En del bär ${DELFALT.join(", ")}.`);
    }
    const did = rensa(del.id);
    if (!did || !ID_FORM.test(did)) {
      throw var_(`hubb.delar[${i}].id ${JSON.stringify(del.id)}`, "måste vara ett id med små bokstäver, siffror, bindestreck och understreck. Omdirigeringarna och startsidan pekar på det.");
    }
    if (delar.some((x) => x.id === did)) throw var_(`hubb.delar[${i}].id "${did}"`, "står två gånger.");
    if (typeof del.namn === "string") {
      throw var_(`hubb.delar[${i}].namn för "${did}"`, 'är en sträng. Ett namn är { sv, en }, som modulens eget namn.');
    }
    let dnamn;
    try {
      dnamn = byggNamn(del.namn && typeof del.namn === "object" ? del.namn : {});
    } catch (fel) {
      throw var_(`hubb.delar[${i}].namn för "${did}"`, fel instanceof Error ? fel.message.replace(/^byggNamn: /, "") : String(fel));
    }
    if (!arElement(del.ikon)) {
      throw var_(`hubb.delar[${i}].ikon för "${did}"`, "måste vara ett React-element. Navigationen ritar en ikon per del, och ett hål i raden ser ut som en del som inte laddat.");
    }
    const drutt = rensa(del.rutt);
    if (!arRutt(drutt) || !drutt.startsWith(`${rutt}/`)) {
      throw var_(
        `hubb.delar[${i}].rutt ${JSON.stringify(del.rutt)} för "${did}"`,
        `måste ligga under modulens adress, alltså börja med ${rutt}/. En del som inte bär sin moduls adress går inte att härleda tillbaka till modulen. En gammal adress blir en omdirigering, inte en del.`,
      );
    }
    if (delar.some((x) => x.rutt === drutt)) throw var_(`hubb.delar[${i}].rutt "${drutt}"`, "står två gånger. Vilken flik som är aktiv avgjordes då av ordningen.");
    delar.push(Object.freeze({ id: did, namn: dnamn, ikon: del.ikon, rutt: drutt }));
  });
  const startsida = rensa(h.startsida);
  if (!delar.some((x) => x.id === startsida)) {
    throw var_(`hubb.startsida ${JSON.stringify(h.startsida)}`, `måste vara en av delarna (${delar.map((x) => x.id).join(", ")}). Startsidan är den del modulen öppnas på, och en startsida utanför navigationen når man bara en gång.`);
  }
  return Object.freeze({ ikon: h.ikon, rutt, startsida, delar: Object.freeze(delar) });
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
  /** @type {Map<string, string>} */
  const skaparAgare = new Map();
  /** @type {Map<string, string>} */
  const hubbAgare = new Map();

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
      /*
       * ⛔ NYCKELN ÄR NAMNET OCH INTE RADEN. När `samlingar` blev utskrivna
       * objekt (#130) slutade den här kontrollen fälla, eftersom två olika
       * objekt aldrig är samma nyckel i en Map. Provet "två moduler som gör
       * anspråk på samma samling avvisas" blev rött, och det är precis vad ett
       * prov som mäter beteende ska göra när formen ändras under det.
       */
      const agare = samlingsAgare.get(samling.namn);
      if (agare) {
        throw new Error(
          `validateModuler: modulerna "${agare}" och "${modul.id}" gör båda anspråk på samlingen "${samling.namn}". Ramverket äger inte modulernas data, så det finns ingen som kan medla mellan två skrivare.`,
        );
      }
      samlingsAgare.set(samling.namn, modul.id);
    }

    /*
     * ⛔ SKAPA-ID:N ÄR UNIKA ÖVER HELA LISTAN, inte bara inom en modul. Plusset
     * ritar en flik per registrering och behöver en stabil nyckel, och två
     * flikar med samma nyckel gör vilken som visas till en fråga om
     * registreringsordningen. Samma felform som två moduler på samma route.
     */
    for (const reg of modul.skapar) {
      const agare = skaparAgare.get(reg.id);
      if (agare) {
        throw new Error(
          `validateModuler: modulerna "${agare}" och "${modul.id}" registrerar båda att de skapar "${reg.id}". Plusset ritar en flik per registrering, och två med samma id ger en flik vars innehåll avgörs av registreringsordningen.`,
        );
      }
      skaparAgare.set(reg.id, modul.id);
    }

    /*
     * ⛔ HUBBENS ADRESSER ÄR UNIKA ÖVER HELA LISTAN (0.37.0). Två moduler vars
     * kort leder till samma adress, eller vars delar gör det, ger en navigation
     * där "vilken modul är jag i" avgörs av registreringsordningen. Samma felform
     * som två moduler på samma route.
     */
    if (modul.hubb) {
      for (const r of [modul.hubb.rutt, ...modul.hubb.delar.map((x) => x.rutt)]) {
        const agare = hubbAgare.get(r);
        if (agare) {
          throw new Error(`validateModuler: modulerna "${agare}" och "${modul.id}" gör båda anspråk på adressen "${r}" i hubben. Vilken modul som är aktiv skulle avgöras av registreringsordningen.`);
        }
        hubbAgare.set(r, modul.id);
      }
    }
  }

  /*
   * ⛔ OCH INGEN MODUL LIGGER INUTI EN ANNAN. `/ekonomi/resor` som en egen
   * modul under `/ekonomi` är inte samma adress, så kontrollen ovan släpper
   * igenom den, men `modulLage` hade då kunnat svara båda för samma sida.
   */
  const med = moduler.filter((m) => m.hubb);
  for (const a of med) {
    for (const b of med) {
      if (a !== b && /** @type {Hubbkort} */ (b.hubb).rutt.startsWith(`${/** @type {Hubbkort} */ (a.hubb).rutt}/`)) {
        throw new Error(`validateModuler: modulen "${b.id}" (${/** @type {Hubbkort} */ (b.hubb).rutt}) ligger inuti modulen "${a.id}" (${/** @type {Hubbkort} */ (a.hubb).rutt}). En sida under båda hade hört till två moduler.`);
      }
    }
  }

  return moduler;
}
