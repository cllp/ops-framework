/**
 * Katalogen: vad en kategori ÄR, och vad som avvisas vid uppstart.
 *
 * ══ ⛔ VARFÖR EN KATALOG OCH INTE EN LISTA I APPEN (#108) ══════════════
 *
 * Beslutat av CP 2026-09-25 i cllp/bolag-ops#359. Appens sorter, kategorier och
 * status låg som listor i koden, vilket betyder att en ny kategori kräver en
 * utvecklare, en release och en driftsättning. Med en katalog lägger den som
 * äger verksamheten till en kategori själv.
 *
 * ══ ⛔ FAST SKELETT BAKOM DET FRIA ═════════════════════════════════════
 *
 * Det fria är namnet, färgen, ikonen och ordningen. Det fasta är FASEN: varje
 * kategori hör till en av fem, och de fem är ramverkets och går inte att lägga
 * till.
 *
 * Skälet är att vyer, filter och räknare måste kunna fråga "är den klar" utan
 * att veta vad kategorin heter hos just den här kunden. En helt fri lista utan
 * skelett betyder att varje vy måste konfigureras lika mycket som katalogen,
 * och då har ingenting vunnits.
 *
 * ══ ⛔ TRE VAL SOM SER UT SOM DETALJER OCH INTE ÄR DET ════════════════
 *
 * `id` ÄNDRAS ALDRIG, `namn` FÅR ÄNDRAS FRITT. Varje rad i databasen pekar på
 * `id`. Vore namnet nyckeln skulle en omdöpning i inställningsvyn förlora
 * kopplingen till allt som redan skrivits, och det upptäcks månader senare som
 * rader utan kategori.
 *
 * FÄRG ÄR EN PALETTPLATS OCH INTE HEX. En hex i konfigurationen är ett tema
 * som inte följer med när mörkt läge eller en ny identitet kommer. Platsen gör
 * att paletten äger färgen. Platserna är `SLAGPLATSER` i `lib/slag.js`, och de
 * är tre eftersom fler inte går att skilja åt som prickar (noten i
 * `tokens.css` har mätningarna).
 *
 * IKONEN ÄR ETT NAMN UR EN TILLÅTELSELISTA. Ett fritt namn blir en tom ruta i
 * vyn den dag någon stavar fel, och en tom ruta ser ut som ett fel i appen i
 * stället för ett fel i konfigurationen.
 *
 * ══ ⛔ VALIDERINGEN KÖRS VID UPPSTART, INTE VID ANVÄNDNING ════════════
 *
 * Samma form som `validateNav`. En trasig katalogpost som upptäcks först när
 * någon öppnar ett filter är ett fel i knäet på användaren. Vid uppstart är det
 * ett fel för den som ändrade, och felet säger vilken katalog och vilket fält.
 */

import { SLAGPLATSER } from "./slag.js";
import { byggNamn, text } from "./sprak.js";

/**
 * Fälten en kategori får bära. Allt annat avvisas.
 *
 * ⛔ LISTAN FINNS FÖR ATT DET TYSTA ÄR VÄRRE ÄN DET SOM SAKNAS (#117). Innan
 * den fanns byggde `byggKategori` ett objekt av sju fält och slängde resten
 * utan ett ljud. Mätt: en kategori skriven med `lofte` och `titleHint` högst
 * upp kom ut utan båda, och ingenting kastades. Den som skrev fick en grön
 * uppstart och en tom rad i vyn, alltså letade i vyn efter ett fel som låg i
 * katalogen.
 */
const KATEGORIFALT = ["id", "namn", "farg", "ikon", "fas", "ordning", "arkiverad", "texter"];

/**
 * ⛔ EN TEXTNYCKEL FÅR INTE BÄRA PUNKT ELLER MELLANSLAG, av samma skäl som
 * `id`: den blir en sökväg i en Firestore-regel, alltså `texter.titleHint`.
 * Versaler är däremot tillåtna här och inte i `id`, eftersom nycklarna är
 * kodens egna namn på texterna och inte något två personer skriver in var för
 * sig.
 */
