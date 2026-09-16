import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsFact } from "../components/OpsFact.jsx";
import { OpsStat } from "../components/OpsStat.jsx";
import { formatRelativeDate } from "../lib/format.js";

/** @param {() => void} kor @param {RegExp} meddelande */
function forvantaKrasch(kor, meddelande) {
  const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(kor).toThrow(meddelande);
  } finally {
    tyst.mockRestore();
  }
}

describe("OpsFact", () => {
  it("skriver ut ordet, aldrig bara en färg", () => {
    render(<OpsFact kind="uppskattat" />);
    expect(screen.getByText("Uppskattat")).toBeInTheDocument();
  });

  it("har fyra lägen och de säger olika saker", () => {
    const { rerender } = render(<OpsFact kind="uppmatt" />);
    expect(screen.getByText("Uppmätt")).toBeInTheDocument();
    rerender(<OpsFact kind="okant" />);
    expect(screen.getByText("Okänt")).toBeInTheDocument();
    rerender(<OpsFact kind="scenario" />);
    expect(screen.getByText("Scenario")).toBeInTheDocument();
  });

  it("låter appen ersätta ordet med sitt eget", () => {
    render(<OpsFact kind="uppskattat" label="Snitt 12 mån" />);
    expect(screen.getByText("Snitt 12 mån")).toBeInTheDocument();
    expect(screen.queryByText("Uppskattat")).toBeNull();
  });

  it("kastar på okänt läge i stället för att rendera något godtyckligt", () => {
    forvantaKrasch(() => render(<OpsFact kind="ungefar" />), /okänt kind/);
  });

  /**
   * ⛔ Den här är hela skälet till att komponenten finns.
   *
   * "Företag 0 kr tillgångar" och "vi vet inte" ser likadana ut på skärmen, och
   * läsaren har ingen anledning att misstro siffran. Ett märke som samtidigt
   * säger "okänt" och visar ett belopp gör saken värre, inte bättre: nu står
   * det uttryckligen att vi inte vet, bredvid en siffra som ser mätt ut.
   */
  it("vägrar bära ett värde när läget är okänt", () => {
    forvantaKrasch(() => render(<OpsFact kind="okant" value="0 kr" />), /kan inte ha ett value/);
  });

  it("bär ett värde i de andra lägena", () => {
    render(<OpsFact kind="scenario" value="5 290 000 kr" label="Vid 3 % avkastning" />);
    expect(screen.getByText("5 290 000 kr")).toBeInTheDocument();
    expect(screen.getByText("Vid 3 % avkastning")).toBeInTheDocument();
  });
});

describe("OpsStat", () => {
  it("är ingen knapp utan onDrillDown, och inget fokuserbart element", () => {
    render(<OpsStat label="Netto" value="+84 776 kr" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  /**
   * ⛔ En klickbar yta som inte leder någonstans är värre än en död ruta.
   * Användaren trycker igen och tror att appen hängt sig, och den som tabbar
   * stannar på ett element som inte gör något.
   */
  it("blir en riktig knapp med onDrillDown, och säger vart den leder", async () => {
    const vidare = vi.fn();
    render(<OpsStat label="Kostnader" value="67 650 kr" onDrillDown={vidare} />);
    const knapp = screen.getByRole("button", { name: "Kostnader: visa underlaget" });
    await userEvent.click(knapp);
    expect(vidare).toHaveBeenCalledTimes(1);
  });

  it("går att nå med tangentbordet", async () => {
    const vidare = vi.fn();
    render(<OpsStat label="Kostnader" value="67 650 kr" onDrillDown={vidare} />);
    screen.getByRole("button").focus();
    await userEvent.keyboard("{Enter}");
    expect(vidare).toHaveBeenCalledTimes(1);
  });

  it("låter appen döpa om knappen", () => {
    render(<OpsStat label="Kostnader" value="1" onDrillDown={() => {}} drillDownLabel="Visa de 14 kostnadsraderna" />);
    expect(screen.getByRole("button", { name: "Visa de 14 kostnadsraderna" })).toBeInTheDocument();
  });

  it("visar källa och ålder tillsammans", () => {
    const iGar = new Date();
    iGar.setDate(iGar.getDate() - 1);
    render(<OpsStat label="Inkomster" value="126 720 kr" source="Bokio" updatedAt={iGar} />);
    expect(screen.getByText("Bokio")).toBeInTheDocument();
    expect(screen.getByText(formatRelativeDate(iGar))).toBeInTheDocument();
  });

  /**
   * ⛔ Åldern i ord är det man vill veta i förbifarten. Det exakta datumet är
   * det man vill veta i det ögonblick man börjar misstro talet, och då ska det
   * inte kräva att man letar upp en annan sida.
   */
  it("har exakt tid kvar i title och i dateTime", () => {
    const nar = new Date("2026-09-10T08:30:00Z");
    render(<OpsStat label="Netto" value="1" updatedAt={nar} />);
    const tid = screen.getByText(formatRelativeDate(nar));
    expect(tid.getAttribute("datetime")).toBe(nar.toISOString());
    expect(tid.getAttribute("title")).toBeTruthy();
  });

  it("visar tillförlitligheten i själva nyckeltalet", () => {
    render(<OpsStat label="Pension vid 65" value="5 290 000 kr" fact="scenario" factLabel="Vid 3 % avkastning" />);
    expect(screen.getByText("Vid 3 % avkastning")).toBeInTheDocument();
  });

  it("renderar varken källrad eller märke när inget skickas in", () => {
    const { container } = render(<OpsStat label="Netto" value="1" />);
    expect(container.querySelector("time")).toBeNull();
    expect(screen.queryByText("Uppmätt")).toBeNull();
  });

  it("kastar fortfarande på okänd tone", () => {
    forvantaKrasch(() => render(<OpsStat label="X" value="1" tone="lila" />), /okänd tone/);
  });
});

describe("formatRelativeDate", () => {
  it("räknar kalenderdagar, inte dygn om 24 timmar", () => {
    // 23:50 i går mot 00:10 i dag är 20 minuter, men i ord är det "i går".
    const nu = new Date(2026, 8, 16, 0, 10);
    const sent = new Date(2026, 8, 15, 23, 50);
    expect(formatRelativeDate(sent, { now: nu })).toBe("i går");
  });

  it("säger i dag om det är i dag", () => {
    const nu = new Date(2026, 8, 16, 12, 0);
    expect(formatRelativeDate(new Date(2026, 8, 16, 7, 0), { now: nu })).toBe("i dag");
  });

  it("växlar till månader och år när avståndet växer", () => {
    const nu = new Date(2026, 8, 16);
    expect(formatRelativeDate(new Date(2026, 5, 16), { now: nu })).toMatch(/månad/);
    expect(formatRelativeDate(new Date(2024, 8, 16), { now: nu })).toMatch(/år/);
  });

  it("ger platshållaren i stället för att kasta på skräp", () => {
    expect(formatRelativeDate(null)).toBeTruthy();
    expect(formatRelativeDate("inte ett datum")).toBeTruthy();
  });
});
