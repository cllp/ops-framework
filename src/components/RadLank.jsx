import { cx } from "../lib/cx.js";

/**
 * Titeln på en rad med en källa i manifestet (0.145.0, cllp/ops-framework#446): en knapp som ser ut som `HandelseLank` och täcker hela raden på samma sätt (`::after`), men utan adress.
 *
 * ⛔ EN KNAPP OCH INTE EN LÄNK, som `ExternLank` i kalendern: raden har inget id appen kan slå upp på en adress (`?handelse=<id>`), den öppnas ur raden i handen. En `<a>` utan `href` är ingen länk
 * för en skärmläsare, och en `href` som inte leder någonstans ljuger. Raden måste vara `relative`, eller bära en negativ `inset` som når kortets kant (`tacker`), som för `HandelseLank`.
 * Kontroller på raden (en åtgärd, en utfällning, en länk) har `relative z-10` och tar sina egna tryck.
 *
 * ⛔ 44 PX HÖG UNDER `md` (0.153.0, cllp/ops-framework#460 punkt 2). Ett tryck var som helst på raden träffar redan knappen (`::after`), men knappens egen ruta var en rad hög, 20 px, och det är den som en
 * mätning av tryckytor ser. Texten ligger kvar vid vänsterkanten och centreras lodrätt i rutan.
 *
 * @param {object} props
 * @param {() => void} props.onOppna
 * @param {string} props.tacker Klasserna för `::after` som gör knappen till hela radens yta.
 * @param {import("react").ReactNode} props.children
 */
export function RadLank({ onOppna, tacker, children }) {
  return (
    <button
      type="button"
      data-radlank=""
      onClick={onOppna}
      className={cx(
        // ⛔ 0.153.0 (#460 punkt 2): knappens EGEN ruta är 44 px hög under md. `::after` täckte redan hela raden för ett tryck, men lifehub.app:s `check:layout` mäter kontrollens ruta och fann 20 px.
        "min-h-11 cursor-pointer rounded-sm border-0 bg-transparent p-0 text-left [font:inherit] text-inherit hover:underline focus-visible:outline-none md:min-h-0",
        "after:absolute after:cursor-pointer focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent",
        tacker,
      )}
    >
      {children}
    </button>
  );
}