const TEXTNYCKEL_FORM = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * Faserna. Ramverkets skelett, och de går inte att lägga till.
 *
 * ⛔ "vantar" FINNS OCH ÄR INTE SAMMA SAK SOM "aktiv". Skillnaden är om det
 * ligger på oss eller på någon annan, och den skillnaden är hela poängen med en
 * lista som ska gå att tömma: det man väntar på ska inte ligga och skava som
 * något man borde göra.
 *
 * ⛔ "avskriven" FINNS OCH ÄR INTE SAMMA SAK SOM "klar". Klar betyder gjort,
 * avskriven betyder att någon tagit ställning till att inget skulle göras. Utan
 * den skillnaden blir statistiken en lögn och en avskriven rad ser ut som en
 * utförd.
 */
export const FASER = /** @type {const} */ (["ny", "aktiv", "vantar", "klar", "avskriven"]);

/** Faserna som betyder att raden är ur vägen. För räknare och filter. */
export const AVSLUTADE_FASER = /** @type {const} */ (["klar", "avskriven"]);

/**
 * @typedef {object} Kategori
 * @property {string} id Maskinnyckeln. Ändras aldrig.
 * @property {import("./sprak.js").Namn} namn Det som visas.
 * @property {number} farg Palettplats ur `SLAGPLATSER`, aldrig hex.
 * @property {string} ikon Namn ur katalogens tillåtelselista.
 * @property {"ny"|"aktiv"|"vantar"|"klar"|"avskriven"} fas
 * @property {number} ordning Lägre först.
 * @property {boolean} arkiverad Går inte att välja för nya poster.
 * @property {Record<string, import("./sprak.js").Namn>} texter Fria, namngivna texter. Se nedan.
 */

/**
 * ══ ⛔ VARFÖR `texter` OCH INTE FLER FASTA FÄLT (#117) ═════════════════
 *
 * En kategori behöver fler ord än ett namn, och det är mätt i appens listor:
 * plural i filtret ("Uppgifter"), singular på raden ("Uppgift"), en kort form i
 * smala kontroller ("Ekonomi"), och för inkorgens sorter dessutom nio
 * hjälptexter var. Vyn får inte hugga av ett långt ord för att det inte ryms,
 * eftersom en avhuggning i en vy är en andra vokabulär.
 *
 * ⛔ DE ÄR PRODUKTTEXT OCH INTE FYLLNAD. Tappas de blir resultatet ett
 * formulär med tomma fält och inga exempel, alltså sämre än listan de ersatte.
 * Det gäller särskilt en kategori som läggs till i inställningsvyn: den föds
 * utan dem om ingen frågar efter dem.
 *
 * ⛔ EN PÅSE OCH INTE FASTA FÄLT, eftersom vilka texter som behövs är appens
 * fråga och inte ramverkets. Ramverket vet inte vad en "rubrikhjälp" är. Det
 * det kan veta är att varje text är ett `Namn`, alltså har svenska, och att
 * katalogen kan KRÄVA vissa nycklar. Det andra är `textnycklar` nedan, och utan
 * det kravet vore "texterna tappas inte" ett löfte utan vakt.
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * ⛔ ETT `id` FÅR INTE BÄRA VERSALER, MELLANSLAG ELLER PUNKTER.
 *
 * Punkten är den som kostar: ett `id` med punkt i blir en sökväg i en
 * Firestore-regel och i ett fältnamn, och då betyder `data.kategori.mat` två
 * olika saker beroende på var det står. Versaler och mellanslag är mildare,
 * men de gör två `id` som ser lika ut till olika nycklar.
 */
const ID_FORM = /^[a-z0-9][a-z0-9_-]*$/;

