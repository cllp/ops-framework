import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { validateModuler } from "../lib/modul.js";

/** @param {(inmatning: any) => void} spara */
function bibliotekModul(spara) {
  return {
    id: "bibliotek",
    namn: { sv: "Bibliotek", en: "Library" },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: null,
    tillagg: [
      {
        plats: "inspelning.mal",
        id: "spara",
        etikett: { sv: "Spara i Biblioteket", en: "Save in the library" },
        spara,
      },
    ],
  };
}

const inspelare = {
  starta: vi.fn(async () => {}),
  stoppa: vi.fn(async () => ({ blob: new Blob(["a"]), mimeType: "audio/webm", sekunder: 1 })),
  kasta: vi.fn(),
  niva: () => 0,
};

const nav = [{ href: "/", label: "Start" }];

/** Huvudets mikrofon har samma namn. Raden i Skapa-menyn ligger utanför headern. */
function oppnaTalk() {
  fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
  const rad = screen.getAllByRole("button", { name: "TALK, prata in" }).find((knapp) => !knapp.closest("header"));
  if (!rad) throw new Error("TALK-raden saknas i Skapa");
  fireEvent.click(rad);
}

describe("plussets inspelare och modulens mål", () => {
  it("visar Spara i Biblioteket när modulen är på, och Klar anropar modulens spara", async () => {
    const spara = vi.fn();
    const onTalk = vi.fn();
    const grupp = { id: "g", moduler: ["bibliotek"] };
    const moduler = validateModuler([bibliotekModul(spara)]);
    render(
      <OpsAppShell
        brand="Ops"
        nav={nav}
        activeHref="/"
        talk={{ onTalk, inspelare, mal: [{ id: "handelse", etikett: "Händelse" }, { id: "meddelande", etikett: "Meddelande" }] }}
        skapa={{ lage: "g", moduler, aktivGrupp: grupp }}
      >
        <p>x</p>
      </OpsAppShell>,
    );
    oppnaTalk();
    expect(screen.getByRole("radio", { name: "Händelse" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Meddelande" })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("radio", { name: "Spara i Biblioteket" }));
    expect(screen.getByRole("button", { name: "Klar, spara inspelningen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
    await waitFor(() => expect(spara).toHaveBeenCalledTimes(1));
    expect(onTalk).not.toHaveBeenCalled();
    const inmatning = spara.mock.calls[0][0];
    expect(inmatning.mimeType).toBe("audio/webm");
    expect(inmatning.grupp).toBe(grupp);
    expect(typeof inmatning.rapportera).toBe("function");
  });

  it("en avstängd modul syns inte, och Händelse lämnas till onTalk", async () => {
    const spara = vi.fn();
    const onTalk = vi.fn();
    const grupp = { id: "g", moduler: [] };
    const moduler = validateModuler([bibliotekModul(spara)]);
    render(
      <OpsAppShell
        brand="Ops"
        nav={nav}
        activeHref="/"
        talk={{ onTalk, inspelare, mal: [{ id: "handelse", etikett: "Händelse" }, { id: "meddelande", etikett: "Meddelande" }] }}
        skapa={{ lage: "g", moduler, aktivGrupp: grupp }}
      >
        <p>x</p>
      </OpsAppShell>,
    );
    oppnaTalk();
    expect(screen.queryByRole("radio", { name: "Spara i Biblioteket" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Händelse" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
    await waitFor(() => expect(onTalk).toHaveBeenCalledTimes(1));
    expect(onTalk.mock.calls[0][1].mal).toEqual({ id: "handelse" });
    expect(spara).not.toHaveBeenCalled();
  });

  it("Röstinspelning i Ny-menyn öppnar plussets inspelare med Biblioteket förvalt", async () => {
    const spara = vi.fn();
    const onTalk = vi.fn();
    const grupp = { id: "g", moduler: ["bibliotek"] };
    const moduler = validateModuler([bibliotekModul(spara)]);
    render(
      <OpsAppShell
        brand="Ops"
        nav={nav}
        activeHref="/"
        talk={{ onTalk, inspelare, mal: [{ id: "handelse", etikett: "Händelse" }, { id: "meddelande", etikett: "Meddelande" }] }}
        skapa={{ lage: "g", moduler, aktivGrupp: grupp }}
      >
        <OpsBibliotek poster={[]} jag={{ uid: "u", roll: "medlem" }} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" />
      </OpsAppShell>,
    );
    expect(document.querySelector("[data-bibliotek-inspelning]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Röstinspelning" }));
    expect(screen.getByRole("radio", { name: "Spara i Biblioteket" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Händelse" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
    await waitFor(() => expect(spara).toHaveBeenCalledTimes(1));
    expect(onTalk).not.toHaveBeenCalled();
    expect(spara.mock.calls[0][0].grupp).toBe(grupp);
  });

  it("Röstinspelning utan modulens mål kastas", () => {
    const onTalk = vi.fn();
    render(
      <OpsAppShell
        brand="Ops"
        nav={nav}
        activeHref="/"
        talk={{ onTalk, inspelare, mal: [{ id: "handelse", etikett: "Händelse" }] }}
        skapa={{ lage: "g", moduler: validateModuler([bibliotekModul(vi.fn())]), aktivGrupp: { id: "g", moduler: [] } }}
      >
        <OpsBibliotek poster={[]} jag={{ uid: "u", roll: "medlem" }} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" />
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Röstinspelning" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/inspelning\.mal/);
    expect(onTalk).not.toHaveBeenCalled();
  });

  it("skapa.spelaIn kastas, så den gamla raden inte försvinner tyst", () => {
    expect(() =>
      render(
        <OpsAppShell brand="Ops" nav={nav} activeHref="/" skapa={{ spelaIn: () => {} }}>
          <p>x</p>
        </OpsAppShell>,
      ),
    ).toThrow(/inspelning\.mal/);
  });
});
