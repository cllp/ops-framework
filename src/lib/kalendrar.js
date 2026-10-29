/**
 * Kalendrarna: gruppens kalendrar, mina kalendrar och posterna i mina kalendrar (0.36.0, #179 fas F0).
 *
 * ══ ⛔ VARFÖR DEN HÄR FILEN FINNS ═════════════════════════════════════════════
 *
 * CP 2026-09-29 21:10, epiken cllp/ops-framework#179: "Vidare kunna skapa olika kalendrar och filtrera på alla eller
 * specifika för gruppen." Beslutet samma kväll: flera namngivna GRUPPKALENDRAR per grupp, och egna privata kalendrar
 * ("Mina"). SessionStudio har bara det senare (PG `PersonalCalendar`), gruppens "kalender" är där gruppens händelser.
 *
 * ══ ⛔ GRUPPENS KALENDRAR ÄR EN KATALOG, PÅ SAMMA MOTOR SOM TYPERNA ═══════════
 *
 * En gruppkalender är precis det en kategori är: ett id som aldrig ändras, ett namn som får ändras, en färg, en ikon,
 * en ordning, arkiverad i stället för raderad, och `groupId` på varje rad (#162). Därför byggs den med `byggKategori`
 * och lagras med `katalognyckel` (`groupId|id`), och regelfragmentet bygger på samma block som katalogens.
 *
 * Två skillnader, båda utskrivna här i stället för att en kalender låtsas vara en kategori:
 *
 *   - INGEN FAS. En kalender är inte ett steg i ett flöde, så den är en sortkatalog (`faser: false`). Nyckeln `fas`
 *     tas bort ur raden i stället för att lagras som `null`, eftersom ett fält som alltid är `null` är ett fält ingen
 *     läser, och regelns `hasOnly` ska inte tillåta det.
 *   - TVÅ FÄLT TILL: `forvald` (den kalender en ny post hamnar i när inget annat väljs, och den kalender en händelse
 *     utan `kalenderId` hör till, se CHANGELOG 0.36.0) och `iFlodet` (tas med i prenumerationsflödet, fas F4).
 *
 * ⛔ FÄRGEN ÄR IDENTITETSPALETTENS SEX TONER, INTE SLAGPALETTENS TRE. Slagpaletten har tre platser för att fler inte
 * går att skilja åt som PRICKAR utan ord (`tokens.css`). En kalender syns aldrig utan sitt namn: i filtret, i
 * dagpanelens kort och i snabbtitten står namnet bredvid färgen. Tre färger hade tvingat fram dubbletter redan vid
 * fjärde kalendern. Samma sex toner som gruppens och profilens märke (`PROFILFARGER`), här som tal eftersom katalogens
 * `farg` alltid är ett tal.
 *
 * ══ ⛔ MINA KALENDRAR OCH DERAS POSTER LIGGER UNDER ANVÄNDAREN ═══════════════
 *
 * `<användare>/{uid}/<minaKalendrar>/{id}` och `<användare>/{uid}/<kalenderposter>/{id}`. Samlingsnamnen skickar appen
 * in (ramverket känner aldrig samlingsnamn eller projekt-id, CLAUDE.md "Vad som inte är regler här"). Bara ägaren läser
 * och skriver: de är privata, och delning per post till en grupp (SS `PersonalCalendarShare`) är en senare fas som
 * skrivs som en rad i gruppens scope, aldrig som en spegelkolumn här.
 *
 * ══ ⛔ TIDEN ÄR VÄGGKLOCKA I EN TIDSZON SOM ÄR EN INSTÄLLNING ═══════════════
 *
 * En post bär `start` och `slut` som lokal tid, `YYYY-MM-DDTHH:MM`, eller datum, `YYYY-MM-DD`, när den är heldag.
 * Zonen är INTE en konstant i koden som i SS (`shared/appTimezone.js`): den är en inställning med `Europe/Stockholm`
 * som förval (`STANDARD_TIDSZON`), så att en kund i en annan zon inte kräver en ny version. Strängar och inte `Date`,
 * av samma skäl som `calendar.js`: ett `Date` bär webbläsarens zon, och en post "09:00" hade blivit 08:00 i London.
 */

import { byggKategori, ID_FORM, KATEGORIFALT, katalognyckel, valjbara } from "./katalog.js";
import { text } from "./sprak.js";

/** Färgerna en kalender får ha: identitetspalettens sex toner (`--color-identity-1` till `-6`). */
export const KALENDERFARGER = /** @type {const} */ ([1, 2, 3, 4, 5, 6]);

/**
 * Ikonerna en kalender får ha, som ramverkets egna id:n och inte Lucide-namn (samma skäl som `GRUPPIKONER`).
 * ⛔ ORDNINGEN ÄR VÄLJARENS ORDNING. `kalender` först, eftersom det är vad de flesta är.
 */
export const KALENDERIKONER = /** @type {const} */ (["kalender", "grupp", "portfolj", "hus", "stjarna", "hjarta", "blixt", "bok"]);

/**
 * Fälten en gruppkalender bär, HÄRLEDDA ur katalogens och inte skrivna för hand: katalogens fält utan `fas`, plus
 * `forvald` och `iFlodet`. Ändras `KATEGORIFALT` följer den här listan med, och regelfragmentet läser DEN här.
 */
export const KALENDERFALT = /** @type {readonly string[]} */ ([...KATEGORIFALT.filter((f) => f !== "fas"), "forvald", "iFlodet"]);

/**
 * Fält en gruppkalender INTE längre bär men som gamla rader i databasen kan göra (0.129.0, cllp/lifehub.app#303 och #307).
 *
 * ══ ⛔ `githubEtikett` (0.108.0 till 0.128.0) ═════════════════════════════════════════════════════════
 *
 * Beslutet 2026-10-15 var att kalendern väljs på ärendet och inte via en GitHub-etikett: "Vi kan inte binda oss till GitHub så." Fältet
 * togs därför bort, med allt som läste det. Men en kalender som sparades med en etikett under de tre veckorna har fältet kvar i
 * databasen, och ramverket kan inte mäta hur många det är (det vet inte appens projekt). Listan finns för att en sådan rad inte ska
 * bli en kalender som inte går att öppna eller ändra, och den har TVÅ läsare som ska förbli ense (arbetsreglernas punkt 2):
 *
 *   - LÄSNINGEN (`utanAvvecklade`): fältet släpps ur raden innan den valideras, så att gruppens kalenderlista inte kastar vid varje
 *     uppstart. Nästa gång kalendern sparas genom ramverket skrivs den utan fältet (källan ersätter dokumentet).
 *   - REGELN (`kalenderregelfragment`): en rad som redan bär fältet får skrivas om med fältet OFÖRÄNDRAT. Det går varken att skriva det
 *     på en rad som saknar det, eller att ändra värdet. Det behövs för en klient som ännu kör en äldre ompinning och skickar tillbaka
 *     raden som den läste den.
 *
 * ⛔ SKRIVVÄGEN VÄGRAR (`byggGruppkalender`): den som försöker skriva fältet får en mening om varför, inte en tyst uteslutning.
 *
 * ⛔ DEN HÄR LISTAN TAS BORT NÄR NOLL KALENDRAR BÄR FÄLTET I PRODUKTION. Det är en mätning appen gör (en fråga mot `gruppkalendrar`
 * efter fältet), och den står som ett uppdrag i CHANGELOG 0.129.0. Tills dess är listan ett dokumenterat undantag och inte en
 * funktion (arbetsreglernas punkt 1: temporärt bara med ett uppdrag).
 */
