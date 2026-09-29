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

const { OpsAppShell, OpsButton, OpsDatePicker, OpsField, OpsHub, OpsHubModul, OpsIconLink, OpsIdentity, OpsInloggning, OpsKatalogInstallning, OpsInput, OpsModal, OpsRadioGroup, OpsSelect, OpsThemeToggle, OpsCard, OpsPill, OpsPanelRow, OpsSegmented, OpsCheckbox, OpsSwitch, OpsTag, OpsChip } = Ops;
// `OpsTimePicker` finns inte i 0.30.1. Saknas den ritas en markör, och provet blir rött på rätt sak i stället för att sidan kastar.
const OpsTimePicker = Ops.OpsTimePicker ?? (() => <span data-saknas="OpsTimePicker">OpsTimePicker saknas</span>);

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
      { href: "/inkomster", label: "Inkomster", icon: <Wallet size={IKON} />, badge: 1, info: "Ny faktura i går" },
      { href: "/kostnader", label: "Kostnader", icon: <Inbox size={IKON} />, info: null },
      ...["Pension", "Skatt", "Moms", "Bokslut"].map((n) => ({ href: `/${n.toLowerCase()}`, label: n, icon: <Settings size={IKON} /> })),
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

function Full({ children, skapa = { handelse: <p>Formulär</p> } }) {
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
      skapa={skapa}
      meny={meny}
      grupper={{ lista: grupperLista, aktiv, onValj: setAktiv, infalld, onInfalld: setInfalld, onSkapa: () => {} }}
    >
      {children}
    </OpsAppShell>
  );
}

/** 0.31.0: ett formulär i en OpsModal med typlista, datum och tid, som "Ny händelse". */
function ModalForm() {
  const [typ, setTyp] = useState(undefined);
  const [datum, setDatum] = useState(undefined);
  const [tid, setTid] = useState(undefined);
  return (
    <OpsModal open onOpenChange={() => {}} title="Ny händelse" footer={<OpsButton>Spara</OpsButton>}>
      <div className="flex flex-col gap-3 pb-4">
        <OpsField label="Typ">
          <OpsSelect ariaLabel="Typ" value={typ} onChange={setTyp} options={["Möte", "Deadline", "Påminnelse", "Resa"].map((n) => ({ value: n.toLowerCase(), label: n }))} />
        </OpsField>
        <OpsField label="Datum">
          <OpsDatePicker value={datum} onChange={setDatum} />
        </OpsField>
        <OpsField label="Tid">
          <OpsTimePicker value={tid} onChange={setTid} />
        </OpsField>
        <output data-varde="">{JSON.stringify({ typ, datum, tid })}</output>
      </div>
    </OpsModal>
  );
}

/** 0.31.0: som "Nytt ärende" i CP:s skärmbild: rubrik, ett val med fyra kort och en beskrivning. */
function SkapaForm({ groupId, formId }) {
  const [sort, setSort] = useState("arende");
  return (
    <form id={formId} className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
      <p data-grupp="">{`groupId=${groupId}`}</p>
      <OpsField label="Rubrik">
        <OpsInput value="" onChange={() => {}} placeholder="Vad gäller det?" />
      </OpsField>
      <OpsRadioGroup
        ariaLabel="Vad gäller det"
        value={sort}
        onChange={setSort}
        options={[
          { value: "arende", label: "Ärende", hint: "Något som ska göras." },
          { value: "kvitto", label: "Kvitto", hint: "Ett underlag till bokföringen." },
          { value: "fraga", label: "Fråga", hint: "Något du vill ha svar på." },
          { value: "ovrigt", label: "Övrigt", hint: "Allt annat." },
        ]}
      />
      <OpsField label="Beskrivning">
        <textarea data-beskrivning="" rows={4} className="w-full rounded-md border border-line bg-canvas p-2" aria-label="Beskrivning" />
      </OpsField>
    </form>
  );
}
const skapaProp = () => ({
  handelse: { form: SkapaForm, katalog: null },
  lage: window.__aktiv ?? "g1",
  sparaEtikett: "Skicka in",
  skapaISektioner: [{ id: "kalendrar", rubrik: "Mina kalendrar", poster: [{ id: "k1", namn: "Semester" }] }],
});

