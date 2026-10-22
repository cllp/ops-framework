import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsDatePicker } from "../components/OpsDatePicker.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";

/**
 * Datumväljarens prickar och månadsanrop (appen räknar, väljaren ritar).
 *
 * ⛔ PROVEN ÖPPNAR VÄLJAREN PÅ RIKTIGT och letar efter pricken som element (`data-prick`), inte efter ett klassnamn:
 * jsdom kör ingen CSS, så en klass säger ingenting om att något ritas (arbetsregler 4, närvarogrep).
 * ⛔ DEN MARKERADE OCH DEN OMARKERADE DAGEN FINNS I SAMMA PROV. Ett prov som bara ser att en prick finns är grönt även
 * om alla dagar får en; ett som bara ser att en annan saknas är grönt utan någon prick alls.
 * ⛔ Datumen är fasta (oktober 2026), aldrig "idag", så att proven ser likadana ut varje dag.
 */

/** @param {string} dag @returns {HTMLElement | null} */
function ruta(dag) {
  return document.body.querySelector(`[data-day="${dag}"]`);
}

/** @param {string} dag */
function pricken(dag) {
  return ruta(dag)?.querySelector("[data-prick]") ?? null;
}

/** @param {import("react").ComponentProps<typeof OpsDatePicker>} [extra] */
function oppna(extra = {}) {
  const ut = render(<OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Datum" {...extra} />);
  fireEvent.click(screen.getByRole("button", { name: "Datum" }));
  return ut;
}

describe("OpsDatePicker: prickar på dagar med händelser", () => {
  it("ritar en prick på varje markerad dag och på ingen annan", () => {
    oppna({ markeradeDagar: new Set(["2026-10-14", "2026-10-20"]) });
    expect(pricken("2026-10-14")).not.toBeNull();
    expect(pricken("2026-10-20")).not.toBeNull();
    expect(pricken("2026-10-15")).toBeNull();
    expect(pricken("2026-10-12")).toBeNull();
    expect(document.body.querySelectorAll("[data-prick]")).toHaveLength(2);
  });

  it("tar en lista lika bra som en mängd", () => {
    oppna({ markeradeDagar: ["2026-10-14"] });
    expect(pricken("2026-10-14")).not.toBeNull();
    expect(document.body.querySelectorAll("[data-prick]")).toHaveLength(1);
  });

  it("lägger etiketten i dagens namn för en markerad dag och bara för den", () => {
    oppna({ markeradeDagar: new Set(["2026-10-14"]) });
    const markerad = ruta("2026-10-14")?.querySelector("button");
    const vanlig = ruta("2026-10-15")?.querySelector("button");
    expect(markerad?.getAttribute("aria-label")).toMatch(/, har händelser$/);
    // Dagens vanliga namn står kvar framför etiketten (datumet är inte bortbytt).
    expect(markerad?.getAttribute("aria-label")).toMatch(/14/);
    expect(vanlig?.getAttribute("aria-label")).not.toMatch(/har händelser/);
  });

  it("säger has events när appen ritas på engelska", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Datum" markeradeDagar={new Set(["2026-10-14", "2026-10-20"])} markeradEtikett={undefined} />
      </OpsSprakProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Datum" }));
    expect(ruta("2026-10-14")?.querySelector("button")?.getAttribute("aria-label")).toMatch(/, has events$/);
    expect(ruta("2026-10-14")?.querySelector("button")?.getAttribute("aria-label")).not.toMatch(/händelser/);
  });

  it("tar en egen etikett", () => {
    oppna({ markeradeDagar: new Set(["2026-10-14"]), markeradEtikett: "has events" });
    expect(ruta("2026-10-14")?.querySelector("button")?.getAttribute("aria-label")).toMatch(/, has events$/);
  });

  it("döljer pricken för skärmläsare, så att etiketten inte läses två gånger", () => {
    oppna({ markeradeDagar: new Set(["2026-10-14"]) });
    expect(pricken("2026-10-14")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("ritar pricken också på det valda datumet, i en annan färg än accenten", () => {
    oppna({ markeradeDagar: new Set(["2026-10-12", "2026-10-14"]) });
    // Det valda datumet är fyllt med accenten, så en accentprick där syns inte. Pricken ska finnas men ha kontrastfärgen.
    expect(pricken("2026-10-12")).not.toBeNull();
    expect(pricken("2026-10-12")?.className).toContain("bg-accent-contrast");
    expect(pricken("2026-10-14")?.className).not.toContain("bg-accent-contrast");
  });

  it("kan fortfarande välja en markerad dag", () => {
    const onChange = vi.fn();
    oppna({ markeradeDagar: new Set(["2026-10-14"]), onChange });
    fireEvent.click(/** @type {HTMLElement} */ (ruta("2026-10-14")).querySelector("button"));
    expect(onChange).toHaveBeenCalledWith("2026-10-14");
  });

  it("kastar för en dag som inte är en ISO-dag i stället för att tiga", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsDatePicker value="2026-10-12" onChange={() => {}} markeradeDagar={["2026-10-14T10:00"]} />)).toThrow(/2026-10-14T10:00/);
    tyst.mockRestore();
  });
});