export const AVVECKLADE_KALENDERFALT = /** @type {readonly string[]} */ (["githubEtikett"]);

/**
 * Raden utan de avvecklade fälten (0.129.0). LÄSVÄGEN, inte skrivvägen: se `AVVECKLADE_KALENDERFALT`.
 * @param {unknown} rad
 * @returns {Record<string, any>}
 */
export function utanAvvecklade(rad) {
  if (!rad || typeof rad !== "object") return /** @type {any} */ (rad);
  const ut = { .../** @type {Record<string, any>} */ (rad) };
  for (const f of AVVECKLADE_KALENDERFALT) delete ut[f];
  return ut;
}

/** Fälten en av mina kalendrar bär. Ingen grupp (den ligger under användaren), inga texter (ett språk: ägarens). */
export const MINKALENDERFALT = /** @type {const} */ (["id", "namn", "farg", "ikon", "ordning", "forvald", "iFlodet", "arkiverad"]);

/** Fälten en post i mina kalendrar bär. */
export const KALENDERPOSTFALT = /** @type {const} */ (["id", "kalenderId", "titel", "beskrivning", "plats", "start", "slut", "heldag", "blockerar"]);

/** Tak som en rad i en regel kan hålla, och som ett formulär kan visa. */
export const MAX_KALENDERNAMN = 80;
export const MAX_POSTTITEL = 200;
export const MAX_POSTBESKRIVNING = 2000;
export const MAX_POSTPLATS = 200;

/**
 * Längsta id en av mina kalendrar eller en post får ha (0.153.0, cllp/ops-framework#463). Samma tak som ett grupp-id och en kalenderrads nyckel i kalendervalen
 * (`MAX_KALENDERVALGRUPP`, `MAX_KALENDERVALNYCKEL`). Appens egna id:n är mycket kortare: `kalenderIdUrNamn` ger högst 40 tecken plus ett suffix, och en posts id är `p-` och tolv tecken.
 * Reglerna (`kalenderregelfragment`) prövar det på `create`, aldrig på `update`: ett dokument som redan finns kan inte byta id, och en regel som nekade dess ändring hade låst ute ägaren.
 */
export const MAX_KALENDERID = 80;

/**
 * Längsta ikon en av mina kalendrar får bära (0.153.0, #463). En ikon är ett NAMN ur `KALENDERIKONER` (längst `portfolj`, åtta tecken), aldrig en bild. Reglerna prövar formen (`ID_FORM`)
 * och det här taket, inte listan: en ikon som ramverket lägger till ska inte kräva en regeldeploy. Byggaren och läsningen prövar samma form; en ikon i formen som saknas i listan behålls och ritas med reservikonen, och bara en ikon utanför formen blir `KALENDERIKONER[0]` vid läsning.
 */
export const MAX_KALENDERIKON = 40;

/** Förvald tidszon. En inställning, inte en konstant i koden (se filhuvudet). */
export const STANDARD_TIDSZON = "Europe/Stockholm";

/** `YYYY-MM-DD`. */
export const DATUMFORM = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** `YYYY-MM-DDTHH:MM`, väggklocka i inställningens zon. */
export const TIDPUNKTSFORM = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * @typedef {object} Gruppkalender
 * @property {string} id
 * @property {import("./sprak.js").Namn} namn
 * @property {1|2|3|4|5|6} farg
 * @property {string} ikon Ur `KALENDERIKONER`.
 * @property {number} ordning
 * @property {boolean} arkiverad
 * @property {Record<string, import("./sprak.js").Namn>} texter
 * @property {string} groupId
 * @property {boolean} forvald
 * @property {boolean} iFlodet
 */

/**
 * @typedef {object} MinKalender
 * @property {string} id
 * @property {string} namn
 * @property {1|2|3|4|5|6} farg
 * @property {string} ikon
 * @property {number} ordning
 * @property {boolean} forvald
 * @property {boolean} iFlodet
 * @property {boolean} arkiverad
 */

/**
 * @typedef {object} Kalenderpost
 * @property {string} id
 * @property {string} kalenderId En av MINA kalendrar.
 * @property {string} titel
 * @property {string} beskrivning Tom sträng när den saknas, aldrig utelämnad (en form, inte två).
 * @property {string} plats Tom sträng när den saknas.
 * @property {string} start `YYYY-MM-DD` vid heldag, annars `YYYY-MM-DDTHH:MM`.
 * @property {string} slut Samma form som `start`, och aldrig före den. Heldag: sista dagen, inklusive.
 * @property {boolean} heldag
 * @property {boolean} blockerar Blockerar tillgänglighet (fas F6 visar det).
 */

/**
 * `forvald` och `iFlodet` som riktiga booleaner, eller kast.
 *
 * ⛔ KASTAR PÅ ALLT SOM INTE ÄR `true`, `false` ELLER UTELÄMNAT. En sträng "false" hade annars blivit sann i en
 * JavaScript-jämförelse och falsk i regeln (`is bool`), och då hade klienten trott att den sparat något regeln nekar.
 *
 * @param {unknown} v @param {string} falt @param {string} var_ @returns {boolean}
 */
function bool(v, falt, var_) {
  if (v === undefined) return false;
  if (typeof v !== "boolean") throw new Error(`${var_}: ${falt} måste vara true eller false, inte ${JSON.stringify(v)}.`);
  return v;
}

/**
 * Bygger en gruppkalender, eller kastar med skälet.
 *
 * ⛔ ETT AVVECKLAT FÄLT (`AVVECKLADE_KALENDERFALT`) AVVISAS HÄR MED EN MENING OM VARFÖR, det tas inte bort tyst. Det här är skrivvägen:
 * den som skickar `githubEtikett` tror att kalendern får en etikett, och 0.129.0 har ingen sådan. Läsvägen (`validateGruppkalendrar`)
 * släpper fältet ur gamla rader innan den kommer hit, så en rad som lästs ur databasen når aldrig det här felet.
 *
 * @param {Record<string, any>} d
 * @returns {Gruppkalender}
 */
export function byggGruppkalender(d) {
  const { forvald, iFlodet, ...resten } = d && typeof d === "object" ? d : /** @type {Record<string, any>} */ ({});
  for (const falt of AVVECKLADE_KALENDERFALT) {
    if (resten[falt] !== undefined) {
      throw new Error(
        `gruppkalendrar: fältet ${falt} för "${String(resten.id)}" finns inte längre (0.129.0). Kalendern väljs på ärendet och inte via en etikett på kalendern. Skicka raden utan fältet.`,
      );
    }
    // Ett `undefined` är "inte angivet" och passerar, men nyckeln ska inte följa med till `byggKategori`, som avvisar okända nycklar.
    delete resten[falt];
  }
  /*
   * ⛔ `fas` AVVISAS AV `byggKategori` (`faser: false`), SÅ DEN BEHÖVER INTE KONTROLLERAS HÄR. Det som tas bort nedan
   * är nyckeln `fas: null` som bygget alltid lägger till, inte ett värde någon skickat in.
   */
  const bas = byggKategori(resten, { katalog: "gruppkalendrar", faser: false, platser: KALENDERFARGER, ikoner: KALENDERIKONER });
  const { fas: _fas, ...utanFas } = bas;
  const id = bas.id;
  return {
    .../** @type {Omit<Gruppkalender, "forvald" | "iFlodet">} */ (/** @type {unknown} */ (utanFas)),
    forvald: bool(forvald, `forvald för "${id}"`, "gruppkalendrar"),
    iFlodet: bool(iFlodet, `iFlodet för "${id}"`, "gruppkalendrar"),
  };
}

