import { gruppikonNamn } from "./gruppikonarv.js";

/**
 * Senast använda ikoner i väljaren, per webbläsare (0.65.0, #265; flyttad ur `OpsGruppmarkeValjare.jsx` i 0.70.0 så att en
 * väljare utan React läser och skriver samma lista, lifehub.identity#27).
 *
 * ⛔ EN BEKVÄMLIGHET, ALDRIG DATA. Den ligger i `localStorage`, får försvinna (privat fönster, rensad webbplatsdata), och
 * raden säger då "Inga ännu". Ett namn som inte längre finns i katalogen släpps tyst ur listan.
 */

/** Nyckeln i `localStorage`. Samma för gruppens och personens väljare: det är samma ikoner. */
export const SENASTE_NYCKEL = "ops-gruppikon-senaste";
export const MAX_SENASTE = 8;

/** @returns {string[]} */
export function lasSenasteGruppikoner() {
  try {
    const varde = JSON.parse(globalThis.localStorage?.getItem(SENASTE_NYCKEL) ?? "[]");
    return Array.isArray(varde) ? varde.filter((n) => typeof n === "string" && gruppikonNamn(n)).slice(0, MAX_SENASTE) : [];
  } catch {
    // ⛔ Ingen lagring (privat fönster, blockerad) är inget fel: raden säger "Inga ännu".
    return [];
  }
}

/** Lägger `namn` först och returnerar listan. @param {string} namn @returns {string[]} */
export function sparaSenasteGruppikon(namn) {
  const lista = [namn, ...lasSenasteGruppikoner().filter((n) => n !== namn)].slice(0, MAX_SENASTE);
  try {
    globalThis.localStorage?.setItem(SENASTE_NYCKEL, JSON.stringify(lista));
  } catch {
    // Se `lasSenasteGruppikoner`. Listan gäller ändå för den här visningen.
  }
  return lista;
}