describe("OpsDatePicker: utan props är väljaren som förut", () => {
  it("ritar ingen prick och lägger ingen etikett", () => {
    oppna();
    expect(document.body.querySelectorAll("[data-prick]")).toHaveLength(0);
    expect(ruta("2026-10-14")?.querySelector("button")?.getAttribute("aria-label")).not.toMatch(/har händelser/);
  });

  it("ritar exakt samma rutnät med en tom mängd som utan propen", () => {
    const utan = oppna();
    const utanHtml = document.body.querySelector("[role='grid']")?.innerHTML;
    utan.unmount();
    oppna({ markeradeDagar: new Set() });
    expect(document.body.querySelector("[role='grid']")?.innerHTML).toBe(utanHtml);
  });
});

describe("OpsDatePicker: onManadVisas", () => {
  it("anropas med månadens första dag när väljaren öppnas, och inte innan", () => {
    const onManadVisas = vi.fn();
    render(<OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Datum" onManadVisas={onManadVisas} />);
    expect(onManadVisas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Datum" }));
    expect(onManadVisas).toHaveBeenCalledTimes(1);
    expect(onManadVisas).toHaveBeenCalledWith("2026-10-01");
  });

  it("anropas med varje ny månad när användaren bläddrar, framåt och bakåt", () => {
    const onManadVisas = vi.fn();
    oppna({ onManadVisas });
    onManadVisas.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    expect(onManadVisas).toHaveBeenLastCalledWith("2026-11-01");
    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    expect(onManadVisas).toHaveBeenLastCalledWith("2026-09-01");
    expect(onManadVisas).toHaveBeenCalledTimes(3);
  });

  it("anropas inte vid en ny ritning eller när ett datum väljs", () => {
    const onManadVisas = vi.fn();
    const { rerender } = oppna({ onManadVisas });
    onManadVisas.mockClear();
    rerender(<OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Datum" onManadVisas={onManadVisas} markeradeDagar={new Set(["2026-10-14"])} />);
    expect(onManadVisas).not.toHaveBeenCalled();
  });

  it("anropas igen vid nästa öppning, med det valda datumets månad", () => {
    const onManadVisas = vi.fn();
    render(<OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Datum" onManadVisas={onManadVisas} />);
    fireEvent.click(screen.getByRole("button", { name: "Datum" }));
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Datum" }));
    expect(onManadVisas).toHaveBeenLastCalledWith("2026-10-01");
  });

  it("utan valt datum utgår första anropet från månaden som visas (idag)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 17, 12));
    try {
      const onManadVisas = vi.fn();
      render(<OpsDatePicker onChange={() => {}} ariaLabel="Datum" onManadVisas={onManadVisas} />);
      fireEvent.click(screen.getByRole("button", { name: "Datum" }));
      expect(onManadVisas).toHaveBeenCalledWith("2026-03-01");
      // Och det är också månaden som ritas, inte bara den som sägs.
      expect(ruta("2026-03-17")).not.toBeNull();
      expect(screen.getByText("mars 2026")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
