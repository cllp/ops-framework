import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { OpsGastLista } from "../components/OpsGastLista.jsx";
import { GASTGRUPPATGARDER, gastId } from "../lib/gast.js";

/**
 * Vyerna för en projektgäst som får ladda upp och ändra (0.254.0, cllp/lifehub.app#928 del 2): reglaget "Får ladda upp och ändra" i medlemmens lista på projektets sida, och i gästens vy Ladda upp fil,
 * Byt namn och Radera på en post och Nytt ärende. jsdom mäter text, knappar och anrop; hur det ser ut mäts inte här.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): mutationerna och utfallen står i PR-texten.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const klicka = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};
const valjFlik = async (namn) => {
  await act(async () => {
    fireEvent.mouseDown(screen.getByRole("tab", { name: namn }), { button: 0 });
  });
};

// ── Medlemmens lista ──────────────────────────────────────────────────────────────────────────────────────────────────

const PER = gastId("per@extern.se");
const projektrad = (redigera, extra = {}) => ({ id: "i-projekt", omfang: { slag: "projekt", tagg: "koket" }, titel: null, status: "inloggad", laddaNed: false, redigera, ...extra });
const person = (inbjudningar) => ({ gastId: PER, epost: "per@extern.se", namn: "Per", status: "inloggad", inbjudningar });
const ritaLista = (props = {}) => {
  const svar = render(<OpsGastLista personer={[person([projektrad(false)])]} platser={{ anvanda: 1, totalt: 5 }} projekt={{ tagg: "koket" }} {...props} />);
  for (const b of document.querySelectorAll('[data-gast-vaxla][aria-expanded="false"]')) fireEvent.click(b);
  return svar;
};

describe("OpsGastLista: Får ladda upp och ändra på en projektrad", () => {
  it("med onRedigera har projektraden ett reglage som följer redigera och anropar med { id, pa }", async () => {
    const onRedigera = vi.fn().mockResolvedValue(undefined);
    const { rerender } = ritaLista({ onRedigera });
    const r = screen.getByRole("switch", { name: "Får ladda upp och ändra" });
    expect(r).not.toBeChecked();
    expect(document.querySelector("[data-gastlista-redigera]")).toHaveAttribute("data-gastlista-redigera", "av");
    await klicka(r);
    await waitFor(() => expect(onRedigera).toHaveBeenCalledWith({ id: "i-projekt", pa: true }));
    rerender(<OpsGastLista personer={[person([projektrad(true)])]} platser={{ anvanda: 1, totalt: 5 }} projekt={{ tagg: "koket" }} onRedigera={onRedigera} />);
    const pa = screen.getByRole("switch", { name: "Får ladda upp och ändra" });
    expect(pa).toBeChecked();
    expect(document.querySelector("[data-gastlista-redigera]")).toHaveAttribute("data-gastlista-redigera", "pa");
    await klicka(pa);
    await waitFor(() => expect(onRedigera).toHaveBeenLastCalledWith({ id: "i-projekt", pa: false }));
  });

  it("reglaget väntar medan svaret dröjer och tar inget andra tryck; ett fel står vid gästen", async () => {
    /** @type {(v?: unknown) => void} */
    let slapp = () => {};
    const onRedigera = vi.fn(() => new Promise((res) => (slapp = res)));
    ritaLista({ onRedigera });
    const r = screen.getByRole("switch", { name: "Får ladda upp och ändra" });
    await klicka(r);
    expect(r).toHaveAttribute("aria-busy", "true");
    await klicka(r);
    expect(onRedigera).toHaveBeenCalledTimes(1);
    await act(async () => slapp());
    await waitFor(() => expect(r).not.toHaveAttribute("aria-busy"));
    cleanup();
    const nekar = vi.fn().mockRejectedValue(Object.assign(new Error("nej"), { kod: "ej-behorig" }));
    ritaLista({ onRedigera: nekar });
    await klicka(screen.getByRole("switch", { name: "Får ladda upp och ändra" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/inte/);
  });

  it("en återkallad går inte att ändra; en gruppinbjudan och en sak på samma person har inget reglage; utan onRedigera inget reglage", () => {
    ritaLista({ onRedigera: vi.fn(), personer: [person([projektrad(true, { status: "aterkallad" }), { id: "i-grupp", omfang: { slag: "grupp" }, status: "vantar", laddaNed: true }, { id: "i-sak", omfang: { slag: "sak", funktion: "rosta", handelseId: "h" }, titel: "Fest", status: "vantar" }])] });
    const reglage = screen.getAllByRole("switch", { name: "Får ladda upp och ändra" });
    expect(reglage).toHaveLength(1);
    expect(reglage[0]).toBeDisabled();
    expect(within(document.querySelector('[data-gast-inbjudan="i-grupp"]')).queryByRole("switch", { name: "Får ladda upp och ändra" })).toBeNull();
    expect(within(document.querySelector('[data-gast-inbjudan="i-sak"]')).queryByRole("switch")).toBeNull();
    cleanup();
    ritaLista();
    expect(screen.queryByRole("switch", { name: "Får ladda upp och ändra" })).toBeNull();
  });

  it("⛔ onRedigera utan projekt kastar, också på gruppens lista och på en omröstning, och onRedigera som inte är en funktion kastar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsGastLista personer={[person([projektrad(false)])]} platser={{ anvanda: 1, totalt: 5 }} onRedigera={() => {}} />)).toThrow(/onRedigera hör till listan på ett projekts sida/);
    expect(() => render(<OpsGastLista gaster={[]} platser={{ anvanda: 0, totalt: 5 }} onRedigera={() => {}} />)).toThrow(/onRedigera hör till listan på ett projekts sida/);
    expect(() => ritaLista({ onRedigera: true })).toThrow(/onRedigera måste vara en funktion/);
  });

  it("projektets ingress säger att uppladdning och ändring bara gäller när det slagits på", () => {
    ritaLista({ onBjudGrupp: vi.fn() });
    expect(document.body.textContent).toContain("ladda upp och ändra filer och skapa ärenden bara om det slås på");
  });
});

