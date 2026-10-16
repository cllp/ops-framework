import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

// Översikten i skalet (0.112.0, cllp/lifehub.app#319). Samma skal, i översikten och i en grupp, med en växlare som byter läge.
const lista = [
  { id: "mitt", namn: "Mitt projekt", roll: "agare", ikon: "user", farg: "blue" },
  { id: "bolag", namn: "Staiger AB", roll: "agare", ikon: "briefcase", farg: "green" },
  { id: "familj", namn: "Familjen", roll: "medlem", ikon: "heart", farg: "orange" },
];
const fasta = { idag: { href: "/idag" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };

function Yta() {
  const [lage, setLage] = useState(window.__oversikt === "grupp" ? "bolag" : "oversikt");
  const iOversikt = lage === "oversikt";
  return (
    <Ops.OpsAppShell
      brand="LIFE HUB"
      fasta={fasta}
      activeHref={iOversikt ? "/" : "/idag"}
      onNavigate={(_h, e) => e.preventDefault()}
      actions={<Ops.OpsIconLink href="/inkorg" label="Inkorg" icon={<Ops.OpsIdentity name="I" seed="inkorg" size="sm" />} />}
      anvandare={<Ops.OpsIconLink href="/profil" label="Min profil" icon={<Ops.OpsIdentity name="Claes-Philip Staiger" seed="cp" size="sm" />} />}
      meny={{ sektioner: [], onLoggaUt: () => {} }}
      grupper={{ lista, aktiv: iOversikt ? "mitt" : lage, onValj: setLage, oversikt: { aktiv: iOversikt, onValj: () => setLage("oversikt") } }}
    >
      <Ops.OpsView>
        <Ops.OpsViewHeader title={iOversikt ? "Översikt" : "Idag"} description={iOversikt ? "Ditt läge i alla grupper." : "Staiger AB"} />
        <div data-oversikt-yta="" />
      </Ops.OpsView>
    </Ops.OpsAppShell>
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