/**
 * Kalendrarnas ordning: `ordning`, sedan `id`. EN jämförelse för alla som sorterar kalendrar (0.108.0, granskningen av PR 395).
 *
 * ⛔ HIT FLYTTADE SORTERINGEN FRÅN `kalenderkalla.js`, där den stod två gånger (gruppens och mina). En egen jämförelse bredvid hade gjort
 * "första i ordningen" till en konvention som två ställen kan tolka olika (arbetsreglernas punkt 2). Källan sorterar med den här, alltså
 * är "första" alltid den kalender `gruppens()` listar först. (Funktionen som valde en kalender ur en etikett, `kalenderForEtikett`, är
 * borttagen i 0.129.0; sorteringen behövs ändå.)
 *
 * @param {{ ordning: number, id: string }} a @param {{ ordning: number, id: string }} b
 * @returns {number}
 */
export const efterOrdning = (a, b) => a.ordning - b.ordning || a.id.localeCompare(b.id);

/**
 * Validerar en grupps kalendrar vid uppstart.
 *
 * ⛔ HÖGST EN FÖRVALD, OCH DEN FÅR INTE VARA ARKIVERAD. Två förvalda gör "var hamnar en post utan kalender" till en
 * fråga om vilken rad databasen svarar med först, och en arkiverad förvald är en kalender ingen kan välja men som
 * ändå får varje ny post. Ingen förvald alls är tillåtet: då gäller den första valbara (`forvaldKalender`), och det är
 * läget innan någon valt.
 *
 * ⛔ SAMMA GRUPP PÅ VARJE RAD. En katalog är EN grupps, och en rad från en annan grupp i listan är ett fel i läsvägen,
 * inte en kalender att visa.
 *
 * @param {unknown} rader
 * @returns {Gruppkalender[]}
 */
export function validateGruppkalendrar(rader) {
  if (!Array.isArray(rader)) throw new Error(`gruppkalendrar: kalendrarna måste vara en lista, inte ${typeof rader}.`);
  /** @type {Set<string>} */
  const sedda = new Set();
  const ut = rader.map((r) => {
    // ⛔ LÄSVÄGEN: ett avvecklat fält på en gammal rad släpps (`AVVECKLADE_KALENDERFALT`), så att en rad som sparades före 0.129.0 fortfarande går att öppna.
    const k = byggGruppkalender(utanAvvecklade(r));
    if (sedda.has(k.id)) throw new Error(`gruppkalendrar: id "${k.id}" finns två gånger. Två kalendrar med samma id ser ut som en, och posterna i den andra ritas med den förstas namn och färg.`);
    sedda.add(k.id);
    return k;
  });
  const grupper = new Set(ut.map((k) => k.groupId));
  if (grupper.size > 1) throw new Error(`gruppkalendrar: raderna kommer från ${grupper.size} grupper (${[...grupper].join(", ")}). En grupps kalendrar är EN grupps, och en rad från en annan grupp är ett fel i läsvägen.`);
  kontrolleraForvald(ut, "gruppkalendrar");
  return ut;
}

/**
 * @param {ReadonlyArray<{ id: string, forvald: boolean, arkiverad: boolean }>} lista @param {string} katalog
 */
function kontrolleraForvald(lista, katalog) {
  const forvalda = lista.filter((k) => k.forvald);
  if (forvalda.length > 1) throw new Error(`${katalog}: ${forvalda.length} kalendrar är förvalda (${forvalda.map((k) => k.id).join(", ")}). Högst en får vara det, annars avgör databasens ordning var en ny post hamnar.`);
  if (forvalda[0] && forvalda[0].arkiverad) throw new Error(`${katalog}: den förvalda kalendern "${forvalda[0].id}" är arkiverad. Då får varje ny post en kalender ingen kan välja.`);
}

/**
 * Den förvalda kalendern: den markerade, annars den första valbara, annars `null`.
 *
 * ⛔ HÄRLEDD OCH INTE LAGRAD NÄR INGEN VALT. Att skriva `forvald: true` på den första raden vid seedningen hade gjort
 * två sanningar om samma sak: raden och ordningen. Här avgör ordningen tills någon väljer.
 *
 * @template {{ id: string, forvald: boolean, arkiverad: boolean, ordning: number, namn: any }} K
 * @param {ReadonlyArray<K>} lista
 * @returns {K | null}
 */
export function forvaldKalender(lista) {
  const valbara = /** @type {K[]} */ (/** @type {unknown} */ (valjbara(/** @type {any} */ (lista))));
  return valbara.find((k) => k.forvald) || valbara[0] || null;
}

/**
 * Dokumentnyckeln för en gruppkalender: samma `groupId|id` som katalogen, ur samma funktion.
 * @param {string} groupId @param {string} id @returns {string}
 */
export const gruppkalendernyckel = (groupId, id) => katalognyckel(groupId, id);

/**
 * ══ ⛔ VARJE GRUPP HAR EN STANDARDKALENDER (0.120.0, cllp/lifehub.app#367) ══════════════════════════════════════════════
 *
 * CP 2026-10-19: "Skapa ny grupp, kommer inte med en default grupp kalender." Det ersätter beslutet "gruppen ÄR kalendern"
 * (0.78.2 och 0.84.0, cllp/ops-framework#309). Händelsen: en ny grupp hade inga namngivna kalendrar, så ramverkets förval för en
 * ny händelse föll på PERSONENS egen kalender (Barnveckor), händelsen blev en post i `users/{uid}/kalenderposter` i stället för en
 * händelse i gruppen, och den gick inte att öppna. Att ha en grupp utan kalender var ett läge som ramverket tillät och som tre
 * ställen i koden inte klarade av. Nu uppstår läget bara om en admin arkiverar allt, och då är det ett val.
 *
 * ⛔ NAMNET OCH ID:T ÄR KONSTANTER HÄR OCH INGEN ANNANSTANS (en sanning per faktum). Claudes förslag, CP kan byta: byt dem här.
 * `forvald` sätts inte på raden: förvald är HÄRLEDD (`forvaldKalender`), och `true` på den första raden hade varit två sanningar.
 */
export const STANDARDKALENDER_ID = "kalender";
/** @type {import("./sprak.js").Namn} */
export const STANDARDKALENDER_NAMN = Object.freeze({ sv: "Kalender", en: "Calendar" });

/**
 * Standardkalenderns rad för en grupp, byggd med SAMMA `byggGruppkalender` som skrivvägen och med dokumentnyckeln (`groupId|id`)
 * som `id`, precis som `sparaGruppens` skriver den.
 *
 * @param {string} groupId
 * @returns {Gruppkalender}
 */
