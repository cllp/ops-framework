import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { identityTone } from "../lib/identity.js";
import { lagerNyckel } from "../lib/kalenderlager.js";

/**
 * Plockaren i kalendern.
 *
 * ⛔ DAGENS NAMN ÄR BEVISET. En post i ett dolt lager får inte stå kvar som "1 post" på dagen. Utan filtret är namnet
 * "12, 1 post" både före och efter trycket, och då är provet rött.
 */

const TODAY = new Date(2026, 9, 5);
const LAGER = [
  { id: "ical:jobb", namn: "Jobb", farg: /** @type {const} */ (4), sektion: "Externa kalendrar" },
  { id: "ical:familj", namn: "Familj", undertext: "Från Anna", sektion: "Externa kalendrar" },
];

/** @returns {{ getItem: (n: string) => string | null, setItem: (n: string, v: string) => void, varden: Map<string, string> }} */
function minne() {
  const varden = new Map();
  return {
    varden,
    getItem: (n) => (varden.has(n) ? /** @type {string} */ (varden.get(n)) : null),
    setItem: (n, v) => {
      varden.set(n, v);
    },
  };
}

/**
 * @param {object} [extra]
 * @param {ReturnType<typeof minne>} [extra.lagring]
 */
function rita(extra = {}) {
  const poster = [
    { id: "p1", date: "2026-10-12", title: "Möte", kalender: { id: "ical:jobb", namn: "Jobb", farg: /** @type {const} */ (4) } },
    { id: "p2", date: "2026-10-12", title: "Gruppmöte", kalender: { id: "styrelsen", namn: "Styrelsen", farg: /** @type {const} */ (1) } },
  ];
  return render(
    <OpsCalendar
      ariaLabel="Kalender"
      today={TODAY}
      entries={poster}
      kalendrar={[
        { id: "styrelsen", namn: "Styrelsen", farg: 1, grupp: true },
        { id: "ical:jobb", namn: "Jobb", farg: 4 },
        { id: "ical:familj", namn: "Familj", farg: 2 },
      ]}
      lager={{ lista: LAGER, minne: "person-a", onHantera: extra.onHantera, onSynliga: extra.onSynliga, tomText: extra.tomText }}
      lagring={extra.lagring}
    />,
  );
}

const ruta = (/** @type {string} */ dag) => /** @type {HTMLElement} */ (document.querySelector(`[data-cal-day="${dag}"]`));

describe("kalenderlager i vyn", () => {
  it("öppnar plockaren, döljer lagrets post och minns valet för samma person", async () => {
    const lagring = minne();
    /** @type {string[][]} */
    const synliga = [];
    const hantera = vi.fn();
    rita({ lagring, onSynliga: (/** @type {string[]} */ ids) => synliga.push(ids), onHantera: hantera });
    expect(synliga.at(-1)).toEqual(["ical:jobb", "ical:familj"]);
    expect(ruta("2026-10-12").getAttribute("aria-label")).toBe("12, 2 poster");

    fireEvent.click(screen.getByRole("button", { name: "Kalenderlager" }));
    const plockare = /** @type {HTMLElement} */ (document.querySelector("[data-lager-plockare]"));
    expect(plockare).toBeTruthy();
    expect(within(plockare).getByRole("button", { name: "Jobb" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(plockare).getByText("Från Anna")).toBeTruthy();
    expect(within(plockare).getByText("Externa kalendrar")).toBeTruthy();

    const prick = /** @type {HTMLElement} */ (plockare.querySelector('[data-lager-id="ical:jobb"]'));
    expect(prick.getAttribute("data-lager-farg")).toBe("4");
    expect(prick.className).toContain("bg-identity-4");
    expect(prick.getAttribute("style")).toBeNull();
    expect(plockare.innerHTML).not.toContain("grupp-kulor");

    const familj = /** @type {HTMLElement} */ (plockare.querySelector('[data-lager-id="ical:familj"]'));
    expect(familj.getAttribute("data-lager-farg")).toBe(String(identityTone("ical:familj")));

    fireEvent.click(within(plockare).getByRole("button", { name: "Jobb" }));
    expect(ruta("2026-10-12").getAttribute("aria-label")).toBe("12, 1 post");
    expect(synliga.at(-1)).toEqual(["ical:familj"]);
    expect(JSON.parse(/** @type {string} */ (lagring.varden.get(lagerNyckel("person-a"))))).toEqual(["ical:jobb"]);

    fireEvent.click(within(plockare).getByRole("button", { name: "Hantera kalendrar" }));
    expect(hantera).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-lager-plockare]")).toBeNull();

    // ⛔ Plockaren ger fokus tillbaka till sin knapp en tick efter att den stängts. Öppnas listan före det stänger fokusflytten den igen, och provet läser då en lista som redan
    // är stängd och bortkopplad (mätt: `isConnected` var falskt, och provet var grönt för att en bortkopplad lista saknar raden). Därför väntar provet en tick och kräver en uppkopplad lista.
    await new Promise((klar) => setTimeout(klar, 0));
    fireEvent.click(screen.getByRole("button", { name: "Kalendrar: Alla kalendrar" }));
    const meny = await screen.findByRole("dialog", { name: "Kalendrar" });
    expect(meny.isConnected).toBe(true);
    // ⛔ Det FÖRÅLDRADE lagret döljer fortfarande kalendern ur listan (kopplingen som 0.134.0 avskaffar för den som använder `kalenderMinne`). Raden är en växel sedan 0.134.0.
    expect(within(meny).queryByRole("switch", { name: "Jobb" })).toBeNull();
    expect(within(meny).getByRole("switch", { name: "Styrelsen" })).toBeTruthy();
  });

  it("en annan person ser lagret, och samma person ser det dolt efter en ny visning", () => {
    const lagring = minne();
    const forsta = rita({ lagring });
    fireEvent.click(screen.getByRole("button", { name: "Kalenderlager" }));
    fireEvent.click(within(/** @type {HTMLElement} */ (document.querySelector("[data-lager-plockare]"))).getByRole("button", { name: "Jobb" }));
    expect(ruta("2026-10-12").getAttribute("aria-label")).toBe("12, 1 post");
    forsta.unmount();

    const andra = rita({ lagring });
    expect(ruta("2026-10-12").getAttribute("aria-label")).toBe("12, 1 post");
    andra.unmount();

    render(
      <OpsCalendar
        ariaLabel="Kalender"
        today={TODAY}
        entries={[{ id: "p1", date: "2026-10-12", title: "Möte", kalender: { id: "ical:jobb", namn: "Jobb", farg: 4 } }]}
        lager={{ lista: LAGER, minne: "person-b" }}
        lagring={lagring}
      />,
    );
    expect(ruta("2026-10-12").getAttribute("aria-label")).toBe("12, 1 post");
  });

  it("tom lista säger att lager saknas, och en tom text säger ingenting", () => {
    const hantera = vi.fn();
    const forsta = render(
      <OpsCalendar ariaLabel="Kalender" today={TODAY} entries={[]} lager={{ lista: [], onHantera: hantera }} />,
    );
    const knapp = screen.getByRole("button", { name: "Kalenderlager" });
    expect(knapp.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(knapp);
    expect(screen.getByText("Inga kalenderlager ännu.")).toBeTruthy();
    forsta.unmount();

    render(<OpsCalendar ariaLabel="Kalender" today={TODAY} entries={[]} lager={{ lista: [], tomText: "" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Kalenderlager" }));
    expect(screen.queryByText("Inga kalenderlager ännu.")).toBeNull();
  });
});
