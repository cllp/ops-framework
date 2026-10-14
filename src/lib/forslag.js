/**
 * Agentens förslag som knappar (0.105.0, CP 2026-10-14 med en skärmbild av TALK-panelen).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Agenten frågade "ska jag skapa ärendet?", personen svarade "ja gör det", och agenten svarade med en lista över de ord som
 * spärren för en begäran kräver. Ett "ja" i text är det servern inte kan lita på: samma "ja" kan stå i ett ärende agenten läst.
 * CP godkände förslaget att en åtgärd agenten vill göra visas som en KNAPP under svaret, och att trycket är personens begäran.
 * Servern tolkar då aldrig ett "ja".
 *
 * ══ ⛔ RAMVERKET VET INTE VAD ETT FÖRSLAG GÖR ═════════════════════════════════════════════════════════════════════════
 *
 * Ett förslag är `{ id, etikett, ikon? }`. Vad trycket gör, och om det är tillåtet, avgör appens `onForslag(id)` och appens
 * server. Ramverket ritar knappen, ser till att ett tryck blir ett anrop, och säger utfallet.
 *
 * ══ ⛔ SERVERN PRÖVAR TRYCKET, INTE KNAPPEN (granskningen av PR 387) ═══════════════════════════════════════════════════
 *
 * `OpsMeddelanden onForslag` får `{ sid, mid, id }`: samtalet, meddelandet och förslaget. Allt tre kommer från klienten och går att
 * skriva för hand, så appens server ska, innan den gör något:
 *
 * 1. läsa det LAGRADE meddelandet `mid` i samtalet `sid`, och kontrollera att det är skrivet av en agent och bär ett förslag med `id`
 *    (det är det lagrade förslaget som utförs, aldrig något klienten skickat med),
 * 2. kontrollera att den som trycker är deltagare i samtalet `sid`, och
 * 3. avgöra om förslaget redan är använt, så att ett tryck från två flikar inte utför det två gånger.
 *
 * Ramverkets lås mot dubbelklick gäller bara i en flik och är en bekvämlighet, inte ett skydd. Och fältet `forslag` på ett
 * meddelande ska bara servern kunna skriva: att ramverket bara ritar knappar under en agents svar är inte en regel, det är ytan.
 *
 * ══ ⛔ INGA FÖRSLAG I TRÅDAR ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `OpsMeddelanden` ritar förslag bara i samtalets egna rader, aldrig i en tråd (`OpsTrad`): varken under trådens rot eller under ett
 * agentsvar i tråden. Ett förslag i en tråd hade behövt trådens id i anropet, och den servern som prövar trycket vet då inte var
 * meddelandet ligger. Agenten som vill föreslå något svarar i samtalet.
 *
 * Rena funktioner här, så att formen går att prova utan komponent.
 */

/** Ikonerna ett förslag kan bära. ⛔ EN STÄNGD LISTA: en okänd ikon kastar, i stället för att knappen ritas utan. */
export const FORSLAG_IKONER = Object.freeze(["arende", "handelse", "meddelande", "app", "kommentar", "hantera", "dela"]);

/** Flest förslag under ett svar. Fler är inte ett val utan en meny, och agenten ska föreslå det personen bad om. */
export const MAX_FORSLAG = 4;

/** Längsta etikett. Knappen ska gå att läsa på en rad i telefonen. */
export const MAX_FORSLAG_ETIKETT = 80;

/**
 * Längsta förhandsvisning under knappen (CP 2026-10-14: "Förslagsknappen visar vad som skapas ... gärna med en kort förhandsvisning
 * av texten under knappen, så att personen ser vad trycket gör"). Två eller tre rader i telefonen.
 */
export const MAX_FORSLAG_TEXT = 240;

/**
 * @typedef {object} Forslag
 * @property {string} id Appens id för förslaget. Det enda `onForslag` får.
 * @property {string} etikett Det knappen säger, till exempel "Skapa ärendet: Kvittot saknas".
 * @property {typeof FORSLAG_IKONER[number]} [ikon]
 * @property {string} [text] Förhandsvisningen under knappen: det som skrivs, i korthet. Utan den ritas bara knappen.
 */

/**
 * @typedef {{ utfall: "ok" | "nekad", text?: string }} Forslagssvar Det `onForslag` löser till. `ok`: det gjordes, och `text` säger vad.
 *   `nekad`: appen sade nej, och `text` säger varför. Ett avvisat löfte är ett fel, och ett tryck till får försöka igen.
 */

/**
 * Felen i ett förslag, tom lista när det håller.
 * @param {unknown} f
 * @returns {string[]}
 */
