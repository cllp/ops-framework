import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastLista } from "../components/OpsGastLista.jsx";
import { OpsGastSida } from "../components/OpsGastSida.jsx";
import { GAST_PLATSER_GRATIS, GASTFEL, GASTNYLANK_SVAR } from "../lib/gast.js";

/**
 * Gästernas två vyer (0.131.0, cllp/lifehub.app#389): medlemmens lista och gästens egen sida. jsdom mäter att rätt text och rätt knappar finns och att anropen går rätt;
 * hur det SER UT mäts inte här utan i skärmbilderna (`scripts/gast-montage.mjs`, 390 och 1280 px).
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const NU = 1_800_000_000_000;
const ID = "a".repeat(64);
const NYCKEL = "N".repeat(43);
const SESSION = "S".repeat(43);

/** Klick i act, så att knappens väntan (ett löfte som blir klart) hinner ritas innan provet slutar. */
const klicka = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

const gast = (extra = {}) => ({ id: "g1", epost: "anna@foretag.se", namn: "", aterkallad: null, forstInloggad: null, lankGiltigTill: NU + 1000, ...extra });

describe("OpsGastLista", () => {
  const rita = (props = {}) =>
    render(<OpsGastLista gaster={[gast(), gast({ id: "g2", epost: "bo@foretag.se", namn: "Bo B", forstInloggad: NU - 5 })]} platser={{ anvanda: 2, totalt: 5 }} nu={NU} onBjud={() => {}} onSkickaOm={() => {}} onAterkalla={() => {}} {...props} />);

  it("visar varje gäst med namn eller adress, status och serverns platssiffra", () => {
    rita();
    expect(screen.getByText("2 av 5 gratis platser")).toBeInTheDocument();
    const rader = document.querySelectorAll("[data-gast]");
    expect(rader).toHaveLength(2);
    expect(within(rader[0]).getByText("anna@foretag.se")).toBeInTheDocument();
    expect(within(rader[0]).getByText("Inbjuden")).toBeInTheDocument();
    // Har gästen ett namn står det först och adressen under.
    expect(within(rader[1]).getByText("Bo B")).toBeInTheDocument();
    expect(within(rader[1]).getByText("bo@foretag.se")).toBeInTheDocument();
    expect(within(rader[1]).getByText("Har loggat in")).toBeInTheDocument();
  });

  it("härleder status ur raden, och tjänstens egen status vinner", () => {
    rita({
      gaster: [gast({ id: "a", aterkallad: NU - 1 }), gast({ id: "u", epost: "u@x.se", lankGiltigTill: NU - 1 }), gast({ id: "r", epost: "r@x.se", forstInloggad: NU - 9 }), gast({ id: "s", epost: "s@x.se", status: "har-rostat" })],
      harRostat: [],
    });
    const status = (id) => document.querySelector(`[data-gast="${id}"]`).getAttribute("data-gast-status");
    expect([status("a"), status("u"), status("r"), status("s")]).toEqual(["aterkallad", "utgangen", "inloggad", "har-rostat"]);
    expect(screen.getByText("Återkallad")).toBeInTheDocument();
    expect(screen.getByText("Länken har gått ut")).toBeInTheDocument();
  });

  it("harRostat (gastId) ger Har röstat", async () => {
    const { gastId } = await import("../lib/gast.js");
    rita({ gaster: [gast({ forstInloggad: NU - 5 })], harRostat: [gastId("anna@foretag.se")] });
    expect(screen.getByText("Har röstat")).toBeInTheDocument();
  });

  it("⛔ tomt är ett svar: en lista utan gäster säger det", () => {
    rita({ gaster: [] });
    expect(screen.getByText(/Inga gäster har bjudits in/)).toBeInTheDocument();
    expect(document.querySelectorAll("[data-gast]")).toHaveLength(0);
  });

  it("bjuder in med adress och namn, och tömmer fälten när det gått", async () => {
    const onBjud = vi.fn(async () => {});
    rita({ onBjud });
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "  cia@foretag.se " } });
    fireEvent.change(screen.getByLabelText("Namn (valfritt)"), { target: { value: " Cia " } });
    fireEvent.click(screen.getByRole("button", { name: "Bjud in utan konto" }));
    await waitFor(() => expect(onBjud).toHaveBeenCalledWith({ epost: "cia@foretag.se", namn: "Cia" }));
    await waitFor(() => expect(screen.getByLabelText("E-postadress")).toHaveValue(""));
  });

  it("en adress som inte är en adress stoppas innan anropet, och knappen är spärrad utan adress", async () => {
    const onBjud = vi.fn();
    rita({ onBjud });
    expect(screen.getByRole("button", { name: "Bjud in utan konto" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "inte en adress" } });
    await klicka(screen.getByRole("button", { name: "Bjud in utan konto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Det där ser inte ut som en e-postadress.");
    expect(onBjud).not.toHaveBeenCalled();
  });

  it("⛔ ett fel med kod får sin egen text och formuläret står kvar med det som skrevs", async () => {
    const onBjud = vi.fn(async () => {
      throw Object.assign(new Error("loggtext"), { kod: "platser-slut" });
    });
    rita({ onBjud });
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "cia@foretag.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Bjud in utan konto" }));
    const larm = await screen.findByRole("alert");
    expect(larm).toHaveTextContent("Gruppen har 5 gäster och det är taket");
    expect(larm).not.toHaveTextContent("loggtext");
    expect(screen.getByLabelText("E-postadress")).toHaveValue("cia@foretag.se");
  });

  it("ett fel utan kod visar felets eget meddelande, och brev-misslyckades säger att Skicka igen löser det", async () => {
    const onBjud = vi.fn().mockRejectedValueOnce(new Error("Nätverket föll")).mockRejectedValueOnce(Object.assign(new Error("x"), { kod: "brev-misslyckades" }));
    rita({ onBjud });
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "cia@foretag.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Bjud in utan konto" }));
    expect(await screen.findByText("Nätverket föll")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bjud in utan konto" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Tryck Skicka igen"));
  });

  it("vid taket är formuläret spärrat och texten säger varför och vad man gör i stället", () => {
    rita({ platser: { anvanda: GAST_PLATSER_GRATIS, totalt: GAST_PLATSER_GRATIS } });
    expect(screen.getByText(/Bjud in personen som medlem i stället/)).toBeInTheDocument();
    expect(screen.getByLabelText("E-postadress")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bjud in utan konto" })).toBeDisabled();
    // Golv: under taket är samma fält öppna, annars mäter provet ett formulär som alltid är stängt.
  });

  it("under taket är fälten öppna", () => {
    rita({ platser: { anvanda: 4, totalt: 5 } });
    expect(screen.getByLabelText("E-postadress")).not.toBeDisabled();
    expect(document.querySelector("[data-gastlista-fulla]")).toBeNull();
  });

  it("Skicka igen och Dra tillbaka anropar med inbjudans id, och knappen väntar tills löftet är klart", async () => {
    let klar;
    const onSkickaOm = vi.fn(() => new Promise((r) => { klar = r; }));
    const onAterkalla = vi.fn(async () => {});
    rita({ onSkickaOm, onAterkalla });
    const knapp = screen.getByRole("button", { name: "Skicka länken igen till anna@foretag.se" });
    await klicka(knapp);
    await klicka(knapp);
    expect(onSkickaOm).toHaveBeenCalledTimes(1);
    expect(onSkickaOm).toHaveBeenCalledWith({ id: "g1" });
    await waitFor(() => expect(knapp).toHaveAttribute("aria-busy", "true"));
    await act(async () => klar());
    await waitFor(() => expect(knapp).not.toHaveAttribute("aria-busy", "true"));
    await klicka(screen.getByRole("button", { name: "Dra tillbaka inbjudan till Bo B" }));
    expect(onAterkalla).toHaveBeenCalledWith({ id: "g2" });
  });

  it("⛔ ett fel på en rad syns på raden och lämnar knappen ledig", async () => {
    const onAterkalla = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { kod: "ej-behorig" }));
    rita({ onAterkalla });
    fireEvent.click(screen.getByRole("button", { name: "Dra tillbaka inbjudan till anna@foretag.se" }));
    const rad = document.querySelector('[data-gast="g1"]');
    expect(await within(rad).findByRole("alert")).toHaveTextContent("Du får inte bjuda in gäster");
    expect(screen.getByRole("button", { name: "Dra tillbaka inbjudan till anna@foretag.se" })).not.toBeDisabled();
  });

  it("en återkallad gäst får Bjud in igen i stället för Skicka igen och Dra tillbaka", async () => {
    const onBjud = vi.fn();
    rita({ gaster: [gast({ aterkallad: NU - 1, namn: "Anna" })], onBjud });
    expect(screen.queryByRole("button", { name: /Skicka länken igen/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dra tillbaka/ })).toBeNull();
    await klicka(screen.getByRole("button", { name: "Bjud in Anna igen" }));
    expect(onBjud).toHaveBeenCalledWith({ epost: "anna@foretag.se", namn: "Anna" });
  });

  it("utan anropen ritas varken formulär eller knappar (en läsvy)", () => {
    rita({ onBjud: undefined, onSkickaOm: undefined, onAterkalla: undefined });
    expect(document.querySelector("[data-gastlista-form]")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelectorAll("[data-gast]")).toHaveLength(2);
  });

  it("engelska och egna texter", () => {
    rita({ sprak: "en", ord: { rubrik: "Outsiders" } });
    expect(screen.getByText("2 of 5 free places")).toBeInTheDocument();
    expect(screen.getByText("Outsiders")).toBeInTheDocument();
    expect(screen.getAllByText("Withdraw").length).toBe(2);
  });

  it("kastar för indata som gör listan till en gissning", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsGastLista gaster={undefined} platser={{ anvanda: 0, totalt: 5 }} />)).toThrow(/gaster måste vara en lista/);
    expect(() => render(<OpsGastLista gaster={[]} />)).toThrow(/platser krävs/);
    expect(() => render(<OpsGastLista gaster={[{ id: 1 }]} platser={{ anvanda: 0, totalt: 5 }} />)).toThrow(/id, epost/);
    expect(() => render(<OpsGastLista gaster={[]} platser={{ anvanda: 0, totalt: 5 }} onBjud="x" />)).toThrow(/onBjud/);
    tyst.mockRestore();
  });
});

