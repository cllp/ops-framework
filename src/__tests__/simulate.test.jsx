import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OpsToggleRow } from "../components/OpsToggleRow.jsx";
import { OpsFilterChip } from "../components/OpsFilterChip.jsx";
import { OpsFullscreenToggle } from "../components/OpsFullscreenToggle.jsx";

describe("OpsToggleRow", () => {
  it("säger sitt tillstånd med aria-pressed, inte bara med opacitet", () => {
    // ⛔ Utan aria-pressed finns urvalet helt enkelt inte för den som inte ser
    // skärmen: en opacitetsskillnad går inte att läsa upp.
    const { rerender } = render(<OpsToggleRow label="Bostad" value="4 200 000 kr" on onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Bostad/ })).toHaveAttribute("aria-pressed", "true");

    rerender(<OpsToggleRow label="Bostad" value="4 200 000 kr" on={false} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Bostad/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("skriver ut vad nedtonat betyder", () => {
    render(<OpsToggleRow label="Bostad" value="x" on={false} onChange={() => {}} />);
    // Ordet ligger i radens namn, alltså det en skärmläsare läser upp.
    expect(screen.getByRole("button", { name: /räknas inte/ })).toBeInTheDocument();
  });

  it("sätter inget löst skiljetecken i namnet", () => {
    // ⛔ Regression, och den upptäcktes bara av en riktig webbläsare: texten var
    // ", räknas inte", och Chromium lade till sitt eget blanksteg mellan
    // textnoderna. Namnet blev "Bostad , räknas inte 1 kr", med kommatecknet
    // löst mitt i. jsdom räknar fram namnet på ett annat sätt, så det här testet
    // är ett golv och inte beviset: beviset är `ariaSnapshot` i mätbygget.
    render(<OpsToggleRow label="Bostad" value="1 kr" on={false} onChange={() => {}} />);
    expect(screen.getByRole("button").textContent).not.toMatch(/\s,/);
  });

  it("växlar åt båda håll", () => {
    const onChange = vi.fn();
    const { rerender } = render(<OpsToggleRow label="Bostad" on onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(false);

    rerender(<OpsToggleRow label="Bostad" on={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("lägger kontrollen utanför knappen, aldrig inuti den", () => {
    /*
     * ⛔ CP 2026-09-20: "Skulle vilja att reglage fanns i varje post direkt att
     * man kan dra i reglaget."
     *
     * Det gick inte förut: raden VAR en knapp. Ett reglage inuti en `<button>`
     * är ogiltig HTML, och varje drag hade bubblat upp och växlat radens
     * nedtoning. Man hade tonat ned posten genom att simulera den.
     *
     * Provet mäter just det: kontrollen får inte ligga i knappen.
     */
    render(
      <OpsToggleRow label="Mat" value="8 000 kr/mån" on onChange={() => {}} control={<input type="range" aria-label="Justera Mat" />} />,
    );

    const button = screen.getByRole("button", { name: /Mat/ });
    const reglage = screen.getByRole("slider", { name: "Justera Mat" });
    expect(button.contains(reglage)).toBe(false);
  });

  it("låter draget vara ett drag och inte en nedtoning", () => {
    // ⛔ Följden av provet ovan, mätt som beteende: rör man kontrollen ska
    // radens tillstånd stå still. Det var hela skälet att reglaget låg i en
    // egen panel innan.
    const vaxla = vi.fn();
    render(
      <OpsToggleRow label="Mat" value="8 000 kr/mån" on onChange={vaxla} control={<input type="range" aria-label="Justera Mat" />} />,
    );

    fireEvent.click(screen.getByRole("slider", { name: "Justera Mat" }));
    expect(vaxla).not.toHaveBeenCalled();
  });

  it("ritar ingen extra behållare utan kontroll", () => {
    /*
     * ⛔ En lista utan kontroller ska inte betala något för att möjligheten
     * finns. Ramen flyttade ut ett steg, men raden ska inte få ett tomt element
     * per post: med hundra rader är det hundra element som aldrig syns.
     */
    const { container } = render(<OpsToggleRow label="Bostad" value="1 kr" on onChange={() => {}} />);
    const omslag = container.firstChild;
    expect(omslag.children).toHaveLength(1);
    expect(omslag.firstChild.tagName).toBe("BUTTON");
  });

  it("är inte disabled när den är nedtonad", () => {
    // ⛔ En disabled-knapp faller ur tabbordningen, alltså går urvalet inte att
    // ångra med tangentbord. Nedtonad är ett läge, inte ett förbud.
    render(<OpsToggleRow label="Bostad" on={false} onChange={() => {}} />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});


  it("lägger trailing utanför knappen, längst till höger", () => {
    render(
      <OpsToggleRow
        label="Mat"
        value="8 000 kr/mån"
        on
        onChange={() => {}}
        trailing={<input type="range" aria-label="Justera Mat" />}
      />,
    );
    const button = screen.getByRole("button", { name: /Mat/ });
    const ratt = screen.getByRole("slider", { name: "Justera Mat" });
    expect(button.contains(ratt)).toBe(false);
  });

  it("låter trailing-draget vara ett drag och inte en nedtoning", () => {
    const vaxla = vi.fn();
    render(
      <OpsToggleRow
        label="Mat"
        value="8 000 kr/mån"
        on
        onChange={vaxla}
        trailing={<input type="range" aria-label="Justera Mat" />}
      />,
    );
    fireEvent.click(screen.getByRole("slider", { name: "Justera Mat" }));
    expect(vaxla).not.toHaveBeenCalled();
  });

describe("OpsFilterChip", () => {
  const choice = [
    { value: null, label: "Alla typer" },
    { value: "kalender", label: "Kalender" },
    { value: "pengar", label: "Pengar" },
  ];

  it("visar vad som är valt i pillret, inte bara i menyn", () => {
    // ⛔ Ett filter som ser likadant ut oavsett val gör att man läser en
    // beskuren lista i tron att den är komplett.
    const { rerender } = render(<OpsFilterChip options={choice} value={null} onChange={() => {}} ariaLabel="Typ" allLabel="Alla typer" />);
    expect(screen.getByRole("button", { name: "Typ: Alla typer" })).toBeInTheDocument();

    rerender(<OpsFilterChip options={choice} value="pengar" onChange={() => {}} ariaLabel="Typ" allLabel="Alla typer" />);
    expect(screen.getByRole("button", { name: "Typ: Pengar" })).toBeInTheDocument();
  });

  it("väljer ur menyn", async () => {
    const onChange = vi.fn();
    render(<OpsFilterChip options={choice} value={null} onChange={onChange} ariaLabel="Typ" allLabel="Alla typer" />);
    // ⛔ fireEvent och inte userEvent: Radix Popover i jsdom, se issue #17.
    fireEvent.click(screen.getByRole("button", { name: /^Typ:/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Kalender" }));
    expect(onChange).toHaveBeenCalledWith("kalender");
  });

  it("ikon-variant visar reglage, inte textpillret", () => {
    render(
      <OpsFilterChip variant="icon" options={choice} value={null} onChange={() => {}} ariaLabel="Typ" allLabel="Alla typer" />,
    );
    const button = screen.getByRole("button", { name: "Typ: Alla typer" });
    expect(button.className).toMatch(/min-w-11/);
    expect(button.textContent).not.toMatch(/Alla typer/);
  });

  it("tänder accent när ikonfiltret är aktivt, och ritar menyikoner", () => {
    const withIcon = [
      { value: null, label: "Alla typer", icon: <span data-testid="ikon-alla">A</span> },
      { value: "pengar", label: "Pengar", icon: <span data-testid="ikon-pengar">P</span> },
    ];
    const { rerender } = render(
      <OpsFilterChip variant="icon" options={withIcon} value={null} onChange={() => {}} ariaLabel="Typ" allLabel="Alla typer" />,
    );
    expect(screen.getByRole("button", { name: "Typ: Alla typer" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Typ: Alla typer" }).className).not.toMatch(/text-accent/);

    rerender(
      <OpsFilterChip variant="icon" options={withIcon} value="pengar" onChange={() => {}} ariaLabel="Typ" allLabel="Alla typer" />,
    );
    const active = screen.getByRole("button", { name: "Typ: Pengar" });
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(active.className).toMatch(/text-accent/);

    fireEvent.click(active);
    expect(screen.getByTestId("ikon-pengar")).toBeInTheDocument();
    expect(screen.getByTestId("ikon-alla")).toBeInTheDocument();
  });
});

describe("OpsFullscreenToggle", () => {
  /**
   * jsdom har varken `fullscreenEnabled` eller `requestFullscreen`, alltså samma
   * svar som Safari på en iPhone: "den här webbläsaren kan inte".
   *
   * ⛔ Uppsättningen står här för att proven nedan handlar om vad knappen GÖR när
   * helskärm finns. Utan den vore de gröna mot en komponent som inte ritar något
   * alls, och ett prov som inte kan bli rött mäter ingenting.
   */
  function latsasWebblasarenKan() {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    // ⛔ `defineProperty` och inte en tilldelning. Ett tidigare prov i samma fil
    // definierar om egenskapen utan `writable`, alltså skrivskyddad, och en ren
    // tilldelning kastar då i nästa prov. Ordningsberoendet är exakt den sortens
    // fel som ser ut som ett fel i komponenten.
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      value: () => Promise.resolve(),
      configurable: true,
    });
  }

  it("ritar ingenting i en webbläsare som inte kan helskärm", () => {
    // ⛔ Rapporterat från en iPhone: knappen satt i sidhuvudet och gjorde
    // ingenting, eftersom Safari på iPhone saknar Fullscreen-API:et för vanliga
    // element. En knapp som aldrig kan fungera ska inte ta plats där utrymmet är
    // som dyrast.
    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
    const { container } = render(<OpsFullscreenToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ritar ingenting när flaggan säger ja men metoden saknas", () => {
    // ⛔ Två villkor och inte ett. En webbläsare som svarar ja på flaggan men bara
    // har den webkit-prefixade metoden hade annars fått tillbaka exakt den döda
    // knapp det här handlar om: komponenten anropar bara den oprefixade.
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    Object.defineProperty(document.documentElement, "requestFullscreen", { value: undefined, configurable: true });
    const { container } = render(<OpsFullscreenToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it("speglar webbläsarens läge i stället för att äga ett eget", () => {
    // ⛔ Man kan lämna helskärm med Escape och F11 utan att någon knapp tryckts.
    // En egen boolean blir då fel, och knappen erbjuder att avsluta något man
    // redan lämnat.
    latsasWebblasarenKan();
    render(<OpsFullscreenToggle />);
    expect(screen.getByRole("button", { name: "Helskärm" })).toBeInTheDocument();

    Object.defineProperty(document, "fullscreenElement", { value: document.documentElement, configurable: true });
    // ⛔ fireEvent och inte dispatchEvent: React 18 batchar uppdateringar
    // utanför `act`, så en rå dispatch hinner inte rendera om innan
    // påståendet läser DOM:en. Testet hade då varit rött av fel anledning.
    fireEvent(document, new Event("fullscreenchange"));
    expect(screen.getByRole("button", { name: "Avsluta helskärm" })).toBeInTheDocument();

    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
    fireEvent(document, new Event("fullscreenchange"));
    expect(screen.getByRole("button", { name: "Helskärm" })).toBeInTheDocument();
  });

  it("kastar inte när webbläsaren nekar helskärm", () => {
    // ⛔ requestFullscreen avslås utanför en användargest och i iframes utan
    // allow="fullscreen". Ett ohanterat löfte hade gett ett fel i konsolen som
    // ser ut som en bugg i appen.
    latsasWebblasarenKan();
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      value: () => Promise.reject(new Error("nekad")),
      configurable: true,
    });
    render(<OpsFullscreenToggle />);
    expect(() => fireEvent.click(screen.getByRole("button"))).not.toThrow();
  });
});
