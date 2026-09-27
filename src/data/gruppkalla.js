/**
 * Frågor som alltid bär sin grupp, och sammanslagningen över flera.
 *
 * ══ ⛔ VARFÖR EN EGEN INGÅNG OCH INTE BARA EN KONVENTION (#139) ════════
 *
 * Kontraktet i `contract.js` vet ingenting om grupper, och ska inte veta det:
 * `tam` har inga. Men i en app som HAR grupper är en fråga utan `groupId` ett
 * läckage, alltså en vy som visar någon annans rader eller en som visar inget
 * och skyller på behörigheter. Den sortens fel syns inte i koden, bara i datan.
 *
 * ⛔ DÄRFÖR ÄR GRUPPEN ETT KRAV I TYPEN OCH INTE EN RAD I EN README. En
 * konvention håller tills någon har bråttom. `check-gruppfraga` kör tsc mot en
 * fråga utan grupp och kräver rött, alltså är kravet mätt och inte påstått.
 *
 * ⛔ OCH KRAVET UPPREPAS I KÖRTID. Ramverket konsumeras som ett paket av appar
 * som inte alla typkontrollerar sin egen kod, och för dem är typen bara en
 * kommentar. Ett kast säger samma sak på den enda plats de läser.
 *
 * ══ ⛔ EN FRÅGA PER GRUPP ══════════════════════════════════════════════
 *
 * `listaPerGrupp` frågar varje grupp för sig och lägger ihop svaren. Det är
 * INTE en optimeringsmiss, det är beslutet i #139: en rad tillhör en grupp,
 * regeln är ett uppslag, och en fråga som spände över flera grupper hade
 * krävt att raderna bar en lista. Se `check-gruppnyckel` för vad det kostade
 * senast någon gjorde det.
 */

import { slaIhopSvar } from "../lib/grupplage.js";

/**
 * En fråga som bär sin grupp.
 *
 * ⛔ `groupId` ÄR OBLIGATORISK, och det är hela vakten. Görs den valfri blir
 * `check-gruppfraga` röd, eftersom provfrågan utan grupp då kompilerar.
 *
 * @typedef {object} GruppFraga
 * @property {string} groupId Gruppen raderna tillhör. Ett värde, aldrig en lista.
 * @property {Record<string, unknown>} [where] Övriga likhetsvillkor.
 * @property {string} [sortBy]
 * @property {"asc" | "desc"} [direction]
 * @property {number} [limit]
 */

/**
 * ⛔ BÅDA ANROPEN ÄR `async`, OCH DET ÄR ETT PROVFYND. De kastade först
 * synkront medan de returnerade ett löfte, alltså gick felet inte att fånga
 * med `.catch()` på anropet. Ett anropsställe som gjorde allt rätt hade fått
 * ett ohanterat undantag, och det är precis den sortens halvhet reglerna
 * kallar en tyst nedsläppsväg: felet finns, men inte där någon letar.
 *
 * @param {GruppFraga} fraga
 * @param {string} vem Namnet i felmeddelandet.
 * @returns {string}
 */
function kravGrupp(fraga, vem) {
  const g = fraga && typeof fraga.groupId === "string" ? fraga.groupId.trim() : "";
  if (!g) {
    throw new Error(
      `${vem}: groupId krävs i frågan. En fråga utan grupp läser antingen någon annans rader eller inga alls, och båda ser ut som ett tomt svar. Ska flera grupper visas: använd listaPerGrupp, som frågar varje grupp för sig.`,
    );
  }
  return g;
}

/**
 * Rader för EN grupp.
 *
 * @template {{ id: string }} T
 * @param {import("./contract.js").DataSource<T>} kalla
 * @param {string} samling
 * @param {GruppFraga} fraga
 * @returns {Promise<T[]>}
 */
export async function gruppLista(kalla, samling, fraga) {
  const groupId = kravGrupp(fraga, "gruppLista");
  const { where, sortBy, direction, limit } = fraga;
  /*
   * ⛔ GRUPPEN LÄGGS TILL SIST I `where`, så att en anropare som skickar med
   * `groupId` i `where` inte kan skriva över den med en annan. Vore ordningen
   * omvänd vore kravet ovan en formalitet som gick att kringgå i samma anrop.
   */
  return kalla.list(samling, { where: { ...(where ?? {}), groupId }, sortBy, direction, limit });
}

