/**
 * Mätytan för `check-typografimatning.mjs` (0.136.0): samma element som SessionStudio har på sina inställnings-, formulär-
 * och listytor, ritade av ramverkets egna komponenter. Texterna matchar `typografi.element.lista` i
 * `tokens/sessionstudio-profil.json`, som anger vad SessionStudio ritar för dem.
 *
 * ⛔ KOMPONENTERNA ÄR DE RIKTIGA (paketets dist), INTE KOPIOR. En yta som ritade egna element med rätt klasser hade bevisat
 * att klasserna är rätt, aldrig att komponenten använder dem.
 */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

const Ikon = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" /></svg>;

function App() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [flik, setFlik] = useState("alla");
  const [vald, setVald] = useState(null);
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <Ops.OpsViewHeader title="API-nycklar" description="Låt ett annat program läsa och lägga saker i gruppen." />
      <div className="mt-6 flex flex-col gap-6">
        <div>
          <Ops.OpsSectionLabel>Påminnelser</Ops.OpsSectionLabel>
          <Ops.OpsSwitch label="Slå på påminnelser" hint="Beskrivning under raden." checked={a} onChange={setA} />
        </div>
        <Ops.OpsField label="Namn" hint="Varje anrop skickas som POST med nyckeln i rubriken Authorization.">
          <Ops.OpsInput value="Mitt skript" onChange={() => {}} />
        </Ops.OpsField>
        <div className="flex flex-col gap-1">
          <Ops.OpsCheckbox label="Läsa kommande händelser" hint="Ger läsrätt till kalendern." checked={b} onChange={setB} />
          <Ops.OpsCheckbox label="Skriva i gruppchatten" checked={!b} onChange={() => {}} />
        </div>
        <div className="flex gap-2"><Ops.OpsButton variant="primary">Skapa nyckel</Ops.OpsButton><Ops.OpsButton size="sm" variant="primary">Liten</Ops.OpsButton></div>
        <Ops.OpsTabs ariaLabel="Typ" value={flik} onChange={setFlik} tabs={[{ id: "alla", label: "Alla" }, { id: "latar", label: "Låtar" }]}>
          <Ops.OpsTabPanel id="alla"><span /></Ops.OpsTabPanel><Ops.OpsTabPanel id="latar"><span /></Ops.OpsTabPanel>
        </Ops.OpsTabs>
        <Ops.OpsBanner tone="info" title="Nyckeln visas en gång">Kopiera den nu, den går inte att läsa igen.</Ops.OpsBanner>
        <Ops.OpsCard><div className="p-4"><p className="m-0 text-etikett">Kortets text</p></div></Ops.OpsCard>
        <Ops.OpsEmpty title="Inga nycklar ännu" description="Skapa den första nyckeln ovan." />
        <Ops.OpsInstallningar
          sektioner={[
            { id: "handelsetyper", rubrik: "Händelsetyper", beskrivning: "Orden och färgerna för händelserna i kalendern.", antal: 4, ikon: <Ikon />, innehall: <p>Innehåll</p> },
            { id: "notiser", rubrik: "Notiser", beskrivning: "Slå på påminnelser som notiser på den här enheten.", ikon: <Ikon />, innehall: <p>Innehåll</p> },
          ]}
          vald={vald}
          onValj={setVald}
          rubrik="Inställningar"
        />
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