export function standardGruppkalender(groupId) {
  const rad = byggGruppkalender({ id: STANDARDKALENDER_ID, namn: { ...STANDARDKALENDER_NAMN }, farg: 1, ikon: "kalender", ordning: 0, arkiverad: false, texter: {}, groupId });
  return { ...rad, id: gruppkalendernyckel(groupId, STANDARDKALENDER_ID) };
}

/** En ikon i den form reglerna tar emot (`opsMinKalenderGiltig`): ett namn i `ID_FORM`, högst `MAX_KALENDERIKON` tecken. @param {unknown} v @returns {v is string} */
function ikonFormOk(v) {
  return typeof v === "string" && v.length <= MAX_KALENDERIKON && ID_FORM.test(v);
}

/** Ett heltal, eller text som bara är ett heltal ("3", " 40 ", "-10"). `Number` ensam hade läst `true`, `null` och "" som tal. @param {unknown} v @returns {boolean} */
function heltalEllerHeltalstext(v) {
  if (typeof v === "number") return Number.isInteger(v);
  return typeof v === "string" && /^\s*-?\d+\s*$/.test(v);
}

/**
 * Bygger en av mina kalendrar, eller kastar.
 *
 * @param {Record<string, any>} d
 * @returns {MinKalender}
 */
export function byggMinKalender(d) {
  const var_ = "minaKalendrar";
  const r = d && typeof d === "object" ? d : {};
  const okanda = Object.keys(r).filter((f) => !(/** @type {readonly string[]} */ (MINKALENDERFALT)).includes(f));
  const id = rensa(r.id);
  if (okanda.length > 0) throw new Error(`${var_}: fälten ${okanda.join(", ")} för "${id}" känns inte igen. En av mina kalendrar bär ${MINKALENDERFALT.join(", ")}.`);
  if (!ID_FORM.test(id)) throw new Error(`${var_}: id "${id}" krävs och får bara innehålla små bokstäver, siffror, - och _.`);
  const namn = rensa(r.namn);
  if (!namn) throw new Error(`${var_}: namn för "${id}" krävs. En kalender utan namn går inte att välja i filtret.`);
  if (namn.length > MAX_KALENDERNAMN) throw new Error(`${var_}: namn för "${id}" är ${namn.length} tecken, taket är ${MAX_KALENDERNAMN}.`);
  const farg = Number(r.farg);
  if (!(/** @type {readonly number[]} */ (KALENDERFARGER)).includes(farg)) throw new Error(`${var_}: farg för "${id}" måste vara ${KALENDERFARGER.join(", ")}, inte ${JSON.stringify(r.farg)}.`);
  const ikon = rensa(r.ikon);
  /*
   * ⛔ IKONEN PRÖVAS MOT REGLERNAS FORM, INTE MOT LISTAN (granskningen av PR 464). En ikon som en nyare version av ramverket lagt till i `KALENDERIKONER` finns inte i den här listan; hade
   * byggaren kastat på den hade en äldre klient inte kunnat spara kalendern alls, och hade läsningen bytt den mot `kalender` hade den äldre klienten skrivit över den nyare klientens val.
   * Den behålls, och ritas med reservikonen (`kalenderIkonKomponent`). Listan är det väljaren erbjuder, och reglerna prövar samma form som här (`ikonFormOk`).
   */
  if (!ikonFormOk(ikon)) {
    throw new Error(`${var_}: ikon "${String(ikon).slice(0, 60)}" för "${id}" är inte ett ikonnamn: små bokstäver, siffror, - och _, högst ${MAX_KALENDERIKON} tecken (${KALENDERIKONER.join(", ")}).`);
  }
  const ordning = r.ordning === undefined ? 0 : Number(r.ordning);
  if (!Number.isInteger(ordning)) throw new Error(`${var_}: ordning för "${id}" måste vara ett heltal.`);
  return {
    id,
    namn,
    farg: /** @type {1|2|3|4|5|6} */ (farg),
    ikon,
    ordning,
    forvald: bool(r.forvald, `forvald för "${id}"`, var_),
    iFlodet: bool(r.iFlodet, `iFlodet för "${id}"`, var_),
    arkiverad: bool(r.arkiverad, `arkiverad för "${id}"`, var_),
  };
}

/**
 * Läser en av mina kalendrar ur databasen och LÄKER den (0.153.0, cllp/ops-framework#463). Skrivvägen (`byggMinKalender`) är strikt och kastar. Läsvägen släpper det reglerna inte längre tar emot,
 * så att dokumentet läker vid nästa skrivning, på samma sätt som `rensaKalenderSynlighet` (0.152.0).
 *
 * ⛔ VARFÖR LÄSVÄGEN SLÄPPER OCH INTE KASTAR. Reglerna nekar från 0.153.0 en `ikon` som inte är ett kort namn och fält av fel sort. Ett dokument som redan står i databasen med en sådan `ikon` hade, om läsaren behöll
 * den, följt med i varje senare skrivning (`sparaMina` skriver HELA raden), nekats, och "Försök igen" aldrig lyckats. Ägaren hade låsts ute från sin egen kalender. Därför:
 *   - en `ikon` som reglerna nekar (inte text, inte ett namn i `ID_FORM`, över `MAX_KALENDERIKON` tecken), eller som saknas (reglerna kräver inte fältet, byggaren gör det), blir `KALENDERIKONER[0]` (kalender).
 *     ⛔ En ikon som klarar reglerna men saknas i `KALENDERIKONER` BEHÅLLS (granskningen av PR 464): en nyare klient kan ha lagt till den, och den ritas med reservikonen,
 *   - ett fält utanför `MINKALENDERFALT` släpps (`hasOnly` i reglerna hade nekat det),
 *   - `ordning` som inte är ett heltal blir 0 (numerisk text som "3" är 3, som byggaren läser den), och `forvald`, `iFlodet` och `arkiverad` som inte är sanningsvärden blir `false`.
 * Det som INTE läker: ett id utanför `ID_FORM` (dokumentets nyckel går inte att byta), ett tomt eller för långt `namn` och en ogiltig `farg`. De kastar som förut, med skälet.
 *
 * @param {unknown} rad
 * @returns {MinKalender}
 */
export function lasMinKalender(rad) {
  const r = rad && typeof rad === "object" ? /** @type {Record<string, any>} */ (rad) : {};
  /** @type {Record<string, any>} */
  const ut = {};
  for (const f of MINKALENDERFALT) if (f in r) ut[f] = r[f];
  if (!(typeof ut.ikon === "string" && ikonFormOk(ut.ikon.trim()))) ut.ikon = KALENDERIKONER[0];
  // ⛔ "3" ÄR 3 (granskningen av PR 464): byggaren läser numerisk text som talet och skriver talet, som reglerna tar emot. Bara det som inte är ett heltal blir 0.
  if ("ordning" in ut && !heltalEllerHeltalstext(ut.ordning)) ut.ordning = 0;
  for (const f of /** @type {const} */ (["forvald", "iFlodet", "arkiverad"])) if (f in ut && typeof ut[f] !== "boolean") ut[f] = false;
  return byggMinKalender(ut);
}

/**
 * @param {unknown} rader
 * @param {(rad: any) => MinKalender} bygg
 * @returns {MinKalender[]}
 */
