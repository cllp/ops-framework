import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

/**
 * Ytan för skärmbilderna av årsvyn (0.237.0, cllp/lifehub.app#874): `OpsCalendar arsvy` med tre kalendrar, en per sak, som CP valde 2026-11-17.
 * Allt är syntetiskt: barnveckor varannan vecka, skollov och uthyrning, plus ett möte som inte blir band.
 */

const KALENDRAR = [
  { id: "barn", namn: "Barnen hos mig", farg: 2, forvald: true },
  { id: "lov", namn: "Skollov", farg: 4 },
  { id: "hyra", namn: "Uthyrning", farg: 6 },
];
const kal = (id) => {
  const k = KALENDRAR.find((x) => x.id === id);
  return { id: k.id, namn: k.namn, farg: k.farg };
};
const POSTER = [];
// Barnveckor: varannan vecka, måndag till söndag, hela året.
for (let v = 0; v < 52; v += 2) {
  const fran = new Date(2027, 0, 4 + v * 7);
  const till = new Date(2027, 0, 10 + v * 7);
  const k = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  POSTER.push({ id: `b${v}`, title: "Barnen", date: k(fran), endDate: k(till), kalender: kal("barn") });
}
POSTER.push(
  { id: "sport", title: "Sportlov", date: "2027-02-22", endDate: "2027-02-28", kalender: kal("lov") },
  { id: "pask", title: "Påsklov", date: "2027-03-29", endDate: "2027-04-02", kalender: kal("lov") },
  { id: "sommar", title: "Sommarlov", date: "2027-06-11", endDate: "2027-08-17", kalender: kal("lov") },
  { id: "host", title: "Höstlov", date: "2027-11-01", endDate: "2027-11-05", kalender: kal("lov") },
  { id: "jul", title: "Jullov", date: "2027-12-20", endDate: "2027-12-31", kalender: kal("lov") },
  { id: "h1", title: "Hyrt", date: "2027-07-05", endDate: "2027-07-18", kalender: kal("hyra") },
  { id: "h2", title: "Hyrt", date: "2027-08-02", endDate: "2027-08-08", kalender: kal("hyra") },
  { id: "h3", title: "Hyrt", date: "2027-04-14", allDay: true, kalender: kal("hyra") },
  { id: "m1", title: "Möte", date: "2027-03-03", time: "10:00", kalender: kal("barn") },
);

function Yta() {
  const [lagring] = useState(() => {
    const v = new Map();
    return { getItem: (n) => (v.has(n) ? v.get(n) : null), setItem: (n, x) => v.set(n, x) };
  });
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-3 py-3">
      <Ops.OpsCalendar ariaLabel="Kalender" today={new Date(2027, 2, 15, 12)} monthsBack={0} monthsForward={1} entries={POSTER} kalendrar={KALENDRAR} kalenderMinne="p:g" lagring={lagring} arsvy onOppnaHandelse={() => {}} />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
window.__redo = true;
