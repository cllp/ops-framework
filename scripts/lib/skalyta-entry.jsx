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
import { Bell, Calendar, CalendarDays, CheckSquare, FileText, Inbox, LayoutGrid, Search, Settings, Sparkles, Wallet } from "lucide-react";

const { OpsEventList, OpsAttributes, OpsFact, OpsAppShell, OpsButton, OpsDatePicker, OpsField, OpsHub, OpsHubModul, OpsIconLink, OpsIdentity, OpsInloggning, OpsKatalogInstallning, OpsInput, OpsModal, OpsRadioGroup, OpsSelect, OpsThemeToggle, OpsCard, OpsPill, OpsPanelRow, OpsSegmented, OpsCheckbox, OpsSwitch, OpsTag, OpsChip, OpsFilterPanel, OpsFilterChip, OpsActivityListActions, OpsGruppvaljare } = Ops;
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

// Fasta, så att kalendern inte räknar om sina månader vid varje rendering.
const FULLYTA_IDAG = new Date(2026, 8, 30);
const FULLYTA_POSTER = Array.from({ length: 10 }, (_, i) => ({ id: `k${i}`, date: `2026-09-${String(3 + i * 2).padStart(2, "0")}`, title: `Post ${i + 1}` }));

/**
 * 0.32.1 (CP 2026-09-30, "Kalender och idag går inte ända ner utan huggs av i botten"): en yta som ska nå bottenraden,
 * som bolag-ops Idag (`OpsScrollArea` med en lista) och Kalender (`OpsCalendar`). Ovanför ytan står en rad på 170 px när
 * `window.__banner` är satt, och `window.__tabortBanner()` tar bort den EFTER mount: en banner som försvinner ovanför ytan.
 * @param {{ vy: "idag" | "kalender" }} props
 */
function FullYta({ vy }) {
  const [banner, setBanner] = useState(!!window.__banner);
  window.__tabortBanner = () => setBanner(false);
  const { OpsView, OpsScrollArea, OpsCalendar } = Ops;
  const handelser = Array.from({ length: 14 }, (_, i) => ({ id: `f${i}`, title: `Händelse nummer ${i + 1}`, daysLeft: i - 3, role: "Du", kind: "Uppgift", when: `Om ${i} dagar`, slag: 2, slagLabel: "Uppgift" }));
  return (
    <Full>
      <OpsView>
        {banner ? <div data-banner="" style={{ height: 170 }} className="bg-raised">Banner</div> : null}
        <p data-filter="">Filter</p>
        {vy === "idag" ? (
          <OpsScrollArea>
            <OpsEventList events={handelser} />
          </OpsScrollArea>
        ) : (
          <OpsCalendar ariaLabel="Kalender" entries={FULLYTA_POSTER} today={FULLYTA_IDAG} />
        )}
      </OpsView>
    </Full>
  );
}

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

