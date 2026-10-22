import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

// Hemikonen i huvudet (0.138.0). Skalet med ett LÅNGT gruppnamn och MÅNGA åtgärder (sex), så att huvudet är så fullt det kan bli.
// window.__lage: "grupp" (hemikon + åtgärder), "oversikt", "utanhem" (ingen oversikt-prop, som före 0.138.0), "fa" (tre åtgärder).
const lista = [
  { id: "mitt", namn: "Mitt projekt", roll: "agare", ikon: "user", farg: "blue" },
  { id: "lang", namn: "Claes Philip Staiger Konsulting Aktiebolag", roll: "agare", ikon: "briefcase", farg: "green" },
  { id: "familj", namn: "Familjen", roll: "medlem", ikon: "heart", farg: "orange" },
];
const fasta = { idag: { href: "/idag" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const ALLA = [
  ["/tema", "Tema"],
  ["/inkorg", "Inkorg"],
  ["/sok", "Sök"],
  ["/fraga", "Fråga"],
  ["/bibliotek", "Bibliotek"],
  ["/chatt", "Meddelanden"],
];

function Yta() {
  const lage = window.__lage;
  const [aktiv, setAktiv] = useState(lage === "oversikt" ? "mitt" : "lang");
  const [iOversikt, setIOversikt] = useState(lage === "oversikt");
  const antal = lage === "fa" ? 3 : 6;
  const oversikt = lage === "utanhem" ? undefined : { aktiv: iOversikt, onValj: () => setIOversikt(true) };
  return (
    <Ops.OpsAppShell
      brand="LIFE HUB"
      fasta={fasta}
      activeHref="/idag"
      onNavigate={(_h, e) => e.preventDefault()}
      actions={<>{ALLA.slice(0, antal).map(([href, label]) => <Ops.OpsIconLink key={href} href={href} label={label} icon={<Ops.OpsIdentity name={label} seed={href} size="sm" />} />)}</>}
      anvandare={<Ops.OpsIconLink href="/profil" label="Min profil" icon={<Ops.OpsIdentity name="Claes-Philip Staiger" seed="cp" size="sm" />} />}
      meny={{ sektioner: [], onLoggaUt: () => {} }}
      grupper={{ lista, aktiv, onValj: (id) => { setAktiv(id); setIOversikt(false); }, ...(oversikt ? { oversikt } : {}) }}
    >
      <Ops.OpsView>
        <Ops.OpsViewHeader title={iOversikt ? "Översikt" : "Idag"} description={iOversikt ? "Ditt läge i alla grupper." : (lista.find((g) => g.id === aktiv)?.namn ?? "")} />
        <div data-hemikon-yta="" />
      </Ops.OpsView>
    </Ops.OpsAppShell>
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