// ── Gästens vy ────────────────────────────────────────────────────────────────────────────────────────────────────────

const PROJEKT = {
  namn: "Ombyggnad av köket",
  funktioner: ["chatt", "kalender", "bibliotek", "arenden"],
  beskrivning: "",
  nedladdning: false,
  kommentera: false,
  projekt: { tagg: "koket", status: { sv: "Pågår", en: "In progress" }, texter: [] },
};
const RITNING = { id: "p-ritning", typ: "fil", rubrik: "Ritning", fil: { sokvag: "p-ritning", namn: "ritning.pdf", mime: "application/pdf", byte: 100, klar: true }, skapad: 2, andrad: 2, skapadAvNamn: "Anna" };
const NOT = { id: "p-not", typ: "anteckning", rubrik: "Mått", text: "240 cm", skapad: 1, andrad: 1, skapadAvNamn: "Anna" };
const LANK = { id: "p-lank", typ: "lank", rubrik: "Leverantören", url: "https://exempel.se", skapad: 0, andrad: 0, skapadAvNamn: "Anna" };

function apiMed(extra = {}) {
  let poster = [RITNING, NOT, LANK];
  let arenden = [];
  const svar = {
    oversikt: async () => ({ ok: true, chatt: { nya: 0, fler: false, senaste: [] }, kalender: { nasta: null }, bibliotek: { nya: 0, senaste: [], antal: 0, filer: 0, fler: false } }),
    kalender: async () => ({ ok: true, handelser: [], kalendrar: [], avkortad: false, ejVisade: 0 }),
    bibliotek: async () => ({ ok: true, poster, avkortad: false }),
    arenden: async () => ({ ok: true, avkortad: false, poster: arenden }),
    laddaUpp: async (a) => ({ ok: true, id: "u1", url: "https://lagring.example/put/u1", huvuden: { "Content-Type": a.typ } }),
    laddaUppKlar: async () => {
      poster = [{ id: "u1", typ: "fil", rubrik: "foto", fil: { sokvag: "u1", namn: "foto.jpg", mime: "image/jpeg", byte: 3, klar: true }, skapad: 3, andrad: 3, skapadAvNamn: "Per" }, ...poster];
      return { ok: true, postId: "u1" };
    },
    bytNamnPost: async ({ postId, rubrik }) => {
      poster = poster.map((p) => (p.id === postId ? { ...p, rubrik } : p));
      return { ok: true };
    },
    taBortPost: async ({ postId }) => {
      poster = poster.filter((p) => p.id !== postId);
      return { ok: true };
    },
    skapaArende: async ({ rubrik, text }) => {
      const a = { id: "a-ny", rubrik, text: text ?? "", status: "ny", kommentarer: [], hosDig: false };
      arenden = [a, ...arenden];
      return { ok: true, arende: a };
    },
    ...extra,
  };
  return Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async (args) => (svar[a] ? svar[a](args ?? {}) : { ok: false, orsak: "nej" }))]));
}

