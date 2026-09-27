import { useKallor } from "../data/useKallor.jsx";
import { OpsEventList } from "./OpsEventList.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";

/**
 * Händelseytan, fylld ur modulernas källor.
 *
 * ⛔ DEN HÄR KOMPONENTEN FINNS FÖR ATT `OpsEventList` INTE SKA HÄMTA. Listan är
 * presentation och tar emot `events`, och det ska den fortsätta göra: en
 * primitiv som hämtar går inte att använda med data appen redan har.
 * Kopplingen till registret bor här i stället, i en komponent vars enda jobb är
 * just den kopplingen.
 *
 * ⛔ TRE TOMHETER, TRE TEXTER. "Ingen modul fyller ytan" är ett annat besked än
 * "modulerna hade inget", och båda är andra besked än "vi hämtar". Slås de ihop
 * står det "allt är gjort" medan sanningen är att ingenting frågades.
 */

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../lib/kallor.js").skapaKallregister> | null} props.register
 * @param {{ groupId: string }} props.fraga ⛔ Bär gruppen. En yta frågar alltid för EN grupp.
 * @param {import("react").ReactNode} [props.tomText] När modulerna svarade utan rader.
 * @param {import("react").ReactNode} [props.utanModulText] När ingen modul alls fyller ytan.
 * @param {string} [props.ariaLabel]
 * @param {string} [props.laddarText]
 */
export function OpsModulHandelser({
  register,
  fraga,
  tomText = "Inget inplanerat.",
  utanModulText = "Ingen modul lämnar händelser till den här gruppen.",
  ariaLabel = "Händelser",
  laddarText = "Hämtar händelser",
}) {
  const { rader, laddar, fel, tomt, fyller } = useKallor(register, "handelser", fraga);

  if (fel) {
    /*
     * ⛔ FELET RITAS, DET GÖMS INTE BAKOM EN TOM LISTA. En modul med ett trasigt
     * kontrakt ska synas som trasig, annars letar man i datan efter rader som
     * aldrig lämnade koden. Samma skäl som KatalogLarm i appen.
     */
    return <OpsBanner tone="danger" title="Händelserna kunde inte hämtas">{fel.message}</OpsBanner>;
  }
  if (laddar) return <OpsSpinner label={laddarText} />;

  return <OpsEventList events={/** @type {any} */ (rader)} ariaLabel={ariaLabel} empty={tomt && fyller.length === 0 ? utanModulText : tomText} />;
}
