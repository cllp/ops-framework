/**
 * Kopplingen mellan katalogens kategorier och koden som gör något åt dem.
 *
 * ══ ⛔ VÄG A, BESLUTAD AV CP 2026-09-26 (#111) ════════════════════════
 *
 * Katalogen bär DATA: id, namn, färg, ikon, fas, ordning. Koden bär BETEENDE:
 * vilka fält en sort kräver, vad som räknas ut, vart posten tar vägen efteråt.
 *
 * Alternativet var att lägga beteendet i databasen som ett litet schemaspråk.
 * Det sköts upp, och skälet är mätt: en helt ny SORT har tillkommit en gång i
 * år (cllp/bolag-ops#144), och ett språk byggt för ett behov som inte uppstått
 * kostar varje gång något annat ska ändras. Väg B läggs till additivt den dag
 * behovet finns.
 *
 * ══ ⛔ DÄRFÖR MÅSTE KOPPLINGEN VAKTAS ÅT BÅDA HÅLL ═══════════════════
 *
 * En KATEGORI UTAN HANTERARE är en rad som ritas, går att välja och sedan inte
 * gör något. Det är precis felklassen i cllp/bolag-ops#144: sorten `bugg` lades
 * till i appen och blev aldrig ett GitHub-ärende. Ingenting blev rött,
 * buggrapporter försvann tyst, och enda ledtråden var en info-rad i en logg
 * ingen läser.
 *
 * En HANTERARE UTAN KATEGORI är död kod som ser levande ut. Den städas aldrig,
 * eftersom nästa läsare antar att den används av något hen inte hittat.
 *
 * ⛔ ARKIVERADE KATEGORIER KRÄVER OCKSÅ EN HANTERARE. En arkiverad kategori går
 * inte att välja för NYA poster, men de gamla raderna finns kvar och ska ritas
 * och räknas som förut. Undantogs de skulle arkivering tyst göra historiken
 * obrukbar, vilket är värre än det raderandet den ersätter.
 */

/** @param {unknown} v @returns {string} */
const rensa = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Binder ihop katalogen med hanterarna, eller kastar med vad som saknas.
 *
 * ⛔ KASTAR VID UPPSTART OCH SAMLAR ALLA FEL, till skillnad från
 * `validateKatalog` som kastar på det första. Skillnaden är avsiktlig: där är
 * felet en rad någon just ändrat, här är det en LISTA som ska stämma med en
 * annan lista, och den som ska laga vill se hela skillnaden på en gång i
 * stället för att köra om fyra gånger.
 *
 * @param {import("./katalog.js").Kategori[]} kategorier
 * @param {Record<string, unknown>} hanterare Nyckel = kategorins id.
 * @param {{ katalog?: string }} [config]
 * @returns {Record<string, { kategori: import("./katalog.js").Kategori, beteende: unknown }>}
 */
export function kopplaBeteenden(kategorier, hanterare, { katalog = "katalog" } = {}) {
  const lista = Array.isArray(kategorier) ? kategorier : [];
  const karta = hanterare && typeof hanterare === "object" ? hanterare : {};

  const utanHanterare = lista.filter((k) => k && rensa(k.id) && !(k.id in karta)).map((k) => k.id);
  const idn = new Set(lista.map((k) => k && rensa(k.id)).filter(Boolean));
  const utanKategori = Object.keys(karta).filter((id) => !idn.has(id));

  /** @type {string[]} */
  const skal = [];
  if (utanHanterare.length > 0) {
    skal.push(
      `kategorierna ${utanHanterare.join(", ")} saknar hanterare. En kategori utan hanterare ritas, går att välja och gör sedan ingenting, vilket inte syns någonstans.`,
    );
  }
  if (utanKategori.length > 0) {
    skal.push(
      `hanterarna ${utanKategori.join(", ")} saknar kategori. En hanterare utan kategori är död kod som ser levande ut, och nästa läsare antar att den används.`,
    );
  }
  if (skal.length > 0) throw new Error(`${katalog}: ${skal.join(" ")}`);

  /** @type {Record<string, { kategori: import("./katalog.js").Kategori, beteende: unknown }>} */
  const ut = {};
  for (const kategori of lista) ut[kategori.id] = { kategori, beteende: karta[kategori.id] };
  return ut;
}

/**
 * Hanteraren för en kategori, eller `null`.
 *
 * ⛔ SVARAR `null` OCH KASTAR INTE, till skillnad från kopplingen ovan. Den
 * körs vid uppstart och ska stoppa en felaktig uppsättning. Den här körs i en
 * vy, på en rad som kan peka på en kategori som hunnit tas bort ur
 * standardvärdena, och en vy som kastar där tar ned hela listan.
 *
 * @param {Record<string, { beteende: unknown }>} kopplade
 * @param {unknown} id
 */
export function beteendet(kopplade, id) {
  const nyckel = rensa(id);
  if (!nyckel || !kopplade || typeof kopplade !== "object") return null;
  const rad = kopplade[nyckel];
  return rad ? rad.beteende : null;
}
