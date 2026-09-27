import { useKallor } from "../data/useKallor.jsx";
import { OpsHelp } from "./OpsHelp.jsx";
import { text } from "../lib/sprak.js";

/**
 * Hjälptexterna för en sida, ur modulernas hjälpkällor.
 *
 * ⛔ ROUTEN SKICKAS TILL MODULEN, den filtreras inte här. Bara modulen vet
 * vilka av sina sidor den har hjälp för, och ett filter i ramverket hade
 * krävt att ramverket kände modulens vyer. Det är precis det kontraktet finns
 * för att slippa.
 *
 * ⛔ INGEN HJÄLP RITAR INGENTING, inte en tom ruta. En hjälpknapp som öppnar
 * tomhet lär läsaren att knappen inte betyder något, och då trycker ingen på
 * den där den faktiskt har något att säga. Samma skäl som chevronen i navet.
 */

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../lib/kallor.js").skapaKallregister> | null} props.register
 * @param {{ groupId: string, route: string }} props.fraga
 * @param {string} [props.sprak]
 * @param {string} [props.label] Skärmläsarens ord för tecknet.
 */
export function OpsModulHjalp({ register, fraga, sprak, label }) {
  const { rader, laddar, fel } = useKallor(register, "hjalp", fraga);

  /*
   * ⛔ VARKEN FEL ELLER VÄNTAN RITAS HÄR. En hjälptext är en bisak på sidan,
   * och en röd banderoll för att en modul inte kunde leverera en förklaring
   * skulle skrika högre än sidans eget innehåll. Felet finns kvar i hookens
   * `fel` för den yta som vill visa det, och det är ytans beslut och inte
   * hjälpens.
   */
  /*
   * ⛔ INGEN EGEN KONTROLL AV TOM LISTA, OCH DET ÄR ETT MUTATIONSFYND. Här stod
   * `|| rader.length === 0`. Svepet tog bort den och ingenting blev rött:
   * `[].map()` ritar redan ingenting alls, alltså var villkoret ett andra sätt
   * att säga samma sak. En kontroll inget prov kan skilja från sin frånvaro
   * ska bort och inte få ett eget prov.
   *
   * ⛔ LÖFTET STÅR KVAR: ingen hjälp ritar ingenting, inte en tom ruta. Det
   * bevisas av provet som mäter att behållaren är tom, inte av den här raden.
   */
  if (laddar || fel) return null;

  return (
    <>
      {rader.map((rad, i) => (
        <OpsHelp key={`${rad.modulId}-${i}`} title={text(rad.titel, sprak)} label={label}>
          {text(rad.text, sprak)}
        </OpsHelp>
      ))}
    </>
  );
}
