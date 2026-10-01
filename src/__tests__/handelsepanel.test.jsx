import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsAppShell, useOppnaHandelse } from "../components/OpsAppShell.jsx";
import { OpsCalendar } from "../components/OpsCalendar.jsx";
import { OpsEventList } from "../components/OpsEventList.jsx";
import { OpsHandelsePanel } from "../components/OpsHandelsePanel.jsx";
import { handelseHref, handelseIdUrAdress, handelsetid, medHandelse } from "../lib/handelsepanel.js";

/**
 * 0.40.0 (#214): händelsepanelen.
 *
 * ⛔ Händelsen: CP 2026-10-01: "Vi behöver en händelsepanel. Så man navigerar dit från kalender och från idag. Händelsepanelen skall ha
 * en tillbaka knapp. Kolla SessionStudio." Raderna i Idag och kalenderns dagpanel kunde fälla ut lite text men inte ÖPPNA händelsen.
 *
 * Provet mäter det en person gör: trycker på en rad, ser panelen, trycker Tillbaka (eller webbläsarens bakåt) och står där hen stod, med
 * det hen hade gjort kvar. jsdom kör ingen CSS, så hur panelen SER UT mäts i webbläsaren (check-skalyta avsnitt 35).
 */

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const HANDELSER = {
  h1: {
    id: "h1",
    titel: "Styrelsemöte",
    datum: "2026-10-12",
    tid: "18:00",
    slutTid: "20:00",
    typ: { namn: "Möte" },
    status: "oppet",
    grupp: "Claes Philip Staiger AB",
    plats: "Visby",
    beskrivning: "Vi går igenom budgeten.",
    kravSvar: true,
  },
  h2: { id: "h2", titel: "Konferens", datum: "2026-10-05", slutDatum: "2026-10-07", heldag: true },
};
const statusWords = { oppet: "Öppet" };

const nav = [
  { href: "/", label: "Idag" },
  { href: "/kalender", label: "Kalender" },
];

function IdagVy() {
  const [anteckning, setAnteckning] = useState("");
  return (
    <div>
      <label>
        Anteckning
        <input value={anteckning} onChange={(e) => setAnteckning(e.target.value)} />
      </label>
      <OpsEventList
        ariaLabel="Idag"
        events={[
          { id: "e1", title: "Styrelsemöte", daysLeft: 0, handelseId: "h1" },
          { id: "e2", title: "En uppgift utan panel", daysLeft: 1 },
        ]}
      />
    </div>
  );
}

function KalenderVy() {
  return (
    <OpsCalendar
      ariaLabel="Kalender"
      today={new Date(2026, 9, 12, 12)}
      entries={[
        { id: "h1", date: "2026-10-12", title: "Styrelsemöte", handelseId: "h1" },
        { id: "p1", date: "2026-10-12", title: "En egen post" },
      ]}
    />
  );
}

/** En app som byter vy ur `activeHref`, som en riktig router, med skalets händelsepanel. */
function App({ start = "/", konfig = {} }) {
  const [href, setHref] = useState(start);
  return (
    <OpsAppShell
      brand="Ops"
      nav={nav}
      activeHref={href}
      onNavigate={(h, e) => {
        e.preventDefault();
        setHref(h);
      }}
      handelsepanel={{
        rita: ({ id, onTillbaka }) => <OpsHandelsePanel handelse={HANDELSER[id] ?? null} onTillbaka={onTillbaka} statusWords={statusWords} svar={<p>Svaren på {id}</p>} />,
        ...konfig,
      }}
    >
      {href === "/" ? <IdagVy /> : <KalenderVy />}
    </OpsAppShell>
  );
}

const panelen = () => document.querySelector("[data-handelsepanel]");
const idParam = () => new URL(window.location.href).searchParams.get("handelse");
const vyn = () => /** @type {HTMLElement} */ (screen.getByLabelText("Anteckning").closest("[hidden]") ?? document.body);

