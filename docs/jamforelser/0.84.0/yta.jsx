/*
 * Ytorna för 0.84.0:s skärmbilder (#315, #309). Byggs mot en dist som skriptet anger, så att samma yta kan
 * fotograferas mot main (före) och mot grenen (efter). Se montage.mjs.
 */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

const G = "cps-ab";
const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];
const namnFor = (uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;

let samtalet = null;
function Skrivfalt() {
  const [k, setK] = useState(samtalet);
  if (!k) {
    (async () => {
      let t = new Date(2026, 9, 8, 9, 0).getTime();
      const s = Ops.createSamtalskalla({ kalla: Ops.createMemorySource({}), klocka: () => (t += 60000), bilagor: true, bilagaSamling: "bilagor" });
      const p = await s.oppnaPrivat({ groupId: G, uid: "anna", annan: "bo" });
      await s.skicka(p.id, { text: "Skicka kvittot när du har det.", av: "bo" });
      samtalet = { s, p };
      setK(samtalet);
    })();
  }
  return (
    <div data-yta="skrivfalt" className="flex h-[560px] min-h-0 flex-col bg-canvas">
      {k ? <Ops.OpsSamtal kalla={k.s} uid="anna" samtal={k.p} rubrik="Bo Lind" namnFor={namnFor} medlemmar={MEDLEMMAR} onTranscribe={async () => "text"} /> : <p>Laddar</p>}
    </div>
  );
}

function Form(p) {
  return <form id={p.formId} aria-label="Händelseformulär"><p className="text-etikett text-ink-muted">Formuläret ritas av appen.</p></form>;
}
function Oppna() {
  const oppna = Ops.useOppnaSkapa();
  return <button type="button" data-oppna-handelse="" onClick={() => oppna("handelse")}>Ny händelse</button>;
}
function NyHandelse() {
  return (
    <div data-yta="nyhandelse">
      <Ops.OpsAppShell
        brand="Ops"
        nav={[{ href: "/", label: "Start" }]}
        activeHref="/"
        grupper={{ lista: [{ id: G, namn: "CPS AB", roll: "agare" }], aktiv: G, onValj: () => {} }}
        skapa={{
          sparaEtikett: "Spara",
          lage: G,
          handelse: { form: Form, katalog: "handelsetyper", kalendrar: { gruppens: [], mina: [] } },
          kataloger: [{ id: "handelsetyper", kategorier: [{ id: "mote", namn: { sv: "Möte" }, ordning: 0 }] }],
        }}
      >
        <Oppna />
      </Ops.OpsAppShell>
    </div>
  );
}

function Kalendermeny() {
  return (
    <div data-yta="kalendermeny" className="h-[640px] bg-canvas p-3">
      <Ops.OpsCalendar
        ariaLabel="Kalender"
        entries={[{ id: "mote", date: "2026-10-12", title: "Styrelsemöte" }]}
        today={new Date(2026, 9, 8, 12)}
        monthsBack={0}
        monthsForward={0}
        kalendrar={[{ id: "privat", namn: "Privat", farg: 5, forvald: true }]}
        lagring={{ getItem: () => null, setItem: () => {} }}
      />
    </div>
  );
}

const yta = window.__yta;
createRoot(document.getElementById("root")).render(yta === "skrivfalt" ? <Skrivfalt /> : yta === "nyhandelse" ? <NyHandelse /> : <Kalendermeny />);