/**
 * Bygger en kategori, eller kastar med skälet.
 *
 * ⛔ KASTAR I STÄLLET FÖR ATT LAGA. En kategori med okänd fas kunde fås att
 * bli "ny" i tysthet, och då hade en felstavning i inställningsvyn blivit en
 * rad som ligger kvar i fel lista för alltid. En okänd sort är ett programfel
 * och inte data, samma regel som resten av ramverket.
 *
 * @param {Record<string, any>} d
 * @param {{ ikoner?: readonly string[], platser?: readonly number[], katalog?: string, textnycklar?: readonly string[] }} [config]
 * @returns {Kategori}
 */
export function byggKategori(d, { ikoner, platser = SLAGPLATSER, katalog = "katalog", textnycklar } = {}) {
  const var_ = (/** @type {string} */ falt, /** @type {string} */ skal) =>
    new Error(`${katalog}: ${falt} ${skal}`);

  const id = rensa(d && d.id);
  if (!id) throw var_("id", "krävs. Det är nyckeln varje rad i databasen pekar på.");
  if (!ID_FORM.test(id)) {
    throw var_(
      `id "${id}"`,
      "får bara innehålla små bokstäver, siffror, bindestreck och understreck. En punkt blir en sökväg i en Firestore-regel, och versaler gör två id som ser lika ut till olika nycklar.",
    );
  }

  /*
   * ⛔ OKÄNDA FÄLT AVVISAS, DE SLÄNGS INTE. Se noten vid `KATEGORIFALT`. Den
   * här kontrollen står före resten med flit: har någon skrivit `lofte` högst
   * upp är det den upplysningen hen behöver, och inte att `farg` också saknas
   * i det utkast hen höll på att skriva.
   */
  const okanda = Object.keys(d && typeof d === "object" ? d : {}).filter((n) => !KATEGORIFALT.includes(n));
  if (okanda.length > 0) {
    throw var_(
      `fälten ${okanda.join(", ")} för "${id}"`,
      `känns inte igen. En kategori bär ${KATEGORIFALT.join(", ")}. Är det text som ska visas hör den hemma i texter, alltså texter: { ${okanda[0]}: { sv: "..." } }, och där följer den med i stället för att försvinna.`,
    );
  }

  let namn;
  try {
    namn = byggNamn(d.namn && typeof d.namn === "object" ? d.namn : { sv: rensa(d.namn) });
  } catch (fel) {
    throw var_(`namn för "${id}"`, fel instanceof Error ? fel.message.replace(/^byggNamn: /, "") : String(fel));
  }

  const farg = Number(d.farg);
  if (!platser.includes(farg)) {
    throw var_(
      `farg för "${id}"`,
      `måste vara en palettplats (${platser.join(", ")}), inte ${JSON.stringify(d.farg)}. En hex i konfigurationen följer inte med när mörkt läge eller en ny identitet kommer.`,
    );
  }

  const ikon = rensa(d.ikon);
  if (!ikon) throw var_(`ikon för "${id}"`, "krävs. En kategori utan ikon ritas som ett hål i en rad som har ikoner överallt annars.");
  if (ikoner && !ikoner.includes(ikon)) {
    throw var_(
      `ikon "${ikon}" för "${id}"`,
      `finns inte i tillåtelselistan (${ikoner.join(", ")}). Ett fritt namn blir en tom ruta i vyn, och en tom ruta ser ut som ett fel i appen i stället för ett fel i konfigurationen.`,
    );
  }

  const fas = rensa(d.fas);
  if (!(/** @type {readonly string[]} */ (FASER).includes(fas))) {
    throw var_(`fas "${fas}" för "${id}"`, `finns inte. Faserna är ramverkets och går inte att lägga till: ${FASER.join(", ")}.`);
  }

  const texter = byggTexter(d.texter, { id, katalog, textnycklar });

  return {
    id,
    namn,
    farg,
    ikon,
    fas: /** @type {Kategori["fas"]} */ (fas),
    ordning: Number.isFinite(Number(d.ordning)) ? Number(d.ordning) : 0,
    arkiverad: d.arkiverad === true,
    texter,
  };
}

