/**
 * Sidan `check-skalyta` mäter i en riktig webbläsare. Den är INTE en app och
 * exporteras inte: den finns för att skalet, menyn och inställningsvyn ska
 * ritas med RIKTIG CSS, som jsdom aldrig gör.
 *
 * Scenariot väljs med `window.__skal` (satt av vakten före sidan laddas).
 * Allt hämtas ur ramverkets `dist` som `Ops`, med `Ops.X` och inte `import { X }`:
 * en komponent som inte finns i den byggda versionen (t.ex. `OpsHub` i 0.29)
 * blir då `undefined` och scenariot hoppar över sin del, i stället för att hela
 * bygget dör. Så kan SAMMA vakt köras mot en äldre `dist` och visa sig röd.
 */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";
import { Calendar, CalendarDays, Inbox, LayoutGrid, Settings, Wallet } from "lucide-react";

const { OpsAppShell, OpsIconLink, OpsIdentity, OpsKatalogInstallning } = Ops;

const IKON = 20;
const nav = [
  { href: "/", label: "Händelser", icon: <Calendar size={IKON} /> },
  { href: "/oversikt", label: "Översikt", icon: <LayoutGrid size={IKON} /> },
  { href: "/ekonomi", label: "Ekonomi", icon: <Wallet size={IKON} />, children: [{ href: "/inkomster", label: "Inkomster" }] },
];
const moduler = [
  { href: "/oversikt", label: "Översikt", icon: <LayoutGrid size={IKON} /> },
  { href: "/ekonomi", label: "Ekonomi", icon: <Wallet size={IKON} />, children: [{ href: "/inkomster", label: "Inkomster" }, { href: "/kostnader", label: "Kostnader" }] },
];

const aktivitetsvy = <p>Aktivitetslistan</p>;
const meny = {
  sektioner: [
    [
      { key: "aktivitet", etikett: "Aktivitet", ikon: <Settings size={16} />, undervy: aktivitetsvy },
      { key: "notiser", etikett: "Notiser", ikon: <Inbox size={16} />, onClick: () => {} },
    ],
    [{ key: "installningar", etikett: "Inställningar", ikon: <Settings size={16} />, onClick: () => {} }],
  ],
  app: [{ href: "/appsida", label: "Appens egen sida", icon: <Settings size={16} /> }],
  onLoggaUt: () => {},
  appVersion: "app v1",
};

/** Kategorier med svenska sammansatta namn: långa ord utan blanksteg är normalfallet, inte ett hörnfall. */
const kategorier = [
  { id: "a", namn: { sv: "Leverantörsfakturaattesteringsunderlagsgranskning" }, farg: 1, ikon: "wallet", fas: "aktiv", ordning: 0, texter: {} },
  { id: "b", namn: { sv: "Kostnadsersättningsgranskningsärenden" }, farg: 2, ikon: "inbox", fas: "klar", ordning: 1, texter: {} },
  { id: "c", namn: { sv: "Övrigt" }, farg: 3, ikon: "wallet", fas: "aktiv", ordning: 2, texter: {} },
];

function Skal({ children, extra = {} }) {
  const [aktiv] = useState("/");
  return (
    <OpsAppShell
      brand="Bolag Ops"
      nav={nav}
      activeHref={aktiv}
      actions={<OpsIconLink href="/inkorg" icon={<Inbox size={IKON} />} label="Inkorg" badge={3} />}
      anvandare={<OpsIconLink avatar href="/profil" label="Min profil" icon={<OpsIdentity name="Claes Philip" seed="u1" size="md" />} />}
      skapa={{ handelse: <p>Formulär</p> }}
      meny={meny}
      {...extra}
    >
      {children}
    </OpsAppShell>
  );
}

function Scen() {
  const s = window.__skal;
  if (s === "fasta") {
    return (
      <OpsAppShell
        brand="Bolag Ops"
        fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }}
        moduler={moduler}
        activeHref="/"
        actions={<OpsIconLink href="/inkorg" icon={<Inbox size={IKON} />} label="Inkorg" badge={3} />}
        anvandare={<OpsIconLink avatar href="/profil" label="Min profil" icon={<OpsIdentity name="Claes Philip" seed="u1" size="md" />} />}
        skapa={{ handelse: <p>Formulär</p> }}
        meny={meny}
      >
        <p>innehåll</p>
      </OpsAppShell>
    );
  }
  if (s === "installning") {
    return (
      <Skal>
        <div className="px-4 py-4">
          <OpsKatalogInstallning kategorier={kategorier} ikoner={["wallet", "inbox"]} kanAndra onSpara={() => {}} onArkivera={() => {}} rubrik="Kategorier" />
        </div>
      </Skal>
    );
  }
  return (
    <Skal>
      <p className="px-4">innehåll</p>
    </Skal>
  );
}

createRoot(document.getElementById("root")).render(<Scen />);
window.__redo = true;
