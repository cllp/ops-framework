/**
 * Rubriken i en skapa-vy: vanlig text, ingen plusikon och ingen knapp.
 *
 * Händelsen: CP 2026-10-09, Meddelanden. Efter ett tryck på "+ Nytt meddelande"
 * stod samma pluscirkel kvar bredvid ordet i compose-huvudet, och den såg ut
 * som en knapp till. Plusset hör till ingången (samtalslistan, plusmenyn, "+ Ny").
 * Vyn man redan är inne i visar titeln.
 *
 * Två varianter, och typografin bor här:
 * - `panel`: sidans rubrik i `OpsSkapaPanel` (Ny händelse, Nytt ärende, Ny grupp
 *   och en moduls formulär). Samma klasser som panelen hade.
 * - `chatt`: läget "nytt" i Meddelanden, en `h3` i chattens huvud.
 *
 * Bibliotekets "Ny anteckning" är sidrubriken i `OpsViewHeader`, och "+ Ny" ritas
 * bara i listan. Kalenderns "Ny kalender" döljer plusknappen när formuläret är
 * öppet, och sektionens rubrik är redan "Mina kalendrar".
 *
 * Intern: panelen och Meddelanden importerar den. Den exporteras inte ur paketet.
 */

/** @type {Record<string, { tagg: "h2" | "h3", klass: string }>} */
const VARIANTER = {
  panel: {
    tagg: "h2",
 klass: "m-0 mt-1 mb-3 min-w-0 truncate text-sida leading-tight text-ink max-md:mt-0 max-md:mb-0 max-md:flex-1 max-md:pr-16 max-md:text-center max-md:text-brod",
  },
  chatt: {
    tagg: "h3",
    klass: "m-0 min-w-0 flex-1 truncate text-etikett font-semibold text-ink",
  },
};

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 * @param {string} [props.id]
 * @param {"panel" | "chatt"} [props.variant] Förval "panel".
 */
export function OpsSkapaRubrik({ children, id, variant = "panel" }) {
  const vald = VARIANTER[variant];
  if (!vald) {
    throw new Error(`OpsSkapaRubrik: okänd variant "${variant}". Giltiga: panel, chatt.`);
  }
  const Tag = vald.tagg;
  return (
    <Tag id={id} data-skapa-rubrik="" className={vald.klass}>
      {children}
    </Tag>
  );
}
