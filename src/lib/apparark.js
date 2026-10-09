/**
 * App-arket och inställningsläget (0.89.0).
 *
 * Rent data in och data ut, så att ordningen, medlemskapet och adressen går
 * att prova utan att en dialog ritas.
 *
 * ══ ⛔ ORDNINGEN ÄR `groups.moduler`, INTE EN NY LISTA ══════════════════
 *
 * CP 2026-10-09, med en bild av Outlooks app-ark: apparna ska gå att ordna,
 * och ordningen gäller hela gruppen. Gruppen har redan den listan. `moduler`
 * är vilka appar som är på, i ägarens ordning, och huvudet läser samma lista
 * (se `huvudmenyPoster`). En egen `ordning` hade glidit isär från den första
 * gången någon sparade bara den ena.
 */

/** Frågeparametern som gör inställningsläget adresserbart. */
export const LAGE_PARAM = "lage";

/** Värdet som betyder att modulens ram visar inställningar, inte vyn. */
export const INSTALLNINGSLAGE = "installningar";

/** Hur länge ett tryck ska stå innan det räknas som långt och öppnar inställningarna. */
export const LANGTRYCK_MS = 500;

/**
 * @param {string} href
 * @returns {{ sokvag: string, qs: string, hash: string }}
 */
function delaHref(href) {
  const h = typeof href === "string" ? href : "";
  const hashI = h.indexOf("#");
  const hash = hashI < 0 ? "" : h.slice(hashI);
  const utan = hashI < 0 ? h : h.slice(0, hashI);
  const q = utan.indexOf("?");
  return { sokvag: q < 0 ? utan : utan.slice(0, q), qs: q < 0 ? "" : utan.slice(q + 1), hash };
}

/**
 * Sant när adressen ber om modulens inställningar.
 * @param {string} href
 */
export function arInstallningslage(href) {
  return new URLSearchParams(delaHref(href).qs).get(LAGE_PARAM) === INSTALLNINGSLAGE;
}

/**
 * Samma adress, med inställningsläget på. Övriga parametrar och brödtextens ankare står kvar.
 * @param {string} href
 */
export function medInstallningslage(href) {
  const { sokvag, qs, hash } = delaHref(href);
  const p = new URLSearchParams(qs);
  p.set(LAGE_PARAM, INSTALLNINGSLAGE);
  const q = p.toString();
  return `${sokvag}?${q}${hash}`;
}

/**
 * Samma adress, utan inställningsläget. En tom frågesträng skrivs inte ut.
 * @param {string} href
 */
export function utanInstallningslage(href) {
  const { sokvag, qs, hash } = delaHref(href);
  const p = new URLSearchParams(qs);
  p.delete(LAGE_PARAM);
  const q = p.toString();
  return `${sokvag}${q ? `?${q}` : ""}${hash}`;
}

/**
 * Apparna arket visar: gruppens `moduler`, i den ordningen, som har ett kort.
 * En fäst modul ingår. Den är installerad, och arket visar det som är installerat.
 *
 * @param {{ moduler?: ReadonlyArray<string> | null, huvudmeny?: ReadonlyArray<string> | null } | null | undefined} grupp
 * @param {ReadonlyArray<{ id: string, namn: { sv: string, en?: string }, hubb: { rutt: string, ikon: unknown } | null }>} moduler
 */
export function arkRader(grupp, moduler) {
  if (!grupp || !Array.isArray(grupp.moduler)) return [];
  const reg = new Map((moduler ?? []).map((m) => [m.id, m]));
  const pin = new Set(Array.isArray(grupp.huvudmeny) ? grupp.huvudmeny : []);
  return grupp.moduler
    .map((id) => reg.get(id))
    .filter((m) => Boolean(m?.hubb))
    .map((m) => {
      const h = /** @type {{ id: string, namn: { sv: string, en: string }, hubb: { rutt: string, ikon: unknown } }} */ (m);
      return { id: h.id, href: h.hubb.rutt, ikon: h.hubb.ikon, namn: h.namn, fast: pin.has(h.id) };
    });
}

/**
 * Lägger till eller tar bort ett modul-id. Ordningen på de andra står kvar.
 * Påslag hamnar sist: det är en ny app, inte ett hopp före de som redan ligger.
 *
 * @param {ReadonlyArray<string> | null | undefined} moduler
 * @param {string} id
 * @param {boolean} pa
 * @returns {string[]}
 */
export function sattModul(moduler, id, pa) {
  const lista = Array.isArray(moduler) ? [...moduler] : [];
  if (pa) return lista.includes(id) ? lista : [...lista, id];
  return lista.filter((x) => x !== id);
}

/**
 * Flyttar ett id `steg` steg. Utanför listan blir svaret en kopia, inte ett kast:
 * en pil på sista rutan ska inte fälla sidan.
 *
 * @param {ReadonlyArray<string>} lista
 * @param {string} id
 * @param {number} steg
 * @returns {string[]}
 */
export function flyttaId(lista, id, steg) {
  const i = lista.indexOf(id);
  const j = i + steg;
  if (i < 0 || j < 0 || j >= lista.length) return lista.slice();
  const ut = lista.slice();
  const [x] = ut.splice(i, 1);
  ut.splice(j, 0, x);
  return ut;
}

/**
 * Sätter `id` på den plats där `mal` står. De andra behåller sin inbördes ordning.
 * Samma ruta, eller ett id som inte finns, ger en kopia: ett släpp på sig själv
 * ska inte fälla sidan.
 *
 * Pilarna räknar ett steg och använder `flyttaId`. Ett drag släpper på en annan
 * ikon och använder den här. Båda skriver sedan in resultatet i `groups.moduler`
 * via `ordningMedSynliga`, samma lista som inställningarnas Ordning och huvudmenyn.
 *
 * @param {ReadonlyArray<string>} lista
 * @param {string} id
 * @param {string} mal
 * @returns {string[]}
 */
export function flyttaFore(lista, id, mal) {
  const fran = lista.indexOf(id);
  const till = lista.indexOf(mal);
  if (fran < 0 || till < 0 || fran === till) return lista.slice();
  const ut = lista.slice();
  ut.splice(fran, 1);
  ut.splice(till, 0, id);
  return ut;
}

/**
 * Skriver en ny ordning för de synliga apparna in i hela `groups.moduler`.
 *
 * En modul utan kort syns inte i arket, men den står kvar i listan på sin
 * plats. Bara de synliga byter plats med varandra. Mängden id är densamma.
 *
 * @param {ReadonlyArray<string>} alla
 * @param {ReadonlyArray<string>} synliga
 * @param {ReadonlyArray<string>} nySynliga
 * @returns {string[]}
 */
export function ordningMedSynliga(alla, synliga, nySynliga) {
  const set = new Set(synliga);
  if (nySynliga.length !== synliga.length || nySynliga.some((id) => !set.has(id))) {
    throw new Error("ordningMedSynliga: den nya ordningen måste innehålla samma moduler, inga andra.");
  }
  const ko = [...nySynliga];
  return alla.map((id) => (set.has(id) ? /** @type {string} */ (ko.shift()) : id));
}
