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
import { useEffect, useState } from "react";
import * as Ops from "OPS_DIST";
import { Bell, Calendar, CalendarDays, CheckSquare, FileText, Inbox, LayoutGrid, Search, Settings, Sparkles, Wallet } from "lucide-react";

const { OpsModulTyper } = Ops;
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

/*
 * 0.33.0 (#162): två grupper med OLIKA händelsetyper, och en inställningsvy som byter katalog när gruppen byts.
 * Knapparna står för appens gruppväxlare. `window.__sparat` samlar vad vyn skickade till onSpara.
 */
const GRUPPKATALOGER = {
  "cps-ab": [
    { id: "mote", namn: { sv: "Styrelsemöte" }, farg: 1, ikon: "wallet", fas: "aktiv", ordning: 0, texter: {}, groupId: "cps-ab" },
    { id: "deklaration", namn: { sv: "Deklaration" }, farg: 2, ikon: "inbox", fas: "aktiv", ordning: 1, texter: {}, groupId: "cps-ab" },
  ],
  "miranda-ab": [
    { id: "turne", namn: { sv: "Turné" }, farg: 3, ikon: "wallet", fas: "aktiv", ordning: 0, texter: {}, groupId: "miranda-ab" },
    { id: "repetition", namn: { sv: "Repetition" }, farg: 1, ikon: "inbox", fas: "aktiv", ordning: 1, texter: {}, groupId: "miranda-ab" },
  ],
};
/** @type {any[]} */
window.__sparat = [];
function InstallningTvaGrupper() {
  const [aktiv, setAktiv] = useState("cps-ab");
  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      <div className="flex gap-2" data-gruppbyte="">
        {Object.keys(GRUPPKATALOGER).map((g) => (
          <OpsButton key={g} variant={g === aktiv ? "primary" : "ghost"} onClick={() => setAktiv(g)}>
            {g}
          </OpsButton>
        ))}
      </div>
      <OpsKatalogInstallning
        kategorier={GRUPPKATALOGER[/** @type {"cps-ab"} */ (aktiv)]}
        ikoner={["wallet", "inbox"]}
        kanAndra
        onSpara={(k) => window.__sparat.push(k)}
        onArkivera={() => {}}
        rubrik="Händelsetyper"
        groupId={aktiv}
      />
    </div>
  );
}

/**
 * 0.42.0 (#217): modulernas typbidrag i en riktig webbläsare. Gruppen har två egna inkorgstyper och Ekonomi PÅ, som bidrar med två
 * typer ("Ekonomisk uppdatering" och ett långt namn som måste få brytas). Överst valen som ett skapa-formulär ritar dem
 * (`typerForGrupp` + `typerTillValg` i `OpsRadioGroup`), under dem ägarens lista (`OpsModulTyper`). `onAndra` går genom `medAvvikelse`,
 * så ett tryck på Dölj visar sig i BÅDA vyerna på en gång. Allt hämtas ur dist, inte ur källan.
 */
const EKONOMI_TYPER = {
  inkorg: [
    { id: "uppdatering", namn: { sv: "Ekonomisk uppdatering", en: "Financial update" }, farg: 2, ikon: "wallet" },
    { id: "kvitto", namn: { sv: "Kvitto, utlägg och andra underlag som ska bokföras" }, ikon: "inbox" },
  ],
};
const MODULTYP_BAS = [
  { id: "arende", namn: { sv: "Ärende" }, farg: 1, ikon: "inbox", fas: null, ordning: 0, arkiverad: false, texter: {}, groupId: "cps-ab" },
  { id: "bugg", namn: { sv: "Bugg" }, farg: 3, ikon: "inbox", fas: null, ordning: 1, arkiverad: false, texter: {}, groupId: "cps-ab" },
];
function ModultyperScen() {
  const ekonomi = Ops.defineModule({ id: "ekonomi", namn: { sv: "Ekonomi", en: "Economy" }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: null, typer: EKONOMI_TYPER });
  const [avvikelser, setAvvikelser] = useState(/** @type {any[]} */ ([]));
  const [valt, setValt] = useState("arende");
  const ctx = { bas: MODULTYP_BAS, moduler: [ekonomi], modulerPa: ["ekonomi"], avvikelser };
  const val = Ops.typerTillValg(Ops.typerForGrupp("inkorg", ctx));
  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      <div data-modultyp-val="">
        <OpsRadioGroup options={val} value={valt} onChange={setValt} ariaLabel="Typ" />
      </div>
      <div data-modultyp-lista="">
        <OpsModulTyper yta="inkorg" bidrag={Ops.bidragForGrupp("inkorg", ctx)} kanAndra onAndra={(a) => setAvvikelser(Ops.medAvvikelse(avvikelser, a))} />
      </div>
    </div>
  );
}

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

/*
 * 0.36.0 (#179 F1): kalendern som SS, i skalet med bottenraden. Idag är onsdag 30 september 2026. Posterna täcker det
 * avsnitt 30 mäter: en flerdagspost inom en vecka (5-7 okt), en över ett veckoskifte (9-13 okt), en heldag (1 okt), tre
 * poster samma dag (12 okt, en i en annan kalender), och en typ och en status per post för filtret.
 * `window.__lagring` är enhetens minne för veckonumren, `window.__skapat` vad "+" och skapa-rutan fick.
 */
const KAL_IDAG = new Date(2026, 8, 30, 12);
const KAL_KALENDRAR = [
  { id: "styrelse", namn: "Styrelsen", farg: 4, grupp: true, forvald: true },
  { id: "resor", namn: "Resor", farg: 2, grupp: true },
  { id: "privat", namn: "Privat", farg: 5 },
];
const kk = (id) => { const k = KAL_KALENDRAR.find((x) => x.id === id); return { id: k.id, namn: k.namn, farg: k.farg }; };
const KAL_POSTER = [
  { id: "stamma", date: "2026-10-01", allDay: true, title: "Deklarationsdag", typ: "deadline", status: "oppet" },
  { id: "konferens", date: "2026-10-05", endDate: "2026-10-07", title: "Konferens i Visby", kalender: kk("resor"), typ: "resa", status: "oppet" },
  { id: "semester", date: "2026-10-09", endDate: "2026-10-13", allDay: true, title: "Semester", kalender: kk("privat"), typ: "ledig", status: "klart" },
  { id: "mote", date: "2026-10-12", title: "Styrelsemöte", typ: "mote", status: "oppet", slag: 1, slagLabel: "Möte", kindIcon: <Calendar size={16} /> },
  { id: "lon", date: "2026-10-12", title: "Löneutbetalning", typ: "deadline", status: "vantar", slag: 2, slagLabel: "Deadline", kindIcon: <FileText size={16} /> },
  { id: "tag", date: "2026-10-12", title: "Tåg till Malmö", kalender: kk("resor"), typ: "resa", status: "klart" },
  { id: "moms", date: "2026-09-14", title: "Momsdeklaration", typ: "deadline", status: "klart" },
  { id: "tandlakare", date: "2026-10-20", title: "Tandläkaren", not: "09:00-10:00", kalender: kk("privat"), typ: "ledig", status: "oppet" },
];
window.__lagring = {};
window.__skapat = [];
window.__hantera = 0;
function KalenderScen() {
  const { OpsView, OpsCalendar } = Ops;
  // 0.37.0 (#179 F2): "Hantera kalendrar" i kalenderväljaren öppnar hanteringen, som en app gör (en egen vy).
  const [hantera, setHantera] = useState(false);
  if (hantera) return <KalendrarScen />;
  return (
    <Full>
      <OpsView>
        <OpsCalendar
          onHanteraKalendrar={() => { window.__hantera += 1; setHantera(true); }}
          // 0.37.0: platsen för F6 (lager och tillgänglighet), med en ton och två hörnmärken den 14 oktober.
          // 0.61.0 (#259): hörnbrickorna är typade, appen skickar bara antalen.
          dagdekor={(d) => (d === "2026-10-14" ? { ton: 5, borta: { antal: 2 }, lager: { antal: 1 } } : undefined)}
          ariaLabel="Kalender"
          entries={KAL_POSTER}
          today={KAL_IDAG}
          kalendrar={KAL_KALENDRAR}
          typer={[{ id: "mote", namn: "Möte" }, { id: "deadline", namn: "Deadline" }, { id: "resa", namn: "Resa" }, { id: "ledig", namn: "Ledig" }]}
          statusWords={{ oppet: "Öppet", vantar: "Väntar", klart: "Klart" }}
          onSkapa={(d) => window.__skapat.push(d)}
          lagring={{ getItem: (n) => window.__lagring[n] ?? null, setItem: (n, v) => { window.__lagring[n] = v; } }}
        />
      </OpsView>
    </Full>
  );
}

