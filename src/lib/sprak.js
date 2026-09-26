/**
 * Ett namn är `{ sv, en }`, aldrig en sträng.
 *
 * ══ ⛔ VARFÖR TVÅ SPRÅK FRÅN DAG ETT (#109) ════════════════════════════
 *
 * Beslutat av CP 2026-09-25 i cllp/bolag-ops#359, som en princip för hela
 * epiken och inte som en senare funktion. Skälet är att efterhandsöversättning
 * är en av de dyraste ändringar ett gränssnitt kan råka ut för: varje sträng
 * som ligger inbakad i en vy måste letas upp, och de som missas hittas bara av
 * någon som faktiskt läser på det andra språket.
 *
 * Kostnaden nu är en form till att skriva. Kostnaden sedan är varje vy.
 *
 * ══ ⛔ LÄSAREN TÅL EN STRÄNG, OCH DET ÄR INTE EN EFTERGIFT ════════════
 *
 * Exakt samma migreringsordning som `skapadAv` fick i Fas 1
 * (cllp/ops-framework#106), och av samma skäl: läsaren måste tåla båda formerna
 * INNAN skrivarna byter, annars visar varje vy tomt för varje omigrerat värde i
 * samma sekund. Appens listor är i dag strängar och flyttas i
 * cllp/bolag-ops#384.
 *
 * ⛔ MEN TOLERANSEN FÅR INTE VARA TYST. `saknadeSprak` räknar upp varje namn
 * som saknar `en`, och den listan är till för en vakt. Utan den blir resultatet
 * en app som ser tvåspråkig ut och är svensk på hälften av ytorna, och ingen
 * vet vilken hälft förrän någon läser den på engelska.
 *
 * ⛔ SVENSKA ÄR RESERVEN OCH INTE ETT VAL. Saknas `en` visas `sv`, eftersom ett
 * ord på fel språk är läsbart och en tom sträng inte är det. Det omvända vore
 * värre: en svensk användare som möter engelska ord i en svensk app tror att
 * appen är trasig.
 */

/** Språken som finns. Fler kräver en ändring här och i vakten, med flit. */
export const SPRAK = /** @type {const} */ (["sv", "en"]);

/** Reservspråket. Se filhuvudet: svenska är reserven, inte ett val. */
export const RESERVSPRAK = "sv";

/**
 * @typedef {object} Namn
 * @property {string} sv Svenska. Krävs.
 * @property {string} [en] Engelska. Saknas den används `sv`, och vakten säger till.
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Bygger ett namn.
 *
 * ⛔ KASTAR NÄR `sv` SAKNAS. Svenska är reserven för allt annat, så ett namn
 * utan svenska har ingen form att falla tillbaka på. Ett sådant namn blir en
 * tom sträng i varje vy, och en tom sträng i en lista ser ut som en rad som
 * inte laddat klart.
 *
 * @param {{ sv?: string, en?: string }} [d]
 * @returns {Namn}
 */
export function byggNamn(d = {}) {
  const sv = rensa(d.sv);
  if (!sv) throw new Error("byggNamn: sv krävs. Svenska är reserven för alla andra språk, så ett namn utan svenska har ingenting att falla tillbaka på.");
  const en = rensa(d.en);
  return en ? { sv, en } : { sv };
}

/**
 * Ordet på valt språk.
 *
 * Svarar ALLTID med en läsbar sträng, så ingen vy behöver veta vilken form
 * värdet hade. Se filhuvudet om varför en sträng tas emot.
 *
 * @param {unknown} namn Ett `{ sv, en }`, eller en sträng under migreringen.
 * @param {string} [sprak]
 * @returns {string}
 */
export function text(namn, sprak = RESERVSPRAK) {
  if (typeof namn === "string") return namn.trim();
  if (!namn || typeof namn !== "object") return "";
  const o = /** @type {Record<string, unknown>} */ (namn);
  const valt = rensa(o[sprak]);
  if (valt) return valt;
  return rensa(o[RESERVSPRAK]);
}

/**
 * Om värdet fortfarande bär den gamla formen.
 *
 * Finns för flytten av appens listor (cllp/bolag-ops#384): den ska kunna köras
 * om utan att röra det som redan är migrerat, och räkningen efteråt ska kunna
 * visa noll.
 *
 * @param {unknown} namn @returns {boolean}
 */
export const arGammalNamn = (namn) => typeof namn === "string";

/**
 * Namnen som saknar en översättning, som sökvägar in i objektet.
 *
 * ⛔ SÖKVÄGAR OCH INTE EN RÄKNARE. "Fyra namn saknar engelska" går inte att
 * åtgärda utan att leta. `kategorier.0.namn` går det. Regel 5 i CLAUDE.md:
 * tomhet är ett svar, inte en utelämnad rubrik, och en lista med noll poster är
 * ett tydligare svar än en nolla.
 *
 * ⛔ EN STRÄNG RÄKNAS SOM SAKNAD. Den har per definition inget `en`, och den
 * är dessutom det som ska bort. Räknades den inte skulle vakten visa noll så
 * länge ingenting alls migrerats, alltså vara som grönast när läget är sämst.
 *
 * @param {unknown} varde Ett namn, en lista eller ett objekt som innehåller namn.
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function saknadeSprak(varde, prefix = "") {
  /** @type {string[]} */
  const ut = [];
  const besok = (/** @type {unknown} */ v, /** @type {string} */ vag) => {
    if (typeof v === "string") return;
    if (Array.isArray(v)) {
      v.forEach((rad, i) => besok(rad, vag ? `${vag}.${i}` : String(i)));
      return;
    }
    if (!v || typeof v !== "object") return;
    const o = /** @type {Record<string, unknown>} */ (v);
    for (const [nyckel, inre] of Object.entries(o)) {
      const nyVag = vag ? `${vag}.${nyckel}` : nyckel;
      // Ett namn känns igen på att det ÄR ett namn: en sträng där ett namn
      // förväntas, eller ett objekt med sv men utan en.
      if (nyckel === "namn") {
        if (typeof inre === "string" && inre.trim()) ut.push(nyVag);
        else if (inre && typeof inre === "object" && rensa(/** @type {any} */ (inre).sv) && !rensa(/** @type {any} */ (inre).en)) ut.push(nyVag);
        else besok(inre, nyVag);
        continue;
      }
      besok(inre, nyVag);
    }
  };
  besok(varde, prefix);
  return ut;
}
