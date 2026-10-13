import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { IDE_MAX_SEKUNDER } from "../lib/bibliotek.js";
import { validateModuler } from "../lib/modul.js";

/**
 * @param {(inmatning: any) => void} spara
 * @param {number} [maxSekunder] Målets tak. Utan det gäller TALK:s 120.
 */
function bibliotekModul(spara, maxSekunder) {
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
        ...(maxSekunder === undefined ? {} : { maxSekunder }),
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

  describe("⛔ valet gäller en inspelning, inte sessionen (0.94.3, lifehub.app#187)", () => {
    /** @param {ReturnType<typeof vi.fn>} spara @param {ReturnType<typeof vi.fn>} onTalk */
    function skal(spara, onTalk) {
      const grupp = { id: "g", moduler: ["bibliotek"] };
      return render(
        <OpsAppShell
          brand="Ops"
          nav={nav}
          activeHref="/"
          talk={{ onTalk, inspelare, mal: [{ id: "forslag", etikett: "Förslag" }, { id: "meddelande", etikett: "Meddelande" }] }}
          skapa={{ lage: "g", moduler: validateModuler([bibliotekModul(spara)]), aktivGrupp: grupp }}
        >
          <OpsBibliotek poster={[]} jag={{ uid: "u", roll: "medlem" }} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" />
        </OpsAppShell>,
      );
    }

    const rostinspelning = () => {
      fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Röstinspelning" }));
    };

    /** Huvudets mikrofon, samma väg som raden i Skapa (`oppnaSkapa(TALK_FORM)`). */
    const talkIHuvudet = () => {
      const knapp = screen.getAllByRole("button", { name: "TALK, prata in" }).find((k) => k.closest("header"));
      if (!knapp) throw new Error("TALK-knappen i huvudet saknas");
      fireEvent.click(knapp);
    };

    it("efter en sparad röstinspelning i Biblioteket börjar nästa inspelning ur plusset och TALK på appens första mål", async () => {
      const spara = vi.fn();
      const onTalk = vi.fn();
      skal(spara, onTalk);
      rostinspelning();
      expect(screen.getByRole("radio", { name: "Spara i Biblioteket" })).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
      await waitFor(() => expect(spara).toHaveBeenCalledTimes(1));
      // Sparat står kvar i SPARAT_MS och fälls sedan till vila. Först då är inspelningen över.
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "TALK" })).toBeNull(), { timeout: 3000 });

      oppnaTalk();
      expect(screen.getByRole("radio", { name: "Förslag" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "Spara i Biblioteket" })).toHaveAttribute("aria-checked", "false");
      fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
      expect(screen.queryByRole("dialog", { name: "TALK" })).toBeNull();

      talkIHuvudet();
      expect(screen.getByRole("radio", { name: "Förslag" })).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
      await waitFor(() => expect(onTalk).toHaveBeenCalledTimes(1));
      expect(onTalk.mock.calls[0][1].mal).toEqual({ id: "forslag" });
      expect(spara).toHaveBeenCalledTimes(1);
    });

    it("samma sak när röstinspelningen i Biblioteket avbryts, och när målet valdes i fältet", async () => {
      const spara = vi.fn();
      const onTalk = vi.fn();
      skal(spara, onTalk);
      rostinspelning();
      expect(screen.getByRole("radio", { name: "Spara i Biblioteket" })).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
      expect(screen.queryByRole("dialog", { name: "TALK" })).toBeNull();

      talkIHuvudet();
      expect(screen.getByRole("radio", { name: "Förslag" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "Spara i Biblioteket" })).toHaveAttribute("aria-checked", "false");
      // Ett val i fältet under en plusinspelning gäller den inspelningen och inte nästa.
      fireEvent.click(screen.getByRole("radio", { name: "Meddelande" }));
      fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));

      oppnaTalk();
      expect(screen.getByRole("radio", { name: "Förslag" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "Meddelande" })).toHaveAttribute("aria-checked", "false");
      expect(spara).not.toHaveBeenCalled();
      expect(onTalk).not.toHaveBeenCalled();
    });

    it("återställningen nollar inte målet innan röstinspelningen startat: den sparas i modulens mål, också andra gången", async () => {
      const spara = vi.fn();
      const onTalk = vi.fn();
      skal(spara, onTalk);
      rostinspelning();
      fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
      // Andra röstinspelningen kommer efter en övergång till vila, alltså efter en återställning.
      rostinspelning();
      expect(screen.getByRole("radio", { name: "Spara i Biblioteket" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Klar, spara inspelningen" }));
      await waitFor(() => expect(spara).toHaveBeenCalledTimes(1));
      expect(onTalk).not.toHaveBeenCalled();
    });
  });

  describe("⛔ taket följer målet (0.93.0)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    /**
     * @param {ReturnType<typeof vi.fn>} stoppa
     * @param {number} [maxSekunder] Målets tak i modulens tillägg.
     */
    function skal(stoppa, maxSekunder) {
      const insp = { starta: vi.fn(async () => {}), stoppa, kasta: vi.fn(), niva: () => 0 };
      const grupp = { id: "g", moduler: ["bibliotek"] };
      const moduler = validateModuler([bibliotekModul(vi.fn(), maxSekunder)]);
      return render(
        <OpsAppShell
          brand="Ops"
          nav={nav}
          activeHref="/"
          talk={{ onTalk: vi.fn(), inspelare: insp, mal: [{ id: "handelse", etikett: "Händelse" }, { id: "meddelande", etikett: "Meddelande" }] }}
          skapa={{ lage: "g", moduler, aktivGrupp: grupp }}
        >
          <OpsBibliotek poster={[]} jag={{ uid: "u", roll: "medlem" }} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" />
        </OpsAppShell>,
      );
    }

    /** @param {number} sekunder */
    const gaFram = async (sekunder) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(sekunder * 1000);
      });
    };

    it("ett mål med taket IDE_MAX_SEKUNDER klipps inte vid 2:00 utan vid 10:00, och ett mål utan tak klipps vid 2:00", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
      const stopp120 = vi.fn(async () => ({ blob: new Blob(["a"]), mimeType: "audio/webm", sekunder: 1 }));
      const utanTak = skal(stopp120);
      fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Röstinspelning" }));
      await gaFram(0);
      expect(screen.getByText(/\/ 2:00$/)).toBeInTheDocument();
      await gaFram(121);
      expect(stopp120).toHaveBeenCalledTimes(1);
      utanTak.unmount();

      const stoppa = vi.fn(async () => ({ blob: new Blob(["a"]), mimeType: "audio/webm", sekunder: 1 }));
      skal(stoppa, IDE_MAX_SEKUNDER);
      fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Röstinspelning" }));
      await gaFram(0);
      expect(screen.getByText(/\/ 10:00$/)).toBeInTheDocument();
      await gaFram(121);
      expect(stoppa).not.toHaveBeenCalled();
      await gaFram(300);
      expect(stoppa).not.toHaveBeenCalled();
      await gaFram(180);
      expect(stoppa).toHaveBeenCalledTimes(1);
    });

    it("byter personen mål medan det spelar in räknas taket om från starten, åt båda håll", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
      const stoppa = vi.fn(async () => ({ blob: new Blob(["a"]), mimeType: "audio/webm", sekunder: 1 }));
      skal(stoppa, IDE_MAX_SEKUNDER);
      // TALK i plusmenyn börjar på appens första mål (120 s). Efter en minut väljs Biblioteket (600 s).
      fireEvent.click(screen.getByRole("button", { name: "Skapa" }));
      const rad = screen.getAllByRole("button", { name: "TALK, prata in" }).find((knapp) => !knapp.closest("header"));
      if (!rad) throw new Error("TALK-raden saknas i Skapa");
      fireEvent.click(rad);
      await gaFram(0);
      expect(screen.getByText(/\/ 2:00$/)).toBeInTheDocument();
      await gaFram(60);
      fireEvent.click(screen.getByRole("radio", { name: "Spara i Biblioteket" }));
      await gaFram(0);
      expect(screen.getByText(/\/ 10:00$/)).toBeInTheDocument();
      await gaFram(90);
      expect(stoppa).not.toHaveBeenCalled();
      // Tillbaka till ett mål med 120 s när 150 s gått: inspelningen avslutas direkt, målet tar inte längre ljud.
      fireEvent.click(screen.getByRole("radio", { name: "Händelse" }));
      await gaFram(0);
      expect(stoppa).toHaveBeenCalledTimes(1);
    });
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