/**
 * Bygger textpåsen, eller kastar med skälet.
 *
 * ⛔ VARJE TEXT GÅR GENOM `byggNamn`, alltså kräver svenska. Skälet är
 * `sprak.js`: svenska är reserven för alla andra språk, så en text utan
 * svenska har ingenting att falla tillbaka på och blir en tom sträng i vyn.
 *
 * ⛔ EN STRÄNG TAS EMOT OCH BLIR `{ sv }`. Samma migreringsordning som resten
 * av epiken: läsaren tål båda formerna innan skrivarna byter. Appens listor är
 * i dag strängar, och `saknadeSprak` räknar upp varje sådan så att toleransen
 * inte blir tyst.
 *
 * @param {unknown} varde
 * @param {{ id: string, katalog: string, textnycklar?: readonly string[] }} config
 * @returns {Record<string, import("./sprak.js").Namn>}
 */
function byggTexter(varde, { id, katalog, textnycklar }) {
  if (varde !== undefined && varde !== null && (typeof varde !== "object" || Array.isArray(varde))) {
    throw new Error(`${katalog}: texter för "${id}" måste vara ett objekt med namngivna texter, inte ${Array.isArray(varde) ? "en lista" : typeof varde}.`);
  }

  /** @type {Record<string, import("./sprak.js").Namn>} */
  const ut = {};
  for (const [nyckel, text_] of Object.entries(/** @type {Record<string, unknown>} */ (varde || {}))) {
    if (!TEXTNYCKEL_FORM.test(nyckel)) {
      throw new Error(
        `${katalog}: textnyckeln "${nyckel}" för "${id}" får bara innehålla bokstäver, siffror och understreck, och måste börja på en bokstav. En punkt blir en sökväg i en Firestore-regel.`,
      );
    }
    try {
      ut[nyckel] = byggNamn(typeof text_ === "string" ? { sv: text_ } : /** @type {any} */ (text_) || {});
    } catch (fel) {
      throw new Error(`${katalog}: texten "${nyckel}" för "${id}" ${fel instanceof Error ? fel.message.replace(/^byggNamn: /, "") : String(fel)}`);
    }
  }

  /*
   * ⛔ KRAVET STÅR HÄR OCH INTE I VARJE ANROPSSTÄLLE. Utan det är "texterna
   * tappas inte i flytten" ett löfte utan vakt, och det som faktiskt händer är
   * att en kategori som lagts till i inställningsvyn föds utan hjälptexter och
   * ger ett formulär med tomma fält och inga exempel.
   */
  const saknade = (textnycklar || []).filter((n) => !(n in ut));
  if (saknade.length > 0) {
    throw new Error(
      `${katalog}: texterna ${saknade.join(", ")} saknas för "${id}". Katalogen kräver dem, och utan dem ritas formuläret med tomma hjälpfält i stället för med de exempel som gör det begripligt.`,
    );
  }

  return ut;
}

/**
 * En text ur påsen, på valt språk.
 *
 * ⛔ SVARAR TOM STRÄNG OCH KASTAR ALDRIG, till skillnad från bygget ovan. Det
 * körs vid uppstart och ska stoppa en felaktig uppsättning. Den här körs i en
 * vy, på en rad som kan peka på en kategori som hunnit arkiveras eller tas bort
 * ur standardvärdena, och en vy som kastar där tar ned hela listan i stället
 * för en rad. Samma val som `beteendet()` i `beteenden.js`.
 *
 * @param {unknown} kategori
 * @param {unknown} nyckel
 * @param {string} [sprak]
 * @returns {string}
 */
export function texten(kategori, nyckel, sprak = "sv") {
  const n = rensa(nyckel);
  if (!n || !kategori || typeof kategori !== "object") return "";
  const pase = /** @type {any} */ (kategori).texter;
  if (!pase || typeof pase !== "object") return "";
  return text(pase[n], sprak);
}

