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
 * @param {{ ikoner?: readonly string[], platser?: readonly number[], katalog?: string }} [config]
 * @returns {Kategori}
 */
export function byggKategori(d, { ikoner, platser = SLAGPLATSER, katalog = "katalog" } = {}) {
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

  return {
    id,
    namn,
    farg,
    ikon,
    fas: /** @type {Kategori["fas"]} */ (fas),
    ordning: Number.isFinite(Number(d.ordning)) ? Number(d.ordning) : 0,
    arkiverad: d.arkiverad === true,
  };
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
 * @param {unknown} kategorier
 * @param {{ ikoner?: readonly string[], platser?: readonly number[], katalog?: string }} [config]
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
