import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsFilterPanel } from "../components/OpsFilterPanel.jsx";

const GRUPPER = [
  { id: "slag", label: "Slag", options: [{ value: "uppgift", label: "Uppgift" }, { value: "paminnelse", label: "Påminnelse" }] },
  { id: "status", label: "Status", options: [{ value: "vantar", label: "Väntar" }, { value: "akut", label: "Akut" }] },
];

const tomt = { slag: null, status: null };

function rendera(extra = {}) {
  const onChange = vi.fn();
  const ut = render(
    <OpsFilterPanel grupper={GRUPPER} value={tomt} onChange={onChange} ariaLabel="Filter" {...extra} />,
  );
  return { onChange, ...ut };
}

describe("OpsFilterPanel", () => {
  it("visar ingen text när inget filter är valt", () => {
    /*
     * ⛔ CP 2026-09-21, med bild ur SessionStudio: "Ingen text när inget filter
     * är valt, endast när det är valt." En knapp som alltid bär ett ord säger
     * inget om huruvida listan är beskuren.
     */
    const { container } = rendera();
    const knapp = screen.getByRole("button", { name: "Filter" });
    expect(knapp.textContent).toBe("");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("skriver den valda etiketten i knappen, inte gruppens rubrik", () => {
    /*
     * ⛔ "Väntar" säger vad som visas. "Status" säger bara vilken sorts filter
     * som är satt, alltså precis det man redan ser av att knappen är tänd.
     */
    rendera({ value: { slag: null, status: "vantar" } });
    expect(screen.getByRole("button", { name: "Filter: Väntar" }).textContent).toBe("Väntar");
  });

  it("lägger en räknare först vid två filter, inte vid ett", () => {
    // ⛔ Vid ett filter står hela sanningen i ordet, och en etta i ett hörn vore
    // dekor. Vid två är ordet ofullständigt, och då behövs siffran.
    const ett = rendera({ value: { slag: "uppgift", status: null } });
    expect(ett.container.textContent).not.toContain("2");
    ett.unmount();

    rendera({ value: { slag: "uppgift", status: "akut" } });
    const knapp = screen.getByRole("button", { name: /Filter:/ });
    expect(knapp.textContent).toContain("2");
  });

  it("byter inte höjd när ett filter sätts", () => {
    /*
     * ⛔ Knappen står på samma rad som listrubriken. Byter den höjd hoppar
     * hela listan när man filtrerar, och det är exakt felet som mättes bort ur
     * bubblan i #242. Provet läser klasserna, eftersom jsdom inte räknar
     * layout: båda lägena måste bära samma `min-h`.
     */
    const utan = rendera();
    const a = screen.getByRole("button", { name: "Filter" }).className;
    utan.unmount();

    rendera({ value: { slag: "uppgift", status: null } });
    const b = screen.getByRole("button", { name: /Filter:/ }).className;

    expect(a).toContain("min-h-11");
    expect(b).toContain("min-h-11");
  });

  it("skickar hela kartan vid val, inte bara den ändrade gruppen", async () => {
    /*
     * ⛔ Ett `onChange` med en delmängd hade lämnat appens karta halvfylld, och
     * nästa läsning hade sett en nyckel som saknas som "aldrig konfigurerad".
     */
    const { onChange } = rendera({ value: { slag: "uppgift", status: null } });
    fireEvent.click(screen.getByRole("button", { name: /Filter:/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Väntar" }));
    expect(onChange).toHaveBeenCalledWith({ slag: "uppgift", status: "vantar" });
  });

  it("rensar alla grupper, även de som inte var satta", async () => {
    const { onChange } = rendera({ value: { slag: "uppgift", status: null } });
    fireEvent.click(screen.getByRole("button", { name: /Filter:/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Rensa" }));
    expect(onChange).toHaveBeenCalledWith({ slag: null, status: null });
  });

  it("visar Rensa bara när något är valt", async () => {
    // ⛔ En alltid synlig knapp som inte gör något lär en att den inte gör något.
    rendera();
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    // ⛔ `findAllByRole`: VARJE grupp har en egen "Alla"-rad, så entalsformen
    // kastade på två träffar. Ett prov som är rött av fel anledning slutar man
    // läsa, och det här hade dessutom dolt att panelen öppnade som den skulle.
    const allaRader = await screen.findAllByRole("button", { name: "Alla" });
    expect(allaRader.length).toBe(GRUPPER.length);
    expect(screen.queryByRole("button", { name: "Rensa" })).toBeNull();
  });

  it("räknar aldrig sorteringen som ett filter", async () => {
    /*
     * ⛔ En sorterad lista är fortfarande komplett. Tände sorteringen
     * filterknappen skulle den säga "något är dolt" när ingenting är dolt.
     */
    const onSortera = vi.fn();
    rendera({
      sortering: {
        label: "Sortering",
        value: "titel",
        options: [
          { value: "datum", label: "Datum" },
          { value: "titel", label: "Titel" },
        ],
        onChange: onSortera,
      },
    });

    const knapp = screen.getByRole("button", { name: "Filter" });
    expect(knapp.textContent).toBe("");

    fireEvent.click(knapp);
    fireEvent.click(await screen.findByRole("button", { name: "Datum" }));
    expect(onSortera).toHaveBeenCalledWith("datum");
    // Fortfarande ingen text: sorteringen ändrade ordningen, inte urvalet.
    expect(screen.getByRole("button", { name: "Filter" }).textContent).toBe("");
  });

  it("kastar utan grupper eller namn", () => {
    // ⛔ Samma val som OpsEventList: hellre ett fel än en knapp som ser färdig
    // ut och inte leder någonstans, eller en ikon utan namn för skärmläsaren.
    expect(() => render(<OpsFilterPanel grupper={[]} value={{}} onChange={() => {}} ariaLabel="Filter" />)).toThrow(
      /grupper krävs/,
    );
    expect(() => render(<OpsFilterPanel grupper={GRUPPER} value={{}} onChange={() => {}} />)).toThrow(/ariaLabel krävs/);
  });

  it("ger varje grupp en egen ikon som lyser när just den är satt", async () => {
    /*
     * ⛔ CP 2026-09-22, med bild: "Detta filtret är absurt stort. En ikon för
     * varje Lägen, Tid, Roller och sortering, vänsterställda så de får plats i
     * mobil, och belys ikonen om det är ett aktivt filter."
     *
     * Med fyra dimensioner plus sortering blev den samlade panelen en lista på
     * tjugo rader som täckte halva skärmen. Man rullade i en meny för att hitta
     * en rad man redan visste namnet på.
     *
     * ⛔ POÄNGEN ÄR ATT TILLSTÅNDET SYNS UTAN ATT NÅGOT ÖPPNAS, och det är det
     * provet mäter: `aria-pressed` per ikon, alltså en per dimension, och bara
     * den satta är tänd. Ett påstående om en klass hade missat att det tända
     * läget också måste gå att HÖRA.
     */
    function Prov() {
      const [val, setVal] = useState({ status: null, tid: null });
      return (
        <OpsFilterPanel
          layout="ikoner"
          ariaLabel="Filter"
          grupper={[
            { id: "status", label: "Lägen", allaLabel: "Alla lägen", options: [{ value: "oppet", label: "Öppet" }] },
            { id: "tid", label: "När", allaLabel: "När som helst", options: [{ value: "7", label: "Inom 7 dagar" }] },
          ]}
          value={val}
          onChange={setVal}
        />
      );
    }
    render(<Prov />);

    const lagen = () => screen.getByRole("button", { name: /^Lägen/ });
    const nar = () => screen.getByRole("button", { name: /^När/ });
    expect(lagen()).toHaveAttribute("aria-pressed", "false");
    expect(nar()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(lagen());
    fireEvent.click(await screen.findByRole("button", { name: "Öppet" }));

    // ⛔ Bara den satta lyser. Tändes båda vore raden en lampa i stället för
    // ett besked.
    expect(screen.getByRole("button", { name: "Lägen: Öppet" })).toHaveAttribute("aria-pressed", "true");
    expect(nar()).toHaveAttribute("aria-pressed", "false");
  });

  it("tänder sorteringsikonen först när den lämnat sitt förval", () => {
    /*
     * ⛔ SORTERING ÄR INTE ETT FILTER, och det är samma regel som den samlade
     * panelen redan har: en sorterad lista är fortfarande komplett. Ikonen lyser
     * för att säga "du har ändrat den här", inte "något är dolt".
     *
     * ⛔ FÖRVALET SKICKAS IN, och räknas annars som det första alternativet.
     * Provet sätter `standard` uttryckligen till det ANDRA, så en implementation
     * som bara antar "första" blir röd.
     */
    const grupper = [{ id: "a", label: "A", options: [{ value: "x", label: "X" }] }];
    const sortering = {
      label: "Sortering",
      value: "b",
      standard: "b",
      options: [
        { value: "a", label: "A-Ö" },
        { value: "b", label: "Datum" },
      ],
      onChange: () => {},
    };
    const { rerender } = render(
      <OpsFilterPanel layout="ikoner" ariaLabel="Filter" grupper={grupper} value={{ a: null }} onChange={() => {}} sortering={sortering} />,
    );
    expect(screen.getByRole("button", { name: "Sortering: Datum" })).toHaveAttribute("aria-pressed", "false");

    rerender(
      <OpsFilterPanel
        layout="ikoner"
        ariaLabel="Filter"
        grupper={grupper}
        value={{ a: null }}
        onChange={() => {}}
        sortering={{ ...sortering, value: "a" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Sortering: A-Ö" })).toHaveAttribute("aria-pressed", "true");
  });

  it("vägrar en okänd layout i stället för att rita den samlade ändå", () => {
    // ⛔ En tyst nedsläppsväg hade ritat fel form och sett ut att fungera.
    expect(() =>
      render(
        <OpsFilterPanel
          layout="raketstol"
          ariaLabel="Filter"
          grupper={[{ id: "a", label: "A", options: [] }]}
          value={{}}
          onChange={() => {}}
        />,
      ),
    ).toThrow(/okänd layout/);
  });
});