/**
 * Skapar en rad i en grupp.
 *
 * ⛔ ATT SKAPA KRÄVER EN VALD GRUPP, och det är ett klarkriterium i #139. I
 * läget "alla" ger `gruppenAttSkapaI` `null`, och då finns ingen rad att
 * skapa: en rad utan grupp finns inte i modellen, och reglerna hade avvisat
 * den ändå, fast med "insufficient permissions" i stället för ett svar.
 *
 * @template {{ id: string }} T
 * @param {import("./contract.js").DataSource<T>} kalla
 * @param {string} samling
 * @param {Partial<T> & { groupId: string }} data
 * @returns {Promise<T>}
 */
export async function gruppSkapa(kalla, samling, data) {
  const groupId = kravGrupp(/** @type {GruppFraga} */ (/** @type {unknown} */ (data)), "gruppSkapa");
  return kalla.create(samling, { ...data, groupId });
}

/**
 * Rader ur flera grupper: en fråga per grupp, ihopslaget och märkt.
 *
 * ⛔ `limit` GÄLLER DET IHOPSLAGNA, OCH SKICKAS DESSUTOM MED NEDÅT. Det
 * avgörande taket är det sista: tio rader ur tre grupper är trettio, och tio
 * av dem ska visas. Att varje delfråga OCKSÅ bär taket är en kostnadsfråga och
 * inte en korrekthetsfråga, och den är säker eftersom delfrågan bär samma
 * sortering: en grupps tio översta innehåller allt den kan bidra med till de
 * tio översta totalt.
 *
 * ⛔ OCH DEN RADEN STOD FEL HÄR TILL ATT BÖRJA MED. Först påstod noten att ett
 * tak per delfråga hade gett fel svar. Svepet visade motsatsen: mutationen som
 * la taket i delfrågan ändrade inget utfall, eftersom sorteringen följer med.
 * Ett skäl som inte stämmer är värre än inget skäl, för nästa läsare tar det
 * för mätt. Taket skickas nu med, och att det gör det provas på anropen.
 *
 * @template {{ id: string }} T
 * @param {import("./contract.js").DataSource<T>} kalla
 * @param {string} samling
 * @param {ReadonlyArray<import("../lib/grupp.js").Grupp>} grupper Ur `grupperAttFraga`.
 * @param {Omit<GruppFraga, "groupId">} [fraga]
 * @returns {Promise<(T & { gruppmarke: { id: string, namn: import("../lib/sprak.js").Namn } })[]>}
 */
export async function listaPerGrupp(kalla, samling, grupper, fraga = {}) {
  const lista = grupper ?? [];
  const { limit, ...utanTak } = fraga;
  const svar = await Promise.all(
    lista.map(async (grupp) => ({
      grupp,
      rader: await gruppLista(kalla, samling, { ...utanTak, limit, groupId: grupp.id }),
    })),
  );
  return slaIhopSvar(svar, { sortBy: fraga.sortBy, direction: fraga.direction, limit });
}

/**
 * Antalet rader per grupp, för märket i gruppfiltret.
 *
 * ⛔ RÄKNAS UR DET SOM REDAN HÄMTATS, inte med en egen fråga. En andra fråga
 * hade kunnat ge ett annat tal än listan visar, och två tal om samma sak är
 * arbetsreglernas punkt 2.
 *
 * ⛔ OCH VARJE GRUPP FÅR SIN RAD ÄVEN NÄR DEN ÄR NOLL. En grupp som saknas i
 * räkningen ser ut som en grupp som inte frågades (punkt 5).
 *
 * @param {ReadonlyArray<{ gruppmarke: { id: string } }>} rader
 * @param {ReadonlyArray<import("../lib/grupp.js").Grupp>} grupper
 * @returns {Record<string, number>}
 */
export function raderPerGrupp(rader, grupper) {
  /** @type {Record<string, number>} */
  const ut = {};
  for (const g of grupper ?? []) ut[g.id] = 0;
  for (const rad of rader ?? []) {
    const id = rad?.gruppmarke?.id;
    if (id !== undefined && Object.prototype.hasOwnProperty.call(ut, id)) ut[id] += 1;
  }
  return ut;
}
