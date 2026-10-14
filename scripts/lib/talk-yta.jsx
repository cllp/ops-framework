import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

/*
 * Ytan för skärmbilden av TALK-fältets samtal (0.103.0, `scripts/talk-montage.mjs`). Skalet med `talk` och `skapa`, en inspelare
 * utan mikrofon och en igenkänning som hör en mening per omgång. Agentens kvitton är de appen hade svarat med.
 */

const SAGT = [
  "Boka rep med bandet nästa vecka. Ta med noterna till den nya låten.",
  "torsdag klockan sju i replokalen",
];
const KVITTON = [
  "Vilken dag passar? Torsdag eller fredag kväll?",
  "Inlagt: Rep, torsdag 22 okt 19:00 i replokalen",
];

let omgang = 0;
const inspelare = {
  starta: () => Promise.resolve(),
  stoppa: () => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 3 }),
  kasta: () => {},
  niva: () => 0.4,
};
const igenkanning = {
  starta: ({ onText }) => onText(SAGT[Math.min(omgang, SAGT.length - 1)]),
  stoppa: async () => SAGT[Math.min(omgang, SAGT.length - 1)],
  kasta: () => {},
};

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };

function App() {
  return (
    <Ops.OpsAppShell
      brand="LIFE HUB"
      fasta={fasta}
      moduler={[]}
      activeHref="/"
      talk={{
        inspelare,
        igenkanning,
        skickarText: "Agenten arbetar…",
        onTalk: async () => ({ kvitto: KVITTON[Math.min(omgang++, KVITTON.length - 1)], angra: async () => {} }),
        onFortsatt: () => {},
      }}
      skapa={{
        lage: "g1",
        handelse: { form: () => <form />, katalog: null },
        arende: ({ formId }) => <form id={formId} />,
      }}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6">
        <h1 className="m-0 text-lg font-medium text-ink">Idag</h1>
        <p className="m-0 text-brod text-ink-secondary">Tisdag 14 oktober</p>
        <div className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Styrelsemöte 10:00</div>
        <div className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Ring revisorn</div>
        <div className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Lämna bilen på service</div>
      </div>
    </Ops.OpsAppShell>
  );
}

createRoot(/** @type {HTMLElement} */ (document.getElementById("root"))).render(<App />);
