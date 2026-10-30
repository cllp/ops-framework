import { ORD_OPSMODULRAM, flyttaForbi } from "../components/OpsModulRam.jsx";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsHuvudmenyProvider } from "../components/OpsHuvudmeny.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { OpsSwitch } from "../components/OpsToggle.jsx";
import { defineModule } from "../lib/modul.js";

/**
 * Modulramen (0.89.0). Kugghjulet, de tre avsnitten och att en hemlighet inte ritas.
 */

const I = () => <svg />;

const BAS = () => ({
  id: "ekonomi",
  namn: { sv: "Ekonomi", en: "Finance" },
  nav: [],
  routes: [],
  samlingar: [],
  kallor: {},
  skapar: [],
  hubb: {
    ikon: <I />,
    rutt: "/ekonomi",
    startsida: "oversikt",
    delar: [{ id: "oversikt", namn: { sv: "Översikt", en: "Overview" }, ikon: <I />, rutt: "/ekonomi/oversikt" }],
  },
});

const EKONOMI = defineModule({
  ...BAS(),
  installningar: [{ id: "visadolda", namn: { sv: "Visa dolda", en: "Show hidden" }, typ: "boolean", forval: false }],
  kopplingar: [
    {
      id: "enable-banking",
      namn: { sv: "Bank", en: "Bank" },
      hint: { sv: "Enable Banking", en: "Enable Banking" },
      behorigheter: [{ sv: "Läsa transaktioner", en: "Read transactions" }],
    },
  ],
});

const GRUPP = { moduler: ["ekonomi", "bibliotek"], huvudmeny: [] };

function ram(over = {}) {
  return {
    farAndra: true,
    grupp: GRUPP,
    onOrdning: vi.fn(),
    onSparaHuvudmeny: vi.fn(),
    onSpara: vi.fn(),
    kopplingar: { lage: {}, onAnslut: vi.fn(), onKopplaFran: vi.fn() },
    ...over,
  };
}

