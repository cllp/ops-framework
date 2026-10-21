import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

/**
 * Ytan för montagen av kalenderlistan (0.134.0, cllp/lifehub.app#402): `OpsCalendar` med fyra kalendrar, som i LifeHub efter ompinningen,
 * och en händelse från Apple utan eget `handelseId`. Allt är syntetiskt. Läget kommer från `window.__kalender`.
 */

const KALENDRAR = [
  { id: "gruppen", namn: "Styrelsen", farg: 4, grupp: true, forvald: true },
  { id: "resor", namn: "Resor", farg: 1, grupp: true },
  { id: "mina", namn: "Barnveckor", farg: 5 },
  { id: "apple", namn: "Apple Calendar", farg: 2, sektion: "Från Mitt konto", marke: "Apple, skrivskyddad" },
  { id: "google", namn: "Google Calendar", farg: 3, sektion: "Från Mitt konto", marke: "Google, skrivskyddad" },
  { id: "arenden", namn: "Ärenden", farg: 6, sektion: "Ärenden", marke: "Från appen", avFranStart: true },
];
const SEKTIONER = [
  { namn: "Gruppens kalendrar" },
  { namn: "Mina kalendrar", tomText: "Du har inga egna kalendrar ännu." },
  { namn: "Från Mitt konto", tomText: "Du har inga kalendrar från Mitt konto ännu." },
  { namn: "Ärenden" },
];
const kal = (id) => {
  const k = KALENDRAR.find((x) => x.id === id);
  return { id: k.id, namn: k.namn, farg: k.farg };
};
const apple = (id, titel, datum, extra = {}) => ({
  id,
  title: titel,
  date: datum,
  kalender: kal("apple"),
  extern: { kalla: "Från Apple, ändras i Apple", ...extra },
});

const POSTER = [
  { id: "mote", date: "2026-10-12", title: "Styrelsemöte", typ: "mote" },
  { id: "resa", date: "2026-10-14", endDate: "2026-10-16", allDay: true, title: "Resa till Malmö", kalender: kal("resor") },
  { id: "barn", date: "2026-10-19", endDate: "2026-10-23", allDay: true, title: "Barnvecka", kalender: kal("mina") },
  apple("tand", "Tandläkare", "2026-10-12", { tid: "09:30", slutTid: "10:15", plats: "Tandvården, Strandgatan 4, Visby", beskrivning: "Ta med remissen från vårdcentralen. Kom tio minuter före." }),
  apple("middag", "Middag hos Anna", "2026-10-15", { tid: "18:30", slutTid: "21:00" }),
  apple("lunch", "Lunch med Erik", "2026-10-21", { tid: "12:00", slutTid: "13:00" }),
  { id: "fakt", date: "2026-10-26", title: "Skicka fakturan", kalender: kal("arenden") },
  { id: "google1", date: "2026-10-27", title: "Föräldramöte", kalender: kal("google") },
];
const MAL = [
  { id: "gruppen", namn: "Styrelsen", farg: 4 },
  { id: "mina", namn: "Barnveckor", farg: 5 },
];

function minne() {
  const v = new Map();
  return { getItem: (n) => (v.has(n) ? v.get(n) : null), setItem: (n, x) => v.set(n, x) };
}

function Yta() {
  const lage = window.__kalender;
  const [lagring] = useState(minne);
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-3 py-3">
      <Ops.OpsCalendar
        ariaLabel="Kalender"
        today={new Date(2026, 9, 7, 12)}
        monthsBack={0}
        monthsForward={0}
        entries={POSTER}
        kalendrar={KALENDRAR}
        kalendersektioner={SEKTIONER}
        kalenderMinne="person:grupp"
        lagring={lagring}
        typer={[{ id: "mote", namn: "Möte" }]}
        onHanteraKalendrar={() => {}}
        kopieraTill={MAL}
        onKopiera={() => {}}
        onOppnaHandelse={() => {}}
        onSkapa={() => {}}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
