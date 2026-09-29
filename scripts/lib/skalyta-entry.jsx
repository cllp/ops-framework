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
import { Calendar, CalendarDays, Inbox, LayoutGrid, Search, Settings, Sparkles, Wallet } from "lucide-react";

const { OpsAppShell, OpsHub, OpsHubModul, OpsIconLink, OpsIdentity, OpsInloggning, OpsKatalogInstallning, OpsThemeToggle } = Ops;

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

// 0.31.0: en undervy med en LÅNG rad, som en riktig aktivitetslista. Före 0.31.0 växte menyn med den till nästan hela bredden.
const aktivitetsvy = (
  <div>
    <p>Aktivitetslistan</p>
    <p>{"Claes Philip Staiger lade till en ny händelse i gruppen Claes Philip Staiger Konsulting och Förvaltning AB och bjöd in alla medlemmar att svara före fredag klockan tolv. ".repeat(3)}</p>
  </div>
);
const meny = {
  sektioner: [
    [
      { key: "aktivitet", etikett: "Aktivitet", ikon: <Settings size={16} />, undervy: aktivitetsvy },
      { key: "notiser", etikett: "Notiser", ikon: <Inbox size={16} />, onClick: () => {} },
    ],
    [{ key: "installningar", etikett: "Inställningar", ikon: <Settings size={16} />, onClick: () => {} }],
  ],
  app: [{ href: "/appsida", label: "Appens egen sida", icon: <Settings size={16} /> }, { href: "/primitiver", label: "Primitiver" }],
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
      nav={nav}
      activeHref={aktiv}
      actions={<OpsIconLink href="/inkorg" icon={<Inbox size={IKON} />} label="Inkorg" badge={3} />}
      anvandare={<OpsIconLink avatar href="/profil" label="Min profil" icon={<OpsIdentity name="Claes Philip" seed="u1" size="md" />} />}
      skapa={{ handelse: <p>Formulär</p>, arende: <p>Ärende</p> }}
      meny={meny}
      {...extra}
    >
      {children}
    </OpsAppShell>
  );
}

/** Appens verkliga uppsättning (0.30.1): tema, inkorg med räknare, sök, fråga, avatar och en gruppväxlare med ett långt gruppnamn. */
const hubModuler = [
  { href: "/oversikt", label: "Översikt", icon: <LayoutGrid size={IKON} />, info: "3 saker att göra" },
  {
    href: "/ekonomi",
    label: "Ekonomi",
    icon: <Wallet size={IKON} />,
    badge: 2,
    info: { sv: "Skatten förfaller 12 oktober" },
    children: [
      { href: "/inkomster", label: "Inkomster", badge: 1, info: "Ny faktura i går" },
      { href: "/kostnader", label: "Kostnader", info: null },
      ...["Pension", "Skatt", "Moms", "Bokslut"].map((n) => ({ href: `/${n.toLowerCase()}`, label: n })),
    ],
  },
  { href: "/schema", label: "Schema", icon: <Calendar size={IKON} />, badge: 0, info: null },
  { href: "/cutover", label: "Cutover", icon: <Settings size={IKON} /> },
];
/** Vart appen har navigerat: kortet är en riktig länk, och sidan får inte laddas om i provet. */
window.__gick = [];
const gaTill = (href, e) => {
  e.preventDefault();
  window.__gick.push(href);
};
const grupperLista = [
  { id: "g1", namn: { sv: "Claes Philip Staiger Konsulting och Förvaltning AB" }, medlemsantal: 2, roll: "agare" },
  { id: "g2", namn: { sv: "Testgruppen" }, medlemsantal: 3 },
  // CP:s egen grupp, den som märkets andra rad visar i hans bild (0.31.0). Kort nog att rymmas utan förkortning.
  { id: "g3", namn: { sv: "Claes Philip Staiger AB" }, medlemsantal: 1, roll: "agare" },
];

function Full({ children }) {
  const [infalld, setInfalld] = useState(false);
  const [aktiv, setAktiv] = useState(window.__aktiv ?? "g1");
  return (
    <OpsAppShell
      fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }}
      moduler={hubModuler}
      activeHref="/"
      actions={
        <>
          <OpsThemeToggle />
          <OpsIconLink href="/inkorg" icon={<Inbox size={IKON} />} label="Inkorg" badge={3} />
          <OpsIconLink href="/sok" icon={<Search size={IKON} />} label="Sök" />
          <OpsIconLink href="/fraga" icon={<Sparkles size={IKON} />} label="Fråga" />
        </>
      }
      anvandare={<OpsIconLink avatar href="/profil" label="Min profil" icon={<OpsIdentity name="Claes Philip" seed="u1" size="md" />} />}
      skapa={{ handelse: <p>Formulär</p> }}
      meny={meny}
      grupper={{ lista: grupperLista, aktiv, onValj: setAktiv, infalld, onInfalld: setInfalld, onSkapa: () => {} }}
    >
      {children}
    </OpsAppShell>
  );
}

function Scen() {
  const s = window.__skal;
  if (s === "full") {
    return (
      <Full>
        <p className="px-4">innehåll</p>
      </Full>
    );
  }
  if (s === "inloggning") {
    // 0.31.0: inloggningens märke. Ingen av förmågorna anropas, sidan ska bara ritas.
    return <OpsInloggning auth={{ signInWithGoogle: () => {} }} etikett="Bolag Ops" />;
  }
  if (s === "hub") {
    return (
      <Full>
        <div className="px-4 py-4">
          <OpsHub moduler={hubModuler} activeHref="/hub" onNavigate={gaTill} />
        </div>
      </Full>
    );
  }
  if (s === "hubmodul") {
    return (
      <Full>
        <div className="px-4 pb-4">
          <OpsHubModul modul={hubModuler[1]} hubHref="/hub" activeHref="/ekonomi" onNavigate={gaTill} />
        </div>
      </Full>
    );
  }
  if (s === "fasta") {
    return (
      <OpsAppShell
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
