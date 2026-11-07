import { ordet } from "../lib/ord.js";

/**
 * (0.202.0, QA 2026-11-07, punkt 16 i cllp/lifehub.app#687) Sista raden på en delad sida, i samma form som gästens översikt: vad appen är och Läs mer, i en ny flik.
 *
 * ⛔ UTAN GRUPPENS NAMN. Gästens rad säger "{grupp} samlar chatt, kalender och filer i {namn}", eftersom gästen är bjuden till gruppen. En delad länk läses av vem som helst, och svaret
 * säger med flit ingenting om gruppen (`HANDELSESVARSFALT`, `DELNINGSSVARSFALT`, beslut 0009). Raden säger därför vad appen gör, inte vems den är.
 *
 * `omAppen` prövas som på gästens sida: `{ href, namn }` där `href` är en https-adress. Allt annat kastar.
 */
export const ORD_OMAPPENRAD = {
  rad: { sv: "Delat från {namn}, där grupper samlar chatt, kalender och filer.", en: "Shared from {namn}, where groups keep chat, calendar and files together." },
  lasMer: { sv: "Läs mer", en: "Read more" },
};

/**
 * @param {unknown} omAppen
 * @returns {{ href: string, namn: string } | null}
 */
export function provatOmAppenRad(omAppen) {
  if (omAppen === undefined || omAppen === null) return null;
  const o = /** @type {{ href?: unknown, namn?: unknown }} */ (omAppen);
  let https = false;
  try {
    https = typeof o.href === "string" && new URL(o.href).protocol === "https:";
  } catch {
    https = false;
  }
  if (!https || typeof o.namn !== "string" || !o.namn.trim()) {
    throw new Error("OmAppenRad: omAppen är { href, namn }, där href är en https-adress och namn är appens namn. En javascript-, data- eller http-adress är aldrig tillåten.");
  }
  return { href: /** @type {string} */ (o.href), namn: o.namn.trim() };
}

/**
 * @param {{ omAppen: unknown, sprak: "sv" | "en" }} props
 */
export function OmAppenRad({ omAppen, sprak }) {
  const appen = provatOmAppenRad(omAppen);
  if (!appen) return null;
  return (
    <p data-delad-om-appen="" className="m-0 max-w-prose text-meta text-publik-ljus-dampad">
      {ordet(ORD_OMAPPENRAD, "rad", sprak).replace("{namn}", appen.namn)}{" "}
      <a href={appen.href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {ordet(ORD_OMAPPENRAD, "lasMer", sprak)}
      </a>
    </p>
  );
}