const ritaVy = (grupp = { ...PROJEKT, redigera: true }, api = apiMed()) => {
  const utf = render(<OpsGastGrupp grupp={grupp} api={api} intervallMs={0} idag={new Date(2026, 10, 10)} />);
  return { ...utf, api };
};

const menyrader = (namn) => within(screen.getByRole("menu", { name: namn })).getAllByRole("menuitem").map((r) => r.querySelector(".truncate")?.textContent ?? r.textContent);

describe("OpsGastGrupp: en projektgäst som får ladda upp och ändra", () => {
  it("Ladda upp fil: väljer en fil, reserverar, lägger den med PUT och de huvuden servern gav, gör klart och hämtar om biblioteket, med Laddar upp… under tiden", async () => {
    /** @type {(v: unknown) => void} */
    let slappPut = () => {};
    const put = vi.fn(() => new Promise((res) => (slappPut = res)));
    vi.stubGlobal("fetch", put);
    const { api } = ritaVy();
    await valjFlik("Bibliotek");
    await waitFor(() => expect(screen.getByRole("button", { name: "Ritning" })).toBeInTheDocument());
    const knapp = screen.getByRole("button", { name: "Ladda upp fil" });
    const valjare = document.querySelector("[data-gast-ladda-upp-fil]");
    const fil = new File(["abc"], "foto.jpg", { type: "image/jpeg" });
    await act(async () => {
      fireEvent.change(valjare, { target: { files: [fil] } });
    });
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(api.laddaUpp).toHaveBeenCalledWith({ filnamn: "foto.jpg", typ: "image/jpeg", storlek: 3, rubrik: "foto" });
    expect(put).toHaveBeenCalledWith("https://lagring.example/put/u1", { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: fil });
    expect(knapp).toHaveAttribute("aria-busy", "true");
    expect(knapp).toHaveTextContent("Laddar upp…");
    expect(api.laddaUppKlar).not.toHaveBeenCalled();
    await act(async () => slappPut({ ok: true }));
    await waitFor(() => expect(api.laddaUppKlar).toHaveBeenCalledWith({ id: "u1" }));
    expect(await screen.findByRole("button", { name: "foto" })).toBeInTheDocument();
    await waitFor(() => expect(knapp).not.toHaveAttribute("aria-busy"));
    expect(document.querySelector("[data-gast-ladda-upp-fel]")).toBeNull();
  });

  it("en fil som biblioteket inte tar emot får sitt skäl vid knappen utan anrop; en PUT som faller säger det och gör inte klart", async () => {
    const put = vi.fn(async () => ({ ok: false, status: 403 }));
    vi.stubGlobal("fetch", put);
    const { api } = ritaVy();
    await valjFlik("Bibliotek");
    const valjare = document.querySelector("[data-gast-ladda-upp-fil]");
    await act(async () => {
      fireEvent.change(valjare, { target: { files: [new File(["x"], "virus.exe", { type: "application/x-msdownload" })] } });
    });
    expect(document.querySelector("[data-gast-ladda-upp-fel]")).toHaveTextContent(/Formatet/);
    expect(api.laddaUpp).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.change(valjare, { target: { files: [new File(["abc"], "foto.jpg", { type: "image/jpeg" })] } });
    });
    await waitFor(() => expect(document.querySelector("[data-gast-ladda-upp-fel]")).toHaveTextContent("Filen kunde inte laddas upp. Försök igen."));
    expect(api.laddaUppKlar).not.toHaveBeenCalled();
  });

  it("Byt namn och Radera på en fil och en anteckning, och inget annat i menyn; en länk har inget av dem", async () => {
    const user = userEvent.setup();
    const { api } = ritaVy();
    await valjFlik("Bibliotek");
    await user.click(await screen.findByRole("button", { name: "Åtgärder för Ritning" }));
    const rader = menyrader("Ritning");
    expect(rader).toContain("Byt namn");
    expect(rader).toContain("Radera");
    for (const inte of ["Redigera", "Dela länk", "Arkivera", "Nåla fast", "Lägg till tagg", "Flytta eller kopiera"]) expect(rader, inte).not.toContain(inte);
    await user.click(screen.getByRole("menuitem", { name: "Byt namn" }));
    const falt = screen.getByRole("textbox", { name: "Nytt namn" });
    await user.clear(falt);
    await user.type(falt, "Ritning v2");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(api.bytNamnPost).toHaveBeenCalledWith({ postId: "p-ritning", rubrik: "Ritning v2" }));
    expect(await screen.findByRole("button", { name: "Ritning v2" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Åtgärder för Mått" }));
    await user.click(screen.getByRole("menuitem", { name: "Radera" }));
    expect(api.taBortPost).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Radera posten" }));
    await waitFor(() => expect(api.taBortPost).toHaveBeenCalledWith({ postId: "p-not" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mått" })).toBeNull());
    await user.click(screen.getByRole("button", { name: "Åtgärder för Leverantören" }));
    const lank = menyrader("Leverantören");
    expect(lank).not.toContain("Byt namn");
    expect(lank).not.toContain("Radera");
  });

  it("ett nej på ett namnbyte står i dialogen och hämtar om listan", async () => {
    const user = userEvent.setup();
    const api = apiMed({ bytNamnPost: async () => ({ ok: false, orsak: "saknas" }) });
    ritaVy(undefined, api);
    await valjFlik("Bibliotek");
    await user.click(await screen.findByRole("button", { name: "Åtgärder för Ritning" }));
    await user.click(screen.getByRole("menuitem", { name: "Byt namn" }));
    await user.type(screen.getByRole("textbox", { name: "Nytt namn" }), "x");
    const hamtningar = api.bibliotek.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(await screen.findByText("Det går inte att ändra här längre, eller så finns det inte längre.")).toBeInTheDocument();
    expect(api.bibliotek.mock.calls.length).toBeGreaterThan(hamtningar);
  });

  it("Nytt ärende: fliken finns också utan ärenden, formuläret ligger bakom knappen, en tom rubrik nekas utan anrop, och ett skapat ärende syns i listan", async () => {
    const user = userEvent.setup();
    const { api } = ritaVy();
    await waitFor(() => expect(api.arenden).toHaveBeenCalled());
    await valjFlik("Ärenden");
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Nytt ärende" }));
    const dialog = screen.getByRole("dialog", { name: "Nytt ärende" });
    await user.click(within(dialog).getByRole("button", { name: "Skapa" }));
    expect(within(dialog).getByText("Skriv en rubrik.")).toBeInTheDocument();
    expect(api.skapaArende).not.toHaveBeenCalled();
    await user.type(within(dialog).getByRole("textbox", { name: "Rubrik" }), "Luckorna är fel");
    await user.type(within(dialog).getByRole("textbox", { name: "Beskrivning" }), "Två är för smala");
    await user.click(within(dialog).getByRole("button", { name: "Skapa" }));
    await waitFor(() => expect(api.skapaArende).toHaveBeenCalledWith({ rubrik: "Luckorna är fel", text: "Två är för smala" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Luckorna är fel")).toBeInTheDocument();
  });

  it("⛔ utan redigera, och för en gäst i hela gruppen med redigera, finns ingen Ladda upp fil, inget Byt namn eller Radera och inget Nytt ärende", async () => {
    const user = userEvent.setup();
    for (const grupp of [{ ...PROJEKT, redigera: false }, { ...PROJEKT, projekt: undefined, redigera: true }]) {
      const { api } = ritaVy(grupp, apiMed({ arenden: async () => ({ ok: true, avkortad: false, poster: [{ id: "a1", rubrik: "Ett", text: "", status: "ny", kommentarer: [] }] }) }));
      await waitFor(() => expect(api.arenden).toHaveBeenCalled());
      await valjFlik("Bibliotek");
      await waitFor(() => expect(screen.getByRole("button", { name: "Ritning" })).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Ladda upp fil" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Åtgärder för Mått" })).toBeNull();
      const atgarder = screen.queryByRole("button", { name: "Åtgärder för Ritning" });
      if (atgarder) {
        await user.click(atgarder);
        expect(menyrader("Ritning")).not.toContain("Byt namn");
        expect(menyrader("Ritning")).not.toContain("Radera");
        await user.keyboard("{Escape}");
      }
      await valjFlik("Ärenden");
      expect(screen.queryByRole("button", { name: "Nytt ärende" })).toBeNull();
      cleanup();
    }
  });
});