/**
 * Validerar en hel katalog vid uppstart.
 *
 * ⛔ KASTAR PÅ FÖRSTA FELET, med katalogens namn och fältet i meddelandet.
 * Samla-alla-fel vore snällare men gör meddelandet långt, och den som just
 * ändrat en rad vet vilken rad det var.
 *
 * ⛔ DUBBLETTER AV `id` ÄR ETT EGET FEL. Två kategorier med samma id ser ut som
 * en i varje vy, och den andra försvinner tyst: raderna som pekar på den ritas
 * med den förstas namn och färg. Det är den sortens fel som tar en dag att tro
 * på.
 *
 * ⛔ EN TOM KATALOG ÄR TILLÅTEN. Den är läget innan seedningen körts, och ett
 * fel där hade gjort en app omöjlig att starta första gången.
 *
 * ⛔ `textnycklar` GÄLLER HELA KATALOGEN OCH INTE EN RAD. Det är just vad som
 * gör den till en vakt: kravet formuleras en gång, av appen som vet vilka
 * texter dess vyer ritar, och varenda kategori mäts mot det. Skrevs kravet per
 * rad skulle en ny kategori kunna läggas till utan, och då finns kravet
 * kvar men inte dess verkan.
 *
 * @param {unknown} kategorier
 * @param {{ ikoner?: readonly string[], platser?: readonly number[], katalog?: string, textnycklar?: readonly string[] }} [config]
 * @returns {Kategori[]}
 */
export function validateKatalog(kategorier, config = {}) {
  const katalog = config.katalog || "katalog";
  if (!Array.isArray(kategorier)) {
    throw new Error(`${katalog}: kategorier krävs och måste vara en lista. Fick ${typeof kategorier}.`);
  }

  /** @type {Map<string, true>} */
  const sedda = new Map();
  const ut = kategorier.map((rad) => {
    const k = byggKategori(rad, config);
    if (sedda.has(k.id)) {
      throw new Error(
        `${katalog}: id "${k.id}" finns två gånger. Två kategorier med samma id ser ut som en i varje vy, och raderna som pekar på den andra ritas med den förstas namn och färg.`,
      );
    }
    sedda.set(k.id, true);
    return k;
  });

  return ut;
}

/**
 * Kategorierna som går att välja, i ordning.
 *
 * ⛔ ARKIVERADE FALLER BORT HÄR OCH INTE I VARJE VY. Görs filtreringen i vyn
 * glöms den i den fjärde vyn någon skriver, och då dyker en arkiverad kategori
 * upp i just ett formulär.
 *
 * ⛔ SORTERINGEN ÄR `ordning` OCH SEDAN NAMNET. Utan det andra ledet ligger tre
 * kategorier med `ordning: 0` i den ordning databasen råkar svara, och den
 * ordningen ändrar sig mellan två laddningar. En lista som byter ordning av sig
 * själv får folk att tro att något ändrats.
 *
 * @param {Kategori[]} kategorier
 * @param {string} [sprak]
 * @returns {Kategori[]}
 */
export function valjbara(kategorier, sprak = "sv") {
  return (Array.isArray(kategorier) ? kategorier : [])
    .filter((k) => k && !k.arkiverad)
    .slice()
    .sort((a, b) => a.ordning - b.ordning || text(a.namn, sprak).localeCompare(text(b.namn, sprak), sprak));
}

/**
 * Slår upp en kategori på id.
 *
 * ⛔ SVARAR `null` OCH KASTAR INTE. En rad i databasen kan peka på en kategori
 * som arkiverats eller tagits bort ur standardvärdena, och en vy som kastar på
 * en sådan rad tar ned hela listan i stället för att rita en rad utan
 * kategorinamn.
 *
 * @param {Kategori[]} kategorier @param {unknown} id @returns {Kategori | null}
 */
export function kategorin(kategorier, id) {
  const nyckel = rensa(id);
  if (!nyckel) return null;
  return (Array.isArray(kategorier) ? kategorier : []).find((k) => k && k.id === nyckel) || null;
}

/**
 * Om fasen betyder att raden är ur vägen.
 *
 * @param {unknown} fas @returns {boolean}
 */
export const arAvslutad = (fas) => /** @type {readonly string[]} */ (AVSLUTADE_FASER).includes(rensa(fas));
