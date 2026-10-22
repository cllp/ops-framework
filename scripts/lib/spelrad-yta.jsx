import { createRoot } from "react-dom/client";
import { Inbox } from "lucide-react";
import * as Ops from "OPS_DIST";

/*
 * Ytan för skärmbilden av spelraden mot mikrofonknappen (cllp/lifehub.app#417, `scripts/spelrad-montage.mjs`). Skalet med TALK i
 * bottenraden, en spelknapp i ytan och skalets riktiga spelare. Ljudet är en tyst WAV: spelraden ritas som i en app, med ett spår.
 */

function stumWav() {
  const antal = 800;
  const buf = new ArrayBuffer(44 + antal * 2);
  const v = new DataView(buf);
  const text = (/** @type {number} */ o, /** @type {string} */ t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF"); v.setUint32(4, 36 + antal * 2, true); text(8, "WAVE"); text(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, "data"); v.setUint32(40, antal * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
const SPAR = { id: "ide", namn: "Idé om bolaget", src: stumWav(), durationMs: 800 };

const inspelare = {
  starta: () => Promise.resolve(),
  stoppa: () => Promise.resolve({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 3 }),
  kasta: () => {},
  niva: () => 0.4,
};
const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const navigera = (/** @type {string} */ _href, /** @type {any} */ e) => e?.preventDefault?.();

function App() {
  return (
    <Ops.OpsAppShell
      brand="LIFE HUB"
      fasta={fasta}
      moduler={[]}
      activeHref="/"
      onNavigate={navigera}
      actions={<Ops.OpsIconLink href="/inkorg" icon={<Inbox size={24} />} label="Inkorg" badge={2} onNavigate={navigera} />}
      talk={{ inspelare, onTalk: async () => {} }}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6">
        <h1 className="m-0 text-lg font-medium text-ink">Idag</h1>
        <div className="flex items-center justify-between rounded-2xl border border-line bg-raised p-4 text-brod text-ink">
          <span>Idé om bolaget</span>
          <Ops.OpsSpelaKnapp spar={SPAR} />
        </div>
        <div className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Styrelsemöte 10:00</div>
        <div className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Ring revisorn</div>
        <div className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Lämna bilen på service</div>
        <div className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Boka tandläkaren</div>
        <div className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Skicka fakturan</div>
        <div className="rounded-2xl border border-line bg-raised p-4 text-brod text-ink">Planera veckan</div>
      </div>
    </Ops.OpsAppShell>
  );
}

createRoot(/** @type {HTMLElement} */ (document.getElementById("root"))).render(<App />);