export function forslagetsFel(f) {
  if (!f || typeof f !== "object" || Array.isArray(f)) return ["förslaget ska vara ett objekt { id, etikett, ikon?, text? }"];
  const o = /** @type {Record<string, unknown>} */ (f);
  /** @type {string[]} */
  const fel = [];
  const okanda = Object.keys(o).filter((k) => !["id", "etikett", "ikon", "text"].includes(k));
  if (okanda.length) fel.push(`okända fält ${okanda.join(", ")}`);
  if (typeof o.id !== "string" || !o.id.trim()) fel.push("id ska vara en sträng som inte är tom");
  if (typeof o.etikett !== "string" || !o.etikett.trim()) fel.push("etikett ska vara en sträng som inte är tom");
  else if (o.etikett.trim().length > MAX_FORSLAG_ETIKETT) fel.push(`etiketten är ${o.etikett.trim().length} tecken, taket är ${MAX_FORSLAG_ETIKETT}`);
  if (o.text !== undefined && (typeof o.text !== "string" || o.text.trim().length > MAX_FORSLAG_TEXT)) fel.push(`text ska vara en sträng på högst ${MAX_FORSLAG_TEXT} tecken`);
  if (o.ikon !== undefined && !FORSLAG_IKONER.includes(/** @type {any} */ (o.ikon))) fel.push(`ikon ska vara en av ${FORSLAG_IKONER.join(", ")}, fick ${JSON.stringify(o.ikon)}`);
  return fel;
}

/**
 * Kastar när listan inte håller. För appens egna props: ett fel i appen ska synas när den ritar, inte när någon trycker.
 * @param {unknown} lista
 * @param {string} vem
 * @returns {ReadonlyArray<Forslag>}
 */
export function kontrolleraForslag(lista, vem) {
  if (!Array.isArray(lista)) throw new Error(`${vem}: forslag ska vara en lista, fick ${lista === null ? "null" : typeof lista}.`);
  if (lista.length > MAX_FORSLAG) throw new Error(`${vem}: högst ${MAX_FORSLAG} förslag under ett svar, fick ${lista.length}.`);
  const ids = new Set();
  lista.forEach((f, i) => {
    const fel = forslagetsFel(f);
    if (fel.length) throw new Error(`${vem}: förslag ${i}: ${fel.join("; ")}.`);
    if (ids.has(f.id)) throw new Error(`${vem}: förslaget ${f.id} står två gånger. Ett tryck ska vara ett anrop.`);
    ids.add(f.id);
  });
  return /** @type {ReadonlyArray<Forslag>} */ (lista);
}

/**
 * Förslagen ur ett meddelande som det kom ur databasen. ⛔ DATA KASTAR INTE: ett felformat förslag i ett gammalt meddelande hade
 * annars fällt hela chatten. Det som inte håller hoppas över och sägs i `fel`, så att anroparen kan rapportera det (regel 5).
 * @param {unknown} varde
 * @returns {{ forslag: ReadonlyArray<Forslag>, fel: string[] }}
 */
export function forslagUrData(varde) {
  if (varde === undefined || varde === null) return { forslag: [], fel: [] };
  if (!Array.isArray(varde)) return { forslag: [], fel: [`forslag är ${typeof varde}, inte en lista`] };
  /** @type {Forslag[]} */
  const ut = [];
  /** @type {string[]} */
  const fel = [];
  for (const f of varde) {
    const e = forslagetsFel(f);
    if (e.length) fel.push(e.join("; "));
    else if (ut.length >= MAX_FORSLAG) fel.push(`fler än ${MAX_FORSLAG} förslag`);
    else if (ut.some((x) => x.id === f.id)) fel.push(`förslaget ${f.id} står två gånger`);
    else ut.push({ id: f.id, etikett: f.etikett.trim(), ...(f.ikon ? { ikon: f.ikon } : {}), ...(typeof f.text === "string" && f.text.trim() ? { text: f.text.trim() } : {}) });
  }
  return { forslag: ut, fel };
}

/**
 * Appens svar på ett tryck. Kastar när svaret har fel form: det är ett fel i appen, och komponenten säger då fel.
 * @param {unknown} svar
 * @returns {{ utfall: "ok" | "nekad", text: string }}
 */
export function forslagssvar(svar) {
  if (!svar || typeof svar !== "object") throw new Error(`onForslag ska lösa till { utfall: "ok" | "nekad", text? }, fick ${svar === null ? "null" : typeof svar}.`);
  const { utfall, text } = /** @type {{ utfall?: unknown, text?: unknown }} */ (svar);
  if (utfall !== "ok" && utfall !== "nekad") throw new Error(`onForslag: utfall ska vara "ok" eller "nekad", fick ${JSON.stringify(utfall)}.`);
  if (text !== undefined && typeof text !== "string") throw new Error(`onForslag: text ska vara en sträng, fick ${typeof text}.`);
  return { utfall, text: typeof text === "string" ? text.trim() : "" };
}
