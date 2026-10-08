import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsHub, OpsHubModul } from "../components/OpsHub.jsx";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { OpsGruppvaxlare } from "../components/OpsGruppanel.jsx";
import { OpsBrand } from "../components/OpsBrand.jsx";
import { validateNav } from "../lib/nav.js";

/**
 * 0.30.1, CP 2026-09-29 13:44: mobilhuvudet, gruppanelen och loggan, Hub. jsdom kör ingen CSS, så det som beror på pixlar
 * (överlappning, mittlinjer, logans vänsterkant) mäts i `scripts/check-skalyta.mjs`. Det här är strukturen och beteendet.
 */

const fasta = { idag: { href: "/" }, kalender: { href: "/kalender" }, hub: { href: "/hub" } };
const moduler = [
  { href: "/oversikt", label: "Översikt", info: "3 saker att göra" },
  { href: "/ekonomi", label: "Ekonomi", badge: 2, info: { sv: "Skatten förfaller", en: "Tax is due" }, children: [{ href: "/inkomster", label: "Inkomster", badge: 1, info: null }, { href: "/kostnader", label: "Kostnader" }] },
  { href: "/schema", label: "Schema", badge: 0, info: null },
  { href: "/cutover", label: "Cutover" },
];
const meny = { sektioner: [[{ key: "a", etikett: "Aktivitet", onClick: () => {} }]], onLoggaUt: () => {} };
const atgarder = (
  <>
    <OpsIconLink href="/tema" label="Tema" icon={<i />} />
    <OpsIconLink href="/inkorg" label="Inkorg" badge={3} icon={<i />} />
    <OpsIconLink href="/sok" label="Sök" icon={<i />} />
    <OpsIconLink href="/fraga" label="Fråga" icon={<i />} />
  </>
);
const Skal = (extra = {}) => (
  <OpsAppShell brand="Ops" fasta={fasta} moduler={moduler} activeHref="/" actions={atgarder} meny={meny} {...extra}>
    <p>innehåll</p>
  </OpsAppShell>
);

describe("A: Hub, modulkort och modulsida (0.30.1)", () => {
  it("räknaren ritas bara när den är större än noll, och info bara när appen har något att säga", () => {
    render(<OpsHub moduler={moduler} />);
    const lista = screen.getByRole("list", { name: "Appar" });
    // 0.83.0: kortet med barn är en länk (chevronen är en egen knapp bredvid).
    const ekonomi = within(lista).getByRole("link", { name: /^Ekonomi/ });
    expect(ekonomi.textContent).toContain("2");
    expect(ekonomi.textContent).toContain("Skatten förfaller");
    // badge 0: ingen räknare. Det finns inget "0" i kortet.
    expect(within(lista).getByRole("link", { name: /Schema/ }).textContent).not.toMatch(/\b0\b/);
    // info utelämnad: ingenting alls under namnet.
    expect(within(lista).getByRole("link", { name: /Cutover/ }).textContent).toBe("Cutover");
  });

  it("⛔ info: null säger \"Inget nytt\", utelämnad info säger ingenting (tomhet är ett svar)", () => {
    render(<OpsHub moduler={moduler} />);
    expect(within(screen.getByRole("link", { name: /Schema/ })).getByText("Inget nytt")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Cutover/ }).textContent).not.toContain("Inget nytt");
  });

  it("språket styr både info och ramverkets egen text", () => {
    render(<OpsHub moduler={moduler} sprak="en" />);
    expect(screen.getByText("Tax is due")).toBeTruthy();
    // 0.83.0: chevronens namn i stället för raden "Show Ekonomi", som är borta.
    fireEvent.click(screen.getByRole("button", { name: "Show the parts of Ekonomi" }));
    expect(screen.queryByRole("link", { name: "Show Ekonomi" })).toBeNull();
    expect(screen.getAllByText("Nothing new").length).toBeGreaterThan(0);
  });

  it("⛔ info valideras: en tom sträng och fel form kastar, null och utelämnad godtas", () => {
    expect(() => validateNav([{ href: "/a", label: "A", info: "" }], "T")).toThrow(/info/);
    expect(() => validateNav([{ href: "/a", label: "A", info: 5 }], "T")).toThrow(/info/);
    expect(() => validateNav([{ href: "/a", label: "A", info: { en: "x" } }], "T")).toThrow(/info/);
    expect(() => validateNav([{ href: "/a", label: "A", children: [{ href: "/b", label: "B", info: "  " }] }], "T")).toThrow(/info på "B"/);
    expect(() => validateNav([{ href: "/a", label: "A", info: null }, { href: "/b", label: "B" }, { href: "/c", label: "C", info: { sv: "x" } }], "T")).not.toThrow();
  });

  // ⛔ ÄNDRAT I 0.83.0: hette "... ett på Ekonomi fäller ut och 'Visa Ekonomi' går dit (0.31.2)". Nu fäller chevronen ut och
  // kortet självt går till modulen.
  it("ett klick på ett kort utan barn går till modulens href, chevronen på Ekonomi fäller ut utan att navigera, och kortet går dit (0.83.0)", () => {
    const gick = [];
    render(<OpsHub moduler={moduler} onNavigate={(href, e) => { e.preventDefault(); gick.push(href); }} />);
    fireEvent.click(screen.getByRole("link", { name: /Schema/ }));
    expect(gick).toEqual(["/schema"]);
    fireEvent.click(screen.getByRole("button", { name: "Visa delarna i Ekonomi" }));
    expect(gick).toEqual(["/schema"]);
    fireEvent.click(screen.getByRole("link", { name: /^Ekonomi/ }));
    expect(gick).toEqual(["/schema", "/ekonomi"]);
  });

  it("modulsidan: tillbaka-länken leder till Hub, modulens namn är rubriken och barnen är kort (0.31.2)", () => {
    const gick = [];
    render(<OpsHubModul modul={moduler[1]} hubHref="/hub" onNavigate={(href, e) => { e.preventDefault(); gick.push(href); }} />);
    const rad = screen.getByRole("navigation", { name: "Var du är" });
    const tillbaka = within(rad).getByRole("link", { name: "Tillbaka till Appar" });
    expect(tillbaka.getAttribute("href")).toBe("/hub");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ekonomi");
    expect(rad.className).not.toContain("sticky");
    fireEvent.click(tillbaka);
    expect(gick).toEqual(["/hub"]);
    const barn = within(screen.getByRole("list", { name: "Ekonomi" })).getAllByRole("link");
    expect(barn.map((a) => a.getAttribute("href"))).toEqual(["/inkomster", "/kostnader"]);
    // Barnen bär räknare och info på samma sätt som modulerna.
    expect(barn[0].textContent).toContain("1");
    expect(barn[0].textContent).toContain("Inget nytt");
  });

  it("modulsidan kastar utan hubHref, och en modul utan barn visar text", () => {
    expect(() => render(<OpsHubModul modul={moduler[0]} />)).toThrow(/hubHref/);
    render(<OpsHubModul modul={moduler[0]} hubHref="/hub" />);
    expect(screen.getByText("Inga undersidor än")).toBeTruthy();
  });
});

