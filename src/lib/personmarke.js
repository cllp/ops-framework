import { initials } from "./identity.js";
import { gruppKulor } from "./gruppfarg.js";
import { gruppikonNamn } from "./gruppikonarv.js";

/**
 * En PERSONS märke ritat som en grupps (0.70.0, lifehub.identity#27): ikonen i kulören på en tonad platta, eller
 * initialerna.
 *
 * CP 2026-10-06: "Låt profildelen i identity ha samma fina funktion exakt som man editerar grupp med ikoner och färger."
 * Personen sparar alltså samma två fält som gruppen, i samma former (`ikon` ett katalognamn, `farg` `kulor:N`), och
 * ritas med samma märke.
 *
 * ⛔ DE ÄLDRE VÄRDENA LÄSES VIDARE, INGENTING SKRIVS OM. De sex ikon-id:na ritas med samma Lucide-ikon som förut
 * (`ARV_PROFILIKON`), och tonerna "1" till "6" med sin kulör (`ARV_TON_KULOR`). En person utan sparad färg får kulören ur
 * sitt id, samma familj som tonen `identityTone(id)` gav.
 *
 * ⛔ ETT VÄRDE SOM INTE KÄNNS IGEN RITAS SOM OM DET INTE FANNS. Läsvägen kastar inte; `byggAnvandare` är den som avvisar.
 *
 * @param {{ id?: string, namn?: string, epost?: string, ikon?: string, farg?: string } | null | undefined} person
 * @returns {{ kulor: number, ikon: string, initialer: string }} `ikon` är ett katalognamn eller tom sträng; `initialer`
 *   är det som ritas när ikonen är tom.
 */
export function personmarke(person) {
  const ikon = gruppikonNamn(person?.ikon ?? "");
  return {
    kulor: gruppKulor({ id: person?.id ?? "", farg: person?.farg ?? "" }),
    ikon,
    initialer: ikon ? "" : initials(person?.namn || person?.epost || ""),
  };
}
