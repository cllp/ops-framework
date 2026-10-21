import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { LJUDFIL_ACCEPT, ljudfilFel } from "../lib/bibliotek.js";
import { validateModuler } from "../lib/modul.js";

/**
 * Ljud: ladda upp och spela in (0.133.0, CP 2026-10-20). Två saker i samma leverans:
 *
 *  1. "+ Ny" under fliken Ljud är en uppladdning först (CP: "Jag kan inte ladda upp en inspelning").
 *  2. En inspelning som startats ur Biblioteket sparas i modulens mål och visar aldrig TALK:s val "Vad ska hända med det du sa?".
 */

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
    tillagg: [{ plats: "inspelning.mal", id: "spara", etikett: { sv: "Spara i Biblioteket", en: "Save in the library" }, spara }],
  };
}

const inspelare = {
  starta: vi.fn(async () => {}),
  stoppa: vi.fn(async () => ({ blob: new Blob(["a"]), mimeType: "audio/webm", sekunder: 1 })),
  kasta: vi.fn(),
  niva: () => 0,
};

const nav = [{ href: "/", label: "Start" }];
const jag = { uid: "u", roll: "medlem" };

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * @param {string[]} moduler Gruppens påslagna moduler.
 * @param {{ spara?: any, onTalk?: any, onLaddaUpp?: any }} [o]
 */
function skalet(moduler, { spara = vi.fn(), onTalk = vi.fn(), onLaddaUpp = vi.fn() } = {}) {
  /** @param {string[]} pa */
  const traed = (pa) => (
    <OpsAppShell
      brand="Ops"
      nav={nav}
      activeHref="/"
      talk={{ onTalk, inspelare, mal: [{ id: "agent", etikett: "Agent" }, { id: "handelse", etikett: "Händelse" }] }}
      skapa={{ lage: "g", moduler: validateModuler([bibliotekModul(spara)]), aktivGrupp: { id: "g", moduler: pa } }}
    >
      <OpsBibliotek poster={[]} jag={jag} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} onLaddaUpp={onLaddaUpp} hubHref="/hub" />
    </OpsAppShell>
  );
  const ut = render(traed(moduler));
  return { ...ut, traed, spara, onTalk, onLaddaUpp };
}

const iLjud = () => fireEvent.mouseDown(screen.getByRole("tab", { name: /^Ljud/ }), { button: 0 });

/** Det dolda filfältet under Ljud. Det saknar roll, så det hämtas på sin typ. */
const filfaltet = () => /** @type {HTMLInputElement} */ (document.querySelector('input[type="file"][aria-label="Ladda upp ljudfil"]'));