describe("OpsGastSida", () => {
  const lagringMed = (start = {}) => {
    const d = { ...start };
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; }, d };
  };
  const SAK = { titel: "Rep" };
  const klar = { ok: true, namn: "", funktion: "rosta", sak: SAK };
  const rita = (props = {}) => {
    const lagring = props.lagring ?? lagringMed();
    const onLos = props.onLos ?? vi.fn(async () => ({ ok: true, sessionsnyckel: SESSION }));
    const onHamta = props.onHamta ?? vi.fn(async () => klar);
    const onNyLank = props.onNyLank ?? vi.fn(async () => ({ ok: true }));
    const utf = render(
      <OpsGastSida lank={{ id: ID, nyckel: NYCKEL }} onLos={onLos} onHamta={onHamta} onNyLank={onNyLank} renderSak={({ sak }) => <div data-sak="">{sak.titel}</div>} intervallMs={0} {...props} lagring={lagring} />,
    );
    return { ...utf, lagring, onLos, onHamta, onNyLank };
  };
  const skrivAdress = (v) => fireEvent.change(screen.getByLabelText("Skriv adressen inbjudan skickades till"), { target: { value: v } });

  it("första öppningen med en länk frågar efter adressen, postar id, nyckel och adress, sparar sessionen och visar saken", async () => {
    const { onLos, onHamta, lagring } = rita();
    expect(await screen.findByRole("heading", { name: "Du är inbjuden" })).toBeInTheDocument();
    expect(onLos).not.toHaveBeenCalled();
    skrivAdress("  Anna@Foretag.se ");
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
    await waitFor(() => expect(onLos).toHaveBeenCalledWith({ id: ID, nyckel: NYCKEL, epost: "Anna@Foretag.se" }));
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(onHamta).toHaveBeenCalledWith({ sessionsnyckel: SESSION });
    expect(lagring.d[`ops-gast:${ID}`]).toBe(SESSION);
    expect(lagring.d["ops-gast:senaste"]).toBe(ID);
    // Nyckeln i länken ligger inte kvar på sidan, och adressformuläret är borta.
    expect(document.body.innerHTML).not.toContain(NYCKEL);
    expect(document.querySelector("[data-gast-form]")).toBeNull();
  });

  it("⛔ fragmentet tas bort ur adressraden när inloggningen lyckats, så att nyckeln inte ligger kvar i historiken", async () => {
    window.history.replaceState(null, "", `/gast#i=${ID}&k=${NYCKEL}`);
    rita();
    await screen.findByRole("heading", { name: "Du är inbjuden" });
    skrivAdress("anna@foretag.se");
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
    await screen.findByText("Rep");
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/gast");
  });

  it("en sparad session hoppar över adressfrågan: stannar inloggad på enheten", async () => {
    const lagring = lagringMed({ [`ops-gast:${ID}`]: SESSION });
    const { onLos, onHamta } = rita({ lagring });
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(onHamta).toHaveBeenCalledWith({ sessionsnyckel: SESSION });
    expect(onLos).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Skriv adressen inbjudan skickades till")).toBeNull();
  });

  it("utan länk öppnas den senast öppnade inbjudans session", async () => {
    const lagring = lagringMed({ "ops-gast:senaste": ID, [`ops-gast:${ID}`]: SESSION });
    const { onHamta } = rita({ lagring, lank: null });
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(onHamta).toHaveBeenCalledWith({ sessionsnyckel: SESSION });
  });

  it("en session som servern inte känner igen glöms, och sidan frågar efter adressen igen", async () => {
    const lagring = lagringMed({ [`ops-gast:${ID}`]: SESSION });
    rita({ lagring, onHamta: vi.fn(async () => ({ ok: false, orsak: "nej" })) });
    expect(await screen.findByLabelText("Skriv adressen inbjudan skickades till")).toBeInTheDocument();
    expect(lagring.d[`ops-gast:${ID}`]).toBeUndefined();
  });

  it("en session vars inbjudan är återkallad glöms INTE: gästen får veta det i stället för att tillfrågas om en adress", async () => {
    const lagring = lagringMed({ [`ops-gast:${ID}`]: SESSION });
    rita({ lagring, onHamta: vi.fn(async () => ({ ok: false, orsak: "aterkallad" })) });
    expect(await screen.findByText(GASTFEL.aterkallad)).toBeInTheDocument();
    expect(screen.queryByLabelText("Skriv adressen inbjudan skickades till")).toBeNull();
    expect(lagring.d[`ops-gast:${ID}`]).toBe(SESSION);
  });

  it("⛔ ett nej är ett nej: fel adress, fel nyckel och okänd inbjudan visar samma text, och formuläret står kvar", async () => {
    const { onLos } = rita({ onLos: vi.fn(async () => ({ ok: false, orsak: "nej" })) });
    await screen.findByRole("heading", { name: "Du är inbjuden" });
    skrivAdress("fel@foretag.se");
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
    expect(await screen.findByText(GASTFEL.nej)).toBeInTheDocument();
    expect(onLos).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Skriv adressen inbjudan skickades till")).toBeInTheDocument();
    expect(screen.queryByText("Rep")).toBeNull();
  });

  it("en adress som inte är en adress anropar inte servern: den räknar felaktiga försök", async () => {
    const { onLos } = rita();
    await screen.findByRole("heading", { name: "Du är inbjuden" });
    skrivAdress("inte en adress");
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
    expect(await screen.findByText("Det där ser inte ut som en e-postadress.")).toBeInTheDocument();
    expect(onLos).not.toHaveBeenCalled();
  });

  it("for-manga och en länk som gått ut har egna texter, och den utgångna erbjuder en ny länk med den adress som stämde", async () => {
    const onNyLank = vi.fn(async () => ({ ok: true }));
    const { rerender, onLos } = rita({ onLos: vi.fn(async () => ({ ok: false, orsak: "for-manga" })), onNyLank });
    await screen.findByRole("heading", { name: "Du är inbjuden" });
    skrivAdress("anna@foretag.se");
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
    expect(await screen.findByText(GASTFEL["for-manga"])).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skicka en ny länk" })).toBeNull();
    onLos.mockResolvedValue({ ok: false, orsak: "utgangen" });
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
    expect(await screen.findByText(GASTFEL.utgangen)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skicka en ny länk" }));
    await waitFor(() => expect(onNyLank).toHaveBeenCalledWith({ epost: "anna@foretag.se" }));
    expect(await screen.findByText(GASTNYLANK_SVAR)).toBeInTheDocument();
    void rerender;
  });

  it("⛔ utan länk och utan session ber sidan om en ny länk, och svaret är detsamma även när anropet faller", async () => {
    const onNyLank = vi.fn().mockRejectedValue(new Error("nätet"));
    rita({ lank: null, onNyLank });
    expect(await screen.findByRole("heading", { name: "Be om en ny länk" })).toBeInTheDocument();
    skrivAdress("okand@foretag.se");
    fireEvent.click(screen.getByRole("button", { name: "Skicka en ny länk" }));
    expect(await screen.findByText(GASTNYLANK_SVAR)).toBeInTheDocument();
    expect(onNyLank).toHaveBeenCalledWith({ epost: "okand@foretag.se" });
  });

  it("⛔ återkallelse syns inom en minut: sidan hämtar om, och sakens kort byts mot texten", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const svar = [klar, klar, { ok: false, orsak: "aterkallad" }];
    const onHamta = vi.fn(async () => svar.shift() ?? { ok: false, orsak: "aterkallad" });
    rita({ lagring: lagringMed({ [`ops-gast:${ID}`]: SESSION }), onHamta, intervallMs: 60_000 });
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(onHamta).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(onHamta).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Rep")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(await screen.findByText(GASTFEL.aterkallad)).toBeInTheDocument();
    expect(screen.queryByText("Rep")).toBeNull();
  });

  it("fokus hämtar om, och ett nätfel i en tyst hämtning lämnar sidan som den är", async () => {
    const onHamta = vi.fn().mockResolvedValueOnce(klar).mockRejectedValueOnce(new Error("nätet")).mockResolvedValue(klar);
    rita({ lagring: lagringMed({ [`ops-gast:${ID}`]: SESSION }), onHamta });
    await screen.findByText("Rep");
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(onHamta).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Rep")).toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(onHamta).toHaveBeenCalledTimes(3);
  });

  it("tidtagningen städas när sidan lämnas: inga hämtningar efter avmontering", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onHamta = vi.fn(async () => klar);
    const { unmount } = rita({ lagring: lagringMed({ [`ops-gast:${ID}`]: SESSION }), onHamta, intervallMs: 60_000 });
    await screen.findByText("Rep");
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
    window.dispatchEvent(new Event("focus"));
    expect(onHamta).toHaveBeenCalledTimes(1);
  });

  it("namnet är valfritt och frågas bara när det saknas; sparas med sessionen", async () => {
    const onNamn = vi.fn(async () => {});
    rita({ lagring: lagringMed({ [`ops-gast:${ID}`]: SESSION }), onNamn });
    await screen.findByText("Rep");
    fireEvent.change(screen.getByLabelText("Vad ska gruppen kalla dig? (valfritt)"), { target: { value: " Anna A " } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onNamn).toHaveBeenCalledWith({ sessionsnyckel: SESSION, namn: "Anna A" }));
    expect(await screen.findByText("Sparat")).toBeInTheDocument();
  });

  it("har gästen redan ett namn, eller saknas onNamn, ritas ingen namnruta", async () => {
    rita({ lagring: lagringMed({ [`ops-gast:${ID}`]: SESSION }), onNamn: vi.fn(), onHamta: vi.fn(async () => ({ ...klar, namn: "Anna" })) });
    await screen.findByText("Rep");
    expect(document.querySelector("[data-gast-namn]")).toBeNull();
  });

  it("ett minne som kastar (privat läge) stoppar inte sidan: sessionen gäller tills sidan lämnas", async () => {
    const kastar = { getItem: () => { throw new Error("blockerad"); }, setItem: () => { throw new Error("blockerad"); }, removeItem: () => { throw new Error("blockerad"); } };
    const { onHamta } = rita({ lagring: kastar });
    await screen.findByRole("heading", { name: "Du är inbjuden" });
    skrivAdress("anna@foretag.se");
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt" }));
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(onHamta).toHaveBeenCalledWith({ sessionsnyckel: SESSION });
  });

  it("språket följer webbläsaren, valet i huvudet byts och sparas, och appens språk vinner", async () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-GB");
    const { unmount } = rita({ lank: null });
    expect(await screen.findByRole("heading", { name: "Ask for a new link" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "SV" }));
    expect(await screen.findByRole("heading", { name: "Be om en ny länk" })).toBeInTheDocument();
    unmount();
    rita({ lank: null, sprak: "en" });
    expect(await screen.findByRole("heading", { name: "Ask for a new link" })).toBeInTheDocument();
  });

  it("kastar för en funktion som saknas, en trasig länk eller ett språk som inte finns", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    const bas = { onLos: () => {}, onHamta: () => {}, onNyLank: () => {} };
    expect(() => render(<OpsGastSida {...bas} onLos={undefined} />)).toThrow(/onLos krävs/);
    expect(() => render(<OpsGastSida {...bas} lank={{ id: ID, nyckel: "kort" }} />)).toThrow(/lank är/);
    expect(() => render(<OpsGastSida {...bas} sprak="de" />)).toThrow(/språket/);
    tyst.mockRestore();
  });
});