/** 0.32.0 (#180 G2): grupper med roll, färg, ikon, medlemsantal och avatarer, för gruppkortets mätning (avsnitt 23). Bara scenen "gruppkort" använder den. */
const g2Lista = [
  { id: "g1", namn: { sv: "Alfa AB" }, roll: "agare", farg: "3", medlemsantal: 6, avatarer: ["A", "B", "C", "D", "E", "F"].map((n) => ({ id: `u${n}`, namn: `${n} Person` })) },
  { id: "g2", namn: { sv: "Beta AB" }, roll: "medlem", medlemsantal: 2, avatarer: [{ id: "uA", namn: "A Person" }, { id: "uB", namn: "B Person" }] },
  { id: "g3", namn: { sv: "Gamma AB" }, roll: "admin", farg: "5", ikon: "hus", medlemsantal: 3 },
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
      grupper={{ lista: window.__skal === "gruppkort" ? g2Lista : grupperLista, aktiv, onValj: setAktiv, infalld, onInfalld: setInfalld, onSkapa: () => {}, onInfo: () => {}, onRedigera: () => {} }}
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

/**
 * 0.31.2: ALLA valmenyer på en sida, för mätningen i check-skalyta avsnitt 18. CP:s bild var filtrets "Slag"-dropdown
 * (Alla slag, Fakta, Påminnelser, Uppgifter), så den finns med i alla tre former (en ikon per grupp, samlad panel, chip).
 * Varje yta bor i en `data-m`-ruta; de öppnas av vakten, en i taget.
 */
function Menyer() {
  const [f, setF] = useState({ slag: null });
  const [sort, setSort] = useState("nyast");
  const [chip, setChip] = useState(null);
  const [chipIkon, setChipIkon] = useState(null);
  const [seg, setSeg] = useState("kommande");
  const [typ, setTyp] = useState("moete");
  const [tid, setTid] = useState("09:30");
  const [dat, setDat] = useState("2026-10-12");
  const [gr, setGr] = useState("g1");
  const slagIkon = { fakta: <FileText size={16} />, paminnelser: <Bell size={16} />, uppgifter: <CheckSquare size={16} /> };
  const slagOpt = [
    { value: "fakta", label: "Fakta", icon: slagIkon.fakta },
    { value: "paminnelser", label: "Påminnelser", icon: slagIkon.paminnelser },
    { value: "uppgifter", label: "Uppgifter", icon: slagIkon.uppgifter },
  ];
  const grupp = { id: "slag", label: "Slag", allLabel: "Alla slag", options: slagOpt };
  const sorting = { label: "Sortera", value: sort, fallback: "nyast", onChange: setSort, options: [{ value: "nyast", label: "Nyast först" }, { value: "aldst", label: "Äldst först" }] };
  const ruta = (/** @type {string} */ id, /** @type {any} */ barn) => <div data-m={id} className="flex min-h-11 items-center gap-2">{barn}</div>;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4" data-menyer="">
      {ruta("filter-ikoner", <OpsFilterPanel layout="ikoner" ariaLabel="Filter" groups={[grupp]} value={f} onChange={setF} sorting={sorting} />)}
      {ruta("filter-samlad", <OpsFilterPanel ariaLabel="Filter och sortering" groups={[grupp]} value={f} onChange={setF} sorting={sorting} />)}
      {ruta("chip-ikon", <OpsFilterChip variant="icon" ariaLabel="Slag" allLabel="Alla slag" options={[{ value: null, label: "Alla slag" }, ...slagOpt]} value={chipIkon} onChange={setChipIkon} />)}
      {ruta("chip-text", <OpsFilterChip ariaLabel="Slag" allLabel="Alla slag" options={[{ value: null, label: "Alla slag" }, ...slagOpt]} value={chip} onChange={setChip} />)}
      {ruta("tema", <OpsThemeToggle />)}
      {ruta("status", <OpsSegmented ariaLabel="Vy" value={seg} onChange={setSeg} options={[{ value: "idag", label: "Idag" }, { value: "kommande", label: "Kommande", menu: { items: [{ value: "kommande", label: "Alla" }, { value: "planerad", label: "Planerade" }, { value: "klar", label: "Klara" }] } }]} />)}
      {ruta("select", <div className="w-56"><OpsSelect ariaLabel="Typ" value={typ} onChange={setTyp} options={["moete:Möte", "deadline:Deadline", "paminnelse:Påminnelse"].map((x) => ({ value: x.split(":")[0], label: x.split(":")[1] }))} /></div>)}
      {ruta("tid", <div className="w-56"><OpsTimePicker value={tid} onChange={setTid} /></div>)}
      {ruta("datum", <div className="w-56"><OpsDatePicker value={dat} onChange={setDat} /></div>)}
      {ruta("aktivitet", <OpsActivityListActions filter={<p className="m-0 text-xs">Filter</p>} onClear={() => {}} />)}
      {ruta("gruppvaljare", <div className="w-72"><OpsGruppvaljare grupper={grupperLista} aktiv={gr} onValj={setGr} rubrik="Grupper" allaEtikett="Alla mina grupper" /></div>)}
    </div>
  );
}

