import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Ops from "OPS_DIST";

/*
 * Ytan för skärmbilderna av TALK som pratar tillbaka (cllp/lifehub.app#870 skiva 4, CP 2026-11-18: vågikonen och högtalarknappen),
 * `scripts/talk-rost-montage.mjs`. Skalet med en agent (`talk.onAgent` som ger en `Talkrost`) och agentens chatt öppen. En inspelare utan
 * mikrofon, en igenkänning som skriver en mening, och en uppläsning som inte säger något förrän bilden är tagen. Ingen tjänst anropas.
 */

const MENING = "Hur långt är det till Visby med färjan";
const SVAR = "Färjan från Nynäshamn tar ungefär tre timmar och femton minuter. Nästa avgång i morgon är klockan nio.";
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
let sagt = "";
const igenkanning = {
  starta: ({ onText }) => {
    const ord = MENING.split(" ");
    ord.forEach((_, i) =>
      setTimeout(() => {
        sagt = ord.slice(0, i + 1).join(" ");
        onText(sagt);
      }, 30 * (i + 1)),
    );
  },
  stoppa: async () => sagt,
  kasta: () => {},
};
// Uppläsningen pågår tills sidan är fotograferad: bilden ska visa läget "Läser upp…".
const upplasning = { las: () => new Promise(() => {}), stoppa: () => {}, forbered: () => {} };
/** @returns {any} */
const rost = () => ({ svar: () => new Promise((r) => setTimeout(() => r(SVAR), 150)), vidare: async () => rost() });

async function bygg() {
  let t = new Date(2026, 10, 18, 8, 30).getTime();
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
  return (
    <Ops.OpsAppShell
      brand="LIFE HUB"
      fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }}
      moduler={[]}
      activeHref="/meddelanden"
      talk={{ inspelare, igenkanning, upplasning, onTalk: async () => {}, onAgent: async () => rost(), onMeddelande: () => {} }}
    >
      <Ops.OpsMeddelanden kalla={k.s} uid="anna" groupId="g1" gruppNamn="Familjen" medlemmar={MEDLEMMAR} valt={k.id} onValj={() => {}} />
    </Ops.OpsAppShell>
  );
}

createRoot(/** @type {HTMLElement} */ (document.getElementById("root"))).render(<App />);