describe("adressen: ?handelse=<id>", () => {
  it("skriver, läser och tar bort id:t utan att röra resten av adressen", () => {
    expect(handelseHref("h 1")).toBe("?handelse=h%201");
    expect(handelseIdUrAdress("http://x/kalender?a=1&handelse=h%201#d")).toBe("h 1");
    expect(handelseIdUrAdress("/kalender?a=1")).toBeNull();
    expect(handelseIdUrAdress("/kalender?handelse=")).toBeNull();
    expect(medHandelse("/kalender?a=1#d", "h2")).toBe("/kalender?a=1&handelse=h2#d");
    expect(medHandelse("/kalender?a=1&handelse=h2#d", null)).toBe("/kalender?a=1#d");
    expect(() => handelseHref("")).toThrow(/id krävs/);
  });

  it("datum och tid: heldag, spann, klockslag, och inget klockslag skrivs inte", () => {
    expect(handelsetid({ datum: "2026-10-12", tid: "18:00", slutTid: "20:00" })).toEqual({ start: "måndag 12 oktober 2026", slut: "", tid: "18:00 - 20:00" });
    expect(handelsetid({ datum: "2026-10-12", tid: "18:00" }).tid).toBe("18:00");
    expect(handelsetid({ datum: "2026-10-12" }).tid).toBe("");
    expect(handelsetid({ datum: "2026-10-05", slutDatum: "2026-10-07", heldag: true })).toEqual({ start: "måndag 5 oktober 2026", slut: "onsdag 7 oktober 2026", tid: "Heldag" });
    // Ett slutdatum som inte är efter startdagen är ingen flerdagshändelse.
    expect(handelsetid({ datum: "2026-10-05", slutDatum: "2026-10-05" }).slut).toBe("");
    expect(handelsetid({ datum: "2026-10-12", heldag: true }, "en").tid).toBe("All day");
  });
});

describe("OpsHandelsePanel: innehållet i SS ordning, bara det händelsen har", () => {
  it("ritar Tillbaka, titel, status, typ, grupp, datum, tid, plats, beskrivning och svar, i den ordningen", () => {
    render(<OpsHandelsePanel handelse={HANDELSER.h1} onTillbaka={() => {}} statusWords={statusWords} svar={<p>Svaren</p>} />);
    const p = /** @type {HTMLElement} */ (panelen());
    const text = p.textContent ?? "";
    const ordning = ["Tillbaka", "Styrelsemöte", "Öppet", "Möte", "Grupp: Claes Philip Staiger AB", "måndag 12 oktober 2026", "18:00 - 20:00", "Visby", "Vi går igenom budgeten.", "Svaren"];
    const lagen = ordning.map((o) => text.indexOf(o));
    expect(lagen.every((l) => l >= 0)).toBe(true);
    expect([...lagen].sort((a, b) => a - b)).toEqual(lagen);
    expect(screen.getByRole("heading", { level: 1, name: "Styrelsemöte" })).toBeInTheDocument();
  });

  it("utelämnar det händelsen saknar: ingen plats, ingen beskrivning, inga svar, ingen tid", () => {
    render(<OpsHandelsePanel handelse={{ id: "x", titel: "Bara en dag", datum: "2026-10-12" }} onTillbaka={() => {}} />);
    const p = /** @type {HTMLElement} */ (panelen());
    expect(within(p).getByText("måndag 12 oktober 2026")).toBeInTheDocument();
    for (const d of ["handelseplats", "handelsetid", "handelsebeskrivning", "handelsesvar", "handelsemeta", "handelsestatus"]) {
      expect(p.querySelector(`[data-${d}]`), d).toBeNull();
    }
  });

  it("en händelse över flera dagar skriver båda datumen, en heldag skriver Heldag", () => {
    render(<OpsHandelsePanel handelse={HANDELSER.h2} onTillbaka={() => {}} />);
    const d = /** @type {HTMLElement} */ (document.querySelector("[data-handelsedatum]"));
    expect(d.textContent).toContain("måndag 5 oktober 2026");
    expect(d.textContent).toContain("onsdag 7 oktober 2026");
    expect(document.querySelector("[data-handelsetid]")?.textContent).toBe("Heldag");
  });

  it("svaren ritas bara när händelsen kräver svar, och en händelse som kräver svar utan `svar` kastar", () => {
    const logg = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<OpsHandelsePanel handelse={{ ...HANDELSER.h1, kravSvar: false }} onTillbaka={() => {}} statusWords={statusWords} svar={<p>Svaren</p>} />);
    expect(screen.queryByText("Svaren")).toBeNull();
    unmount();
    expect(() => render(<OpsHandelsePanel handelse={HANDELSER.h1} onTillbaka={() => {}} statusWords={statusWords} />)).toThrow(/kräver svar/);
    logg.mockRestore();
  });

  it("en status utan ord kastar, och en panel utan onTillbaka kastar", () => {
    const logg = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsHandelsePanel handelse={HANDELSER.h1} onTillbaka={() => {}} svar={<p>S</p>} />)).toThrow(/statusWords saknar ordet/);
    // @ts-expect-error provar felet
    expect(() => render(<OpsHandelsePanel handelse={HANDELSER.h2} />)).toThrow(/onTillbaka krävs/);
    logg.mockRestore();
  });

  it("har en väg tillbaka också när händelsen läses och när den inte finns, och de två säger olika saker", async () => {
    const tillbaka = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<OpsHandelsePanel handelse={null} laddar onTillbaka={tillbaka} />);
    expect(screen.getByText("Hämtar händelsen", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText("Händelsen finns inte")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    rerender(<OpsHandelsePanel handelse={null} onTillbaka={tillbaka} />);
    expect(screen.getByText("Händelsen finns inte")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(tillbaka).toHaveBeenCalledTimes(2);
  });
});