describe("modulramen", () => {
  it("kugghjulet syns för den som får ändra, och en medlem i visningsläge ser det inte", () => {
    const onNavigate = vi.fn((_h, e) => e.preventDefault());
    const { unmount } = render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi" hubHref="/hub" onNavigate={onNavigate} ram={ram()}>
        <p>översikten</p>
      </OpsModulSida>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Inställningar" }));
    expect(onNavigate).toHaveBeenCalledWith("/ekonomi?lage=installningar", expect.anything());
    expect(screen.getByText("översikten")).toBeTruthy();
    unmount();

    render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi" hubHref="/hub" ram={ram({ farAndra: false })}>
        <p>översikten</p>
      </OpsModulSida>,
    );
    expect(screen.queryByRole("link", { name: "Inställningar" })).toBeNull();
    expect(screen.getByText("översikten")).toBeTruthy();
  });

  it("inställningsläget byter rubrik, döljer vyn och en fäst modul har ingen Tillbaka", () => {
    render(
      <OpsHuvudmenyProvider moduler={["ekonomi"]}>
        <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram({ grupp: { ...GRUPP, huvudmeny: ["ekonomi"] } })}>
          <p>översikten</p>
        </OpsModulSida>
      </OpsHuvudmenyProvider>,
    );
    const sidrubrik = screen.getByRole("heading", { name: "Ekonomi · Inställningar" });
    // ⛔ ÄNDRAT (0.102.0, regel 9: granskaren godkänner): vyns huvud är Meddelandens tunna rad, etikettens storlek och vikt 600,
    // med Klar på samma rad. CP 2026-10-14: "Kolla header panelen på chatt ... Gör dessa enhetliga." Förut `text-sida`, 20 px.
    expect(sidrubrik.className).toContain("text-etikett");
    expect(sidrubrik.className).not.toContain("text-sida");
    expect(sidrubrik.closest("[data-vyhuvud]")?.querySelector("[data-modul-lage-knapp='klar']")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Tillbaka/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Klar" }).getAttribute("href")).toBe("/ekonomi");
    expect(screen.queryByText("översikten")).toBeNull();
    expect(screen.getByText("Allmänt")).toBeTruthy();
    expect(screen.getByText("Kopplingar")).toBeTruthy();
    expect(screen.getByText("Egna inställningar")).toBeTruthy();
  });

  it("pinnen och avstängning skriver gruppens listor, och en hemlighet ritas inte", () => {
    const r = ram({
      grupp: { moduler: ["ekonomi", "bibliotek"], huvudmeny: ["ekonomi"] },
      kopplingar: {
        lage: {
          "enable-banking": { status: "fel", fel: "Banken svarade inte", senasteSynk: "2026-10-01T10:00:00.000Z", token: "super-hemlig-nyckel", apiKey: "annan-nyckel" },
        },
        onAnslut: vi.fn(),
        onKopplaFran: vi.fn(),
      },
    });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    expect(screen.queryByText("super-hemlig-nyckel")).toBeNull();
    expect(screen.queryByText("annan-nyckel")).toBeNull();
    const bankfel = screen.getByRole("alert");
    expect(bankfel.textContent).toBe("Banken svarade inte");
    expect(bankfel.className).toContain("bg-danger-bg");
    expect(bankfel.className).toContain("border");
    expect(screen.getByText("Fel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Koppla från" }));
    expect(r.kopplingar.onKopplaFran).toHaveBeenCalledWith("enable-banking");

    fireEvent.click(screen.getByRole("switch", { name: /På/ }));
    expect(r.onOrdning).toHaveBeenCalledWith(["bibliotek"]);
    expect(r.onSparaHuvudmeny).toHaveBeenCalledWith([]);
  });

  it("ett eget fält sparas, och utan egna fält och utan slot ritas inte avsnittet", () => {
    const r = ram();
    const { unmount } = render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>,
    );
    fireEvent.click(screen.getByRole("switch", { name: /Visa dolda/ }));
    expect(r.onSpara).toHaveBeenCalledWith({ modulId: "ekonomi", varden: { visadolda: true } });
    unmount();

    const utan = defineModule(BAS());
    render(
      <OpsModulSida modul={utan} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram()}>
        <p />
      </OpsModulSida>,
    );
    expect(screen.queryByText("Inga egna inställningar.")).toBeNull();
    expect(screen.queryByText("Inga kopplingar.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Egna inställningar" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Kopplingar" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Allmänt" })).toBeTruthy();
  });

  it("en slot ritas, och en medlem som öppnat läget kan lämna det", () => {
    render(
      <OpsModulSida
        modul={defineModule(BAS())}
        activeHref="/ekonomi?lage=installningar"
        hubHref="/hub"
        ram={ram({ farAndra: false, egna: <p>Egen ruta</p> })}
      >
        <p>översikten</p>
      </OpsModulSida>,
    );
    expect(screen.getByText("Egen ruta")).toBeTruthy();
    expect(screen.queryByText("Inga egna inställningar.")).toBeNull();
    expect(screen.getByRole("link", { name: "Klar" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: /Visa i huvudmenyn/ })).toBeDisabled();
    expect(screen.getByText("Bara ägare och admin ändrar de här inställningarna.")).toBeTruthy();
  });

  it("ram.kropp ersätter de tre avsnitten, och utan kropp står På kvar", () => {
    const { unmount } = render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram({ kropp: <p>Agentens egna</p> })}>
        <p>översikten</p>
      </OpsModulSida>,
    );
    expect(screen.getByText("Agentens egna")).toBeTruthy();
    expect(screen.queryByText("översikten")).toBeNull();
    expect(screen.queryByRole("switch", { name: /På/ })).toBeNull();
    expect(screen.queryByText("Kopplingar")).toBeNull();
    unmount();

    render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram()}>
        <p>översikten</p>
      </OpsModulSida>,
    );
    expect(screen.queryByText("Agentens egna")).toBeNull();
    expect(screen.getByRole("switch", { name: /På/ })).toBeTruthy();
    expect(screen.getByText("Kopplingar")).toBeTruthy();
  });

  it("tummen slår om innan sparningen svarar, och ett avslag ställer tillbaka den", async () => {
    /** @type {() => void} */
    let avsla = () => {};
    const r = ram({
      onOrdning: vi.fn(() => new Promise((_, nej) => { avsla = () => nej(new Error("Nätet svarade inte")); })),
    });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    expect(screen.getByRole("switch", { name: "På" })).toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "På" }));
    expect(screen.getByRole("switch", { name: "På" })).not.toBeChecked();
    expect(r.onOrdning).toHaveBeenCalledWith(["bibliotek"]);
    expect(document.querySelector("[data-installning-fel]")).toBeNull();
    avsla();
    await waitFor(() => expect(screen.getByRole("switch", { name: "På" })).toBeChecked());
    const fel = document.querySelector("[data-installning-fel]");
    expect(fel?.textContent).toBe("Nätet svarade inte");
    expect(fel?.getAttribute("role")).toBe("alert");
  });

  it("ett eget fält slår om innan sparningen svarar, och ett avslag ställer tillbaka det", async () => {
    /** @type {() => void} */
    let avsla = () => {};
    const r = ram({
      onSpara: vi.fn(() => new Promise((_, nej) => { avsla = () => nej(new Error("Nätet svarade inte")); })),
    });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    fireEvent.click(screen.getByRole("switch", { name: "Visa dolda" }));
    expect(screen.getByRole("switch", { name: "Visa dolda" })).toBeChecked();
    expect(r.onSpara).toHaveBeenCalledWith({ modulId: "ekonomi", varden: { visadolda: true } });
    avsla();
    await waitFor(() => expect(screen.getByRole("switch", { name: "Visa dolda" })).not.toBeChecked());
    expect(document.querySelector("[data-installning-fel]")?.textContent).toBe("Nätet svarade inte");
  });

  it("ett tryck på hjälptexten slår om På, och raden håller höjdgolvet från md", () => {
    const r = ram();
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    const etikett = screen.getByText("På").closest("label");
    expect(etikett?.className).toContain("min-h-11");
    expect(etikett?.className).toContain("w-full");
    expect(etikett?.className).not.toContain("md:min-h-0");
    fireEvent.click(screen.getByText("Appen är installerad i gruppen."));
    expect(r.onOrdning).toHaveBeenCalledWith(["bibliotek"]);
    expect(screen.getByRole("switch", { name: "På" })).not.toBeChecked();
  });

  it("ordningen är vänster- och högerpilar utan räknare, och den flyttar innan sparningen svarar", async () => {
    /** @type {() => void} */
    let avsla = () => {};
    const r = ram({
      onOrdning: vi.fn(() => new Promise((_, nej) => { avsla = () => nej(new Error("Nätet svarade inte")); })),
    });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    expect(screen.queryByText("Flytta vänster")).toBeNull();
    expect(screen.queryByText(/\d\/\d/)).toBeNull();
    expect(document.querySelector("[data-ordning-plats]")).toBeNull();
    const ordning = () => [...document.querySelectorAll("[data-ordning-app]")].map((e) => e.getAttribute("data-ordning-app"));
    expect(ordning()).toEqual(["ekonomi", "bibliotek"]);
    expect(document.querySelector('[data-ordning-app="ekonomi"]')?.getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "Flytta vänster" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Flytta höger" }));
    expect(ordning()).toEqual(["bibliotek", "ekonomi"]);
    expect(screen.getByRole("button", { name: "Flytta höger" })).toBeDisabled();
    expect(r.onOrdning).toHaveBeenCalledWith(["bibliotek", "ekonomi"]);
    avsla();
    await waitFor(() => expect(ordning()).toEqual(["ekonomi", "bibliotek"]));
  });

  it("en fäst app visar huvudmenyns rad och flyttar förbi appar som inte är fästa", () => {
    const r = ram({
      grupp: { moduler: ["bibliotek", "agenter", "ekonomi"], huvudmeny: ["bibliotek", "ekonomi"] },
      appar: [{ id: "bibliotek", namn: "Bibliotek", ikon: <svg data-testid="bib" /> }],
    });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    expect([...document.querySelectorAll("[data-ordning-app]")].map((e) => e.getAttribute("data-ordning-app"))).toEqual(["bibliotek", "ekonomi"]);
    expect(screen.getByTestId("bib")).toBeTruthy();
    expect(screen.getByText("Platsen i huvudmenyn.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Flytta höger" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Flytta vänster" }));
    expect(r.onOrdning).toHaveBeenCalledWith(["ekonomi", "bibliotek", "agenter"]);
  });

  it("⛔ varje rad i förhandsvisningen har ett läsbart namn, också när ikonen är en SVG, och aldrig det råa id:t för den aktuella appen (granskningen av PR 470)", () => {
    const r = ram({ appar: [{ id: "bibliotek", namn: "Bibliotek", ikon: <svg data-testid="bib" /> }, { id: "ekonomi", ikon: <svg /> }] });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    const rad = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.querySelector(`[data-ordning-app="${id}"]`));
    // Den aktuella appen heter sitt riktiga namn ("Ekonomi"), inte sitt id ("ekonomi"), i både texten för skärmläsare och title.
    expect(rad("ekonomi").textContent).toBe("Ekonomi");
    expect(rad("ekonomi").getAttribute("title")).toBe("Ekonomi");
    // Den andra har ikonen som SVG och ett namn som text.
    expect(rad("bibliotek").textContent).toBe("Bibliotek");
    expect(rad("bibliotek").querySelector("svg")?.closest("[aria-hidden=true]")).not.toBeNull();
    // Ikonen läses inte upp, namnet gör det: listan har två namngivna rader.
    expect([...document.querySelectorAll("[data-ordning-app]")].map((e) => e.querySelector(".sr-only")?.textContent)).toEqual(["Ekonomi", "Bibliotek"]);
  });

  it("namnet följer språket, och en app utan namn i ram.appar får sitt id i stället för en tom rad", () => {
    const r = ram({ grupp: { moduler: ["ekonomi", "okand"], huvudmeny: [] } });
    render(<OpsSprakProvider sprak="en"><OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida></OpsSprakProvider>);
    expect(document.querySelector('[data-ordning-app="ekonomi"]')?.textContent).toBe("Finance");
    // Utan ikon ritas första bokstaven (dold för skärmläsare) och namnet står som text: id:t, eftersom inget namn finns.
    expect(document.querySelector('[data-ordning-app="okand"] .sr-only')?.textContent).toBe("okand");
    expect(document.querySelector('[data-ordning-app="okand"] [aria-hidden=true]')?.textContent).toBe("O");
  });

  it("⛔ när appen flyttas till änden flyttas fokus till den motsatta pilen, och inte tappas på den spärrade (granskningen av PR 470)", () => {
    const r = ram();
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    const hoger = screen.getByRole("button", { name: "Flytta höger" });
    hoger.focus();
    expect(document.activeElement).toBe(hoger);
    fireEvent.click(hoger);
    expect(hoger).toBeDisabled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Flytta vänster" }));
    // Och tillbaka: nu är vänster pilen som blir spärrad, och fokus går till höger.
    fireEvent.click(screen.getByRole("button", { name: "Flytta vänster" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Flytta höger" }));
  });

  it("fokus ligger kvar på pilen när den inte blev spärrad (appen är inte i änden)", () => {
    const r = ram({ grupp: { moduler: ["bibliotek", "ekonomi", "agenter"], huvudmeny: [] } });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    const hoger = screen.getByRole("button", { name: "Flytta höger" });
    hoger.focus();
    fireEvent.click(hoger);
    expect(hoger).toBeDisabled();
    // ekonomi stod i mitten och hamnade sist: höger är spärrad, så fokus går till vänster.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Flytta vänster" }));
    const vanster = screen.getByRole("button", { name: "Flytta vänster" });
    fireEvent.click(vanster);
    // Nu står ekonomi i mitten igen: ingen av pilarna är spärrad och fokus är kvar på den som trycktes.
    expect(vanster).not.toBeDisabled();
    expect(document.activeElement).toBe(vanster);
  });

  it("⛔ en sparning som misslyckas flyttar inte fokus i efterhand", async () => {
    /** @type {() => void} */
    let avsla = () => {};
    const r = ram({ onOrdning: vi.fn(() => new Promise((_, nej) => { avsla = () => nej(new Error("Nätet svarade inte")); })) });
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    fireEvent.click(screen.getByRole("button", { name: "Flytta höger" }));
    const vanster = screen.getByRole("button", { name: "Flytta vänster" });
    expect(document.activeElement).toBe(vanster);
    vanster.blur();
    document.body.focus();
    avsla();
    await waitFor(() => expect([...document.querySelectorAll("[data-ordning-app]")].map((e) => e.getAttribute("data-ordning-app"))).toEqual(["ekonomi", "bibliotek"]));
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Flytta höger" }));
  });

  it("⛔ ORD_OPSMODULRAM: nycklarna upp och ned är borta (en liten brytande ändring, står i CHANGELOG), vänster och höger finns på båda språken", () => {
    expect(Object.keys(ORD_OPSMODULRAM)).not.toContain("upp");
    expect(Object.keys(ORD_OPSMODULRAM)).not.toContain("ned");
    for (const k of /** @type {const} */ (["vanster", "hoger"])) {
      expect(ORD_OPSMODULRAM[k].sv).toBeTruthy();
      expect(ORD_OPSMODULRAM[k].en).toBeTruthy();
    }
  });

  it("ikonraden är skrivskyddad: ingen knapp, ingen chevron, ingen utfällning", () => {
    const r = ram();
    render(<OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={r}><p /></OpsModulSida>);
    const rad = document.querySelector('[data-allmant="ikon"]');
    expect(rad?.tagName).toBe("DIV");
    expect(rad?.querySelector("button, [aria-expanded]")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ikon/ })).toBeNull();
    expect(screen.getByText("Appens ikon.")).toBeTruthy();
  });

  it("flyttaForbi hoppar över appar utanför raden och står still i ändarna", () => {
    expect(flyttaForbi(["a", "x", "b"], ["a", "b"], "b", -1)).toEqual(["b", "a", "x"]);
    expect(flyttaForbi(["a", "x", "b"], ["a", "b"], "a", 1)).toEqual(["x", "b", "a"]);
    expect(flyttaForbi(["a", "b"], ["a", "b"], "a", -1)).toEqual(["a", "b"]);
  });

  it("kugghjulet och Klar sitter i huvudets bakre plats", () => {
    const { unmount } = render(
      <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram()}>
        <p />
      </OpsModulSida>,
    );
    const slot = document.querySelector("[data-modul-huvud-atgard]");
    expect(slot?.className).toContain("ml-auto");
    expect(slot?.querySelector("[data-modul-lage-knapp='klar']")).toBeTruthy();
    // ⛔ ÄNDRAT (0.102.0): Klar står på rubrikens rad också när Tillbaka finns, och Tillbaka har sin egen rad ovanför.
    // Förut stod Klar på Tillbaka-raden och rubriken i 20 px under den, tre rader i huvudet.
    expect(slot?.parentElement?.querySelector("h1")?.textContent).toBe("Ekonomi · Inställningar");
    const tillbakaLank = screen.getByRole("link", { name: /Tillbaka till/ });
    expect(tillbakaLank.closest("[data-vyhuvud]")).toBeNull();
    unmount();

    render(
      <OpsHuvudmenyProvider moduler={["ekonomi"]}>
        <OpsModulSida modul={EKONOMI} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram({ grupp: { ...GRUPP, huvudmeny: ["ekonomi"] } })}>
          <p />
        </OpsModulSida>
      </OpsHuvudmenyProvider>,
    );
    const fastSlot = document.querySelector("[data-modul-huvud-atgard]");
    const rad = fastSlot?.parentElement;
    expect(rad?.querySelector("h1")?.textContent).toBe("Ekonomi · Inställningar");
    expect(rad?.querySelector("[data-modul-lage-knapp='klar']")).toBeTruthy();
  });

  it("en okänd placering på strömbrytaren avvisas", () => {
    expect(() => render(<OpsSwitch label="På" checked={false} onChange={() => {}} placering="mitt" />)).toThrow(/okänd placering/);
  });

  it("en nyckel i manifestet avvisas", () => {
    expect(() => defineModule({
      ...BAS(),
      kopplingar: [{ id: "bank", namn: { sv: "Bank", en: "Bank" }, behorigheter: [], token: "super-hemlig-nyckel" }],
    })).toThrow(/token/);
  });
});