/*
 * 0.61.0 (#259 skiva 1): lager och tillgänglighet. Idag är tisdag 6 oktober 2026, som i förebilderna. Tillgängligheten räknas med
 * ramverkets egen `tillganglighetForDag` ur fjorton medlemmar och deras poster, så att sidan visar modellen hela vägen till brickan.
 *
 * ⛔ SAMMA DATA SOM FÖREBILDEN (regel 12: samma flöde). Två scener, en per förebild, eftersom CP:s två bilder visar olika lägen:
 *   - `kalender-tillganglighet`: förebild 7 (`docs/bilder/259/ss-kalender-mobil-7.png`). Lager med ram på onsdagarna 9, 16, 23
 *     och 30 september och 7, 14 och 21 oktober. En borta den 24 september, 1-4 och 22 oktober. Båda den 30 september. Två borta
 *     och två lager den 8 oktober. Prickarna dag för dag som i bilden. Mätdagarna som förebilden inte visar ligger i november:
 *     den 18 tolv borta och tolv lager (`9+`), den 19 två borta, den 22 (söndag) en borta, den 25 två lager.
 *   - `kalender-tillganglighet-3`: förebild 3 (`ss-lager-och-tillganglighet-mobil-3.png`). Lager med ram på onsdagarna 2 september
 *     till 14 oktober; en borta den 5, 6, 24 och 30 september och 1-4 och 8 oktober.
 * Den 9 oktober har bara DOLDA poster och ska alltså inte få någon bricka. Gruppen räknas som vald, så `N/N` står på dagar utan
 * borta från 640 px (SS webb, `ss-tillganglighet-webb-6.png`).
 */