describe("Idag: en rad med handelseId öppnar panelen, Tillbaka kommer tillbaka till exakt det man lämnade", () => {
  it("raden är en länk med händelsens adress, och en rad utan handelseId är text", () => {
    render(<App />);
    const lank = screen.getByRole("link", { name: "Styrelsemöte" });
    expect(lank.getAttribute("href")).toBe("?handelse=h1");
    expect(screen.queryByRole("link", { name: "En uppgift utan panel" })).toBeNull();
  });

  it("ett tryck öppnar panelen, lägger id:t i adressen och döljer vyn utan att montera ner den", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Anteckning"), "Ring Anna");
    await user.click(screen.getByRole("link", { name: "Styrelsemöte" }));
    expect(panelen()).not.toBeNull();
    expect(idParam()).toBe("h1");
    expect(screen.getByRole("heading", { level: 1, name: "Styrelsemöte" })).toBeInTheDocument();
    expect(screen.getByText("Svaren på h1")).toBeInTheDocument();
    // Vyn ligger kvar i DOM:en men är dold, så det man skrev finns kvar.
    expect(vyn().hasAttribute("hidden")).toBe(true);
    expect(/** @type {HTMLInputElement} */ (screen.getByLabelText("Anteckning")).value).toBe("Ring Anna");
  });

  it("Tillbaka stänger panelen, tar bort id:t ur adressen och återställer vyn med det man skrivit", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Anteckning"), "Ring Anna");
    await user.click(screen.getByRole("link", { name: "Styrelsemöte" }));
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(panelen()).toBeNull());
    expect(idParam()).toBeNull();
    expect(vyn().hasAttribute("hidden")).toBe(false);
    expect(/** @type {HTMLInputElement} */ (screen.getByLabelText("Anteckning")).value).toBe("Ring Anna");
  });

  it("Tillbaka-knappen och webbläsarens bakåt är SAMMA gest: knappen går ett steg bakåt i historiken", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(window.history, "back");
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Styrelsemöte" }));
    expect(spy).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(spy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(panelen()).toBeNull());
    spy.mockRestore();
  });

  it("webbläsarens bakåt stänger panelen och framåt öppnar den igen", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Styrelsemöte" }));
    expect(panelen()).not.toBeNull();
    act(() => window.history.back());
    await waitFor(() => expect(panelen()).toBeNull());
    expect(vyn().hasAttribute("hidden")).toBe(false);
    act(() => window.history.forward());
    await waitFor(() => expect(panelen()).not.toBeNull());
    expect(idParam()).toBe("h1");
  });

  it("en adress med ?handelse= öppnar panelen vid inläsning, och Tillbaka där tar bort id:t i stället för att gå bakåt", async () => {
    window.history.replaceState(null, "", "/?handelse=h2");
    const spy = vi.spyOn(window.history, "back");
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Konferens" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(panelen()).toBeNull());
    // Ingen post att gå tillbaka till: bakåt hade lämnat appen.
    expect(spy).not.toHaveBeenCalled();
    expect(idParam()).toBeNull();
    spy.mockRestore();
  });

  it("ett id som appen inte känner ger 'Händelsen finns inte' med en väg tillbaka, och vyn ligger kvar", async () => {
    window.history.replaceState(null, "", "/?handelse=borta");
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText("Händelsen finns inte")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(panelen()).toBeNull());
    expect(screen.getByLabelText("Anteckning")).toBeInTheDocument();
  });

  it("ett tryck med Ctrl lämnas åt webbläsaren (ny flik) och öppnar inte panelen", () => {
    render(<App />);
    // Webbläsaren navigerar när en länk inte avbryts; jsdom kan inte, så det avbryts här, EFTER att länkens egen hanterare har fått se klicket.
    document.addEventListener("click", (e) => e.preventDefault(), { once: true });
    fireEvent.click(screen.getByRole("link", { name: "Styrelsemöte" }), { ctrlKey: true });
    expect(panelen()).toBeNull();
    expect(idParam()).toBeNull();
  });

  it("att navigera till en annan vy medan panelen är öppen stänger den", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Styrelsemöte" }));
    const toppnav = screen.getAllByRole("navigation").find((n) => n.closest("header"));
    const kalender = Array.from(/** @type {HTMLElement} */ (toppnav).querySelectorAll("a")).find((a) => a.textContent === "Kalender");
    await user.click(/** @type {HTMLElement} */ (kalender));
    await waitFor(() => expect(panelen()).toBeNull());
    expect(idParam()).toBeNull();
  });
});