describe("⛔ Ny under Ljud: ladda upp först, spela in sedan", () => {
  it("menyn har två val i rätt ordning: Ladda upp ljudfil, sedan Spela in", () => {
    skalet(["bibliotek"]);
    iLjud();
    fireEvent.click(screen.getByRole("button", { name: "Nytt ljud" }));
    const meny = screen.getByRole("menu", { name: "Nytt ljud" });
    expect(Array.from(meny.querySelectorAll('[role="menuitem"]')).map((r) => r.textContent)).toEqual(["Ladda upp ljudfil", "Spela in"]);
  });

  it("Ladda upp ljudfil öppnar filväljaren, som godtar ljud och inget annat", () => {
    skalet(["bibliotek"]);
    iLjud();
    const klick = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Nytt ljud" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Ladda upp ljudfil" }));
    expect(klick).toHaveBeenCalledTimes(1);
    expect(klick.mock.instances[0]).toBe(filfaltet());
    expect(filfaltet().getAttribute("accept")).toBe(LJUDFIL_ACCEPT);
    expect(LJUDFIL_ACCEPT).toMatch(/^audio\/\*/);
    for (const andelse of [".m4a", ".mp3", ".wav", ".aac", ".ogg", ".flac"]) expect(LJUDFIL_ACCEPT).toContain(andelse);
  });

  it("en vald ljudfil anropar onLaddaUpp med rubrik ur filnamnet, och menyn behöver inte vara öppen", () => {
    const { onLaddaUpp } = skalet(["bibliotek"]);
    iLjud();
    const fil = new File(["x"], "Replokal torsdag.m4a", { type: "audio/x-m4a" });
    fireEvent.change(filfaltet(), { target: { files: [fil] } });
    expect(onLaddaUpp).toHaveBeenCalledTimes(1);
    expect(onLaddaUpp.mock.calls[0][0]).toEqual({ rubrik: "Replokal torsdag", fil });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("webbläsaren utan MIME (m4a från iOS) godtas på ändelsen", () => {
    const { onLaddaUpp } = skalet(["bibliotek"]);
    iLjud();
    fireEvent.change(filfaltet(), { target: { files: [new File(["x"], "Minne.m4a", { type: "" })] } });
    expect(onLaddaUpp).toHaveBeenCalledTimes(1);
  });

  it("en bild eller PDF som valts ändå laddas inte upp, och felet sägs", () => {
    const { onLaddaUpp } = skalet(["bibliotek"]);
    iLjud();
    fireEvent.change(filfaltet(), { target: { files: [new File(["x"], "Foto.png", { type: "image/png" })] } });
    expect(onLaddaUpp).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/inte en ljudfil/);
  });

  it("ett fel från uppladdningen visas i stället för att sväljas", async () => {
    const onLaddaUpp = vi.fn(async () => {
      throw new Error("Nätet hakade upp sig.");
    });
    skalet(["bibliotek"], { onLaddaUpp });
    iLjud();
    fireEvent.change(filfaltet(), { target: { files: [new File(["x"], "A.mp3", { type: "audio/mpeg" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Nätet hakade upp sig.");
  });

  it("utan mottagare för inspelningar finns bara uppladdningen, som en knapp utan meny", () => {
    const { onLaddaUpp } = skalet([]);
    iLjud();
    expect(screen.queryByRole("button", { name: "Nytt ljud" })).toBeNull();
    const knapp = screen.getByRole("button", { name: "Ladda upp ljudfil" });
    const klick = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(knapp);
    expect(klick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.change(filfaltet(), { target: { files: [new File(["x"], "A.wav", { type: "audio/wav" })] } });
    expect(onLaddaUpp).toHaveBeenCalledTimes(1);
  });

  it("under Alla heter inspelningsraden Spela in ljud", () => {
    skalet(["bibliotek"]);
    fireEvent.click(screen.getByRole("button", { name: "Ny post" }));
    expect(screen.getByRole("menuitem", { name: "Spela in ljud" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Röstinspelning" })).toBeNull();
  });

  it("Spela in under Ljud öppnar modulens inspelare, låst, utan val", () => {
    skalet(["bibliotek"]);
    iLjud();
    fireEvent.click(screen.getByRole("button", { name: "Nytt ljud" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Spela in" }));
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("0:00 / 2:00")).toBeInTheDocument();
  });
});

describe("ljudfilFel", () => {
  it("godtar ljud, avvisar annat och för stora filer", () => {
    expect(ljudfilFel({ name: "a.mp3", type: "audio/mpeg", size: 10 })).toBeNull();
    expect(ljudfilFel({ name: "a.aac", type: "audio/aac", size: 10 })).toBeNull();
    expect(ljudfilFel({ name: "a.flac", type: "", size: 10 })).toBeNull();
    expect(ljudfilFel({ name: "a.png", type: "image/png", size: 10 })).toMatch(/inte en ljudfil/);
    expect(ljudfilFel({ name: "a.pdf", type: "", size: 10 })).toMatch(/inte en ljudfil/);
    expect(ljudfilFel({ name: "a.mp3", type: "audio/mpeg", size: 0 })).not.toBeNull();
  });
});

describe("⛔ en inspelning från Biblioteket hamnar i modulens mål, aldrig i TALK:s val", () => {
  it("modulen försvinner ur gruppens lista under inspelningen: Klar anropar ändå målets spara och ritar inga val", async () => {
    const { traed, rerender, spara, onTalk } = skalet(["bibliotek"]);
    iLjud();
    fireEvent.click(screen.getByRole("button", { name: "Nytt ljud" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Spela in" }));
    expect(screen.queryByRole("radio")).toBeNull();
    // Härledningen som bröt: låset räknades om ur gruppens påslagna moduler vid varje rendering. Försvann modulen (appen läser om gruppen)
    // föll fältet tillbaka till appens första mål, och vid Klar ritades "Vad ska hända med det du sa?" med valen Agent och Händelse.
    rerender(traed([]));
    fireEvent.click(screen.getByRole("button", { name: /^Klar/ }));
    await waitFor(() => expect(spara).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Vad ska hända med det du sa/)).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(onTalk).not.toHaveBeenCalled();
    expect(spara.mock.calls[0][0]).toMatchObject({ mimeType: "audio/webm", sekunder: 1 });
    expect(spara.mock.calls[0][0].blob).toBeInstanceOf(Blob);
  });

  it("efteråt är mikrofonen i huvudet TALK igen, med appens mål och inte Biblioteket", async () => {
    const { traed, rerender, spara, onTalk } = skalet(["bibliotek"]);
    iLjud();
    fireEvent.click(screen.getByRole("button", { name: "Nytt ljud" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Spela in" }));
    rerender(traed([]));
    fireEvent.click(screen.getByRole("button", { name: /^Klar/ }));
    await waitFor(() => expect(spara).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "TALK" })).toBeNull(), { timeout: 3000 });

    const mikrofon = screen.getAllByRole("button", { name: "TALK, prata in" }).find((k) => k.closest("header"));
    if (!mikrofon) throw new Error("TALK-knappen i huvudet saknas");
    await act(async () => {
      fireEvent.click(mikrofon);
    });
    expect(screen.getByRole("radio", { name: "Agent" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("radio", { name: "Spara i Biblioteket" })).toBeNull();
    expect(onTalk).not.toHaveBeenCalled();
  });
});