function Scen() {
  const s = window.__skal;
  if (s === "menyer") return <Menyer />;
  if (s === "galleri") return <Galleri />;
  if (s === "skapa") {
    return (
      <Full skapa={skapaProp()}>
        <p className="px-4" data-appvy="">appens vy</p>
      </Full>
    );
  }
  // 0.32.0 (#180): "Ny grupp". Saknas `OpsGruppFormular` i den byggda versionen (0.31.x) finns ingen `skapa.grupp` och raden "Ny grupp" ritas
  // inte: vakten (avsnitt 22) blir röd på rätt sak i stället för att sidan kastar.
  if (s === "nygrupp") {
    const GruppForm = Ops.OpsGruppFormular;
    const grupp = GruppForm
      ? ({ formId, onKlar }) => (
          <GruppForm
            formId={formId}
            onKlar={onKlar}
            onSkapa={async () => ({ groupId: "ny-grupp", tillagda: [], inbjudna: [], fel: [] })}
            onSkapad={() => { window.__skapad = (window.__skapad ?? 0) + 1; }}
          />
        )
      : undefined;
    return (
      <Full skapa={{ sparaEtikett: "Spara", ...(grupp ? { grupp } : { handelse: <p>Formulär</p> }) }}>
        <p className="px-4" data-appvy="">appens vy</p>
      </Full>
    );
  }
  if (s === "gruppkort") {
    return (
      <Full>
        <p className="px-4" data-appvy="">appens vy</p>
      </Full>
    );
  }
  // 0.32.0 (#180 G2): detaljsidan. Saknas `OpsGruppSida` (0.31.x) ritas en markör och vakten blir röd på rätt sak.
  if (s === "gruppsida") {
    const Sida = Ops.OpsGruppSida ?? (() => <span data-saknas="OpsGruppSida">OpsGruppSida saknas</span>);
    const m = ["Dan Ägare", "Bo Admin", "Ann Medlem"].map((namn, i) => ({ id: `u${i}`, namn, bild: "", roll: ["agare", "admin", "medlem"][i] }));
    return (
      <Full>
        <Sida
          grupp={{ id: "g1", namn: { sv: "Alfa AB" }, beskrivning: "Vi arbetar med trädgårdar och uteplatser på Gotland.", ort: "Visby", roll: "agare", farg: "3" }}
          medlemmar={m}
          snabbval={[
            { icon: <Calendar size={20} />, label: "Kalender", onClick: () => {} },
            { icon: <FileText size={20} />, label: "Bibliotek", onClick: () => {} },
            { icon: <Inbox size={20} />, label: "Chatt", onClick: () => {} },
          ]}
          onTillbaka={() => {}}
          onRedigera={() => {}}
        />
      </Full>
    );
  }
  if (s === "modal") return <ModalForm />;
  if (s === "full") {
    return (
      <Full>
        <p className="px-4 text-brod">innehåll</p>
      </Full>
    );
  }
  if (s === "inloggning") {
    // 0.31.0: inloggningens märke. Ingen av förmågorna anropas, sidan ska bara ritas.
    return <OpsInloggning auth={{ signInWithGoogle: () => {} }} etikett="Bolag Ops" />;
  }
  if (s === "inloggningbild") {
    // 0.31.1: inloggningen med appens BILDLOGGA. Fyrkantiga mästare som appens (3750 px, mycket luft), här som SVG-data-URL:er:
    // ljus = vit bakgrund, mörk = kolgrå, så att "rätt bild för temat" går att läsa av på pixlarna.
    const svg = (/** @type {string} */ bg, /** @type {string} */ fg) =>
      `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="${bg}"/><rect x="70" y="210" width="260" height="220" rx="14" fill="${fg}"/><rect x="360" y="290" width="175" height="60" fill="${fg}"/></svg>`)}`;
    return <OpsInloggning auth={{ signInWithGoogle: () => {} }} etikett="Bolag Ops" ordmarke={{ ljus: svg("#ffffff", "#242c27"), mork: svg("#202420", "#e8e4dc") }} />;
  }
  if (s === "hub") {
    return (
      <Full>
        <OpsHub moduler={hubModuler} activeHref="/hub" onNavigate={gaTill} />
      </Full>
    );
  }
  // 0.31.2 (uppgift 5): Idag med ett utfällt kort och en faktalista, byggd av ramverkets egna komponenter. Typvakten (avsnitt 20) mäter
  // varje synligt textelement här och i de andra sidorna.
  if (s === "idagkort") {
    const { OpsView } = Ops;
    const [vy, setVy] = useState("idag");
    const handelser = [
      {
        id: "e1",
        title: "Kundfaktura 119223 Adavo AB, skickad, väntar betalning, 158 400 kr inkl moms",
        daysLeft: -19,
        role: "Du",
        kind: "Faktura",
        when: "För 19 dagar sedan",
        updatedAt: "Senast 10 sep",
        deadline: "Förfaller 2026-09-10",
        slag: 1,
        slagLabel: "Faktura",
        status: "vantar",
        skapadAv: { namn: "Wint", typ: "agent" },
        skapad: "2026-09-10T09:12:00Z",
        atgard: <OpsButton size="sm" variant="secondary">Bocka av</OpsButton>,
        details: (
          <OpsAttributes
            rows={[
              { label: "Belopp inkl moms", value: "158 400 kr" },
              { label: "Exkl moms", value: "126 720 kr" },
              { label: "Period", value: "2026-07" },
              { label: "Underlag", value: "144 h x 880 kr" },
              { label: "Status", value: "sent" },
              { label: "Hämtad från", value: "Wint" },
              { label: "Försvinner", value: "Försvinner när underlaget ändras, inte när du gör något." },
            ]}
          />
        ),
      },
      { id: "e2", title: "Attest större leverantörsfakturor", daysLeft: 3, role: "Agent", kind: "Uppgift", when: "Om 3 dagar", slag: 2, slagLabel: "Uppgift" },
    ];
    return (
      <Full>
        <OpsView>
          <OpsSegmented ariaLabel="Idag eller kommande" value={vy} onChange={setVy} options={[{ value: "idag", label: "Idag", badge: 3 }, { value: "kommande", label: "Kommande", badge: 76 }]} />
          <OpsEventList
            events={handelser}
            actionHint="Bara påminnelser går att bocka av, och bara för den här gången."
            statusWords={{ vantar: "Väntar" }}
            labels={{ forsenat: "Försenat" }}
          />
          <div className="flex gap-2">
            <OpsFact kind="uppskattat" value="1 200 kr" />
            <OpsTag label="Etikett" />
          </div>
        </OpsView>
      </Full>
    );
  }
  // 0.31.2 (uppgift 6): en lång sida i skalet med bottenrad, för att emulera en hemskärmsapp (iOS standalone) med säkra zoner.
  if (s === "lang") {
    const { OpsView } = Ops;
    const handelser = Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, title: `Händelse nummer ${i + 1}`, daysLeft: i - 3, role: "Du", kind: "Uppgift", when: `Om ${i} dagar`, slag: 2, slagLabel: "Uppgift" }));
    return (
      <Full>
        <OpsView>
          <OpsEventList events={handelser} />
        </OpsView>
      </Full>
    );
  }
  // Samma sida med listan i `OpsScrollArea` (som bolag-ops Idag): ytan rullar i sig själv och dokumentet ska INTE rulla.
  if (s === "langarea") {
    const { OpsView, OpsScrollArea } = Ops;
    const handelser = Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, title: `Händelse nummer ${i + 1}`, daysLeft: i - 3, role: "Du", kind: "Uppgift", when: `Om ${i} dagar`, slag: 2, slagLabel: "Uppgift" }));
    return (
      <Full>
        <OpsView>
          <p>Filter</p>
          <OpsScrollArea>
            <OpsEventList events={handelser} />
          </OpsScrollArea>
        </OpsView>
      </Full>
    );
  }
  // 0.32.1: ytor som ska nå bottenraden, se `FullYta`.
  if (s === "fullyta-idag") return <FullYta vy="idag" />;
  if (s === "fullyta-kalender") return <FullYta vy="kalender" />;
  // 0.31.2: Idag som referens för avståndet under toppraden och sidomarginalen: en vanlig vy i `OpsView`, som bolag-ops Idag.
  if (s === "idag") {
    const { OpsView } = Ops;
    return (
      <Full>
        <OpsView>
          <p data-idag-forst="">Idag</p>
        </OpsView>
      </Full>
    );
  }
  // 0.31.0 (fynd 1 i #475): utan `px-4` runt. 0.31.2: Hub äger sin egen ram (`OpsView`), så "naken" är nu samma sak som "hub"
  // (före 0.31.2 hade appen INGEN sidomarginal och inget avstånd under toppraden, se CHANGELOG). Scenerna behålls som alias.
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
        <OpsHubModul modul={hubModuler[1]} hubHref="/hub" activeHref="/ekonomi" onNavigate={gaTill} />
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
        <p className="text-brod">innehåll</p>
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
      <p className="px-4 text-brod">innehåll</p>
    </Skal>
  );
}

createRoot(document.getElementById("root")).render(<Scen />);
window.__redo = true;
