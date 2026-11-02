import { useState } from "react";
import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

/*
 * Ytan för mätningen och skärmbilderna av den flytande Skapa-knappen (ej utgivet, `scripts/flytande-skapa-montage.mjs`, cllp/lifehub.app#582).
 * Skalet med `talk`, `skapa` och `flytandeSkapa={["/", "/kalender"]}`: Hub är en vy där appen INTE slagit på knappen. Innehållet är
 * långt nog att rulla, så att mätningen kan prova att sista kortet går att få fram ovanför knappen och att knappen står kvar vid rullning.
 */

const inspelare = {
  starta: () => Promise.resolve(),
  stoppa: () => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 3 }),
  kasta: () => {},
  niva: () => 0.4,
};
const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };

function App() {
  const [href, setHref] = useState("/");
  return (
    <Ops.OpsAppShell
      brand="LIFE HUB"
      fasta={fasta}
      moduler={[]}
      activeHref={href}
      onNavigate={(/** @type {string} */ h, /** @type {any} */ e) => {
        e?.preventDefault?.();
        setHref(h);
      }}
      grupper={{ lista: [{ id: "g1", namn: "Familjen", roll: "agare" }], aktiv: "g1", onValj: () => {} }}
      talk={{ inspelare, onTalk: async () => {} }}
      skapa={{ lage: "g1", handelse: { form: ({ formId }) => <form id={formId} />, katalog: null }, arende: ({ formId }) => <form id={formId} /> }}
      flytandeSkapa={["/", "/kalender"]}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6">
        <h1 className="m-0 text-lg font-medium text-ink">{href === "/hub" ? "Hub" : "Idag"}</h1>
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} data-kort={i} className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">
            {`Rad ${i + 1}`}
          </div>
        ))}
        <div data-sista-kort="" className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Sista raden</div>
      </div>
    </Ops.OpsAppShell>
  );
}

createRoot(/** @type {HTMLElement} */ (document.getElementById("root"))).render(<App />);
