/**
 * Vilken ton ett ärendes läge får, på ETT ställe.
 *
 * ⛔ CP 2026-09-25 (bolag-ops #363), med skärmdump: "Ny" var ett rött fyllt
 * chip i Aktivitet och ett blått piller i Inkorgen. Samma ord, samma betydelse
 * (det här har ingen tittat på än), två färger. Den som läser lär sig då att
 * färgen inte betyder något, och det är värre än ingen färg alls.
 *
 * Orsaken var att varje yta valde själv: Aktivitet skrev `bg-badge`, Inkorgen
 * `tone="info"`. Här står valet en gång, och båda läser härifrån.
 *
 * ⛔ TONERNA ÄR `OpsPill`S, inte färgvärden. Paren (text mot yta) är vaktade i
 * `scripts/check-kontrast.mjs`, i båda teman.
 *
 * ⛔ "Ny" ÄR INFO OCH INTE BADGE-RÖTT. Rött är räknemärkets färg och betyder
 * "det finns något att se" på en ikon. Ett rött chip på varje oläst rad gjorde
 * en lugn lista till en larmlista, och en ny post är inget fel.
 *
 * ⛔ Nycklarna är ärendemodellens lägen (`ny`, `hanterad`, `avskriven`). En app
 * med egna lägen slår upp sina egna ord; en okänd nyckel ger `neutral` och
 * aldrig en gissad färg.
 */

/** @type {Readonly<Record<string, "neutral"|"success"|"warning"|"danger"|"info">>} */
export const STATUS_TONES = Object.freeze({
  ny: "info",
  hanterad: "success",
  avskriven: "neutral",
});

/**
 * @param {string | null | undefined} status
 * @returns {"neutral"|"success"|"warning"|"danger"|"info"}
 */
export function statusTone(status) {
  return STATUS_TONES[String(status ?? "")] ?? "neutral";
}