function minaKalendrarMed(rader, bygg) {
  if (!Array.isArray(rader)) throw new Error(`minaKalendrar: kalendrarna måste vara en lista, inte ${typeof rader}.`);
  /** @type {Set<string>} */
  const sedda = new Set();
  const ut = rader.map((r) => {
    const k = bygg(r);
    if (sedda.has(k.id)) throw new Error(`minaKalendrar: id "${k.id}" finns två gånger.`);
    sedda.add(k.id);
    return k;
  });
  kontrolleraForvald(ut, "minaKalendrar");
  return ut;
}

/**
 * Validerar mina kalendrar: unika id och högst en förvald, som för gruppens. SKRIVVÄGEN: strikt, kastar på varje avvikelse.
 * @param {unknown} rader @returns {MinKalender[]}
 */
export function validateMinaKalendrar(rader) {
  return minaKalendrarMed(rader, byggMinKalender);
}

/**
 * Mina kalendrar ur databasen, läkta (`lasMinKalender`), med samma kontroller av unika id och högst en förvald. LÄSVÄGEN (`createKalenderkalla().mina`).
 * @param {unknown} rader @returns {MinKalender[]}
 */
export function lasMinaKalendrar(rader) {
  return minaKalendrarMed(rader, lasMinKalender);
}

/**
 * Bygger en post i en av mina kalendrar, eller kastar.
 *
 * ⛔ `slut` ÄR ALDRIG FÖRE `start`, OCH BÅDA HAR SAMMA FORM. En post som slutar innan den börjar ritas inte alls i ett
 * rutnät (den har ingen dag), och en post med datum i ena änden och klockslag i den andra är varken heldag eller inte.
 * Formerna gör att en ren strängjämförelse räcker, och regeln gör samma jämförelse (`slut >= start`).
 *
 * ⛔ TOMT ÄR EN TOM STRÄNG, INTE ETT UTELÄMNAT FÄLT. `beskrivning` och `plats` finns alltid. Två former av "ingen plats"
 * (saknas och tom) är två grenar i varje läsare, och en av dem glöms (arbetsreglernas punkt 5).
 *
 * @param {Record<string, any>} d
 * @param {{ kalendrar?: ReadonlyArray<{ id: string, arkiverad?: boolean }> }} [config] Finns listan krävs att `kalenderId`
 *   är en av dem och inte arkiverad. Regeln kräver att dokumentet finns (`exists`).
 * @returns {Kalenderpost}
 */
export function byggKalenderpost(d, config = {}) {
  const var_ = "kalenderposter";
  const r = d && typeof d === "object" ? d : {};
  const id = rensa(r.id);
  const okanda = Object.keys(r).filter((f) => !(/** @type {readonly string[]} */ (KALENDERPOSTFALT)).includes(f));
  if (okanda.length > 0) throw new Error(`${var_}: fälten ${okanda.join(", ")} för "${id}" känns inte igen. En post bär ${KALENDERPOSTFALT.join(", ")}.`);
  if (!ID_FORM.test(id)) throw new Error(`${var_}: id "${id}" krävs och får bara innehålla små bokstäver, siffror, - och _.`);
  const kalenderId = rensa(r.kalenderId);
  if (!ID_FORM.test(kalenderId)) throw new Error(`${var_}: kalenderId för "${id}" krävs. En post utan kalender syns i ingen kalender och går inte att filtrera fram.`);
  if (config.kalendrar) {
    const k = config.kalendrar.find((x) => x.id === kalenderId);
    if (!k) throw new Error(`${var_}: kalendern "${kalenderId}" för "${id}" finns inte bland mina kalendrar.`);
    if (k.arkiverad) throw new Error(`${var_}: kalendern "${kalenderId}" för "${id}" är arkiverad och går inte att lägga nya poster i.`);
  }
  const titel = rensa(r.titel);
  if (!titel) throw new Error(`${var_}: titel för "${id}" krävs. En post utan titel är en tom rad i dagpanelen.`);
  if (titel.length > MAX_POSTTITEL) throw new Error(`${var_}: titel för "${id}" är ${titel.length} tecken, taket är ${MAX_POSTTITEL}.`);
  const beskrivning = rensa(r.beskrivning);
  if (beskrivning.length > MAX_POSTBESKRIVNING) throw new Error(`${var_}: beskrivning för "${id}" är ${beskrivning.length} tecken, taket är ${MAX_POSTBESKRIVNING}.`);
  const plats = rensa(r.plats);
  if (plats.length > MAX_POSTPLATS) throw new Error(`${var_}: plats för "${id}" är ${plats.length} tecken, taket är ${MAX_POSTPLATS}.`);
  const heldag = bool(r.heldag, `heldag för "${id}"`, var_);
  const form = heldag ? DATUMFORM : TIDPUNKTSFORM;
  const formText = heldag ? "YYYY-MM-DD (heldag)" : "YYYY-MM-DDTHH:MM";
  const start = rensa(r.start);
  const slut = rensa(r.slut) || start;
  if (!form.test(start)) throw new Error(`${var_}: start "${start}" för "${id}" ska vara ${formText}.`);
  if (!form.test(slut)) throw new Error(`${var_}: slut "${slut}" för "${id}" ska vara ${formText}.`);
  if (!giltigtDatum(start.slice(0, 10)) || !giltigtDatum(slut.slice(0, 10))) throw new Error(`${var_}: ett datum för "${id}" finns inte i kalendern (${start} till ${slut}).`);
  if (slut < start) throw new Error(`${var_}: slut ${slut} för "${id}" är före start ${start}.`);
  return { id, kalenderId, titel, beskrivning, plats, start, slut, heldag, blockerar: bool(r.blockerar, `blockerar för "${id}"`, var_) };
}

/**
 * Läser en post ur databasen och LÄKER den (0.153.0, #463), som `lasMinKalender`. Reglerna kräver från 0.153.0 att `beskrivning` och `plats` är text och `blockerar` ett sanningsvärde.
 * Ett fält utanför `KALENDERPOSTFALT` släpps, `beskrivning` och `plats` som inte är text blir tomma och `blockerar` som inte är ett sanningsvärde blir `false`. Titel, kalender och tider kastar som förut.
 *
 * @param {unknown} rad
 * @returns {Kalenderpost}
 */
export function lasKalenderpost(rad) {
  const r = rad && typeof rad === "object" ? /** @type {Record<string, any>} */ (rad) : {};
  /** @type {Record<string, any>} */
  const ut = {};
  for (const f of KALENDERPOSTFALT) if (f in r) ut[f] = r[f];
  for (const f of /** @type {const} */ (["beskrivning", "plats"])) if (f in ut && typeof ut[f] !== "string") ut[f] = "";
  if ("blockerar" in ut && typeof ut.blockerar !== "boolean") ut.blockerar = false;
  return byggKalenderpost(ut);
}