describe("Kalendern: dagpanelens rad och snabbtitten öppnar panelen, och valda dagar finns kvar efter Tillbaka", () => {
  const valjDag = async (user) => {
    await user.click(screen.getByRole("link", { name: "Kalender" }));
    await user.click(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')));
  };
  const toppnavLank = (namn) => Array.from(/** @type {HTMLElement} */ (screen.getAllByRole("navigation").find((n) => n.closest("header"))).querySelectorAll("a")).find((a) => a.textContent === namn);

  it("raden i dagpanelen öppnar händelsen, och efter Tillbaka är dagen fortfarande vald", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(/** @type {HTMLElement} */ (toppnavLank("Kalender")));
    await user.click(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')));
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-dagpanel]"));
    // En post utan handelseId har ingen länk.
    expect(within(rad).queryByRole("link", { name: "En egen post" })).toBeNull();
    await user.click(within(rad).getByRole("link", { name: "Styrelsemöte" }));
    expect(idParam()).toBe("h1");
    expect(screen.getByRole("heading", { level: 1, name: "Styrelsemöte" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tillbaka" }));
    await waitFor(() => expect(panelen()).toBeNull());
    // Dagpanelen och den valda dagen finns kvar: kalendern var dold, inte nedmonterad.
    expect(document.querySelector("[data-dagpanel]")).not.toBeNull();
    expect(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')).getAttribute("aria-pressed")).toBe("true");
  });

  it("raden i snabbtitten öppnar händelsen och stänger titten", async () => {
    const user = userEvent.setup();
    render(<App start="/kalender" />);
    fireEvent.contextMenu(/** @type {HTMLElement} */ (document.querySelector('[data-cal-day="2026-10-12"]')));
    const titt = /** @type {HTMLElement} */ (document.querySelector("[data-snabbtitt]"));
    await user.click(within(titt).getByRole("link", { name: "Styrelsemöte" }));
    expect(idParam()).toBe("h1");
    expect(document.querySelector("[data-snabbtitt]")).toBeNull();
  });
});

describe("raderna utan skal och `useOppnaHandelse`", () => {
  it("en rad med handelseId utan skal med panel och utan onOppnaHandelse kastar, i listan och i kalendern", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsEventList events={[{ id: "e", title: "X", daysLeft: 0, handelseId: "h1" }]} />)).toThrow(/handelseId/);
    expect(() => render(<OpsCalendar ariaLabel="K" today={new Date(2026, 9, 12, 12)} entries={[{ id: "h", date: "2026-10-12", title: "X", handelseId: "h1" }]} />)).toThrow(/handelseId/);
    spy.mockRestore();
  });

  it("onOppnaHandelse går före skalet och fungerar utanför det", async () => {
    const user = userEvent.setup();
    const oppna = vi.fn();
    render(<OpsEventList events={[{ id: "e", title: "X", daysLeft: 0, handelseId: "h1" }]} onOppnaHandelse={oppna} />);
    await user.click(screen.getByRole("link", { name: "X" }));
    expect(oppna).toHaveBeenCalledWith("h1");
  });

  it("useOppnaHandelse öppnar panelen från en egen yta, och kastar utanför skalet", async () => {
    const user = userEvent.setup();
    function Knapp() {
      const oppna = useOppnaHandelse();
      return (
        <button type="button" onClick={() => oppna("h2")}>
          Öppna konferensen
        </button>
      );
    }
    render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/" handelsepanel={{ rita: ({ id, onTillbaka }) => <OpsHandelsePanel handelse={HANDELSER[id]} onTillbaka={onTillbaka} /> }}>
        <Knapp />
      </OpsAppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Öppna konferensen" }));
    expect(screen.getByRole("heading", { level: 1, name: "Konferens" })).toBeInTheDocument();
    expect(idParam()).toBe("h2");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Knapp />)).toThrow(/utanför OpsAppShell/);
    spy.mockRestore();
  });

  it("utan `handelsepanel` på skalet finns ingen kontext, och ett id i adressen ritar ingenting", () => {
    window.history.replaceState(null, "", "/?handelse=h1");
    render(
      <OpsAppShell brand="Ops" nav={nav} activeHref="/">
        <p>Appens vy</p>
      </OpsAppShell>,
    );
    expect(screen.getByText("Appens vy").closest("[hidden]")).toBeNull();
    expect(panelen()).toBeNull();
  });
});
