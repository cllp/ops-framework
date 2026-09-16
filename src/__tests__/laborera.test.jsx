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

  it("är inte disabled när den är nedtonad", () => {
    // ⛔ En disabled-knapp faller ur tabbordningen, alltså går urvalet inte att
    // ångra med tangentbord. Nedtonad är ett läge, inte ett förbud.
    render(<OpsToggleRow label="Bostad" on={false} onChange={() => {}} />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});

describe("OpsFilterChip", () => {
  const val = [
    { value: null, label: "Alla typer" },
    { value: "kalender", label: "Kalender" },
    { value: "pengar", label: "Pengar" },
  ];

  it("visar vad som är valt i pillret, inte bara i menyn", () => {
    // ⛔ Ett filter som ser likadant ut oavsett val gör att man läser en
    // beskuren lista i tron att den är komplett.
    const { rerender } = render(<OpsFilterChip options={val} value={null} onChange={() => {}} ariaLabel="Typ" allLabel="Alla typer" />);
    expect(screen.getByRole("button", { name: "Typ: Alla typer" })).toBeInTheDocument();

    rerender(<OpsFilterChip options={val} value="pengar" onChange={() => {}} ariaLabel="Typ" allLabel="Alla typer" />);
    expect(screen.getByRole("button", { name: "Typ: Pengar" })).toBeInTheDocument();
  });

  it("väljer ur menyn", async () => {
    const onChange = vi.fn();
    render(<OpsFilterChip options={val} value={null} onChange={onChange} ariaLabel="Typ" allLabel="Alla typer" />);
    // ⛔ fireEvent och inte userEvent: Radix Popover i jsdom, se issue #17.
    fireEvent.click(screen.getByRole("button", { name: /^Typ:/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Kalender" }));
    expect(onChange).toHaveBeenCalledWith("kalender");
  });
});

describe("OpsFullscreenToggle", () => {
  it("speglar webbläsarens läge i stället för att äga ett eget", () => {
    // ⛔ Man kan lämna helskärm med Escape och F11 utan att någon knapp tryckts.
    // En egen boolean blir då fel, och knappen erbjuder att avsluta något man
    // redan lämnat.
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
    document.documentElement.requestFullscreen = () => Promise.reject(new Error("nekad"));
    render(<OpsFullscreenToggle />);
    expect(() => fireEvent.click(screen.getByRole("button"))).not.toThrow();
  });
});
