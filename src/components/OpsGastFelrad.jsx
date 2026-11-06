import { OpsButton } from "./OpsButton.jsx";

/**
 * Felet i en gästflik, med en knapp som hämtar fliken igen (0.192.0, cllp/lifehub.app#675). Förut stod bara texten, och den enda vägen vidare var att
 * ladda om sidan. En komponent för alla fyra flikar, så att kalendern, biblioteket, chatten och ärendena säger och gör samma sak.
 *
 * Texten är redan översatt av den som ritar, på det språk som gäller nu: felet sparas som en orsak och blir text först här.
 *
 * @param {object} props
 * @param {string} props.text
 * @param {string} props.forsokIgen Knappens text.
 * @param {() => void} [props.onForsokIgen] Utan den ritas bara texten.
 * @param {string} props.data Namnet på data-attributet som märker raden (proven och skalytan hittar den på det).
 */
export function OpsGastFelrad({ text, forsokIgen, onForsokIgen, data }) {
  return (
    <div {...{ [`data-${data}`]: "" }} className="flex min-w-0 flex-col items-start gap-2">
      <p role="alert" className="m-0 text-etikett text-danger">{text}</p>
      {typeof onForsokIgen === "function" ? (
        <OpsButton variant="secondary" size="sm" onClick={onForsokIgen}>
          {forsokIgen}
        </OpsButton>
      ) : null}
    </div>
  );
}
