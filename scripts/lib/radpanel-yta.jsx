import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

/**
 * Ytan för montagen av "en rad, en panel" (0.145.0, cllp/ops-framework#446): `OpsCalendar` och `OpsEventList` med ett manifest (`radkallor`) för tre källor,
 * som lifehub.app skulle skicka dem. Allt är syntetiskt. Vilken yta som ritas kommer från `window.__radpanel` ("kalender" eller "idag").
 */

const PAMINNELSE = (id, titel, datum) => ({ id: `paminnelse:${id}`, date: datum, title: titel, not: "Påminnelse", slag: 2, slagLabel: "Påminnelse" });

const POSTER = [
  PAMINNELSE("attest", "Attest större leverantörsfakturor", "2026-10-28"),
  PAMINNELSE("bankrader", "Kolla omatchade bankrader", "2026-10-28"),
  {
    id: "ekonomi:kundfaktura:114",
    date: "2026-10-30",
    title: "Kundfaktura 114 till Visby Kakel",
    not: "Faktura",
    details: <p className="m-0">Förfaller 30 okt. Belopp 12 400 kr inklusive moms. Skickad 30 sep.</p>,
  },
];

const HANDELSER = [
  { id: "paminnelse:attest", title: "Attest större leverantörsfakturor", daysLeft: 3, when: "Om 3 dagar", deadline: "Senast 28 okt", kind: "Påminnelse" },
  { id: "ekonomi:kundfaktura:114", title: "Kundfaktura 114 till Visby Kakel", daysLeft: 5, when: "Om 5 dagar", deadline: "Förfaller 30 okt", kind: "Faktura", details: <p className="m-0">Belopp 12 400 kr inklusive moms.</p> },
  { id: "uppgift-1", title: "Rad utan källa, som förut", daysLeft: 6, when: "Om 6 dagar" },
];

const RADKALLOR = {
  paminnelse: {
    etikett: "Påminnelse",
    atgarder: () => [
      { id: "klar", etikett: "Klar", onClick: () => {} },
      { id: "rutin", etikett: "Öppna rutinen", href: "#rutin" },
    ],
    dela: () => ({ skal: "Påminnelser delas inte ännu.", istallet: "Skriv en händelse om andra ska se den." }),
  },
  ekonomi: {
    etikett: "Ekonomi",
    atgarder: () => [{ id: "oppna", etikett: "Öppna i Ekonomi", href: "#ekonomi" }],
    dela: () => ({ onClick: () => {} }),
  },
};

function minne() {
  const v = new Map();
  return { getItem: (n) => (v.has(n) ? v.get(n) : null), setItem: (n, x) => v.set(n, x) };
}

function Yta() {
  const lage = window.__radpanel;
  const [lagring] = useState(minne);
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-3 py-3">
      {lage === "idag" ? (
        <Ops.OpsEventList events={HANDELSER} radkallor={RADKALLOR} ariaLabel="Idag" />
      ) : (
        <Ops.OpsCalendar ariaLabel="Kalender" today={new Date(2026, 9, 25, 12)} monthsBack={0} monthsForward={0} entries={POSTER} lagring={lagring} radkallor={RADKALLOR} onSkapa={() => {}} />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
