import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OpsIconLink } from "../components/OpsIconLink.jsx";
import { OpsFelBadge } from "../components/counter.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";

/**
 * 0.45.0: felmärket på en ikonlänk (cllp/bolag-ops#150) och bilagan i händelsepanelen (#221).
 *
 * ⛔ #150, händelsen: inkorgens räknare ritade INGET märke när läsningen föll, och inget märke är vad den ritar när inget väntar.
 * "Klart" och "vet inte" såg likadana ut. Provet mäter att de nu går att skilja på, för den som ser och för den som lyssnar.
 *
 * ⛔ #221, händelsen: CP 2026-10-01 ville kunna bifoga bilder och dokument till en händelse, som till ett ärende. Provet mäter att
 * panelen visar det appen skickar, bild som bild och annat som en länk med namn och storlek, och att en trasig bilaga inte tyst
 * försvinner.
 *
 * jsdom kör ingen CSS, så hur märket SER UT mäts i webbläsaren (check-skalyta).
 */

const ikon = <svg data-testid="ikon" />;

describe("⛔ OpsIconLink: ett fel är inte en nolla (cllp/bolag-ops#150)", () => {
  it("utan fel och utan antal: inget märke alls", () => {
    const { container } = render(<OpsIconLink href="/inkorg" icon={ikon} label="Inkorg" badge={0} />);
    expect(container.querySelector("[data-ops-count-badge]")).toBeNull();
    expect(container.querySelector("[data-ops-fel-badge]")).toBeNull();
  });

  it("med fel: ett felmärke som läses upp, aldrig en siffra, och felet står i tooltipens text", () => {
    const { container } = render(<OpsIconLink href="/inkorg" icon={ikon} label="Inkorg" badgeFel="kunde inte läsas" />);
    const fel = container.querySelector("[data-ops-fel-badge]");
    expect(fel).not.toBeNull();
    expect(fel.textContent).toContain("kunde inte läsas");
    expect(fel.textContent).not.toMatch(/\d/);
    expect(container.querySelector("[data-ops-count-badge]")).toBeNull();
    const lank = screen.getByRole("link", { name: "Inkorg" });
    expect(within(lank).getByText("kunde inte läsas")).toBeTruthy();
  });

  it("⛔ felet går före ett gammalt antal: en siffra från innan läsningen föll ser aktuell ut", () => {
    const { container } = render(<OpsIconLink href="/inkorg" icon={ikon} label="Inkorg" badge={4} badgeFel="kunde inte läsas" />);
    expect(container.querySelector("[data-ops-fel-badge]")).not.toBeNull();
    expect(container.querySelector("[data-ops-count-badge]")).toBeNull();
    expect(container.textContent).not.toContain("4");
  });

  it("utan fel ritas antalet som förut", () => {
    const { container } = render(<OpsIconLink href="/inkorg" icon={ikon} label="Inkorg" badge={3} />);
    expect(container.querySelector("[data-ops-count-badge]")).not.toBeNull();
    expect(container.querySelector("[data-ops-fel-badge]")).toBeNull();
  });

  it("ett felmärke utan ord kastar, både på länken och på märket", () => {
    expect(() => render(<OpsIconLink href="/inkorg" icon={ikon} label="Inkorg" badgeFel="  " />)).toThrow(/badgeFel/);
    expect(() => render(<OpsFelBadge text="" />)).toThrow(/text krävs/);
  });
});

const BILD = { dataUrl: "data:image/png;base64,AAAA", namn: "kvitto.png", typ: "image/png", tecken: 14000, bredd: 800, hojd: 600 };
const PDF = { dataUrl: "data:application/pdf;base64,AAAA", namn: "avtal.pdf", typ: "application/pdf", tecken: 140000 };
const bas = { id: "h1", titel: "Styrelsemöte", datum: "2026-10-12" };

describe("⛔ OpsHandelsePanel: bilagan (#221)", () => {
  it("en bild visas som bild, med alt-text, namn och storlek, och går att öppna", () => {
    render(<OpsHandelsePanel handelse={{ ...bas, bilaga: BILD }} onTillbaka={() => {}} />);
    const region = screen.getByRole("region", { name: "Bilaga" });
    const bild = within(region).getByRole("img", { name: "Bilaga till Styrelsemöte: kvitto.png" });
    expect(bild.getAttribute("src")).toBe(BILD.dataUrl);
    const nedladdning = within(region).getByRole("link", { name: "kvitto.png" });
    expect(nedladdning.getAttribute("download")).toBe("kvitto.png");
    expect(region.textContent).toMatch(/kB/);
  });

  it("ett dokument är en länk med namn och storlek, ingen bild", () => {
    render(<OpsHandelsePanel handelse={{ ...bas, bilaga: PDF }} onTillbaka={() => {}} />);
    const region = screen.getByRole("region", { name: "Bilaga" });
    expect(within(region).queryByRole("img")).toBeNull();
    const lank = within(region).getByRole("link", { name: "avtal.pdf" });
    expect(lank.getAttribute("href")).toBe(PDF.dataUrl);
    expect(lank.getAttribute("download")).toBe("avtal.pdf");
    expect(region.textContent).toMatch(/kB/);
  });

  it("utan bilaga (null eller utelämnad) ritas ingen bilageyta", () => {
    render(<OpsHandelsePanel handelse={{ ...bas, bilaga: null }} onTillbaka={() => {}} />);
    expect(screen.queryByRole("region", { name: "Bilaga" })).toBeNull();
  });

  it("⛔ en bilaga utan dataUrl kastar, i stället för att tyst se ut som ingen bilaga", () => {
    expect(() => render(<OpsHandelsePanel handelse={{ ...bas, bilaga: { namn: "trasig.pdf" } }} onTillbaka={() => {}} />)).toThrow(/dataUrl/);
  });

  it("rubriken går att byta språk på", () => {
    render(<OpsHandelsePanel handelse={{ ...bas, bilaga: PDF }} bilagaEtikett="Attachment" onTillbaka={() => {}} />);
    expect(screen.getByRole("region", { name: "Attachment" })).toBeTruthy();
  });
});