/**
 * Vad i ett lagrat dokument i `minaKalendrar` eller `kalenderposter` som reglerna från 0.153.0 inte släpper igenom (cllp/ops-framework#463). Tom lista: dokumentet kan skrivas om som det står.
 *
 * ══ ⛔ VARFÖR DEN FINNS ═════════════════════════════════════════════════════════════════════════════════════
 *
 * Reglerna får inte låsa ute någon från sina egna kalendrar. Ramverket känner inte appens produktion, så frågan "bryter något befintligt dokument mot den nya formen?" besvaras av en MÄTNING i produktion,
 * `scripts/mat-kalenderdokument.mjs` (bara läsning), och mätningen använder den här funktionen. Den är härledd ur samma konstanter som reglerna (`MAX_KALENDERID`, `MAX_KALENDERIKON`, `ID_FORM`, fältlistorna), och
 * `rules/__tests__/kalendertak.test.mjs` prövar mot emulatorn att den och reglerna säger samma sak om varje dokument i provet: en mätning som kan gå isär från regeln mäter inte regeln.
 *
 * Koderna: `id` (utanför `ID_FORM` eller över `MAX_KALENDERID`; PRÖVAS BARA VID CREATE, så det låser ingen ute, men `byggMinKalender` kastar på det vid läsning), `okant-falt`, `namn`, `farg`, `ikon`, `ordning`, `forvald`,
 * `iFlodet`, `arkiverad` (kalender) samt `kalenderId`, `titel`, `beskrivning`, `plats`, `blockerar`, `heldag`, `start`, `slut`, `tidsordning` (post). Att kalendern finns och inte är arkiverad prövas inte: det är inte en
 * egenskap hos dokumentet.
 *
 * @param {"kalender" | "post"} slag
 * @param {string} id Dokumentets id (nyckeln i sökvägen).
 * @param {unknown} data Dokumentets fält.
 * @returns {string[]}
 */
export function kalenderformFel(slag, id, data) {
  /** @type {string[]} */
  const fel = [];
  if (typeof id !== "string" || !ID_FORM.test(id) || id.length > MAX_KALENDERID) fel.push("id");
  const d = data && typeof data === "object" && !Array.isArray(data) ? /** @type {Record<string, any>} */ (data) : null;
  if (!d) return [...fel, "okant-falt"];
  const tillatna = /** @type {readonly string[]} */ (slag === "kalender" ? MINKALENDERFALT : KALENDERPOSTFALT).filter((f) => f !== "id");
  if (Object.keys(d).some((f) => !tillatna.includes(f))) fel.push("okant-falt");
  const sant = (/** @type {string} */ f, /** @type {boolean} */ ok) => {
    if (!ok) fel.push(f);
  };
  const finns = (/** @type {string} */ f) => f in d;
  const text = (/** @type {unknown} */ v, /** @type {number} */ max) => typeof v === "string" && v.length <= max;
  if (slag === "kalender") {
    sant("namn", typeof d.namn === "string" && d.namn.length > 0 && d.namn.length <= MAX_KALENDERNAMN);
    sant("farg", (/** @type {readonly unknown[]} */ (KALENDERFARGER)).includes(d.farg));
    sant("ikon", !finns("ikon") || (text(d.ikon, MAX_KALENDERIKON) && ID_FORM.test(d.ikon)));
    sant("ordning", !finns("ordning") || typeof d.ordning === "number");
    for (const f of ["forvald", "iFlodet", "arkiverad"]) sant(f, !finns(f) || typeof d[f] === "boolean");
    return fel;
  }
  sant("kalenderId", typeof d.kalenderId === "string");
  sant("titel", typeof d.titel === "string" && d.titel.length > 0 && d.titel.length <= MAX_POSTTITEL);
  sant("beskrivning", !finns("beskrivning") || text(d.beskrivning, MAX_POSTBESKRIVNING));
  sant("plats", !finns("plats") || text(d.plats, MAX_POSTPLATS));
  sant("blockerar", !finns("blockerar") || typeof d.blockerar === "boolean");
  sant("heldag", typeof d.heldag === "boolean");
  const form = d.heldag === true ? DATUMFORM : TIDPUNKTSFORM;
  const tid = (/** @type {unknown} */ v) => typeof v === "string" && form.test(v);
  sant("start", d.heldag === true || d.heldag === false ? tid(d.start) : false);
  sant("slut", d.heldag === true || d.heldag === false ? tid(d.slut) : false);
  sant("tidsordning", typeof d.start === "string" && typeof d.slut === "string" && d.slut >= d.start);
  return fel;
}

/**
 * Räknar avvikelserna i en lista dokument. Ren funktion (skriptet `scripts/mat-kalenderdokument.mjs` läser dokumenten och skriver ut svaret), provad i `src/__tests__/kalendrar-lasning.test.js`.
 *
 * @param {Array<{ sokvag: string, id: string, data: unknown, byte?: number }>} dokument
 * @param {{ slag: "kalender" | "post", stor?: number, exempel?: number }} val
 * @returns {{ lasta: number, medAvvikelse: number, stora: number, perKod: Record<string, number>, exempel: Array<{ sokvag: string, koder: string[] }>, personer: number, flestHosEnPerson: number }}
 */
export function kalenderformMatning(dokument, { slag, stor = 20_000, exempel = 5 }) {
  /** @type {Record<string, number>} */
  const perKod = {};
  /** @type {Array<{ sokvag: string, koder: string[] }>} */
  const ex = [];
  let medAvvikelse = 0;
  let stora = 0;
  /** @type {Map<string, number>} */
  const perPerson = new Map();
  for (const d of dokument) {
    // Sökvägen är `<användare>/<uid>/<samling>/<id>`: antalet dokument per person behövs för att kunna sätta ett tak per person ur siffror och inte ur en gissning.
    const uid = d.sokvag.split("/")[1];
    if (uid) perPerson.set(uid, (perPerson.get(uid) ?? 0) + 1);
    const koder = kalenderformFel(slag, d.id, d.data);
    if (typeof d.byte === "number" && d.byte > stor) {
      stora += 1;
      koder.push("stor");
    }
    if (koder.length === 0) continue;
    medAvvikelse += 1;
    for (const k of koder) perKod[k] = (perKod[k] ?? 0) + 1;
    if (ex.length < exempel) ex.push({ sokvag: d.sokvag, koder });
  }
  return { lasta: dokument.length, medAvvikelse, stora, perKod, exempel: ex, personer: perPerson.size, flestHosEnPerson: Math.max(0, ...perPerson.values()) };
}

/**
 * Slutkoden för `scripts/mat-kalenderdokument.mjs` (granskningen av PR 464): 1 när någon samling lästes som tom, eller när något dokument bär en avvikelse som reglerna nekar, `id` inräknat; annars 0.
 *
 * ⛔ `id` RÄKNAS. Ett id utanför formen låser ingen ute i reglerna (det prövas bara vid `create`), men `byggMinKalender` och `byggKalenderpost` kastar på det, så dokumentet är redan oläsligt för ramverket, och
 * CHANGELOG 0.153.0 säger "noll avvikelser, också id" innan reglerna deployas. ⛔ `stor` RÄKNAS INTE: ett stort dokument med rätt form låser inte ute någon. Det står i utskriften, som underlag för ett tak.
 *
 * @param {ReadonlyArray<{ lasta: number, perKod: Record<string, number> }>} svar Ett svar från `kalenderformMatning` per samling.
 * @returns {0 | 1}
 */
export function kalenderformSlutkod(svar) {
  for (const s of svar) {
    if (s.lasta === 0) return 1;
    if (Object.entries(s.perKod).some(([k, n]) => k !== "stor" && n > 0)) return 1;
  }
  return 0;
}

/**
 * Om ett `YYYY-MM-DD` finns i kalendern. Formen ensam släpper in den 31 februari.
 * @param {string} s @returns {boolean}
 */
