import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

/*
 * Ytan för skärmbilden av tal i chatten (0.103.0, `scripts/chatt-tal-montage.mjs`): agentens privata samtal med två meddelanden, och
 * TALK:s inspelningsyta i skrivfältets plats medan orden hörs. En inspelare utan mikrofon och en igenkänning som skriver en mening ord
 * för ord, som webbläsaren hade gjort. Ingen tjänst anropas.
 */

const MENING = "Kan du flytta tandläkartiden till nästa tisdag efter lunch";
const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

const inspelare = {
  starta: () => Promise.resolve(),
  stoppa: () => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 4 }),
  kasta: () => {},
  niva: () => 0.45,
};
const igenkanning = {
  starta: ({ onText }) => {
    const ord = MENING.split(" ");
    ord.forEach((_, i) => setTimeout(() => onText(ord.slice(0, i + 1).join(" ")), 40 * (i + 1)));
  },
  stoppa: async () => MENING,
  kasta: () => {},
};

async function bygg() {
  let t = new Date(2026, 9, 14, 8, 30).getTime();
  const kalla = Ops.createMemorySource({});
  const s = Ops.createSamtalskalla({ kalla, klocka: () => (t += 60000) });
  const a = await s.oppnaPrivat({ groupId: "g1", uid: "anna", annan: "ops", slag: "agent" });
  await s.skicka(a.id, { text: "Vad har jag i kalendern i dag?", av: "anna" });
  await kalla.create(`samtal/${a.id}/meddelanden`, { text: "Styrelsemöte 10:00 och tandläkaren 15:30.", av: "ops", tid: (t += 60000) });
  return { s, id: a.id };
}

function App() {
  const [k, setK] = useState(/** @type {{ s: any, id: string } | null} */ (null));
  useEffect(() => {
    bygg().then(setK);
  }, []);
  if (!k) return <p>Laddar</p>;
  // I skalet, som i appen: chattens höjd räknar med bottenraden, och utan skalet hade bilden fått ett tomt band under ytan.
  return (
    <Ops.OpsAppShell brand="LIFE HUB" fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }} moduler={[]} activeHref="/meddelanden">
      <Ops.OpsMeddelanden kalla={k.s} uid="anna" groupId="g1" gruppNamn="Familjen" medlemmar={MEDLEMMAR} valt={k.id} onValj={() => {}} onTranscribe={async () => MENING} inspelare={inspelare} igenkanning={igenkanning} />
    </Ops.OpsAppShell>
  );
}

createRoot(/** @type {HTMLElement} */ (document.getElementById("root"))).render(<App />);
