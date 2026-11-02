import { createRoot } from "react-dom/client";
import { useState } from "react";
import * as Ops from "OPS_DIST";

// Toppraden med appikoner (0.177.0). Samma skal som lifehub.app bygger det: hemikon, gruppmärke, Inkorg som åtgärd, fästa appar, Sök och Fråga,
// avatar och Meny. window.__lage och window.__antal styr scenen:
//   "kapacitet": antal appikoner ritas som EGEN komponent runt OpsIconLink (alltså inte som `kvarIHuvudet`), så skalet kan inte kapa dem.
//                Det är mätningen av vad toppraden RYMS, och den ger talet `HUVUDMENY_MAX`.
//   "tak":       antal appikoner ritas som riktiga `kvarIHuvudet`-ikoner, och skalet ska kapa vid taket och lägga resten i Meny.
const lista = [
  { id: "mitt", namn: "Mitt projekt", roll: "agare", ikon: "user", farg: "blue" },
  { id: "lang", namn: "Claes Philip Staiger Konsulting Aktiebolag", roll: "agare", ikon: "briefcase", farg: "green" },
];
const fasta = { idag: { href: "/idag" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const APPAR = ["Bibliotek", "Meddelanden", "Ekonomi", "Recept", "Agenter", "Foton", "Planering", "Resor", "Kalendrar", "Budget"];

function Appikon({ id, label, badge }) {
  return <Ops.OpsIconLink href={`/${id}`} label={label} icon={<Ops.OpsIdentity name={label} seed={id} size="sm" />} {...(badge ? { badge } : {})} />;
}

function Yta() {
  const lage = window.__lage;
  window.__max = Ops.HUVUDMENY_MAX;
  const antal = Number(window.__antal);
  const [aktiv, setAktiv] = useState("lang");
  const [sparade, setSparade] = useState(/** @type {string[] | null} */ (null));
  const valda = APPAR.slice(0, antal);
  const grupp = { moduler: valda.map((n) => n.toLowerCase()), huvudmeny: sparade ?? valda.map((n) => n.toLowerCase()) };
  const moduler = valda.map((n) => ({ id: n.toLowerCase(), namn: { sv: n, en: n }, hubb: { rutt: `/${n.toLowerCase()}`, ikon: <i /> } }));
  window.__sparade = sparade;
  return (
    <Ops.OpsAppShell
      brand="LIFE HUB"
      fasta={fasta}
      activeHref="/idag"
      onNavigate={(_h, e) => e.preventDefault()}
      actions={
        <>
          <Ops.OpsIconLink href="/inkorg" label="Inkorg" badge={3} icon={<Ops.OpsIdentity name="Inkorg" seed="inkorg" size="sm" />} />
          {valda.map((n, i) =>
            lage === "kapacitet" ? (
              <Appikon key={n} id={n.toLowerCase()} label={n} badge={i === 1 ? 12 : 0} />
            ) : (
              <Ops.OpsIconLink key={n} href={`/${n.toLowerCase()}`} label={n} kvarIHuvudet badge={i === 1 ? 12 : undefined} icon={<Ops.OpsIdentity name={n} seed={n} size="sm" />} />
            ),
          )}
          <Ops.OpsIconLink href="/sok" label="Sök" icon={<Ops.OpsIdentity name="Sök" seed="sok" size="sm" />} />
          <Ops.OpsIconLink href="/fraga" label="Fråga" icon={<Ops.OpsIdentity name="Fråga" seed="fraga" size="sm" />} />
        </>
      }
      anvandare={<Ops.OpsIconLink href="/profil" label="Min profil" avatar icon={<Ops.OpsIdentity name="Claes-Philip Staiger" seed="cp" size="sm" />} />}
      meny={{ sektioner: [], onLoggaUt: () => {} }}
      grupper={{ lista, aktiv, onValj: (id) => setAktiv(id), oversikt: { aktiv: false, onValj: () => {} } }}
      {...(lage === "tak" ? { apparArk: { moduler, grupp, farAndra: window.__farAndra !== false, ...(window.__utanCallback ? {} : { onSparaHuvudmeny: (m) => setSparade(m) }) } } : {})}
    >
      <Ops.OpsView>
        <Ops.OpsViewHeader title="Idag" description="" />
        <div data-huvudmeny-yta="" />
      </Ops.OpsView>
    </Ops.OpsAppShell>
  );
}

createRoot(document.getElementById("root")).render(<Yta />);
