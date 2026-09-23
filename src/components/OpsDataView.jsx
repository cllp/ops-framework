import { OpsBanner } from "./OpsBanner.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";

/**
 * En vys tre datatillstånd: fel, hämtning, och innehåll som inte kom.
 *
 * ⛔ DET HÄR ÄR REGLER SOM I DAG BARA BEVAKAS AV KOMMENTARER. Mätt i
 * bolag-ops skriver SEX vyer samma tre grenar för hand, ord för ord:
 * `if (error) ... if (loading || !data) ... annars innehållet`. Varje vy som
 * skriver dem själv kan skriva dem fel, och ingen vakt kan se skillnaden på
 * en vy som följer regeln och en som glömde den.
 *
 * ⛔ SIFFRAN STOD FÖRST SOM NIO, OCH DET VAR FEL. Nio vyer skriver
 * felbanderollen med orden "Kunde inte hämta", och den räkningen förväxlades
 * med hela formen. Fem har den rakt av (Tillgångar, Pension, Försäkringar,
 * Inkomster, Kostnader) och Översikt har den i en ternär med egen väntetext.
 * Rättelsen står kvar i stället för att skrivas över: en siffra som en gång
 * varit fel är värd att kunna känna igen nästa gång.
 *
 * ⛔ 1. FEL VINNER ÖVER LADDNING, aldrig tvärtom.
 *
 * Med flera läsningar kan felet komma medan en annan fortfarande hämtar. Låter
 * man laddningen vinna göms felet bakom en snurra som aldrig slutar snurra, och
 * användaren väntar på något som redan misslyckats.
 *
 * ⛔ 2. LADDNING SÄGER VAD DEN VÄNTAR PÅ.
 *
 * "Hämtar" utan objekt är samma text i tolv vyer, och när en av fem läsningar
 * hänger går det inte att se vilken. Därför är `loadingLabel` obligatorisk och
 * gissas inte fram ur rubriken.
 *
 * ⛔ 3. HÄMTAT MEN TOMT ÄR INTE HÄMTNING SOM PÅGÅR.
 *
 * Det här är det verkliga felet i den handskrivna varianten. `loading || !data`
 * betyder att en läsning som gick igenom men gav `null` ritar "Hämtar ..." för
 * ALLTID. Sidan säger att den arbetar när den har gett upp, och det är den
 * sortens fel ingen rapporterar som en bugg utan som att appen "hängde sig".
 *
 * Kontraktet säger att `read` ger `null` för "finns inte", och att det INTE är
 * ett fel. Alltså är det inte heller ett fel här, utan ett eget tillstånd med
 * egna ord: hämtningen gick, posten fanns inte.
 *
 * ⛔ BARNEN ÄR EN FUNKTION, och det är inte stil. Vore de en nod hade React
 * byggt dem innan komponenten hann välja gren, alltså skulle `data.totals`
 * kastat i precis det läge komponenten finns för. En funktion anropas först när
 * det finns data att anropa den med.
 */

/**
 * @template T
 * @param {object} props
 * @param {boolean} props.loading
 * @param {Error | null | undefined} [props.error]
 * @param {T | null | undefined} [props.data]
 *   ⛔ Utelämnas den görs INGEN tomhetskontroll, och regel 3 är då vyns eget
 *   ansvar. Det gäller vyer som läser flera listor och inte har ett enda värde
 *   att peka på.
 * @param {import("react").ReactNode} [props.header] Ritas i alla tillstånd, alltså även i felet.
 * @param {string} props.errorTitle Appens ord: "Kunde inte hämta tillgångarna".
 * @param {string} props.loadingLabel Appens ord: "Hämtar tillgångar".
 * @param {string} [props.missingTitle]
 * @param {(data: T) => import("react").ReactNode} props.children
 */
export function OpsDataView(props) {
  /* ⛔ HELA OBJEKTET OCH INTE EN DESTRUKTURERING, med flit. `data` får vara
     `null`, och `null` betyder något annat än "vyn skickade ingen data alls".
     En destrukturerad parameter gör de två omöjliga att skilja åt, och då hade
     varje vy som läser flera listor fått tomhetsbanderollen i ansiktet. */
  const { loading, error, header, errorTitle, loadingLabel, missingTitle = "Innehållet saknas", children } = props;
  if (typeof children !== "function") {
    throw new Error("OpsDataView: children måste vara en funktion (data) => innehåll. Se regeln om barnen.");
  }
  if (!errorTitle) throw new Error("OpsDataView: errorTitle krävs och gissas inte fram.");
  if (!loadingLabel) throw new Error("OpsDataView: loadingLabel krävs, annars går det inte att se vad som hänger.");

  if (error) {
    return (
      <>
        {header}
        <OpsBanner tone="danger" title={errorTitle}>
          {error.message}
        </OpsBanner>
      </>
    );
  }

  if (loading) {
    return (
      <>
        {header}
        <OpsEmpty title={loadingLabel} busy busyLabel={loadingLabel} />
      </>
    );
  }

  if ("data" in props && (props.data === null || props.data === undefined)) {
    return (
      <>
        {header}
        {/* ⛔ TOMHET OCH INTE EN BANDEROLL. Första försöket var en banderoll,
            och den valde mellan `danger` (röd för något som inte gick sönder)
            och `warning`, som i OpsBanner får `role="alert"` och alltså AVBRYTER
            skärmläsaren. Att posten inte finns är information, precis som
            OpsEmpty redan säger om sig själv, och det är den som har
            `role="status"` och en artig annonsering. */}
        <OpsEmpty title={missingTitle} description="Hämtningen gick igenom, men det kom inget innehåll tillbaka." />
      </>
    );
  }

  return (
    <>
      {header}
      {/* ⛔ Kontrollen ovan har redan uteslutit null och undefined NÄR `data`
          skickades in. Utelämnades den får barnen `undefined`, och då ska de
          inte läsa argumentet. Typen säger `T` för det vanliga fallet. */}
      {children(/** @type {any} */ (props.data))}
    </>
  );
}