/** 0.31.0: en sida med ett urval av primitiverna, för mätningen (check-skalyta avsnitt 17) och galleriet i montaget. */
function Galleri() {
  const [seg, setSeg] = useState("a");
  const [sort, setSort] = useState("b");
  const [dat, setDat] = useState("2026-10-12");
  const [tid, setTid] = useState("09:30");
  const [typ, setTyp] = useState("moete");
  const [cb, setCb] = useState(true);
  const [sw, setSw] = useState(true);
  const rubrik = (t) => <p className="m-0 mt-4 mb-1 text-sektion font-semibold uppercase text-accent">{t}</p>;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2 p-4" data-galleri="">
      {rubrik("Knappar")}
      <div className="flex flex-wrap items-center gap-2">
        <span data-p="knapp-primary"><OpsButton variant="primary">Spara</OpsButton></span>
        <span data-p="knapp-secondary"><OpsButton variant="secondary">Avbryt</OpsButton></span>
        <span data-p="knapp-ghost"><OpsButton variant="ghost">Mer</OpsButton></span>
        <span data-p="knapp-sm"><OpsButton variant="primary" size="sm">Liten</OpsButton></span>
      </div>
      {rubrik("Fält")}
      <div className="flex flex-col gap-2">
        <div data-p="falt"><OpsField label="Rubrik"><OpsInput value="" onChange={() => {}} placeholder="Vad gäller det?" /></OpsField></div>
        <div data-p="select"><OpsField label="Typ"><OpsSelect value={typ} onChange={setTyp} options={[{ value: "moete", label: "Möte" }, { value: "resa", label: "Resa" }]} /></OpsField></div>
        <div data-p="datum"><OpsField label="Datum"><OpsDatePicker value={dat} onChange={setDat} /></OpsField></div>
        <div data-p="tid"><OpsField label="Tid"><OpsTimePicker value={tid} onChange={setTid} /></OpsField></div>
      </div>
      {rubrik("Val")}
      <div className="flex flex-col gap-2">
        <div data-p="segment"><OpsSegmented ariaLabel="Vy" value={seg} onChange={setSeg} options={[{ value: "a", label: "Lista" }, { value: "b", label: "Kalender" }, { value: "c", label: "Karta" }]} /></div>
        <div data-p="radio"><OpsRadioGroup ariaLabel="Sort" value={sort} onChange={setSort} options={[{ value: "a", label: "Ärende", hint: "Något som ska göras." }, { value: "b", label: "Kvitto", hint: "Ett underlag." }, { value: "c", label: "Fråga" }]} /></div>
        <div className="flex flex-wrap gap-4">
          <span data-p="checkbox"><OpsCheckbox label="Skicka kopia" checked={cb} onChange={setCb} /></span>
          <span data-p="switch"><OpsSwitch label="Aktiv" checked={sw} onChange={setSw} /></span>
        </div>
      </div>
      {rubrik("Ytor")}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div data-p="kort"><OpsCard><p className="m-0 text-base">Ett kort</p></OpsCard></div>
        <div data-p="rad" className="rounded-base border border-line bg-surface p-1"><OpsPanelRow label="En rad" onClick={() => {}} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span data-p="pill"><OpsPill tone="success">Klar</OpsPill></span>
        <span data-p="tag"><OpsTag label="Etikett" /></span>
        <span data-p="chip"><OpsChip selected={false} onClick={() => {}}>Filter</OpsChip></span>
      </div>
    </div>
  );
}

function Scen() {
  const s = window.__skal;
  if (s === "galleri") return <Galleri />;
  if (s === "skapa") {
    return (
      <Full skapa={skapaProp()}>
        <p className="px-4" data-appvy="">appens vy</p>
      </Full>
    );
  }
  if (s === "modal") return <ModalForm />;
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
  // 0.31.0 (fynd 1 i #475): utan `px-4` runt. Appen får lägga vilken padding den vill, och Hub får inte kräva en: raden hade
  // `-mx-4`, som ger horisontell överflödning i en kolumn utan egen padding.
  if (s === "hubnaken") {
    return (
      <Full>
        <OpsHub moduler={hubModuler} activeHref="/hub" onNavigate={gaTill} />
      </Full>
    );
  }
  if (s === "hubmodulnaken") {
    return (
      <Full>
        <OpsHubModul modul={hubModuler[1]} hubHref="/hub" activeHref="/ekonomi" onNavigate={gaTill} />
      </Full>
    );
  }
  // Fynd 3: en sida UNDER modulen bär samma tillbaka-rad, via `OpsView tillbaka`.
  if (s === "hubbarn") {
    const { OpsView } = Ops;
    return (
      <Full>
        <OpsView tillbaka={{ hubHref: "/hub", etikett: "Inkomster", steg: [{ href: "/ekonomi", label: "Ekonomi" }], onNavigate: gaTill }}>
          <p data-barnsida="">Inkomster</p>
        </OpsView>
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
