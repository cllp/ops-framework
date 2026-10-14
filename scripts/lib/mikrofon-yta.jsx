import { createRoot } from "react-dom/client";
import { Inbox } from "lucide-react";
import * as Ops from "OPS_DIST";

/*
 * Ytan för skärmbilden av bottenraden med mikrofonen (0.103.0, `scripts/mikrofon-montage.mjs`). Skalet med `talk`, `skapa` och
 * en grupp, och Inkorgen i huvudet med `skapa="arende"`: samma rader som en app med TALK har på telefonen. Händelseformuläret
 * visar dagen det fick, så att bilden av långtrycket på Kalender visar dagens datum som formuläret faktiskt får.
 */

const inspelare = {
  starta: () => Promise.resolve(),
  stoppa: () => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 3 }),
  kasta: () => {},
  niva: () => 0.4,
};

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };

/** @param {{ datum?: string | null, formId?: string }} p */
function Handelseform({ datum, formId }) {
  return (
    <form id={formId} className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
      <Ops.OpsField label="Rubrik">
        <Ops.OpsInput value="" onChange={() => {}} placeholder="Vad händer?" />
      </Ops.OpsField>
      <Ops.OpsField label="Dag">
        <Ops.OpsInput value={datum ?? ""} readOnly />
      </Ops.OpsField>
    </form>
  );
}

const navigera = (/** @type {string} */ _href, /** @type {any} */ e) => e?.preventDefault?.();

function App() {
  return (
    <Ops.OpsAppShell
      brand="LIFE HUB"
      fasta={fasta}
      moduler={[]}
      activeHref="/"
      onNavigate={navigera}
      grupper={{ lista: [{ id: "g1", namn: "Familjen", roll: "agare" }], aktiv: "g1", onValj: () => {} }}
      actions={<Ops.OpsIconLink href="/inkorg" icon={<Inbox size={24} />} label="Inkorg" badge={2} skapa="arende" onNavigate={navigera} />}
      talk={{ inspelare, onTalk: async () => {} }}
      skapa={{
        lage: "g1",
        handelse: { form: Handelseform, katalog: null },
        arende: ({ formId }) => <form id={formId} />,
        grupp: ({ formId }) => <form id={formId} />,
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