describe("B: mobilhuvudet flödar aldrig över (0.30.1)", () => {
  it("de tre första åtgärderna stannar i huvudet på telefon, resten göms till lg och ligger i bottenradens meny", () => {
    render(Skal());
    const huvud = screen.getByRole("banner");
    const fraga = within(huvud).getByRole("link", { name: "Fråga", hidden: true });
    // ⛔ 0.87.0 (#262): index >= ATGARDER_SMAL var `hidden md:contents`. Surfplattan rymmer dem inte ens utan
    // ordmärket, så de stannar gömda till `lg`. Telefonens ark (bottenradens Meny) är oförändrat.
    expect(fraga.parentElement?.className).toContain("hidden");
    expect(fraga.parentElement?.className).toContain("lg:contents");
    expect(fraga.parentElement?.className).not.toContain("md:contents");
    // Index 0 och 1 syns i alla bredder. Index ATGARDER_SURF (Sök) syns på telefon och från lg, och är gömd däremellan.
    for (const n of ["Tema", "Inkorg"]) expect(within(huvud).getByRole("link", { name: n }).parentElement?.className ?? "").not.toContain("hidden");
    const sok = within(huvud).getByRole("link", { name: "Sök" });
    expect(sok.parentElement?.className).toContain("max-md:contents");
    expect(sok.parentElement?.className).toContain("md:hidden");
    expect(sok.parentElement?.className).toContain("lg:contents");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Meny" }));
    const ark = screen.getByRole("dialog");
    const rad = within(ark).getByRole("link", { name: "Fråga" });
    expect(rad.getAttribute("href")).toBe("/fraga");
  });

  // ⛔ 0.62.0 (granskningen av #261): HÄR STOD "utan meny finns inget hem för en flyttad åtgärd, så ingen åtgärd göms". Det
  // höll inte: bottenradens Meny ritas alltid under md, och huvudet med fem åtgärder svämmade över vid 320 px (scrollWidth 346,
  // mätt i check-skalyta 6b). Hemmet är arkets navigeringsrader. Provet kräver nu BÅDA halvorna: gömd i huvudet under md, och
  // en rad i arket, så att ingen åtgärd försvinner tyst.
  it("⛔ utan meny flyttar åtgärd fyra och uppåt ändå, till bottenradens ark, och försvinner aldrig tyst (0.62.0)", () => {
    render(Skal({ meny: undefined }));
    const fraga = within(screen.getByRole("banner")).getByRole("link", { name: "Fråga", hidden: true });
    expect(fraga.parentElement?.className).toContain("hidden");
    expect(fraga.parentElement?.className).toContain("lg:contents");
    expect(fraga.parentElement?.className).not.toContain("md:contents");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Snabbnavigering" })).getByRole("button", { name: "Meny" }));
    const rad = within(screen.getByRole("dialog")).getByRole("link", { name: "Fråga" });
    expect(rad.getAttribute("href")).toBe("/fraga");
  });

  it("gruppväxlaren är bara gruppmärket under md: 44 px träffyta, namnet dolt men kvar i knappens skärmläsarnamn (0.31.1)", () => {
    render(<OpsGruppvaxlare grupper={[{ id: "g", namn: { sv: "Claes Philip Staiger Konsulting" } }]} aktiv="g" onValj={() => {}} />);
    const knapp = screen.getByRole("button", { name: "Byt grupp, nu: Claes Philip Staiger Konsulting" });
    expect(knapp.className).toContain("size-11");
    expect(knapp.className).toContain("md:size-auto");
    const marke = knapp.querySelector("[data-gruppmarke]");
    expect(marke?.className).toContain("md:hidden");
    const namn = within(knapp).getByText("Claes Philip Staiger Konsulting");
    expect(namn.parentElement?.className).toContain("hidden");
    expect(namn.parentElement?.className).toContain("md:flex");
  });

  it("gruppväxlaren utan grupp (0.35.0: personen är inte med i någon) ritar PersonIkon, inte initialer", () => {
    render(<OpsGruppvaxlare grupper={[]} aktiv="" onValj={() => {}} />);
    const marke = screen.getByRole("button", { name: "Byt grupp, nu: Ingen grupp" }).querySelector("[data-gruppmarke]");
    expect(marke?.querySelector("svg")).not.toBeNull();
    expect(marke?.textContent).toBe("");
  });

  it("skalet ritar inte märket under md när grupper finns, men behåller det utan grupper (0.31.1)", () => {
    const med = render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" grupper={{ lista: [], aktiv: "", onValj: () => {} }}>
        <p>x</p>
      </OpsAppShell>,
    );
    // ⛔ 0.38.0 (#203): ändrat prov (regel 9). Länken var `hidden md:block`; den blev `hidden md:flex` när gruppens namn står bredvid OH.
    // ⛔ 0.87.0 (#262): dold ända till `lg`. Mätt: 180 px ordmärke plus växlare med namn lämnar inte plats åt flikar och 44 px knappar i 768 px.
    const klass = med.container.querySelector('header a[href="/"]')?.className ?? "";
    expect(klass).toMatch(/(^| )hidden( |$)/);
    expect(klass).toContain("lg:flex");
    expect(klass).not.toContain("md:flex");
    med.unmount();
    const utan = render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/">
        <p>x</p>
      </OpsAppShell>,
    );
    expect(utan.container.querySelector('header a[href="/"]')?.className).not.toContain("hidden");
  });

  it("märket är monogrammet under md, ordmärket från md, även med panelen utfälld i state", () => {
    const { container } = render(<OpsBrand panelInfalld={false} />);
    const ruta = container.querySelector("span");
    expect(ruta?.className).toContain("w-(--logo-bredd-infalld)");
    expect(ruta?.className).toContain("md:w-(--logo-bredd)");
    expect(container.querySelector('[data-marke="monogram"]')?.className).toContain("max-md:opacity-100");
    expect(container.querySelector('[data-marke="ordmarke"]')?.className).toContain("max-md:opacity-0");
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("C: loggan och panelen ligger i samma behållare (0.30.1)", () => {
  it("med panelen ligger den under toppraden i samma max-w-7xl-behållare, så märkets och panelens vänsterkant linjerar", () => {
    const { container } = render(
      <OpsAppShell brand="Ops" nav={[{ href: "/", label: "Start" }]} activeHref="/" grupper={{ lista: [], aktiv: "", onValj: () => {} }}>
        <p>x</p>
      </OpsAppShell>,
    );
    const panel = container.querySelector("nav[aria-label='Mina grupper']");
    const behallare = panel?.closest("div.lg\\:flex");
    expect(behallare?.className).toContain("max-w-7xl");
    expect(behallare?.className).toContain("mx-auto");
    // Märkeslänken bär ingen egen sidpadding: den flyttade rutan 4 px från panelens kant.
    const lank = container.querySelector('header a[href="/"]');
    expect(lank?.className).not.toMatch(/\bpx-1\b/);
  });
});
