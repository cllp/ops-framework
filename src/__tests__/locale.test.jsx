import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsDatePicker } from "../components/OpsDatePicker.jsx";
import { DEFAULT_LOCALE, dateText, monthNames, weekdayNames } from "../lib/calendar.js";

/**
 * Datumens ord kommer ur `Intl` och språket ur ett argument (#95).
 *
 * ⛔ PROVEN JÄMFÖR MOT ORD OCH INTE MOT `Intl` SOM SPEGEL. Ett prov som skriver
 * `expect(monthNames("en-GB")[9]).toBe(new Intl.DateTimeFormat("en-GB", { month: "long" }).format(...))`
 * är grönt även om funktionen ignorerar sitt argument, eftersom båda sidor då
 * räknar fel på samma sätt. Orden står därför utskrivna.
 *
 * ⛔ ETT SPRÅK SOM INTE ÄR SVENSKA ÄR HELA POÄNGEN. Före den här ändringen var
 * `sv` hårdkodad, och varje prov som bara tittade på svenska hade varit grönt
 * hela tiden.
 */

const IDAG = new Date(2026, 9, 5); // måndag 5 oktober 2026

describe("månadernas och veckodagarnas namn", () => {
  it("ger svenska månadsnamn på förvalsspråket", () => {
    expect(DEFAULT_LOCALE).toBe("sv-SE");
    expect(monthNames()).toHaveLength(12);
    expect(monthNames()[0]).toBe("januari");
    expect(monthNames()[9]).toBe("oktober");
  });

  it("ger engelska månadsnamn på engelska", () => {
    expect(monthNames("en-GB")[0]).toBe("January");
    expect(monthNames("en-GB")[9]).toBe("October");
  });

  it("börjar veckan på måndag i båda språken, aldrig på söndag", () => {
    /*
     * ⛔ DET HÄR ÄR DET FEL SOM KOSTAR MEST OCH SYNS MINST. Rutnätet räknar sin
     * första kolumn måndagsbaserat. Hämtade rubrikraden sin ordning ur språket
     * hade en engelsk app fått söndag först i raden och måndag först i rutorna,
     * alltså varje dag under fel rubrik. Kalendern ser felfri ut och är en dag
     * fel.
     */
    expect(weekdayNames()[0]).toBe("Mån");
    expect(weekdayNames()[6]).toBe("Sön");
    expect(weekdayNames("en-GB")[0]).toBe("Mon");
    expect(weekdayNames("en-GB")[6]).toBe("Sun");
  });

  it("skriver veckodagen med stor bokstav också på svenska", () => {
    // Svenskan skriver dem gement, och `Intl` svarar därefter. En rubrikrad där
    // halva paketet är gement och halva versalt ser ut som ett fel.
    expect(weekdayNames()).toEqual(["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"]);
  });

  it("skriver dagsrubriken på det språk den ombeds", () => {
    expect(dateText("2026-10-12")).toBe("12 oktober");
    expect(dateText("2026-10-12", "en-GB")).toBe("12 October");
  });

  it("ger tillbaka strängen som inte är ett datum i stället för NaN", () => {
    expect(dateText("inte ett datum", "en-GB")).toBe("inte ett datum");
  });
});

describe("OpsCalendar talar appens språk", () => {
  it("ritar månadsrubrik och veckodagar på svenska utan locale", () => {
    render(<OpsCalendar ariaLabel="Kalender" entries={[]} today={IDAG} monthsBack={0} monthsForward={0} />);
    expect(screen.getByRole("heading", { name: "oktober 2026" })).toBeInTheDocument();
    expect(screen.getByText("Mån")).toBeInTheDocument();
  });

  it("ritar samma kalender på engelska med locale", () => {
    render(<OpsCalendar ariaLabel="Calendar" entries={[]} today={IDAG} monthsBack={0} monthsForward={0} locale="en-GB" />);
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.queryByText("Mån")).not.toBeInTheDocument();
  });

  it("skriver dagspanelens datum på samma språk som rutnätet", () => {
    render(
      <OpsCalendar
        ariaLabel="Calendar"
        entries={[{ id: "a", date: "2026-10-12", title: "Payroll", status: "oppet" }]}
        statusWords={{ oppet: "Open" }}
        today={IDAG}
        monthsBack={0}
        monthsForward={0}
        locale="en-GB"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "12, 1 post" }));
    expect(screen.getAllByText("12 October").length).toBeGreaterThan(0);
  });
});

describe("OpsDatePicker talar appens språk", () => {
  /**
   * ⛔ ÖPPNAR VÄLJAREN PÅ RIKTIGT. Rubrikerna ritas av react-day-picker genom
   * `formatters`, alltså finns de inte förrän popovern är öppen. Ett prov som
   * bara renderar komponenten hade varit grönt utan att ha sett något.
   *
   * @param {string} [locale]
   */
  function oppna(locale) {
    render(<OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Datum" locale={locale} />);
    fireEvent.click(screen.getByRole("button", { name: "Datum" }));
    const rutnat = screen.getByRole("grid");
    const dialog = rutnat.closest("[role='dialog']") || document.body;
    return within(/** @type {HTMLElement} */ (dialog));
  }

  it("ritar månadsrubrik och veckodagar på svenska utan locale", () => {
    const i = oppna();
    expect(i.getByText("oktober 2026")).toBeInTheDocument();
    expect(i.getByText("Mån")).toBeInTheDocument();
  });

  it("ritar samma väljare på engelska med locale", () => {
    const i = oppna("en-GB");
    expect(i.getByText("October 2026")).toBeInTheDocument();
    expect(i.getByText("Mon")).toBeInTheDocument();
    expect(i.queryByText("oktober 2026")).not.toBeInTheDocument();
  });

  it("skriver det valda datumet i knappen på samma språk", () => {
    render(<OpsDatePicker value="2026-10-12" onChange={() => {}} ariaLabel="Date" locale="en-GB" />);
    // en-GB kort datum: 12/10/2026. sv-SE: 2026-10-12. Skillnaden är beviset.
    expect(screen.getByRole("button", { name: "Date" })).toHaveTextContent("12/10/2026");
  });
});