const TG_IDAG = new Date(2026, 9, 6, 12);
const TG_MEDLEMMAR = ["Örjan Klintberg", "Anna Berg", "Bo Ek", "Cecilia Holm", "David Lind", "Eva Nord", "Filip Strand", "Greta Åberg", "Hugo Wik", "Ida Sjö", "Jonas Ström", "Karin Dahl", "Lena Falk", "Måns Gran"].map((namn, i) => ({ uid: `m${i}`, namn }));
/** En borta per dag, växelvis delad och upptagen. @param {string[]} dagar */
const tgEnBorta = (dagar) => dagar.map((d, i) => ({ uid: `m${i % 3}`, heldag: true, start: d, lage: i % 2 ? "delad" : "upptagen", rubrik: "Jobbresa | Tyskland" }));
// ⛔ Bara dolda poster den 9 oktober: ingen bricka.
const TG_DOLDA = [
  { uid: "m5", heldag: true, start: "2026-10-09", lage: "dold", rubrik: "Hemligt" },
  { uid: "m6", start: "2026-10-09T08:00", slut: "2026-10-09T17:00", lage: "dold" },
];
const TG_VARIANT = {
  7: {
    poster: [
      ...tgEnBorta(["2026-09-24", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-22", "2026-11-22"]),
      // Två den 8 oktober: en heldag och en tidsatt ("upptagen", som räknas i brickan som i SS, blockedCount är binärt).
      { uid: "m3", heldag: true, start: "2026-10-08", lage: "upptagen" },
      { uid: "m4", start: "2026-10-08T09:00", slut: "2026-10-08T12:00", lage: "upptagen" },
      ...TG_DOLDA,
      ...TG_MEDLEMMAR.slice(0, 12).map((m) => ({ uid: m.uid, heldag: true, start: "2026-11-18", lage: "upptagen" })),
      { uid: "m1", heldag: true, start: "2026-11-19", lage: "upptagen" },
      { uid: "m2", start: "2026-11-19T10:00", slut: "2026-11-19T11:00", lage: "delad", rubrik: "Tandläkare" },
    ],
    ramdagar: ["2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21"],
    lager: { "2026-10-08": 2, "2026-11-18": 12, "2026-11-25": 2 },
    // Prickarna dag för dag ur förebild 7 (1-6 september syns inte där och har förebild 3:s). ⛔ UTAN LAGRETS PRICK: på lagerdagarna
    // ritar SS en egen prick i lagrets färg (`DayCell.js:330-357`, visningssättet "dot"), och den byggs inte i den här skivan
    // (granskningen av PR 260: en tredje visning av samma lager). Scenen fejkar den inte med extra poster, för då hade montaget sett
    // likare ut än förmågan är. Prickarna här är alltså bara förebildens HÄNDELSER.
    prickar: { "2026-09-01": 3, "2026-09-02": 4, "2026-09-03": 5, "2026-09-04": 3, "2026-09-06": 1, "2026-09-07": 1, "2026-09-08": 1, "2026-09-10": 3, "2026-09-11": 1, "2026-09-12": 4, "2026-09-14": 2, "2026-09-15": 3, "2026-09-16": 1, "2026-09-17": 4, "2026-09-18": 3, "2026-09-19": 1, "2026-09-20": 1, "2026-09-21": 2, "2026-09-22": 1, "2026-09-24": 6, "2026-09-25": 2, "2026-09-27": 1, "2026-09-29": 1, "2026-09-30": 1, "2026-10-01": 4, "2026-10-02": 1, "2026-10-03": 1, "2026-10-08": 1, "2026-10-24": 1 },
  },
  3: {
    poster: [...tgEnBorta(["2026-09-05", "2026-09-06", "2026-09-24", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]), { uid: "m4", start: "2026-10-08T09:00", slut: "2026-10-08T12:00", lage: "upptagen" }, ...TG_DOLDA],
    ramdagar: ["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30", "2026-10-07", "2026-10-14"],
    lager: {},
    // Utan lagrets prick, som i förebild 7:s scen ovan: en prick mindre på varje lagerdag.
    prickar: { "2026-09-01": 3, "2026-09-02": 3, "2026-09-03": 5, "2026-09-04": 3, "2026-09-06": 1, "2026-09-07": 1, "2026-09-08": 1, "2026-09-10": 3, "2026-09-11": 1, "2026-09-12": 4, "2026-09-14": 2, "2026-09-15": 3, "2026-09-16": 1, "2026-09-17": 4, "2026-09-18": 3, "2026-09-19": 1, "2026-09-20": 1, "2026-09-21": 2, "2026-09-22": 1, "2026-09-24": 6, "2026-09-25": 2, "2026-09-27": 1, "2026-09-29": 1, "2026-09-30": 1, "2026-10-01": 4, "2026-10-02": 1, "2026-10-03": 1, "2026-10-08": 1 },
  },
};
const TG_KAL = [{ id: "g", namn: "Gruppen", farg: 6 }, { id: "r", namn: "Resor", farg: 4 }, { id: "p", namn: "Privat", farg: 2 }];
/** @param {Record<string, number>} prickar */
const tgEntries = (prickar) => Object.entries(prickar).flatMap(([d, n]) => Array.from({ length: n }, (_, i) => ({ id: `${d}-${i}`, date: d, title: `Post ${i + 1}`, kalender: TG_KAL[(i + Number(d.slice(-2))) % 3] })));
/** @param {{ variant: 3 | 7 }} props */
function KalenderTillganglighetScen({ variant }) {
  const { OpsView, OpsCalendar, tillganglighetForDag, bortaAntal } = Ops;
  const v = TG_VARIANT[variant];
  const [tg, setTg] = useState(true);
  const [lager, setLager] = useState(true);
  return (
    <Full>
      <OpsView>
        <OpsCalendar
          ariaLabel="Kalender"
          entries={tgEntries(v.prickar)}
          today={TG_IDAG}
          monthsBack={1}
          monthsForward={1}
          // Sidan laddas med `setContent` och har ingen `localStorage`: enhetens minne är `window.__lagring`, som i `KalenderScen`.
          lagring={{ getItem: (n) => window.__lagring[n] ?? null, setItem: (n, v) => { window.__lagring[n] = v; } }}
          tillganglighet={{ pa: tg, onByt: setTg }}
          lager={{ pa: lager, onByt: setLager }}
          dagdekor={(d) => {
            const borta = tg && tillganglighetForDag ? bortaAntal(tillganglighetForDag({ medlemmar: TG_MEDLEMMAR, poster: v.poster, dag: d })) : 0;
            const ram = v.ramdagar.includes(d);
            const l = lager ? v.lager[d] || (ram ? 1 : 0) : 0;
            // N/N: gruppen är vald (sidan visar en grupp), som SS webbs `activeGroup`. Rutan ritar den bara när ingen är borta.
            const narvaro = tg ? { narvaro: { tillgangliga: TG_MEDLEMMAR.length - borta, totalt: TG_MEDLEMMAR.length } } : {};
            return { ...narvaro, ...(borta ? { borta: { antal: borta } } : {}), ...(l ? { lager: { antal: l }, ...(ram ? { ram: 1 } : {}) } : {}) };
          }}
        />
      </OpsView>
    </Full>
  );
}

/*
 * 0.54.0 (#244 beslut B och C): appraden. Samma kalender som `KalenderScen`, men med poster från fem moduler utöver
 * gruppens egna, alltså sex appar: fyra i raden och två under "Fler". Valet sparas i `window.__lagring` under gruppen "g1".
 */
const APP_POSTER = [
  ...KAL_POSTER,
  { id: "kvitto", date: "2026-10-12", title: "Kvitto Clas Ohlson", typ: "ekonomi:kvitto", status: "oppet" },
  { id: "lektion", date: "2026-10-12", title: "Matte, Elsa", typ: "skola:lektion", status: "oppet" },
  { id: "prov", date: "2026-10-14", title: "Engelska prov, Olle", typ: "skola:prov", status: "oppet" },
  { id: "sprint", date: "2026-10-12", title: "Sprintplanering", typ: "planering:mote", status: "oppet" },
  { id: "pass", date: "2026-10-15", title: "Löpning", typ: "traning:pass", status: "klart" },
  { id: "laxa", date: "2026-10-16", title: "Läxhjälp", typ: "familj:uppgift", status: "oppet" },
];
const APP_TYPER = [
  { id: "mote", namn: "Möte" }, { id: "deadline", namn: "Deadline" }, { id: "resa", namn: "Resa" }, { id: "ledig", namn: "Ledig" },
  { id: "ekonomi:kvitto", namn: "Kvitto", modulNamn: "Ekonomi" },
  { id: "skola:lektion", namn: "Lektion", modulNamn: "Skola" }, { id: "skola:prov", namn: "Prov", modulNamn: "Skola" },
  { id: "planering:mote", namn: "Möte", modulNamn: "Planering" },
  { id: "traning:pass", namn: "Pass", modulNamn: "Träning" },
  { id: "familj:uppgift", namn: "Uppgift", modulNamn: "Familj" },
];
function KalenderApparScen() {
  const { OpsView, OpsCalendar } = Ops;
  return (
    <Full>
      <OpsView>
        <OpsCalendar
          ariaLabel="Kalender"
          entries={APP_POSTER}
          today={KAL_IDAG}
          kalendrar={KAL_KALENDRAR}
          typer={APP_TYPER}
          statusWords={{ oppet: "Öppet", vantar: "Väntar", klart: "Klart" }}
          onSkapa={(d) => window.__skapat.push(d)}
          filterMinne="g1"
          lagring={{ getItem: (n) => window.__lagring[n] ?? null, setItem: (n, v) => { window.__lagring[n] = v; } }}
        />
      </OpsView>
    </Full>
  );
}

/*
 * 0.57.0 (cllp/lifehub.app#2): TALK. En inspelare utan mikrofon (nivån är en sinus så att prickarna rör sig), och det
 * appen får lämnas i `window.__talk`. Saknas `talk` i den byggda versionen ritas skalet utan, och avsnitt 39 blir rött.
 */
function TalkScen() {
  window.__talk = window.__talk || [];
  const inspelare = {
    starta: async () => {},
    stoppa: async () => ({ blob: new Blob(["ljud"], { type: "audio/webm" }), mimeType: "audio/webm", sekunder: 3.2 }),
    kasta: () => {},
    niva: () => 0.5 + 0.5 * Math.sin(Date.now() / 120),
  };
  return (
    <Full talk={{ onTalk: (_b, meta) => window.__talk.push(meta), onInstallningar: () => {}, inspelare, marke: <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent text-etikett font-bold text-accent-contrast">M</span> }}>
      <Ops.OpsView>
        <p>Idag</p>
      </Ops.OpsView>
    </Full>
  );
}

/*
 * 0.37.0 (#179 F2): Hantera kalendrar. Gruppens kalendrar (Styrelsen förvald, Resor, en arkiverad) och mina (Privat,
 * Träning), med sparningar som skriver tillbaka i scenens tillstånd och i `window.__sparat`, som en app med en källa.
 * Saknas `OpsKalendrar` i den byggda versionen (0.36.0) ritas en markör, och avsnitt 31 blir rött på det.
 */
const KH_G = "g1";
window.__sparat = [];
function KalendrarScen() {
  const { OpsView } = Ops;
  const [gruppens, setGruppens] = useState(() => [
    { id: "styrelse", namn: { sv: "Styrelsen" }, farg: 4, ikon: "kalender", ordning: 0, arkiverad: false, texter: {}, groupId: KH_G, forvald: true, iFlodet: false },
    { id: "resor", namn: { sv: "Resor" }, farg: 2, ikon: "portfolj", ordning: 10, arkiverad: false, texter: {}, groupId: KH_G, forvald: false, iFlodet: false },
    { id: "gammal", namn: { sv: "Gamla möten" }, farg: 1, ikon: "bok", ordning: 20, arkiverad: true, texter: {}, groupId: KH_G, forvald: false, iFlodet: false },
  ]);
  const [mina, setMina] = useState(() => [
    { id: "privat", namn: "Privat", farg: 5, ikon: "hjarta", ordning: 0, forvald: true, iFlodet: false, arkiverad: false },
    { id: "traning", namn: "Träning", farg: 3, ikon: "blixt", ordning: 10, forvald: false, iFlodet: false, arkiverad: false },
  ]);
  const skriv = (/** @type {any} */ set) => (/** @type {any[]} */ rader) => {
    window.__sparat.push(rader);
    set((/** @type {any[]} */ nu) => [...nu.filter((k) => !rader.some((r) => r.id === k.id)), ...rader]);
  };
  if (!Ops.OpsKalendrar) return <Full><p data-saknas="OpsKalendrar">OpsKalendrar saknas</p></Full>;
  return (
    <Full>
      <OpsView>
        <Ops.OpsKalendrar groupId={KH_G} gruppNamn="Claes Philip Staiger AB" gruppens={gruppens} mina={mina} kanAndraGruppens onSparaGruppens={skriv(setGruppens)} onSparaMina={skriv(setMina)} />
      </OpsView>
    </Full>
  );
}

/*
 * 0.37.0 (#179 F3, #206): "Ny händelse" med kalender. Formuläret är appens (rubrik, datum, från och till, som bolag-ops),
 * och skalet står för Kalender, Kräv svar och Blockerar. Panelen öppnas med `useOppnaSkapa()("handelse", { datum })`, som
 * appens kalender gör när en dag är vald, och `window.__formProps` är vad formuläret fick senast.
 */
window.__formProps = null;
function HandelseForm(/** @type {any} */ p) {
  window.__formProps = { datum: p.datum ?? null, kalender: p.kalender ?? null, kravSvar: p.kravSvar ?? null, blockerar: p.blockerar ?? null, typ: p.typ ?? null };
  const [rubrik, setRubrik] = useState("");
  const [datum, setDatum] = useState(p.datum ?? undefined);
  return (
    <form id={p.formId} data-app-formular="" className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
      <OpsField label="Rubrik">
        <OpsInput value={rubrik} onChange={setRubrik} placeholder="Till exempel Styrelsemöte" />
      </OpsField>
      <OpsField label="Datum">
        <OpsDatePicker value={datum} onChange={setDatum} />
      </OpsField>
      <div className="grid grid-cols-2 gap-3">
        <OpsField label="Från">
          <OpsTimePicker value="18:00" onChange={() => {}} />
        </OpsField>
        <OpsField label="Till">
          <OpsTimePicker value="20:00" onChange={() => {}} />
        </OpsField>
      </div>
    </form>
  );
}
function OppnaNyHandelse() {
  const oppna = Ops.useOppnaSkapa();
  useEffect(() => {
    try {
      oppna("handelse", { datum: "2026-10-12" });
    } catch (e) {
      // Mot en äldre dist finns inget `datum` att kasta på (0.36.0 ignorerar det): öppna ändå, så att resten mäts för sig.
      window.__oppnaFel = String(e && e.message);
      oppna("handelse");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p className="text-brod">Kalendern</p>;
}
function NyHandelseScen() {
  const kalendrar = {
    gruppens: [
      { id: "styrelse", namn: { sv: "Styrelsen" }, farg: 4, ikon: "kalender", ordning: 0, arkiverad: false, texter: {}, groupId: "g3", forvald: true, iFlodet: false },
      { id: "resor", namn: { sv: "Resor" }, farg: 2, ikon: "portfolj", ordning: 10, arkiverad: false, texter: {}, groupId: "g3", forvald: false, iFlodet: false },
    ],
    mina: [{ id: "privat", namn: "Privat", farg: 5, ikon: "hjarta", ordning: 0, forvald: true, iFlodet: false, arkiverad: false }],
  };
  return (
    <Full
      skapa={{
        lage: "g3",
        sparaEtikett: "Spara",
        handelse: { form: HandelseForm, katalog: "handelsetyper", kalendrar },
        kataloger: [{ id: "handelsetyper", kategorier: [{ id: "mote", namn: { sv: "Möte" }, ordning: 0 }, { id: "deadline", namn: { sv: "Deadline" }, ordning: 1 }] }],
      }}
    >
      <OppnaNyHandelse />
    </Full>
  );
}

/*
 * 0.38.0 (#194): "Ny händelse" öppen, och en app som byter vy ur `activeHref` som en riktig router. Appens vy visar vilken sida
 * den står på (`data-vy`), så provet kan mäta att klicket på en flik både stänger panelen och visar den nya vyn.
 */
function NavNyHandelseScen() {
  const [href, setHref] = useState("/");
  return (
    <Full
      aktivHref={href}
      onNavigate={(h, e) => {
        e.preventDefault();
        window.__gick.push(h);
        setHref(h);
      }}
      skapa={{ lage: "g3", sparaEtikett: "Spara", handelse: { form: HandelseForm } }}
    >
      <p data-vy={href} className="text-brod">Vy: {href}</p>
      {href === "/" ? <OppnaNyHandelse /> : null}
    </Full>
  );
}

/*
 * 0.37.0 (#179 F3): svaren på en händelse och inkorgens rad. Anna tittar; Bo har svarat Kommer inte, Cecilia inget.
 * `window.__svar` är vad knapparna skickade. Saknas `OpsSvar` (0.36.0) ritas en markör.
 */
window.__svar = [];
function SvarScen() {
  const { OpsView } = Ops;
  const [svar, setSvar] = useState([{ id: "bo", svar: "kommerInte" }]);
  if (!Ops.OpsSvar) return <Full><p data-saknas="OpsSvar">OpsSvar saknas</p></Full>;
  const svara = (/** @type {string} */ v) => {
    window.__svar.push(v);
    setSvar((nu) => [...nu.filter((x) => x.id !== "anna"), { id: "anna", svar: v }]);
  };
  return (
    <Full>
      <OpsView>
        <div className="flex flex-col gap-6">
          <Ops.OpsSvarsrad titel="Styrelsemöte" nar="Måndag 12 oktober, 18:00" onSvara={(v) => window.__svar.push(`rad:${v}`)} />
          <Ops.OpsSvar svar={svar} uid="anna" onSvara={svara} medlemmar={[{ uid: "anna", namn: "Anna Ek" }, { uid: "bo", namn: "Bo Lind" }, { uid: "cecilia", namn: "Cecilia Berg" }]} />
        </div>
      </OpsView>
    </Full>
  );
}

/*
 * 0.40.0 (#214): händelsepanelen. En app med Idag och Kalender i skalet, där en post med `handelseId` öppnar panelen. Idag har två flikar (Idag och
 * Kommande, tillståndet som ska finnas kvar efter Tillbaka) och tolv rader så att sidan rullar; kalendern är scenens `KAL_POSTER` med tre poster som är
 * händelser. Appens källa är `HANDELSE_VY`, och `rita` slår upp id:t ur den, som en app gör med sin egen källa. Saknas `OpsHandelsePanel` i den byggda
 * versionen (0.39.2) ritas en markör, och avsnitt 35 blir rött på det i stället för att sidan kastar. `window.__vy` är vilken vy appen står på.
 */
const HANDELSE_VY = {
  mote: { id: "mote", titel: "Styrelsemöte", datum: "2026-10-12", tid: "18:00", slutTid: "20:00", typ: { namn: "Möte", ikon: <Calendar size={16} />, slag: 1 }, status: "oppet", grupp: "Claes Philip Staiger AB", kalender: { namn: "Styrelsen", farg: 4 }, plats: "Kontoret, Visby", beskrivning: "Vi går igenom budgeten för fjärde kvartalet och beslutar om utdelningen. Handlingarna skickas ut en vecka före mötet, och den som inte kan komma ger sina synpunkter i förväg.", kravSvar: true },
  lon: { id: "lon", titel: "Löneutbetalning", datum: "2026-10-12", heldag: true, typ: { namn: "Deadline", ikon: <FileText size={16} />, slag: 2 }, status: "vantar", grupp: "Claes Philip Staiger AB" },
  tag: { id: "tag", titel: "Tåg till Malmö", datum: "2026-10-12", tid: "07:15", kalender: { namn: "Resor", farg: 2 }, status: "klart" },
  lang: { id: "lang", titel: "Konferens i Visby med en mycket lång rubrik som måste få bryta över flera rader på en smal skärm utan att klippas", datum: "2026-10-05", slutDatum: "2026-10-07", heldag: true, typ: { namn: "Resa", ikon: <FileText size={16} />, slag: 3 }, status: "oppet", plats: "Almedalsbiblioteket, Strandgatan 1, 621 56 Visby", beskrivning: "Ett långt ord som Sammanträdesprotokollsjusteringsförfarandet ska inte spränga kolumnen." },
};
const HANDELSE_RADER = [
  { id: "e-mote", title: "Styrelsemöte", daysLeft: 0, role: "Du", kind: "Möte", when: "Idag 18:00", slag: 1, slagLabel: "Möte", handelseId: "mote" },
  { id: "e-lon", title: "Löneutbetalning", daysLeft: 0, kind: "Deadline", when: "Idag", slag: 2, slagLabel: "Deadline", handelseId: "lon", atgard: <OpsButton variant="ghost" onClick={() => { window.__atgard = (window.__atgard ?? 0) + 1; }}>Markera</OpsButton>, details: <p>Tre löner.</p> },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `u${i}`, title: `Uppgift nummer ${i + 1}`, daysLeft: i + 1, kind: "Uppgift", when: `Om ${i + 1} dagar`, slag: 3, slagLabel: "Uppgift", atgard: <OpsButton variant="ghost">Klar</OpsButton> })),
  // En händelse långt ner i listan: provet rullar dit, öppnar den och mäter att rullningen kommer tillbaka.
  { id: "e-tag", title: "Tåg till Malmö", daysLeft: 14, kind: "Resa", when: "Om 14 dagar", slag: 3, slagLabel: "Resa", handelseId: "tag" },
];
window.__atgard = 0;
function HandelseSvarSlot({ id }) {
  const [svar, setSvar] = useState([{ id: "bo", svar: "kommerInte" }]);
  const { OpsSvar } = Ops;
  if (!OpsSvar) return <p data-saknas="OpsSvar">OpsSvar saknas</p>;
  return <OpsSvar svar={svar} uid="anna" onSvara={(v) => setSvar((nu) => [...nu.filter((x) => x.id !== "anna"), { id: "anna", svar: v }])} medlemmar={[{ uid: "anna", namn: "Anna Ek" }, { uid: "bo", namn: "Bo Lind" }, { uid: "cecilia", namn: "Cecilia Berg" }]} />;
}
function HandelseScen() {
  const { OpsView, OpsCalendar, OpsHandelsePanel } = Ops;
  const [href, setHref] = useState("/");
  const [flik, setFlik] = useState("idag");
  window.__vy = href;
  const posterMedId = KAL_POSTER.map((p) => (HANDELSE_VY[p.id] ? { ...p, handelseId: p.id } : p));
  const panel = OpsHandelsePanel
    ? {
        rita: ({ id, onTillbaka }) => <OpsHandelsePanel handelse={HANDELSE_VY[id] ?? null} onTillbaka={onTillbaka} statusWords={{ oppet: "Öppet", vantar: "Väntar", klart: "Klart" }} svar={<HandelseSvarSlot id={id} />} />,
      }
    : undefined;
  return (
    <Full
      aktivHref={href}
      onNavigate={(h, e) => {
        e.preventDefault();
        setHref(h);
      }}
      handelsepanel={panel}
    >
      {OpsHandelsePanel ? null : <p data-saknas="OpsHandelsePanel">OpsHandelsePanel saknas</p>}
      {href === "/kalender" ? (
        <OpsView>
          <OpsCalendar ariaLabel="Kalender" entries={posterMedId} today={KAL_IDAG} kalendrar={KAL_KALENDRAR} statusWords={{ oppet: "Öppet", vantar: "Väntar", klart: "Klart" }} />
        </OpsView>
      ) : (
        <OpsView>
          <div role="tablist" className="mb-3 flex gap-2">
            {["idag", "kommande"].map((f) => (
              <button key={f} role="tab" type="button" aria-selected={flik === f} data-flik={f} onClick={() => setFlik(f)} className="min-h-11 rounded-base border border-line px-3 text-etikett aria-selected:bg-accent-faint">
                {f === "idag" ? "Idag" : "Kommande"}
              </button>
            ))}
          </div>
          <OpsEventList ariaLabel="Idag" events={flik === "idag" ? HANDELSE_RADER.slice(0, 8) : HANDELSE_RADER} actionHint="Bara uppgifter går att markera." />
        </OpsView>
      )}
    </Full>
  );
}

/*
 * 0.60.0 (#251, beslut 0003): tillägg på händelseytan. En provmodul "Datumomröstning" utan egen yta, med en sektion i panelen
 * (`handelse.sektion`) och en rad i plussets händelsedel (`handelse.atgard`), påslagen i gruppen g1. En andra modul har en sektion
 * men är AVSLAGEN, och dess komponent markerar om den ändå anropas. Ekonomi har en egen yta och står med i inställningslistan.
 * "tillagg" ritar panelen fristående i skalet, "tillagg-installning" gruppens inställningar med alla appar. Saknas `tillaggFor`
 * i den byggda versionen (0.59.0) ritas en markör, och avsnitt 40 blir rött på det i stället för att sidan kastar.
 */
function TillaggRostning({ handelse, grupp }) {
  const forslag = [
    { dag: "tis 13 okt, 18:00", roster: 4 },
    { dag: "ons 14 okt, 18:00", roster: 2 },
    { dag: "tor 15 okt, 17:30", roster: 5 },
  ];
  return (
    <div data-provtillagg="rostning" data-handelse={handelse.id} data-grupp={grupp.id} className="flex flex-col gap-1.5">
      {forslag.map((f) => (
        <div key={f.dag} className="flex min-h-11 items-center justify-between gap-3 rounded-base border border-line bg-raised px-3 text-etikett text-ink">
          <span>{f.dag}</span>
          <span className="text-meta text-ink-muted">{f.roster} röster</span>
        </div>
      ))}
    </div>
  );
}
function TillaggNyRostning() {
  return <OpsPanelRow icon={<CalendarDays size={18} />} label="Ny datumomröstning" accent onClick={() => { window.__nyRostning = (window.__nyRostning ?? 0) + 1; }} />;
}
function TillaggAvslagen() {
  window.__avslagenAnropad = true;
  return <p data-provtillagg="avslagen">Avslagen modul</p>;
}
const TILLAGG_MODULER = () =>
  Ops.validateModuler([
    {
      id: "omrostning",
      namn: { sv: "Datumomröstning", en: "Date poll" },
      nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: null,
      tillagg: [
        { plats: "handelse.sektion", id: "rostning", etikett: { sv: "Omröstning", en: "Poll" }, komponent: TillaggRostning },
        { plats: "handelse.atgard", id: "ny", etikett: { sv: "Ny datumomröstning", en: "New date poll" }, komponent: TillaggNyRostning },
      ],
    },
    {
      id: "anteckningar",
      namn: { sv: "Anteckningar", en: "Notes" },
      nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: null,
      tillagg: [{ plats: "handelse.sektion", id: "anteckning", etikett: { sv: "Anteckningar", en: "Notes" }, komponent: TillaggAvslagen }],
    },
    {
      id: "ekonomi",
      namn: { sv: "Ekonomi", en: "Finance" },
      nav: [{ href: "/ekonomi", label: "Ekonomi" }], routes: [], samlingar: [], kallor: {}, skapar: [],
      hubb: { ikon: <Wallet size={20} />, rutt: "/ekonomi", startsida: "oversikt", delar: [{ id: "oversikt", namn: { sv: "Översikt", en: "Overview" }, ikon: <LayoutGrid size={16} />, rutt: "/ekonomi/oversikt" }] },
    },
  ]);
function TillaggScen() {
  const { OpsHandelsePanel } = Ops;
  if (!Ops.tillaggFor) return <Full><p data-saknas="tillaggFor">tillaggFor saknas</p></Full>;
  const moduler = TILLAGG_MODULER();
  const grupp = { id: "g1", namn: { sv: "Claes Philip Staiger Konsulting och Förvaltning AB" }, moduler: ["ekonomi", "omrostning"] };
  return (
    <Full skapa={{ handelse: <p>Formulär</p>, lage: grupp.id, moduler, aktivGrupp: grupp }}>
      <OpsHandelsePanel handelse={{ ...HANDELSE_VY.mote, kravSvar: false }} onTillbaka={() => {}} statusWords={{ oppet: "Öppet" }} moduler={moduler} grupp={grupp} />
    </Full>
  );
}
function TillaggInstallningScen() {
  const { OpsView, OpsGruppFormular } = Ops;
  if (!Ops.tillaggFor) return <Full><p data-saknas="tillaggFor">tillaggFor saknas</p></Full>;
  const moduler = TILLAGG_MODULER();
  return (
    <Full>
      <OpsView>
        <OpsGruppFormular grupp={{ id: "g1", namn: { sv: "Claes Philip Staiger Konsulting och Förvaltning AB" }, moduler: ["ekonomi", "omrostning"] }} onSpara={async () => {}} moduler={{ valbara: Ops.valbaraModuler(moduler), agare: true }} />
      </OpsView>
    </Full>
  );
}

/*
 * 0.40.0 (#214): att ÄNDRA en händelse. Samma app som `handelse` men med pennan i panelen (`onRedigera`) och skalets redigeringsläge
 * (`skapa.handelse.redigera`). Appens källa är `REDIGERA_RADER`, en liten butik som formuläret skriver i och panelen läser ur, som en
 * app gör med sin databas. `?utanpenna=1` ritar panelen utan `onRedigera` (appen ger ingen penna till den som inte får ändra). Saknas
 * `onRedigera` i den byggda versionen (0.39.2) ritas ingen penna, och avsnitt 36 blir rött på det i stället för att sidan kastar.
 */
const REDIGERA_RADER = { mote: { id: "mote", rubrik: "Styrelsemöte", datum: "2026-10-12", tid: "18:00", slutTid: "20:00", text: "Vi går igenom budgeten.", typ: "mote", kalenderId: "styrelse", kravSvar: true } };
const REDIGERA_LYSSNARE = new Set();
function useRedigeraRader() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((x) => x + 1);
    REDIGERA_LYSSNARE.add(l);
    return () => REDIGERA_LYSSNARE.delete(l);
  }, []);
  return REDIGERA_RADER;
}
window.__sparade = [];
function useRedigeraHandelse(id) {
  const rader = useRedigeraRader();
  const r = rader[id];
  return r ? { laddar: false, finns: true, typ: r.typ, kalenderId: r.kalenderId, kravSvar: r.kravSvar === true } : { laddar: false, finns: false };
}
function RedigeraForm(/** @type {any} */ p) {
  const rader = useRedigeraRader();
  const r = rader[p.redigera] ?? {};
  window.__redigeraProps = { redigera: p.redigera ?? null, typ: p.typ ?? null, kalender: p.kalender ?? null, kravSvar: p.kravSvar ?? null };
  const [rubrik, setRubrik] = useState(r.rubrik ?? "");
  const [datum, setDatum] = useState(r.datum ?? undefined);
  const [tid, setTid] = useState(r.tid ?? "");
  const [slutTid, setSlutTid] = useState(r.slutTid ?? "");
  return (
    <form
      id={p.formId}
      data-app-formular=""
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        REDIGERA_RADER[p.redigera] = { ...rader[p.redigera], rubrik, datum, tid, slutTid, typ: p.typ, kalenderId: p.kalender?.id, kravSvar: p.kravSvar };
        window.__sparade.push({ id: p.redigera, rubrik, kalenderId: p.kalender?.id, kravSvar: p.kravSvar });
        REDIGERA_LYSSNARE.forEach((l) => l());
        p.onKlar();
      }}
    >
      <OpsField label="Rubrik">
        <OpsInput value={rubrik} onChange={setRubrik} />
      </OpsField>
      <OpsField label="Datum">
        <OpsDatePicker value={datum} onChange={setDatum} />
      </OpsField>
      <div className="grid grid-cols-2 gap-3">
        <OpsField label="Från">
          <OpsTimePicker value={tid} onChange={setTid} />
        </OpsField>
        <OpsField label="Till">
          <OpsTimePicker value={slutTid} onChange={setSlutTid} />
        </OpsField>
      </div>
    </form>
  );
}
function RedigeraPanel({ id, onTillbaka }) {
  const { OpsHandelsePanel } = Ops;
  const oppna = Ops.useOppnaSkapa();
  const rader = useRedigeraRader();
  const r = rader[id];
  const utanPenna = new URLSearchParams(window.location.search).get("utanpenna") === "1";
  if (!OpsHandelsePanel) return <p data-saknas="OpsHandelsePanel">OpsHandelsePanel saknas</p>;
  return (
    <OpsHandelsePanel
      handelse={r ? { id, titel: r.rubrik, datum: r.datum, tid: r.tid || undefined, slutTid: r.slutTid || undefined, typ: { namn: "Möte", ikon: <Calendar size={16} />, slag: 1 }, status: "oppet", grupp: "Claes Philip Staiger AB", kalender: { namn: "Styrelsen", farg: 4 }, beskrivning: r.text } : null}
      onTillbaka={onTillbaka}
      statusWords={{ oppet: "Öppet" }}
      onRedigera={utanPenna ? undefined : () => oppna("handelse", { id })}
    />
  );
}
function HandelseRedigeraScen() {
  const kalendrar = {
    gruppens: [
      { id: "styrelse", namn: { sv: "Styrelsen" }, farg: 4, ikon: "kalender", ordning: 0, arkiverad: false, texter: {}, groupId: "g3", forvald: true, iFlodet: false },
      { id: "resor", namn: { sv: "Resor" }, farg: 2, ikon: "portfolj", ordning: 10, arkiverad: false, texter: {}, groupId: "g3", forvald: false, iFlodet: false },
    ],
    mina: [],
  };
  return (
    <Full
      skapa={{
        lage: "g3",
        sparaEtikett: "Spara",
        handelse: { form: RedigeraForm, katalog: "handelsetyper", kalendrar, redigera: useRedigeraHandelse },
        kataloger: [{ id: "handelsetyper", kategorier: [{ id: "mote", namn: { sv: "Möte" }, ordning: 0 }, { id: "deadline", namn: { sv: "Deadline" }, ordning: 1 }] }],
      }}
      handelsepanel={{ rita: ({ id, onTillbaka }) => <RedigeraPanel id={id} onTillbaka={onTillbaka} /> }}
    >
      <p data-vy="">Idag</p>
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
/*
 * 0.37.0 (#184): Ekonomi som EN modul med bolag-ops fjorton delar, registrerad med `defineModule`. Kastar den (en dist utan
 * `hubb`) blir svaret `null` och scenen ritar en markör.
 */
const EKONOMIDELAR = [
  ["oversikt", "Översikt"], ["inkomster", "Inkomster"], ["kostnader", "Kostnader"], ["abonnemang", "Abonnemang"], ["tillgangar", "Tillgångar"],
  ["pension", "Pension"], ["forsakringar", "Försäkringar"], ["liv", "Liv"], ["schema", "Schema"], ["cutover", "Cutover"],
  ["bolaget", "Bolaget"], ["kontakter", "Kontakter"], ["lankar", "Länkar"], ["jamforelse", "Jämförelse"],
];
const HUBBGRUPPER = { g3: ["ekonomi"], g2: [], g1: ["ekonomi", "bokning"] };
let hubbCache;
function hubbLage() {
  if (hubbCache !== undefined) return hubbCache;
  try {
    hubbCache = Ops.OpsGruppHubb && Ops.OpsModulSida
      ? Ops.validateModuler([
          {
            id: "ekonomi", namn: { sv: "Ekonomi" }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [],
            hubb: { ikon: <Wallet size={IKON} />, rutt: "/ekonomi", startsida: "oversikt", delar: EKONOMIDELAR.map(([id, sv]) => ({ id, namn: { sv }, ikon: <Settings size={16} />, rutt: `/ekonomi/${id}` })) },
          },
        ])
      : null;
  } catch {
    hubbCache = null;
  }
  return hubbCache;
}

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

/*
 * 0.35.0 (#190): "ingen" är scenen där personen inte är med i någon grupp, det enda tillståndet utan aktiv grupp. Läget
 * "Alla mina grupper" finns inte längre, och en scen med grupper har alltid en aktiv.
 */
/** 0.39.1 (#497): `window.__manga` lägger till så många grupper att panelen måste rulla. Utan det finns ingen botten att nå. */
const manyaGrupper = (lista) => [...lista, ...Array.from({ length: window.__manga ?? 0 }, (_, i) => ({ id: `x${i}`, namn: { sv: `Extragrupp nummer ${i + 1}` }, medlemsantal: 2 }))];
const utanGrupp = () => window.__aktiv === "ingen";
const aktivIScenen = () => (utanGrupp() ? "" : window.__aktiv ?? "g1");

function Full({ children, utanMeny = false, skapa = { handelse: <p>Formulär</p> }, extraActions = null, moduler: skaletsModuler = hubModuler, onNavigate = undefined, aktivHref = "/", handelsepanel = undefined, talk = undefined }) {
  const [infalld, setInfalld] = useState(false);
  const [aktiv, setAktiv] = useState(aktivIScenen());
  return (
    <OpsAppShell
      fasta={{ idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } }}
      moduler={skaletsModuler}
      activeHref={aktivHref}
      onNavigate={onNavigate}
      actions={
        <>
          <OpsThemeToggle />
          <OpsIconLink href="/inkorg" icon={<Inbox size={IKON} />} label="Inkorg" badge={3} />
          {extraActions}
          <OpsIconLink href="/sok" icon={<Search size={IKON} />} label="Sök" />
          <OpsIconLink href="/fraga" icon={<Sparkles size={IKON} />} label="Fråga" />
        </>
      }
      anvandare={<OpsIconLink avatar href="/profil" label="Min profil" icon={<OpsIdentity name="Claes Philip" seed="u1" size="md" />} />}
      skapa={skapa}
      handelsepanel={handelsepanel}
      talk={talk}
      meny={utanMeny ? undefined : meny}
      grupper={{ lista: utanGrupp() ? [] : window.__skal === "gruppkort" ? g2Lista : manyaGrupper(grupperLista), aktiv, onValj: setAktiv, infalld, onInfalld: setInfalld, onSkapa: () => {}, onInfo: () => {}, onRedigera: () => {} }}
    >
      {children}
    </OpsAppShell>
  );
}

/*
 * 0.34.0 (#182): meddelanden. En samtalskälla mot minnesadaptern med gruppchatten, ett privat samtal med två olästa och
 * ett samtal Anna inte deltar i. Saknas samtalen i den byggda versionen (0.33.0) ritas en markör, och avsnitt 29 blir rött
 * på det i stället för att sidan kastar.
 */
const MEDLEMMAR_M = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "cecilia", namn: "Cecilia Berg", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];
let samtalskallan = null;
async function byggSamtalskalla() {
  if (!Ops.createSamtalskalla) return null;
  let t = new Date(2026, 8, 30, 9, 0).getTime();
  const s = Ops.createSamtalskalla({ kalla: Ops.createMemorySource({}), klocka: () => (t += 60000) });
  const g = await s.oppnaGrupp({ groupId: "g1", uid: "anna" });
  await s.skicka(g.id, { text: "Hej alla, styrelsemötet flyttas till fredag klockan tio.", av: "cecilia" });
  const p = await s.oppnaPrivat({ groupId: "g1", uid: "bo", annan: "anna" });
  await s.skicka(p.id, { text: "Hej Anna! Kan du titta på fakturan från Bokio innan fredag?", av: "bo" });
  await s.skicka(p.id, { text: "Absolut, jag gör det i eftermiddag.", av: "anna" });
  await s.skicka(p.id, { text: "Tack! Den ligger i inkorgen.", av: "bo" });
  await s.skicka(p.id, { text: "Och en sak till: momsen för augusti.", av: "bo" });
  // 0.39.1 (#497): `window.__manga` fyller samtalet så att loggen måste rulla, annars finns ingen botten att nå.
  for (let i = 0; i < (window.__manga ?? 0); i += 1) await s.skicka(p.id, { text: `Meddelande nummer ${i + 1} i ett långt samtal som måste rullas.`, av: i % 2 ? "bo" : "anna" });
  const annat = await s.oppnaPrivat({ groupId: "g1", uid: "bo", annan: "cecilia" });
  await s.skicka(annat.id, { text: "Det här får Anna aldrig se.", av: "bo" });
  return s;
}
function MeddelandeScen() {
  const [kalla, setKalla] = useState(samtalskallan);
  const [olasta, setOlasta] = useState(0);
  const [valt, setValt] = useState(null);
  if (!Ops.OpsMeddelanden) return <Full><p data-saknas="OpsMeddelanden">OpsMeddelanden saknas</p></Full>;
  if (!kalla) {
    byggSamtalskalla().then((k) => {
      samtalskallan = k;
      setKalla(k);
    });
  }
  return (
    <Full
      extraActions={<Ops.OpsMeddelandeLank href="/meddelanden" olasta={olasta} />}
      skapa={{
        handelse: <p>Formulär</p>,
        lage: "g1",
        meddelande: ({ formId, groupId, onKlar }) => (
          <Ops.OpsNyttMeddelande formId={formId} groupId={groupId} uid="anna" medlemmar={MEDLEMMAR_M} kalla={kalla} onKlar={(id) => { onKlar(); setValt(id); }} />
        ),
      }}
    >
      {kalla ? (
        <Ops.OpsMeddelanden kalla={kalla} uid="anna" groupId="g1" gruppNamn="Claes Philip Staiger Konsulting och Förvaltning AB" medlemmar={MEDLEMMAR_M} onOlasta={setOlasta} valt={valt} onValj={setValt} onNytt={() => {}} />
      ) : (
        <p>Laddar</p>
      )}
    </Full>
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
  lage: aktivIScenen() || null,
  sparaEtikett: "Skicka in",
  skapaISektioner: [{ id: "kalendrar", rubrik: "Mina kalendrar", poster: [{ id: "k1", namn: "Semester" }, { id: "k2", namn: "Jobb" }] }],
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
      {ruta("gruppvaljare", <div className="w-72"><OpsGruppvaljare grupper={grupperLista} aktiv={gr} onValj={setGr} rubrik="Grupper" /></div>)}
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
  // 0.62.0 (granskningen av #261): huvudet UTAN `meny`, med fem åtgärder (tema, inkorg, påminnelser, sök, fråga) plus avataren.
  // Före 0.62.0 flyttades inga åtgärder utan `meny`, och huvudet svämmade över vid 320 px. Avsnitt 6b mäter 320 och 360.
  if (s === "utanmeny") {
    return (
      <Full utanMeny extraActions={<OpsIconLink href="/paminnelser" icon={<Calendar size={IKON} />} label="Påminnelser" />}>
        <p className="px-4 text-brod">innehåll</p>
      </Full>
    );
  }
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
  // 0.37.0 (#184): hubben för den aktiva gruppen och modulens insida. Grupperna: g3 har Ekonomi, g2 har inga moduler, g1 har
  // Ekonomi och en modul appen inte registrerat. Saknas `OpsGruppHubb` (0.37.0 och äldre) ritas en markör, och avsnitt 9c blir
  // rött på det i stället för att sidan kastar.
  // "modulsida|/ekonomi/jamforelse": adressen efter strecket är den som visas.
  if (s === "grupphubb" || s.startsWith("modulsida")) {
    const lage = hubbLage();
    if (!lage) return <Full><p data-saknas="OpsGruppHubb">OpsGruppHubb saknas</p></Full>;
    const grupp = { ...grupperLista.find((g) => g.id === aktivIScenen()), moduler: HUBBGRUPPER[aktivIScenen()] ?? [] };
    const poster = Ops.hubbPoster(Ops.hubbForGrupp({ grupp, moduler: lage }).kort, { info: { ekonomi: "Skatten förfaller 12 oktober" } });
    if (s === "grupphubb") {
      return (
        <Full moduler={poster}>
          <Ops.OpsGruppHubb grupp={grupp} moduler={lage} activeHref="/hub" onNavigate={gaTill} info={{ ekonomi: "Skatten förfaller 12 oktober" }} />
        </Full>
      );
    }
    return (
      <Full moduler={poster}>
        <Ops.OpsModulSida modul={lage[0]} activeHref={s.split("|")[1] ?? "/ekonomi/inkomster"} hubHref="/hub" onNavigate={gaTill}>
          <p data-moduldel-innehall="">Delens innehåll</p>
        </Ops.OpsModulSida>
      </Full>
    );
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
  // 0.32.1 (CP 2026-09-30 08:04, "Kolla storleken och fint på texten i händelserna. Matchar inte det vi har i SessionStudio.
  // Dubbelkolla även inkorgen."): två händelsekort som bolag-ops Idag, en inkorgsrad i `OpsDisclosure` med en summary utan
  // egen klass, och en liten `OpsPill`. `OpsRollmarke` finns inte i 0.32.0: då ritas en markör och provet blir rött på rätt sak.
  if (s === "handelsekort") {
    const { OpsView, OpsDisclosure } = Ops;
    const Roll = Ops.OpsRollmarke ?? (({ label }) => <span data-saknas="OpsRollmarke">{label}</span>);
    const handelser = [
      { id: "k1", title: "Kundfaktura 119223 Adavo AB, skickad, väntar betalning, 158 400 kr inkl moms", daysLeft: -20, role: <Roll kind="human" label="Du" />, kind: "Faktum", slag: 1, slagLabel: "Faktum", when: "För 20 dagar sedan", deadline: "Senast 10 sep", details: <p>Fakta om fakturan.</p> },
      { id: "k2", title: "Attest större leverantörsfakturor", daysLeft: 3, role: <Roll kind="auto" label="Förfaller" />, kind: "Påminnelse", slag: 2, slagLabel: "Påminnelse", when: "Om 3 dagar", deadline: "Senast 3 okt", details: <p>Tre fakturor över 50 000 kr.</p> },
    ];
    return (
      <Full>
        <OpsView>
          <div data-handelser="">
            <OpsEventList events={handelser} />
          </div>
          {/* 0.33.1: en inkorgsrad som REFERENS i montaget, med bolag-ops InboxView:s klasser (datum text-meta, titel text-etikett font-medium,
              pill OpsPill liten). En kopia, så den mäter ingenting: den är bilden bredvid händelsekorten. */}
          <div data-inkorgsrad="" className="flex items-baseline justify-between gap-3 rounded-card border border-line bg-raised px-3 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="shrink-0 tabular-nums text-meta text-ink-muted">2026-09-30</span>
                <span className="text-etikett font-medium text-ink">Kundfaktura 119223 Adavo AB, skickad, väntar</span>
              </div>
              <div className="mt-0.5 text-etikett text-ink-muted">Ärende</div>
            </div>
            <OpsPill size="liten" tone="warning">Hög</OpsPill>
          </div>
          <OpsDisclosure summary={<span data-summary-utan-klass="">Kundfaktura 119223 Adavo AB, skickad</span>}>
            <p>Innehåll</p>
          </OpsDisclosure>
          <span data-pill-liten="">
            <OpsPill size="liten">Ärende</OpsPill>
          </span>
        </OpsView>
      </Full>
    );
  }
  // 0.32.1 (CP 2026-09-30, skärmbild av Profil på dator: "Typsnitten på profil är också fel. Storlek / typsnitt"): profilen som
  // bolag-ops ritar den, med bild (så att Ta bort och Använd initialer syns), roll och en grupp.
  if (s === "profil") {
    const bild = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#8E7A4E"/></svg>');
    return (
      <Full>
        <Ops.OpsProfil
          anvandare={{ id: "u1", namn: "Claes Philip Staiger", epost: "claes-philip@staiger.se", bild, telefon: "+46701234567", stad: "Visby", presentation: "", lankar: [], sprak: "sv", tema: "system" }}
          roll="Ägare"
          grupper={[{ grupp: { id: "g1", namn: "Claes Philip Staiger AB" }, roll: "agare" }]}
          onSpara={async () => {}}
          inloggningsBild={bild}
        />
      </Full>
    );
  }
  // 0.32.1: ytor som ska nå bottenraden, se `FullYta`.
  if (s === "fullyta-idag") return <FullYta vy="idag" />;
  if (s === "fullyta-kalender") return <FullYta vy="kalender" />;
  if (s === "kalender") return <KalenderScen />;
  if (s === "kalender-appar") return <KalenderApparScen />;
  if (s === "kalender-tillganglighet") return <KalenderTillganglighetScen variant={7} />;
  if (s === "kalender-tillganglighet-3") return <KalenderTillganglighetScen variant={3} />;
  // Samma scen med veckonumren på (granskningen av PR 260: rutan blir smalare och brickan klipptes). Enhetens minne säger "1".
  if (s === "kalender-tillganglighet-vecka") {
    window.__lagring["ops-kalender-veckonummer"] = "1";
    return <KalenderTillganglighetScen variant={7} />;
  }
  if (s === "talk") return <TalkScen />;
  if (s === "kalendrar") return <KalendrarScen />;
  if (s === "ny-handelse") return <NyHandelseScen />;
  if (s === "ny-handelse-nav") return <NavNyHandelseScen />;
  if (s === "svar") return <SvarScen />;
  if (s === "handelse") return <HandelseScen />;
  if (s === "handelse-redigera") return <HandelseRedigeraScen />;
  if (s === "tillagg") return <TillaggScen />;
  if (s === "tillagg-installning") return <TillaggInstallningScen />;
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
          <OpsKatalogInstallning kategorier={kategorier} ikoner={["wallet", "inbox"]} kanAndra onSpara={() => {}} onArkivera={() => {}} rubrik="Kategorier" groupId="cps-ab" />
        </div>
      </Skal>
    );
  }
  if (s === "modultyper") {
    return (
      <Skal>
        <ModultyperScen />
      </Skal>
    );
  }
  if (s === "meddelanden") return <MeddelandeScen />;
  if (s === "installning-grupper") {
    return (
      <Skal>
        <InstallningTvaGrupper />
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
