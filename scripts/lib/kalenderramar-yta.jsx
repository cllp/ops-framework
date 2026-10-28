import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

/**
 * Ytan för mätningen av dagens ramar (0.151.0): `OpsCalendar` med tre kalendrar och dagar med noll, en, två och tre ramar, med och utan hörnbrickor. Allt är syntetiskt.
 * Läget kommer från `window.__prov.lage`: "tva" (Ram och Båda på alla tre kalendrar), "en" (bara Styrelsen har ram) och "gammal" (EN ram per dag, den första kalenderns:
 * så som 0.150.0 ritade, via appens egen `dagdekor.ram`), som `--bevisa` mäter mot och förväntar sig rött för.
 */

const KALENDRAR = [
  { id: "gruppen", namn: "Styrelsen", farg: 4, grupp: true, forvald: true },
  { id: "resor", namn: "Resor", farg: 1, grupp: true },
  { id: "mina", namn: "Privat", farg: 5 },
];
const kal = (id) => {
  const k = KALENDRAR.find((x) => x.id === id);
  return { id: k.id, namn: k.namn, farg: k.farg };
};
const p = (id, titel, datum, kalender) => ({ id, title: titel, date: datum, kalender: kal(kalender) });

const POSTER = [
  // Tre kalendrar samma dag: två ramar, de två första i listan.
  p("a12", "Styrelsemöte", "2026-10-12", "gruppen"),
  p("b12", "Resa", "2026-10-12", "resor"),
  p("c12", "Kaffe", "2026-10-12", "mina"),
  // Två kalendrar.
  p("a13", "Revision", "2026-10-13", "gruppen"),
  p("b13", "Hotell", "2026-10-13", "resor"),
  // En kalender: en ram, som förut.
  p("b14", "Lunch", "2026-10-14", "resor"),
  // Ingen ram (Privat har bara Händelser i läget "en"), ingen kalender med ram i läget "tva" har post den 15:e.
  // Hörnbrickor tillsammans med ramar.
  p("a16", "Möte", "2026-10-16", "gruppen"),
  p("a17", "Workshop", "2026-10-17", "gruppen"),
  p("b17", "Middag", "2026-10-17", "resor"),
];

const VISNINGAR = {
  tva: { gruppen: "bada", resor: "ram", mina: "ram" },
  en: { gruppen: "ram" },
  // 0.150.0: kalendrarna visar händelser, och ramen kommer från appens dagdekor (en ram, den första kalenderns).
  gammal: {},
};
const FORSTA_RAM = { "2026-10-12": 4, "2026-10-13": 4, "2026-10-14": 1, "2026-10-16": 4, "2026-10-17": 4 };
const BRICKOR = { "2026-10-16": { borta: { antal: 2 }, lager: { antal: 1 } }, "2026-10-17": { borta: { antal: 3 } } };

function Yta() {
  const prov = window.__prov || { lage: "tva" };
  const [lagring] = useState(() => {
    const v = new Map([["ops-kalender-synlighet:p:g", JSON.stringify({ v: 1, syns: {}, visning: VISNINGAR[prov.lage] })]]);
    return { getItem: (n) => (v.has(n) ? v.get(n) : null), setItem: (n, x) => v.set(n, x) };
  });
  const dagdekor = (dag) => {
    const dekor = { ...(BRICKOR[dag] || {}) };
    if (prov.lage === "gammal" && FORSTA_RAM[dag]) dekor.ram = FORSTA_RAM[dag];
    return Object.keys(dekor).length ? dekor : undefined;
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-3 py-3">
      <Ops.OpsCalendar
        ariaLabel="Kalender"
        today={new Date(2026, 9, 7, 12)}
        monthsBack={0}
        monthsForward={0}
        entries={POSTER}
        kalendrar={KALENDRAR}
        kalenderMinne="p:g"
        lagring={lagring}
        dagdekor={dagdekor}
        onOppnaHandelse={() => {}}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
window.__redo = true;
