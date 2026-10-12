/**
 * Sidan `check-brand` mäter i en riktig webbläsare. Den är INTE en app och exporteras inte: den ritar de fyra ytor en
 * instans brandfil ska kunna ändra (appens rubrik, en knapp, märket, en publik sida) med RIKTIG CSS.
 *
 * Allt hämtas ur ramverkets `dist` som `Ops`, med `Ops.X` och inte `import { X }`, av samma skäl som i
 * `skalyta-entry.jsx`: en komponent som saknas i en äldre `dist` blir `undefined` och provet blir rött på rätt sak.
 */
import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

const { OpsViewHeader, OpsButton, OpsBrand, OpsPublikHjalte, OpsPublikAvsnitt, OpsPublikText, OpsSidoyta } = Ops;

function Saknas({ namn }) {
  return <span data-saknas={namn}>{namn} saknas</span>;
}

function Sida() {
  return (
    <div className="bg-canvas p-4 text-ink font-sans">
      <section data-prov="app">
        {OpsViewHeader ? <OpsViewHeader title="Inställningar" /> : <Saknas namn="OpsViewHeader" />}
      </section>
      <section data-prov="knapp">
        {OpsButton ? <OpsButton variant="primary">Spara</OpsButton> : <Saknas namn="OpsButton" />}
      </section>
      <section data-prov="marke" className="w-60">
        {OpsBrand ? <OpsBrand namn="NORDLYS HUB" undertext="Kundens grupp" /> : <Saknas namn="OpsBrand" />}
      </section>
      <section data-prov="brodtext">
        <p className="text-brod">Brödtext i appen.</p>
      </section>
      <section data-prov="sidoyta">
        {OpsSidoyta ? <OpsSidoyta><p className="text-brod">Innehållsytan.</p></OpsSidoyta> : <Saknas namn="OpsSidoyta" />}
      </section>
      <section data-prov="publik">
        {OpsPublikHjalte ? (
          <OpsPublikHjalte eyebrow="Om oss" title="Ett lugnare sätt att samla gruppen" ingress="Allt ni behöver på ett ställe, och inget mer.">
            <OpsButton variant="primary">Kom igång</OpsButton>
          </OpsPublikHjalte>
        ) : (
          <Saknas namn="OpsPublikHjalte" />
        )}
        {OpsPublikAvsnitt ? (
          <OpsPublikAvsnitt eyebrow="Så funkar det" title="En idé per block" ingress="Varje avsnitt har en rubrik och ett stycke.">
            <OpsPublikText>Löpande text i läsbredd.</OpsPublikText>
          </OpsPublikAvsnitt>
        ) : (
          <Saknas namn="OpsPublikAvsnitt" />
        )}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Sida />);
window.__redo = true;