/**
 * 0.147.0: platsen för appens egna inställningar. Ekonomi väljer område under bankvalet, och området styr vilka kopplingar som visas: raden som avgör ska stå FÖRE
 * raderna den avgör. `ram.egnaForst` flyttar hela avsnittet "Egna inställningar" före Kopplingar; utan det är allt som förut.
 */
describe("⛔ egna inställningar före kopplingarna (egnaForst)", () => {
  const sida = (/** @type {any} */ modul, /** @type {any} */ over = {}) =>
    render(
      <OpsModulSida modul={modul} activeHref="/ekonomi?lage=installningar" hubHref="/hub" ram={ram({ egna: <p>Område: Sverige</p>, ...over })}>
        <p />
      </OpsModulSida>,
    );
  const rubriker = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
  const ordning = (/** @type {string} */ a, /** @type {string} */ b) => {
    const [x, y] = [screen.getByText(a), screen.getByText(b)];
    return Boolean(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
  };

  it("utan valet, och med false, är ordningen som förut: Allmänt, Kopplingar, Egna inställningar", () => {
    const { unmount } = sida(EKONOMI);
    expect(rubriker()).toEqual(["Allmänt", "Kopplingar", "Egna inställningar"]);
    expect(ordning("Bank", "Område: Sverige")).toBe(true);
    unmount();
    sida(EKONOMI, { egnaForst: false });
    expect(rubriker()).toEqual(["Allmänt", "Kopplingar", "Egna inställningar"]);
  });

  it("med egnaForst står hela avsnittet före Kopplingar: fältet, appens ruta och Spara följer med", () => {
    const med = defineModule({
      ...BAS(),
      installningar: [{ id: "namn", namn: { sv: "Bolagsnamn", en: "Company name" }, typ: "text", forval: "" }],
      kopplingar: EKONOMI.kopplingar,
    });
    sida(med, { egnaForst: true });
    expect(rubriker()).toEqual(["Allmänt", "Egna inställningar", "Kopplingar"]);
    expect(ordning("Område: Sverige", "Bank")).toBe(true);
    // Spara hör till avsnittet och står före Kopplingar, inte kvar efter dem.
    const spara = screen.getByRole("button", { name: "Spara" });
    const kopplingar = screen.getByRole("heading", { name: "Kopplingar" });
    expect(Boolean(spara.compareDocumentPosition(kopplingar) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    // Avsnittet finns EN gång: ordningen kopierar det inte.
    expect(screen.getAllByRole("heading", { name: "Egna inställningar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Spara" })).toHaveLength(1);
  });

  it("det som sparas är detsamma i båda ordningarna", () => {
    const r = ram();
    sida(EKONOMI, { ...r, egnaForst: true });
    fireEvent.click(screen.getByRole("switch", { name: /Visa dolda/ }));
    expect(r.onSpara).toHaveBeenCalledWith({ modulId: "ekonomi", varden: { visadolda: true } });
  });

  it("ett avsnitt som inte ritas lämnar ingen tom plats, vilken ordning som än gäller", () => {
    const utanKopplingar = defineModule({ ...BAS(), installningar: EKONOMI.installningar });
    const { unmount } = sida(utanKopplingar, { egnaForst: true });
    expect(rubriker()).toEqual(["Allmänt", "Egna inställningar"]);
    unmount();
    const utanEgna = defineModule({ ...BAS(), kopplingar: EKONOMI.kopplingar });
    sida(utanEgna, { egna: undefined, egnaForst: true });
    expect(rubriker()).toEqual(["Allmänt", "Kopplingar"]);
  });
});
