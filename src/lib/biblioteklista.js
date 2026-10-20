/**
 * Listor i Biblioteket: att läsa en lista mot platsens poster, och att ändra dess ordning och innehåll (0.128.0, cllp/lifehub.app#378).
 *
 * ══ ⛔ VAD CP BESLÖT (2026-10-19 och 2026-10-20) ═══════════════════════════════════════════════════════════════════════════
 *
 * "En lista rymmer bara poster från samma plats: gruppens bibliotek eller Mitt bibliotek. En lista rymmer allt som finns i Biblioteket: filer, anteckningar och länkar.
 * Det ska vara lätt att i efterhand ändra ordningen, lägga till och ta bort." Listan PEKAR på poster och kopierar dem inte. "En borttagen post står kvar i listan med texten
 * 'borttagen'", och sedan 2026-10-20: "ingen ny app och ingen ny låttyp", alltså en post i Biblioteket som pekar på andra poster. Ingen zip, inga avsnitt, inga anteckningar per rad.
 *
 * ══ ⛔ BARA FRÅN SAMMA PLATS GÄLLER GENOM HUR LISTAN LÄSES ════════════════════════════════════════════════════════════════
 *
 * `losLista` slår upp varje id bland de poster vyn redan har, och vyn har bara platsens egna (frågan är `where groupId == plats`). Ett id från en annan plats finns inte där och blir en rad
 * som säger "Finns inte längre". Den läser aldrig en post från en annan plats, hur listan än skrivits. Reglerna kan inte pröva detsamma vid skrivning (högst tio uppslag per skrivning,
 * och en lista har upp till 200 id), så läsningen är spärren och regeln låser bara formen (`opsBibliotekPoster`).
 *
 * ⛔ EN BORTTAGEN POST SYNS, OCH ÄR INTE BORTFILTRERAD (regel 5). En lista som tyst tappade en rad hade sett ut som att personen själv tagit bort den, och en lista vars längd
 * ändras av att någon annan raderar en post är en lista ingen kan lita på. Raden står kvar med sitt id och ett skäl, och den som får ändra listan kan ta bort den.
 *
 * Filen är ren: inget Firebase, ingen React.
 */

import { MAX_LISTPOSTER, POSTIDFORM } from "./bibliotek.js";

/**
 * Orden på en lista som inte går att visa som en post. EN definition för medlemmens listvy, mottagarens publika lista och menyn (regel 2): CP 2026-10-20 sade att en delad lista ska
 * ritas som medlemmen ser den, så texterna får inte finnas i två kopior som glider isär.
 */
export const LISTRADTEXT = /** @type {const} */ ({
  saknas: "Finns inte längre",
  lista: "Listor kan inte ligga i en lista.",
});

/** Förklaringen på den avstängda raden "Lägg i lista" i menyn för en lista (0.133.0). */
export const LISTA_I_LISTA_TEXT = "En lista kan inte ligga i en lista.";

/** Förklaringen på den avstängda raden "Flytta eller kopiera" i menyn för en lista (0.133.0). */
export const LISTA_FLYTT_TEXT = "En lista pekar på poster i den här gruppen och flyttas inte.";

/**
 * @typedef {object} Listrad
 * @property {string} id Postens id, som det står i listan.
 * @property {(import("./bibliotek.js").Bibliotekspost & { id: string }) | null} post Posten, eller `null` när den inte går att visa.
 * @property {"saknas" | "lista" | null} skal Varför `post` är `null`: `saknas` (posten finns inte på platsen, borttagen eller från en annan plats) eller `lista` (en lista kan inte ligga i en lista). `null` när posten visas.
 */

/**
 * Listans rader i listans ordning, mot platsens poster.
 *
 * ⛔ ALLA ID KOMMER MED. Antalet rader är alltid listans längd, vilka poster som än finns kvar: `losLista(l, p).length === l.poster.length`. Det är provet som skiljer den här funktionen
 * från en som filtrerar (regel 5).
 *
 * @param {{ poster?: unknown } | null | undefined} lista
 * @param {ReadonlyArray<import("./bibliotek.js").Bibliotekspost & { id: string }>} platsensPoster
 * @returns {Listrad[]}
 */
export function losLista(lista, platsensPoster) {
  const ids = Array.isArray(lista?.poster) ? /** @type {unknown[]} */ (lista.poster).filter((x) => typeof x === "string") : [];
  const perId = new Map(platsensPoster.map((p) => [p.id, p]));
  return ids.map((id) => {
    const post = perId.get(/** @type {string} */ (id)) ?? null;
    if (!post) return { id: /** @type {string} */ (id), post: null, skal: /** @type {const} */ ("saknas") };
    // En lista i en lista hade kunnat peka på sig själv, och ingen vy ritar träd. Raden står kvar med ett skäl och kan tas bort.
    if (post.typ === "lista") return { id: /** @type {string} */ (id), post: null, skal: /** @type {const} */ ("lista") };
    return { id: /** @type {string} */ (id), post, skal: null };
  });
}

/**
 * Listorna en post kan läggas i: de som personen får ändra och som inte är fulla. Posten i sig kan inte vara en lista.
 *
 * @template {import("./bibliotek.js").Bibliotekspost & { id: string }} T
 * @param {ReadonlyArray<T>} platsensPoster
 * @param {(post: T) => boolean} farAndra Svar på `farAndra(post, jag)`: författaren, en admin eller en ägare.
 * @returns {T[]}
 */
export function listorAttLaggaI(platsensPoster, farAndra) {
  return platsensPoster
    .filter((p) => p.typ === "lista" && farAndra(p) && (p.poster?.length ?? 0) < MAX_LISTPOSTER)
    .sort((a, b) => b.andrad - a.andrad || a.rubrik.localeCompare(b.rubrik, "sv"));
}

/**
 * Posterna som går att lägga till i en lista: platsens poster utom listor och utom dem som redan ligger i den. En fil som ännu laddas upp räknas med: listan pekar på posten,
 * och posten blir klar eller inte oberoende av listan.
 *
 * @template {import("./bibliotek.js").Bibliotekspost & { id: string }} T
 * @param {{ poster?: readonly string[] } | null | undefined} lista
 * @param {ReadonlyArray<T>} platsensPoster
 * @returns {T[]}
 */
export function kandidaterForLista(lista, platsensPoster) {
  const finns = new Set(lista?.poster ?? []);
  return platsensPoster.filter((p) => p.typ !== "lista" && !finns.has(p.id));
}

/**
 * Listans poster med ett id till sist. Ligger id:t redan i listan lämnas listan som den är (`andrad: false`): samma post två gånger är inget val en person gör, och regeln nekar dubbletter.
 * Är listan full (`MAX_LISTPOSTER`) kastas ett fel med skälet, det klipps inte tyst.
 *
 * @param {readonly string[]} poster
 * @param {string} id
 * @returns {{ poster: string[], andrad: boolean }}
 */
export function laggTillPost(poster, id) {
  if (typeof id !== "string" || !POSTIDFORM.test(id)) throw new Error(`"${String(id)}" är inte ett postid.`);
  if (poster.includes(id)) return { poster: [...poster], andrad: false };
  if (poster.length >= MAX_LISTPOSTER) throw new Error(`Listan är full: högst ${MAX_LISTPOSTER} poster.`);
  return { poster: [...poster, id], andrad: true };
}

/**
 * Listans poster utan ett id. Ett id som inte finns lämnar listan som den är.
 *
 * @param {readonly string[]} poster
 * @param {string} id
 * @returns {string[]}
 */
export function taBortPost(poster, id) {
  return poster.filter((x) => x !== id);
}