export function giltigtDatum(s) {
  if (!DATUMFORM.test(s)) return false;
  const [a, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Prefixet på `handelseId` för en post i mina kalendrar. Ett tecken som inget id i ramverket har (`ID_FORM`), så ett händelse-id kan aldrig likna det. */
export const KALENDERPOST_HANDELSEPREFIX = "post~";

/** @param {string} postId @returns {string} Det `handelseId` raden för posten bär, och `?handelse=` i adressen. */
export function postHandelseId(postId) {
  if (typeof postId !== "string" || postId === "") throw new Error("postHandelseId: postId krävs, en sträng som inte är tom.");
  return `${KALENDERPOST_HANDELSEPREFIX}${postId}`;
}

/**
 * Postens id ur ett `handelseId`, eller `null` när det inte är en posts. Den enda platsen prefixet tolkas.
 * @param {unknown} handelseId @returns {string | null}
 */
export function postIdUrHandelseId(handelseId) {
  if (typeof handelseId !== "string" || !handelseId.startsWith(KALENDERPOST_HANDELSEPREFIX) || handelseId.length === KALENDERPOST_HANDELSEPREFIX.length) return null;
  return handelseId.slice(KALENDERPOST_HANDELSEPREFIX.length);
}

/**
 * En post som en `HandelseVy` för `OpsHandelsePanel`: titel, datum, tid, kalender, plats och beskrivning. Ingen typ, ingen status och inga
 * svar, för en post har inga (den ligger i personens egen kalender, `blockerar` är det enda den påverkar).
 *
 * @param {Kalenderpost} post
 * @param {ReadonlyArray<{ id: string, namn: string | import("./sprak.js").Namn, farg: number }>} kalendrar
 * @param {string} [sprak]
 * @returns {import("../components/OpsHandelsePanel.jsx").HandelseVy}
 */
export function postTillHandelse(post, kalendrar, sprak = "sv") {
  const k = kalendrar.find((x) => x.id === post.kalenderId);
  const datum = post.start.slice(0, 10);
  const slutdatum = post.slut.slice(0, 10);
  const tid = post.heldag ? "" : post.start.slice(11);
  const slutTid = post.heldag ? "" : post.slut.slice(11);
  return {
    id: postHandelseId(post.id),
    titel: post.titel,
    datum,
    ...(slutdatum > datum ? { slutDatum: slutdatum } : {}),
    ...(tid ? { tid } : {}),
    ...(slutTid && post.slut !== post.start ? { slutTid } : {}),
    ...(post.heldag ? { heldag: true } : {}),
    ...(k ? { kalender: { namn: text(k.namn, sprak), farg: /** @type {1|2|3|4|5|6} */ (k.farg) } } : {}),
    ...(post.plats ? { plats: post.plats } : {}),
    ...(post.beskrivning ? { beskrivning: post.beskrivning } : {}),
  };
}

/**
 * En post i mina kalendrar som en rad i `OpsCalendar`: datum, slutdatum, heldag och kalendern.
 *
 * ⛔ EN FUNKTION OCH INTE APPENS EGEN MAPPNING, eftersom samma post ritas av ramverkets kalender och av appens lista, och
 * två mappningar hade börjat säga olika saker om vilken dag en post som slutar vid midnatt hör till.
 *
 * @param {Kalenderpost} post
 * @param {ReadonlyArray<{ id: string, namn: string | import("./sprak.js").Namn, farg: number }>} kalendrar
 * @param {string} [sprak]
 * @returns {import("./calendar.js").CalendarEntry}
 */
export function postTillRad(post, kalendrar, sprak = "sv") {
  const k = kalendrar.find((x) => x.id === post.kalenderId);
  const datum = post.start.slice(0, 10);
  const slutdatum = post.slut.slice(0, 10);
  const tid = post.heldag ? "" : `${post.start.slice(11)}${post.slut.slice(11) && post.slut !== post.start ? `-${post.slut.slice(11)}` : ""}`;
  return {
    id: post.id,
    // ⛔ EN POST GÅR ATT ÖPPNA (0.120.0, cllp/lifehub.app#367). Före 0.120.0 bar raden inget `handelseId`, så titeln var vanlig text och
    // kortet såg ut som en ingång utan att vara en: "Ingen text, ingen detaljvy, navigation". Id:t har prefixet `post~`, som inget
    // händelse-id har (ett id i ramverket följer `ID_FORM`, och `~` ingår inte), och appen slår upp posten med `postIdUrHandelseId`.
    handelseId: postHandelseId(post.id),
    date: datum,
    ...(slutdatum > datum ? { endDate: slutdatum } : {}),
    ...(post.heldag ? { allDay: true } : {}),
    title: post.titel,
    ...(tid || post.plats ? { not: [tid, post.plats].filter(Boolean).join(" · ") } : {}),
    ...(k ? { kalender: { id: k.id, namn: text(k.namn, sprak), farg: /** @type {1|2|3|4|5|6} */ (k.farg) } } : {}),
  };
}

/**
 * Kastar om tidszonen inte finns, annars svarar den med zonen.
 *
 * ⛔ VID UPPSTART OCH INTE NÄR DEN ANVÄNDS. `Intl` kastar `RangeError` på en okänd zon, och gör det i en vy blir hela
 * kalendern ett fel i knäet på användaren. Samma form som `validateKatalog`.
 *
 * @param {unknown} tidszon @returns {string}
 */
export function kontrolleraTidszon(tidszon) {
  const tz = rensa(tidszon);
  if (!tz) throw new Error(`tidszon krävs. Förvalet är ${STANDARD_TIDSZON}.`);
  try {
    new Intl.DateTimeFormat("sv-SE", { timeZone: tz });
  } catch {
    throw new Error(`tidszon "${tz}" finns inte. Ange en IANA-zon, till exempel ${STANDARD_TIDSZON}.`);
  }
  return tz;
}

/**
 * Dagens datum, `YYYY-MM-DD`, i tidszonen.
 *
 * ⛔ INTE `todayKey`, som läser webbläsarens egen zon. En användare i Stockholm med en dator inställd på New York hade
 * annars haft "idag" en dag fel mellan 18 och midnatt, alltså under just de timmar man planerar morgondagen.
 *
 * @param {string} [tidszon] @param {Date} [nu] @returns {string}
 */
export function idagI(tidszon = STANDARD_TIDSZON, nu = new Date()) {
  const delar = new Intl.DateTimeFormat("en-CA", { timeZone: tidszon, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(nu);
  /** @param {string} t */
  const del = (t) => (delar.find((p) => p.type === t) || { value: "" }).value;
  return `${del("year")}-${del("month")}-${del("day")}`;
}

/*
 * ═══════════════════════════════════════════════════════════════════════
 * ⛔ HANTERA KALENDRAR (0.37.0, #179 F2). Skapa, byta namn, färg, ikon, ordning, förvald och arkivera.
 *
 * Varje funktion nedan är REN och svarar med de rader som ska skrivas, aldrig med hela listan. Skälet är att en
 * ändring av förvald eller ordning rör MER än en rad (den nya förvalda och den gamla, två grannar som byter plats), och
 * att "skriv hela listan" hade gjort varje klick till lika många skrivningar som kalendrar, varav de flesta skriver
 * samma sak igen. Vem som skriver (ägaren för mina, ägare och admin för gruppens) avgör reglerna, inte de här.
 * ═══════════════════════════════════════════════════════════════════════
 */

/** Steget mellan två kalendrars `ordning` när listan numreras om. Luft, så att en ny kalender kan läggas sist. */
export const ORDNINGSSTEG = 10;

/**
 * Ett id ur ett namn: små bokstäver, å/ä till a, ö till o, allt annat till bindestreck, och unikt i listan.
 *
 * ⛔ UNIKT GENOM LISTAN OCH NYCKELN, INTE GENOM EN FRÅGA FÖRE SKRIVNINGEN. Listan är den som redan är läst, och krockar
 * två som skapar samtidigt är det regeln (`create` på en nyckel som finns är en uppdatering) och inte den här funktionen
 * som avgör. Här undviks bara den krock man själv kan se.
 *
 * @param {string} namn @param {ReadonlyArray<{ id: string }>} lista @returns {string}
 */
export function kalenderIdUrNamn(namn, lista) {
  const bas =
    rensa(namn)
      .toLowerCase()
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .replace(/é/g, "e")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "kalender";
  const tagna = new Set(lista.map((k) => k.id));
  if (!tagna.has(bas)) return bas;
  for (let n = 2; ; n += 1) if (!tagna.has(`${bas}-${n}`)) return `${bas}-${n}`;
}

/**
 * Nästa lediga `ordning`: efter den sista, med `ORDNINGSSTEG` emellan.
 * @param {ReadonlyArray<{ ordning: number }>} lista @returns {number}
 */
export function nastaOrdning(lista) {
  return lista.reduce((m, k) => Math.max(m, k.ordning), -ORDNINGSSTEG) + ORDNINGSSTEG;
}

/**
 * Flyttar en kalender ett steg upp (-1) eller ned (+1) bland de valbara, och svarar med raderna vars `ordning` ändrats.
 *
 * ⛔ LISTAN NUMRERAS OM, I STÄLLET FÖR ATT TVÅ TAL BYTER PLATS. Två kalendrar med samma `ordning` (båda 0, som när de
 * skapats utan ordning) byter inte plats av att deras tal byts: de är fortfarande lika, och namnet avgör. Omnumreringen
 * ger varje kalender ett eget tal, och bara de som faktiskt fått ett nytt skrivs.
 *
 * ⛔ ARKIVERADE RÖRS INTE. De syns inte i listan man flyttar i, och deras plats är ingenting någon ser.
 *
 * @template {{ id: string, ordning: number, arkiverad: boolean, namn: any }} K
 * @param {ReadonlyArray<K>} lista @param {string} id @param {-1 | 1} steg @param {string} [sprak]
 * @returns {K[]} Tom när kalendern redan står först (eller sist) eller inte finns.
 */
export function flyttaKalender(lista, id, steg, sprak = "sv") {
  const ordnade = /** @type {K[]} */ (/** @type {unknown} */ (valjbara(/** @type {any} */ (lista), sprak)));
  const i = ordnade.findIndex((k) => k.id === id);
  const j = i + steg;
  if (i < 0 || j < 0 || j >= ordnade.length) return [];
  const ny = ordnade.slice();
  [ny[i], ny[j]] = [ny[j], ny[i]];
  return ny.map((k, n) => ({ ...k, ordning: n * ORDNINGSSTEG })).filter((k, n) => ordnade.find((x) => x.id === k.id)?.ordning !== n * ORDNINGSSTEG);
}

/**
 * Gör en kalender förvald: den nya får `forvald: true`, den som var förvald får `false`. Svarar med de rader som ändrats.
 *
 * ⛔ TVÅ RADER, OCH DE SKA SKRIVAS I SAMMA BATCH. Skrivs den nya först och den gamla misslyckas finns två förvalda, och
 * `validateGruppkalendrar` kastar vid nästa läsning. Därför svarar funktionen med båda, och källan skriver dem ihop.
 *
 * @template {{ id: string, forvald: boolean, arkiverad: boolean }} K
 * @param {ReadonlyArray<K>} lista @param {string} id @returns {K[]}
 */
export function valjForvald(lista, id) {
  const mal = lista.find((k) => k.id === id);
  if (!mal) throw new Error(`valjForvald: kalendern "${id}" finns inte.`);
  if (mal.arkiverad) throw new Error(`valjForvald: kalendern "${id}" är arkiverad. En arkiverad kalender kan inte vara förvald.`);
  return lista.filter((k) => (k.id === id ? !k.forvald : k.forvald)).map((k) => ({ ...k, forvald: k.id === id }));
}

/**
 * Arkiverar en kalender, eller tar tillbaka den (`arkiverad: false`). Svarar med raden.
 *
 * ⛔ EN ARKIVERAD KALENDER ÄR INTE FÖRVALD. Den som arkiverar den förvalda får alltså ingen förvald markerad, och då
 * gäller den första valbara (`forvaldKalender`), som det står i filhuvudet: den härleds, den seedas inte.
 *
 * ⛔ POSTERNA I EN ARKIVERAD KALENDER FINNS KVAR. De ritas med kalenderns namn så länge de visas, men nya poster kan inte
 * läggas där (regeln och `byggKalenderpost`).
 *
 * @template {{ id: string, forvald: boolean, arkiverad: boolean }} K
 * @param {ReadonlyArray<K>} lista @param {string} id @param {boolean} [arkiverad] @returns {K}
 */
export function arkiveraKalender(lista, id, arkiverad = true) {
  const k = lista.find((x) => x.id === id);
  if (!k) throw new Error(`arkiveraKalender: kalendern "${id}" finns inte.`);
  return { ...k, arkiverad, forvald: arkiverad ? false : k.forvald };
}

/**
 * En kalender som ett val i filtret och i "Skapa i": `{ id, namn, farg, ikon, grupp, forvald }`.
 *
 * ⛔ BARA DE VALBARA, I SIN ORDNING, OCH `forvald` ÄR DEN HÄRLEDDA. En arkiverad kalender går inte att välja, och den
 * förvalda är den markerade eller annars den första (`forvaldKalender`). Samma lista matar kalenderns filter och "Skapa i",
 * så att de två aldrig visar olika kalendrar eller olika förval.
 *
 * @param {{ gruppens?: ReadonlyArray<Gruppkalender>, mina?: ReadonlyArray<MinKalender>, sprak?: string }} arg
 * @returns {Array<{ id: string, namn: string, farg: 1|2|3|4|5|6, ikon: string, grupp: boolean, forvald: boolean }>}
 */
export function kalenderval({ gruppens = [], mina = [], sprak = "sv" }) {
  const fg = forvaldKalender(gruppens);
  const fm = forvaldKalender(mina);
  return [
    ...valjbara(/** @type {any} */ (gruppens), sprak).map((/** @type {any} */ k) => ({ id: k.id, namn: text(k.namn, sprak), farg: k.farg, ikon: k.ikon, grupp: true, forvald: !!fg && fg.id === k.id })),
    ...valjbara(/** @type {any} */ (mina), sprak).map((/** @type {any} */ k) => ({ id: k.id, namn: text(k.namn, sprak), farg: k.farg, ikon: k.ikon, grupp: false, forvald: !!fm && fm.id === k.id })),
  ];
}
