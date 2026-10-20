import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastChatt } from "../components/OpsGastChatt.jsx";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { OpsGastSida } from "../components/OpsGastSida.jsx";
import { OpsSvar, OpsSvarSummor } from "../components/OpsSvar.jsx";
import { GASTGRUPPATGARDER, GASTFEL, gastGruppApi, gastId } from "../lib/gast.js";

/**
 * Gästens bantade gränssnitt och dess delar (0.132.0, cllp/lifehub.app#389, skiva 2). jsdom mäter att rätt text och rätt knappar finns, att anropen går rätt och att inget som lästs står kvar efter en
 * återkallelse; hur det SER UT mäts inte här utan i skalytan (avsnitt 56, 390 och 1280 px).
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

const ID = "a".repeat(64);
const ID2 = "b".repeat(64);
const NYCKEL = "N".repeat(43);
const SESSION = "S".repeat(43);
const SESSION2 = "T".repeat(43);

const klicka = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

/** Radix aktiverar en flik vid `mousedown`, inte vid `click`. */
const valjFlik = async (el) => {
  await act(async () => {
    fireEvent.mouseDown(el, { button: 0 });
  });
};

const GRUPP = { namn: "Källan", funktioner: ["chatt", "kalender", "bibliotek"] };

const MEDDELANDEN = [
  { id: "m1", av: { namn: "Agda Ägare" }, text: "Välkommen till gruppen", tid: Date.UTC(2026, 9, 19, 9, 0) },
  { id: "m2", av: { namn: "Maja Medlem" }, text: "Tack Agda", tid: Date.UTC(2026, 9, 19, 9, 5), svarPa: { id: "m1", namn: "Agda Ägare", text: "Välkommen till gruppen" } },
  { id: "m3", av: { namn: "Tidigare medlem" }, text: "Se bilden", tid: Date.UTC(2026, 9, 19, 9, 10), bilaga: { namn: "bild.png", typ: "image/png" } },
];

describe("OpsGastChatt", () => {
  it("ritar medlemmens bubblor med avsändarnamn, ett citat och bilagans namn, och ingen skrivruta", () => {
    render(<OpsGastChatt meddelanden={MEDDELANDEN} />);
    expect(screen.getByRole("log", { name: "Chatt" })).toBeInTheDocument();
    expect(screen.getByText("Välkommen till gruppen", { selector: "[data-bubbla] *" })).toBeInTheDocument();
    expect(screen.getAllByText("Agda Ägare").length).toBeGreaterThan(0);
    expect(screen.getByText("Tidigare medlem")).toBeInTheDocument();
    expect(document.querySelector("[data-citat]")).not.toBeNull();
    expect(document.querySelector("[data-gast-chatt-bilaga]").textContent).toBe("Bilaga: bild.png. Bilagor visas inte för gäster.");
    // Ingen väg att skriva: varken fält, skicka-knapp eller reaktioner.
    expect(document.querySelectorAll("textarea, input, [contenteditable]")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /skicka/i })).toBeNull();
    expect(screen.getByText(/Du kan läsa chatten men inte skriva i den/)).toBeInTheDocument();
    expect(screen.getByText("Du ser hela gruppens chatt, från början.")).toBeInTheDocument();
  });

  it("⛔ tomt är ett svar, ett fel är inte tomt, och äldre meddelanden hämtas med en knapp som bara finns när det finns fler", async () => {
    const { rerender } = render(<OpsGastChatt meddelanden={[]} />);
    expect(screen.getByText("Inga meddelanden än.")).toBeInTheDocument();
    rerender(<OpsGastChatt meddelanden={[]} fel="x" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Chatten kunde inte hämtas just nu.");
    expect(screen.queryByText("Inga meddelanden än.")).toBeNull();
    const onAldre = vi.fn();
    rerender(<OpsGastChatt meddelanden={MEDDELANDEN} fler onAldre={onAldre} />);
    await klicka(screen.getByRole("button", { name: "Visa äldre meddelanden" }));
    expect(onAldre).toHaveBeenCalledTimes(1);
    rerender(<OpsGastChatt meddelanden={MEDDELANDEN} fler={false} onAldre={onAldre} />);
    expect(screen.queryByRole("button", { name: "Visa äldre meddelanden" })).toBeNull();
  });

  it("kastar för indata som gör chatten till en gissning", () => {
    expect(() => render(<OpsGastChatt meddelanden={null} />)).toThrow(/måste vara en lista/);
    expect(() => render(<OpsGastChatt meddelanden={[{ id: "x", text: "a", tid: 1, av: "Agda" }]} />)).toThrow(/av: \{ namn \}/);
  });

  it("med onSkriv finns chattens skrivfält, utan bilagor, mikrofon och agent, och texten skickas och töms; ett fel står kvar med texten", async () => {
    const onSkriv = vi.fn().mockResolvedValue(undefined);
    render(<OpsGastChatt meddelanden={MEDDELANDEN} onSkriv={onSkriv} />);
    const falt = screen.getByRole("textbox", { name: /Skriv/ });
    // Inget som bifogar, spelar in eller frågar agenten.
    expect(screen.queryByRole("button", { name: /Bifoga|bild|foto|fil/i })).toBeNull();
    expect(document.querySelector("[data-mikrofon]")).toBeNull();
    expect(document.querySelector("input[type=file]")).toBeNull();
    expect(screen.getByText(/Du skriver som gäst: dina meddelanden märks Gäst/)).toBeInTheDocument();
    fireEvent.change(falt, { target: { value: "  Hej gruppen  " } });
    await klicka(screen.getByRole("button", { name: "Skicka" }));
    expect(onSkriv).toHaveBeenCalledWith("Hej gruppen");
    await waitFor(() => expect(falt).toHaveValue(""));
    onSkriv.mockRejectedValueOnce(new Error("För många anrop."));
    fireEvent.change(falt, { target: { value: "Igen" } });
    await klicka(screen.getByRole("button", { name: "Skicka" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("För många anrop.");
    expect(falt).toHaveValue("Igen");
  });

  it("⛔ ett tomt fält skickar inget, och över taket (1000 tecken) är Skicka spärrad med en räknare", async () => {
    const onSkriv = vi.fn().mockResolvedValue(undefined);
    render(<OpsGastChatt meddelanden={[]} onSkriv={onSkriv} />);
    expect(screen.getByRole("button", { name: "Skicka" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /Skriv/ }), { target: { value: "x".repeat(1001) } });
    expect(screen.getByRole("button", { name: "Skicka" })).toBeDisabled();
    expect(document.querySelector("[data-langdraknare='over']")).not.toBeNull();
    expect(onSkriv).not.toHaveBeenCalled();
  });

  it("⛔ en gästs meddelanden bär märket Gäst, och det egna står som eget; ett utan gast-flagga har inget märke", () => {
    const rader = [
      { id: "a", av: { namn: "Maja Medlem" }, text: "Hej", tid: Date.UTC(2026, 9, 19, 9, 0) },
      { id: "b", av: { namn: "Bo Gäst" }, text: "Hej från Bo", tid: Date.UTC(2026, 9, 19, 9, 10), gast: true, egen: false },
      { id: "c", av: { namn: "Anna Gäst" }, text: "Mitt eget", tid: Date.UTC(2026, 9, 19, 9, 20), gast: true, egen: true },
    ];
    render(<OpsGastChatt meddelanden={rader} onSkriv={async () => {}} />);
    const markningar = [...document.querySelectorAll("[data-gast-markning]")];
    expect(markningar.map((m) => m.textContent)).toEqual(["Gäst"]);
    expect(within(markningar[0].parentElement).getByText("Bo Gäst")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-meddelande="eget"]')).toHaveLength(1);
    expect(within(document.querySelector('[data-meddelande="eget"]')).getByText("Mitt eget")).toBeInTheDocument();
  });

  it("engelska", () => {
    render(<OpsGastChatt meddelanden={[]} sprak="en" />);
    expect(screen.getByText("No messages yet.")).toBeInTheDocument();
    expect(screen.getByText(/You can read the chat but not write in it/)).toBeInTheDocument();
  });
});

describe("OpsSvar med gäster och OpsSvarSummor", () => {
  const medlemmar = [{ uid: "u1", namn: "Agda" }, { uid: "u2", namn: "Maja" }];
  const gaster = [{ uid: gastId("anna@foretag.se"), namn: "Anna" }, { uid: gastId("bo@foretag.se") }];

  it("gäster räknas i summan och antalet, märks Gäst och har inga knappar; en gäst som inte finns i listan räknas inte", () => {
    const svar = [{ id: "u1", svar: "kommer" }, { id: gastId("anna@foretag.se"), svar: "kommerInte" }, { id: gastId("borta@foretag.se"), svar: "kommer" }];
    render(<OpsSvar svar={svar} medlemmar={medlemmar} uid="u2" onSvara={() => {}} gaster={gaster} />);
    expect(document.querySelector("[data-sammanstallning]").textContent).toBe("1 kommer, 1 kommer inte, 2 har inte svarat");
    const rader = document.querySelectorAll("[data-gast]");
    expect(rader).toHaveLength(2);
    expect(within(rader[0]).getByText("Anna")).toBeInTheDocument();
    expect(within(rader[0]).getByText("Gäst")).toBeInTheDocument();
    expect(within(rader[0]).getByText("Kommer inte")).toBeInTheDocument();
    expect(within(rader[1]).getByText("Gäst")).toBeInTheDocument();
    expect(within(rader[1]).getByText("Har inte svarat")).toBeInTheDocument();
    for (const r of rader) expect(r.querySelectorAll("button")).toHaveLength(0);
    // Antalet: två medlemmar och två gäster.
    expect(document.querySelector("section").textContent).toContain("4");
  });

  it("utan gäster är vyn som förut", () => {
    render(<OpsSvar svar={[]} medlemmar={medlemmar} uid="u2" onSvara={() => {}} />);
    expect(document.querySelector("[data-sammanstallning]").textContent).toBe("0 kommer, 0 kommer inte, 2 har inte svarat");
    expect(document.querySelectorAll("[data-gast]")).toHaveLength(0);
  });

  it("OpsSvarSummor visar summan, mitt eget svar som två knappar och inga namn", async () => {
    const onSvara = vi.fn(async () => {});
    render(<OpsSvarSummor summa={{ kommer: 2, kommerInte: 0, ejSvarat: 1, text: "2 kommer, 0 kommer inte, 1 har inte svarat", mitt: "kommer" }} onSvara={onSvara} rubrik="Svar" />);
    expect(document.querySelector("[data-sammanstallning]").textContent).toBe("2 kommer, 0 kommer inte, 1 har inte svarat");
    expect(screen.getByRole("button", { name: "Kommer" })).toHaveAttribute("aria-pressed", "true");
    await klicka(screen.getByRole("button", { name: "Kommer inte" }));
    expect(onSvara).toHaveBeenCalledWith("kommerInte");
    expect(document.querySelectorAll("[data-svarsrad]")).toHaveLength(0);
    expect(() => render(<OpsSvarSummor summa={{ kommer: 1, text: "x" }} onSvara={() => {}} rubrik="Svar" />)).toThrow(/summa.kommerInte/);
    // Rubriken krävs: ramverket gissar inte gästens språk.
    expect(() => render(<OpsSvarSummor summa={{ kommer: 1, kommerInte: 0, ejSvarat: 0, text: "x", mitt: null }} onSvara={() => {}} />)).toThrow(/rubrik krävs/);
  });

  it("gästens namnlösa etikett följer språket: Gäst på svenska, Guest på engelska, och en egen etikett vinner", () => {
    const svar = [];
    const { rerender } = render(<OpsSvar svar={svar} medlemmar={medlemmar} uid="u2" onSvara={() => {}} gaster={[{ uid: gastId("bo@foretag.se") }]} sprak="en" />);
    expect(within(document.querySelector("[data-gast]")).getByText("Guest")).toBeInTheDocument();
    rerender(<OpsSvar svar={svar} medlemmar={medlemmar} uid="u2" onSvara={() => {}} gaster={[{ uid: gastId("bo@foretag.se") }]} gastEtikett="Besökare" />);
    expect(within(document.querySelector("[data-gast]")).getByText("Besökare")).toBeInTheDocument();
  });
});

describe("gastGruppApi", () => {
  it("lägger sessionsnyckeln och åtgärdens namn på varje anrop, och vyn hanterar aldrig nyckeln", async () => {
    const anrop = vi.fn(async () => ({ ok: true }));
    const api = gastGruppApi(anrop, SESSION);
    expect(Object.keys(api).sort()).toEqual([...GASTGRUPPATGARDER].sort());
    await api.chatt({ fore: 5 });
    await api.fil({ postId: "p1" });
    await api.kalender();
    expect(anrop.mock.calls.map((c) => c[0])).toEqual([
      { fore: 5, atgard: "chatt", sessionsnyckel: SESSION },
      { postId: "p1", atgard: "fil", sessionsnyckel: SESSION },
      { atgard: "kalender", sessionsnyckel: SESSION },
    ]);
    // Ett argument kan inte skriva över åtgärden eller sessionen.
    await api.svara({ atgard: "radera", sessionsnyckel: "x", val: "kommer" });
    expect(anrop.mock.calls[3][0]).toEqual({ atgard: "svara", sessionsnyckel: SESSION, val: "kommer" });
    expect(() => gastGruppApi(null, SESSION)).toThrow(/anrop krävs/);
    expect(() => gastGruppApi(anrop, "kort")).toThrow(/sessionsnyckel/);
  });
});

describe("OpsGastGrupp: det bantade gränssnittet", () => {
  const HANDELSER = [
    { id: "h-mote", titel: "Möte", beskrivning: "Vi ses i salen", plats: "Salen", datum: "2026-11-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false, kalenderId: null, kravSvar: true, ejSatt: false },
    { id: "h-fri", titel: "Repetition", beskrivning: null, plats: null, datum: "2026-11-09", slutDatum: null, tid: null, slutTid: null, heldag: true, kalenderId: null, kravSvar: false, ejSatt: false },
    { id: "h-ejsatt", titel: "Fika", beskrivning: null, plats: null, datum: null, slutDatum: null, tid: null, slutTid: null, heldag: false, kalenderId: null, kravSvar: true, ejSatt: true },
  ];
  const POSTER = [
    { id: "p-pdf", typ: "fil", rubrik: "Låtlista", fil: { sokvag: "p-pdf", namn: "lat.pdf", mime: "application/pdf", byte: 1200, klar: true }, skapad: 5000, andrad: 5000, skapadAvNamn: "Maja" },
    { id: "p-ljud", typ: "fil", rubrik: "Demo", fil: { sokvag: "p-ljud", namn: "demo.mp3", mime: "audio/mpeg", byte: 3000, klar: true }, durationMs: 61000, skapad: 4000, andrad: 4000, skapadAvNamn: "Agda" },
    { id: "p-bild", typ: "fil", rubrik: "Scenen", fil: { sokvag: "p-bild", namn: "scen.png", mime: "image/png", byte: 3000, klar: true }, skapad: 3500, andrad: 3500, skapadAvNamn: "Agda" },
    { id: "p-not", typ: "anteckning", rubrik: "Kom ihåg tejp", text: "Tejp och skruvar", skapad: 3000, andrad: 3000, skapadAvNamn: "Agda" },
  ];

  /** Ett api som svarar som tjänsten. Alla anrop loggas. */
  function apiMed(extra = {}) {
    const logg = [];
    const svar = {
      chatt: async () => ({ ok: true, meddelanden: MEDDELANDEN, fler: false }),
      kalender: async () => ({ ok: true, handelser: HANDELSER, kalendrar: [], avkortad: false, ejVisade: 0 }),
      handelse: async ({ handelseId }) => ({
        ok: true,
        handelse: HANDELSER.find((h) => h.id === handelseId),
        svar: { kommer: 1, kommerInte: 0, ejSvarat: 2, text: "1 kommer, 0 kommer inte, 2 har inte svarat", mitt: null },
        ...(handelseId === "h-ejsatt" ? { omrostning: { forslag: [{ id: "f1", datum: "2026-12-01" }] } } : {}),
      }),
      svara: async () => ({ ok: true }),
      rosta: async () => ({ ok: true }),
      skrivChatt: async ({ text }) => ({ ok: true, meddelande: { id: "ny1", av: { namn: "Anna Gäst" }, text, tid: Date.UTC(2026, 9, 19, 10, 0), gast: true, egen: true } }),
      bibliotek: async () => ({ ok: true, poster: POSTER, avkortad: false }),
      fil: async ({ postId }) => ({ ok: true, url: `https://lagring.example/${postId}`, namn: "x", mime: "application/pdf" }),
      ...extra,
    };
    const api = Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async (args) => { logg.push([a, args]); return svar[a](args ?? {}); })]));
    return { api, logg };
  }

  const rita = (props = {}) => {
    const { api, logg } = props.api ? { api: props.api, logg: props.logg } : apiMed();
    const utf = render(<OpsGastGrupp grupp={GRUPP} api={api} intervallMs={0} idag={new Date(2026, 9, 20)} {...props} />);
    return { ...utf, api, logg };
  };

  it("har exakt tre flikar och ingen länk eller knapp som leder ut ur sidan", async () => {
    rita();
    const flikar = screen.getAllByRole("tab");
    expect(flikar.map((f) => f.textContent)).toEqual(["Chatt", "Kalender", "Bibliotek"]);
    expect(screen.queryByRole("tab", { name: "Ärenden" })).toBeNull();
    expect(await screen.findByText("Välkommen till gruppen", { selector: "[data-bubbla] *" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Källan");
    expect(screen.getByText(/Du är gäst i Källan/)).toBeInTheDocument();
    for (const f of ["Kalender", "Bibliotek"]) {
      await klicka(screen.getByRole("tab", { name: f }));
      await waitFor(() => expect(document.querySelector("[data-gast-grupp]")).not.toBeNull());
      for (const a of document.querySelectorAll("a[href]")) expect(a.getAttribute("href"), `${f}: länk ut`).toMatch(/^(https?:|#|blob:|data:)/);
      expect(document.body.textContent).not.toMatch(/Inställningar|Ekonomi|Appar|Hubb|Agent/);
    }
  });

  it("flikarna följer vilka funktioner gruppen har, och ärenden finns inte som flik hur appen än skriver funktionerna", () => {
    const { unmount } = rita({ grupp: { namn: "Källan", funktioner: ["chatt", "bibliotek"] } });
    expect(screen.getAllByRole("tab").map((f) => f.textContent)).toEqual(["Chatt", "Bibliotek"]);
    unmount();
    // ⛔ En app (eller en äldre tjänst) som ändå listar arenden får ingen ärendeflik: gästen ser inga ärenden (CP 2026-10-20).
    rita({ grupp: { namn: "Källan", funktioner: ["chatt", "arenden"] } });
    expect(screen.getAllByRole("tab").map((f) => f.textContent)).toEqual(["Chatt"]);
    expect(() => render(<OpsGastGrupp grupp={{ namn: "K", funktioner: [] }} api={apiMed().api} />)).toThrow(/inga funktioner/);
    expect(() => render(<OpsGastGrupp grupp={null} api={apiMed().api} />)).toThrow(/grupp är/);
    expect(() => render(<OpsGastGrupp grupp={GRUPP} api={{}} />)).toThrow(/api krävs/);
  });

  it("en flik hämtas när den öppnas första gången och inte före, och inte igen vid ett byte tillbaka inom en minut", async () => {
    const { api } = rita();
    await screen.findByText("Välkommen till gruppen", { selector: "[data-bubbla] *" });
    expect(api.chatt).toHaveBeenCalledTimes(1);
    for (const a of ["kalender", "bibliotek", "handelse", "fil", "skrivChatt"]) expect(api[a], a).not.toHaveBeenCalled();
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    await waitFor(() => expect(api.kalender).toHaveBeenCalledTimes(1));
    await valjFlik(screen.getByRole("tab", { name: "Chatt" }));
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    expect(api.kalender).toHaveBeenCalledTimes(1);
    expect(api.chatt).toHaveBeenCalledTimes(1);
  });

  it("kalendern ritas med OpsCalendar, Datum ej satt står för sig, och en händelse öppnas i OpsHandelsePanel utan penna eller flytt", async () => {
    rita();
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    await screen.findByRole("region", { name: "Datum ej satt" });
    expect(document.querySelector("[data-gast-ejsatt='h-ejsatt']").textContent).toBe("Fika");
    expect(screen.getByText("De här händelserna har inget datum än. Öppna en för att svara eller rösta.")).toBeInTheDocument();
    await klicka(document.querySelector("[data-gast-ejsatt='h-ejsatt']"));
    await screen.findByText("1 kommer, 0 kommer inte, 2 har inte svarat");
    const panel = document.querySelector("[data-handelsepanel]");
    expect(within(panel).getByRole("heading", { name: "Fika" })).toBeInTheDocument();
    expect(within(panel).getByText("Datum ej satt")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Redigera" })).toBeNull();
    expect(within(panel).queryByText("Flytta till kalender")).toBeNull();
    // Utan en omröstningsrenderare säger sidan att omröstningen inte går att visa.
    expect(document.querySelector("[data-gast-omrostning-ejstodd]")).not.toBeNull();
    await klicka(within(panel).getByRole("button", { name: "Tillbaka" }));
    expect(await screen.findByRole("region", { name: "Datum ej satt" })).toBeInTheDocument();
  });

  it("att svara anropar svara med händelsen och värdet och hämtar händelsen på nytt; ett fel står kvar utskrivet", async () => {
    let anrop = 0;
    const { api, logg } = rita({
      ...(() => {
        const m = apiMed({
          handelse: async ({ handelseId }) => ({
            ok: true,
            handelse: HANDELSER.find((h) => h.id === handelseId),
            svar: anrop === 0 ? { kommer: 1, kommerInte: 0, ejSvarat: 2, text: "1 kommer, 0 kommer inte, 2 har inte svarat", mitt: null } : { kommer: 2, kommerInte: 0, ejSvarat: 1, text: "2 kommer, 0 kommer inte, 1 har inte svarat", mitt: "kommer" },
          }),
          svara: async () => { anrop += 1; return { ok: true }; },
        });
        return { api: m.api, logg: m.logg };
      })(),
    });
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    await screen.findByRole("region", { name: "Datum ej satt" });
    // Händelsen "Möte" öppnas ur dagpanelen i kalendern: här direkt via en lista, eftersom OpsCalendar bara visar dagen när den valts.
    await klicka(document.querySelector("[data-gast-ejsatt='h-ejsatt']"));
    await screen.findByText("1 kommer, 0 kommer inte, 2 har inte svarat");
    await klicka(screen.getByRole("button", { name: "Kommer" }));
    await screen.findByText("2 kommer, 0 kommer inte, 1 har inte svarat");
    expect(logg.filter(([a]) => a === "svara")).toEqual([["svara", { handelseId: "h-ejsatt", val: "kommer" }]]);
    expect(screen.getByRole("button", { name: "Kommer" })).toHaveAttribute("aria-pressed", "true");
    expect(api.handelse).toHaveBeenCalledTimes(2);
  });

  it("⛔ ett svar som inte går att spara visar felet och lämnar knapparna lediga", async () => {
    const m = apiMed({ svara: async () => ({ ok: false, orsak: "for-manga" }) });
    rita({ api: m.api, logg: m.logg });
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    await screen.findByRole("region", { name: "Datum ej satt" });
    await klicka(document.querySelector("[data-gast-ejsatt='h-ejsatt']"));
    await screen.findByText("1 kommer, 0 kommer inte, 2 har inte svarat");
    await klicka(screen.getByRole("button", { name: "Kommer" }));
    expect(await screen.findByText("Svaret sparades inte: Svaret kunde inte sparas just nu. Försök igen.")).toBeInTheDocument();
    expect(document.querySelector("[data-gast-svar-fel]").textContent).toBe("För många anrop. Vänta en stund och försök igen.");
    expect(screen.getByRole("button", { name: "Kommer" })).not.toBeDisabled();
  });

  it("omröstningen är appens: renderOmrostning får förslagen och en rosta som anropar tjänsten och hämtar om händelsen", async () => {
    const m = apiMed();
    const renderOmrostning = vi.fn(({ omrostning, rosta }) => (
      <button type="button" onClick={() => rosta({ forslagId: omrostning.forslag[0].id, val: "ja" })}>Rösta ja</button>
    ));
    rita({ api: m.api, logg: m.logg, renderOmrostning });
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    await screen.findByRole("region", { name: "Datum ej satt" });
    await klicka(document.querySelector("[data-gast-ejsatt='h-ejsatt']"));
    await klicka(await screen.findByRole("button", { name: "Rösta ja" }));
    expect(m.logg.filter(([a]) => a === "rosta")).toEqual([["rosta", { handelseId: "h-ejsatt", forslagId: "f1", val: "ja" }]]);
    expect(m.api.handelse).toHaveBeenCalledTimes(2);
    expect(document.querySelector("[data-gast-omrostning-ejstodd]")).toBeNull();
  });

  it("⛔ biblioteket: ingen Ny, ingen redigering, radering eller delning, och listan signerar INGEN fil: bara den öppnade", async () => {
    const m = apiMed();
    rita({ api: m.api, logg: m.logg });
    await valjFlik(screen.getByRole("tab", { name: "Bibliotek" }));
    await screen.findByText("Låtlista");
    // Fyra poster, tre av dem filer: ingen signering har skett.
    expect(document.querySelectorAll("[data-bibliotek-kort]")).toHaveLength(4);
    expect(m.api.fil).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Ny/ })).toBeNull();
    expect(screen.queryByText("Radera")).toBeNull();
    expect(screen.queryByText("Dela länk")).toBeNull();
    expect(screen.queryByText(/Mitt bibliotek|Flytta/)).toBeNull();
    expect(document.querySelectorAll('a[href^="/"]')).toHaveLength(0);
    // Öppna en fil: en signering, med postens id, och inte fler.
    await klicka(screen.getByRole("button", { name: "Låtlista" }));
    await waitFor(() => expect(m.api.fil).toHaveBeenCalledTimes(1));
    expect(m.logg.filter(([a]) => a === "fil")).toEqual([["fil", { postId: "p-pdf" }]]);
    expect(await screen.findByRole("link", { name: /lat\.pdf/ })).toHaveAttribute("href", "https://lagring.example/p-pdf");
    // Tillbaka till listan: ingen ny signering för en fil som redan öppnats, och ingen för de andra.
    await klicka(screen.getByRole("button", { name: /Tillbaka/ }));
    expect(m.api.fil).toHaveBeenCalledTimes(1);
  });

  it("gästen skriver i chatten: skrivChatt anropas med texten och meddelandet står i chatten som gästens eget, märkt Gäst; ett nej från servern visar texten", async () => {
    const { api } = rita();
    await screen.findByText("Välkommen till gruppen", { selector: "[data-bubbla] *" });
    fireEvent.change(screen.getByRole("textbox", { name: /Skriv/ }), { target: { value: "Hej från mig" } });
    await klicka(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(api.skrivChatt).toHaveBeenCalledWith({ text: "Hej från mig" }));
    expect(await screen.findByText("Hej från mig", { selector: "[data-bubbla] *" })).toBeInTheDocument();
    expect(within(document.querySelector('[data-meddelande="eget"]')).getByText("Hej från mig")).toBeInTheDocument();
    api.skrivChatt.mockResolvedValueOnce({ ok: false, orsak: "for-manga" });
    fireEvent.change(screen.getByRole("textbox", { name: /Skriv/ }), { target: { value: "För mycket" } });
    await klicka(screen.getByRole("button", { name: "Skicka" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("För många anrop. Vänta en stund och försök igen.");
    expect(screen.getByRole("textbox", { name: /Skriv/ })).toHaveValue("För mycket");
  });

  it("⛔ nekas ett anrop med aterkallad anropas onNekad, och en annan orsak än nej och aterkallad gör det inte", async () => {
    const onNekad = vi.fn();
    const m = apiMed({ kalender: async () => ({ ok: false, orsak: "aterkallad" }) });
    const forsta = rita({ api: m.api, logg: m.logg, onNekad });
    await screen.findByText("Välkommen till gruppen", { selector: "[data-bubbla] *" });
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    await waitFor(() => expect(onNekad).toHaveBeenCalledWith("aterkallad"));
    forsta.unmount();
    // En annan orsak (för många anrop) visar sitt fel i fliken men säger inte till sidan att åtkomsten är borta.
    const onNekad2 = vi.fn();
    const m2 = apiMed({ bibliotek: async () => ({ ok: false, orsak: "for-manga" }) });
    rita({ api: m2.api, logg: m2.logg, onNekad: onNekad2 });
    await valjFlik(screen.getByRole("tab", { name: "Bibliotek" }));
    expect(await screen.findByText("För många anrop. Vänta en stund och försök igen.")).toBeInTheDocument();
    expect(onNekad2).not.toHaveBeenCalled();
  });

  it("chattens ping hämtar bara det nya: nyast är tiden på det senaste, ett ingetNytt ändrar ingenting, och ett nytt meddelande läggs till utan dubbletter", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let nyaste = false;
    const m = apiMed({
      chatt: async (a) => {
        if (a.nyast !== undefined) return nyaste ? { ok: true, meddelanden: [...MEDDELANDEN, { id: "m4", av: { namn: "Agda Ägare" }, text: "Nytt!", tid: MEDDELANDEN[2].tid + 1000 }], fler: false } : { ok: true, meddelanden: [], fler: false, ingetNytt: true };
        return { ok: true, meddelanden: MEDDELANDEN, fler: false };
      },
    });
    rita({ api: m.api, logg: m.logg, intervallMs: 30_000 });
    await screen.findByText("Tack Agda", { selector: "[data-bubbla] *" });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(m.logg.filter(([a]) => a === "chatt").map(([, x]) => x)).toEqual([{}, { nyast: MEDDELANDEN[2].tid }]);
    expect(screen.queryByText("Nytt!")).toBeNull();
    nyaste = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(await screen.findByText("Nytt!", { selector: "[data-bubbla] *" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-meddelande]")).toHaveLength(4);
    // Pingen är bara på chattfliken: i kalenderfliken går den inte.
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    const fore = m.logg.filter(([a]) => a === "chatt").length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(m.logg.filter(([a]) => a === "chatt")).toHaveLength(fore);
  });

  it("äldre meddelanden hämtas med fore = tiden på det äldsta, och läggs före utan att de nyare försvinner", async () => {
    const aldre = [{ id: "m0", av: { namn: "Agda Ägare" }, text: "Det första", tid: MEDDELANDEN[0].tid - 1000 }];
    const m = apiMed({ chatt: async (a) => (a.fore !== undefined ? { ok: true, meddelanden: aldre, fler: false } : { ok: true, meddelanden: MEDDELANDEN, fler: true }) });
    rita({ api: m.api, logg: m.logg });
    await klicka(await screen.findByRole("button", { name: "Visa äldre meddelanden" }));
    expect(await screen.findByText("Det första", { selector: "[data-bubbla] *" })).toBeInTheDocument();
    expect(m.logg.filter(([a]) => a === "chatt").map(([, x]) => x)).toEqual([{}, { fore: MEDDELANDEN[0].tid }]);
    expect(screen.queryByRole("button", { name: "Visa äldre meddelanden" })).toBeNull();
    expect(screen.getByText("Tack Agda", { selector: "[data-bubbla] *" })).toBeInTheDocument();
  });
});

describe("OpsGastSida med hela gruppen", () => {
  const lagringMed = (start = {}) => {
    const d = { ...start };
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; }, d };
  };
  const gruppSvar = { ok: true, namn: "", funktion: "grupp", grupp: GRUPP };
  const sakSvar = { ok: true, namn: "", funktion: "rosta", sak: { titel: "Rep" } };
  const rita = (props = {}) => {
    const lagring = props.lagring ?? lagringMed();
    const onHamta = props.onHamta ?? vi.fn(async () => gruppSvar);
    const utf = render(
      <OpsGastSida
        lank={null}
        onLos={vi.fn(async () => ({ ok: true, sessionsnyckel: SESSION }))}
        onHamta={onHamta}
        onNyLank={vi.fn(async () => ({ ok: true }))}
        renderSak={({ sak }) => <div data-sak="">{sak.titel}</div>}
        renderGrupp={({ grupp, uppdatera }) => <div data-grupp="" data-namn={grupp.namn}><button type="button" onClick={uppdatera}>Uppdatera</button>Gruppinnehåll</div>}
        intervallMs={0}
        {...props}
        lagring={lagring}
      />,
    );
    return { ...utf, lagring, onHamta };
  };

  it("en gruppinbjudan ritas av renderGrupp i en bredare spalt, och en omröstning i den smala", async () => {
    const lagring = lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID });
    const { unmount } = rita({ lagring });
    expect(await screen.findByText("Gruppinnehåll")).toBeInTheDocument();
    expect(document.querySelector("[data-grupp]").getAttribute("data-namn")).toBe("Källan");
    expect(document.querySelector("main").className).toContain("max-w-5xl");
    unmount();
    rita({ lagring, onHamta: vi.fn(async () => sakSvar) });
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(document.querySelector("main").className).toContain("max-w-3xl");
    expect(document.querySelector("main").className).not.toContain("max-w-5xl");
  });

  it("utan renderGrupp säger sidan att inbjudan inte går att visa, i stället för att tiga", async () => {
    rita({ lagring: lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID }), renderGrupp: undefined });
    expect(await screen.findByText("Den här inbjudan går inte att visa i den här versionen av appen.")).toBeInTheDocument();
  });

  it("⛔ med flera sessioner på enheten prövas alla: en återkallad grupp döljer inte en levande omröstning (hålet från skiva 1)", async () => {
    // Gruppen (ID) är den senast öppnade och är återkallad. Omröstningen (ID2) lever.
    const lagring = lagringMed({ "ops-gast:senaste": ID, "ops-gast:alla": JSON.stringify([ID, ID2]), [`ops-gast:${ID}`]: SESSION, [`ops-gast:${ID2}`]: SESSION2 });
    const onHamta = vi.fn(async ({ sessionsnyckel }) => (sessionsnyckel === SESSION ? { ok: false, orsak: "aterkallad" } : sakSvar));
    rita({ lagring, onHamta });
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(screen.queryByText(GASTFEL.aterkallad)).toBeNull();
    expect(onHamta.mock.calls.map((c) => c[0].sessionsnyckel)).toEqual([SESSION, SESSION2]);
    // Den som levde är nu den senast öppnade, och den återkallade sessionen är inte glömd.
    expect(lagring.d["ops-gast:senaste"]).toBe(ID2);
    expect(lagring.d[`ops-gast:${ID}`]).toBe(SESSION);
  });

  it("sessioner från före indexet hittas när minnet kan räkna upp sina nycklar (localStorage), och ordningen är senast öppnade först", async () => {
    const d = { "ops-gast:senaste": ID, [`ops-gast:${ID}`]: SESSION, [`ops-gast:${ID2}`]: SESSION2 };
    const lagring = { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; }, key: (i) => Object.keys(d)[i] ?? null, get length() { return Object.keys(d).length; }, d };
    const onHamta = vi.fn(async ({ sessionsnyckel }) => (sessionsnyckel === SESSION ? { ok: false, orsak: "aterkallad" } : sakSvar));
    rita({ lagring, onHamta });
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(onHamta).toHaveBeenCalledTimes(2);
  });

  it("⛔ när ALLA sessioner nekats visas orsaken, och en session som servern inte känner glöms men en återkallad gör det inte", async () => {
    const lagring = lagringMed({ "ops-gast:senaste": ID, "ops-gast:alla": JSON.stringify([ID, ID2]), [`ops-gast:${ID}`]: SESSION, [`ops-gast:${ID2}`]: SESSION2 });
    const onHamta = vi.fn(async ({ sessionsnyckel }) => (sessionsnyckel === SESSION ? { ok: false, orsak: "aterkallad" } : { ok: false, orsak: "nej" }));
    rita({ lagring, onHamta });
    expect(await screen.findByText(GASTFEL.aterkallad)).toBeInTheDocument();
    expect(lagring.d[`ops-gast:${ID}`]).toBe(SESSION);
    expect(lagring.d[`ops-gast:${ID2}`]).toBeUndefined();
  });

  it("en länk i adressraden prövar bara sin egen inbjudan, och ett nätfel eller for-manga glömmer ingenting", async () => {
    const lagring = lagringMed({ "ops-gast:senaste": ID2, [`ops-gast:${ID}`]: SESSION, [`ops-gast:${ID2}`]: SESSION2 });
    const onHamta = vi.fn(async () => ({ ok: false, orsak: "aterkallad" }));
    rita({ lagring, onHamta, lank: { id: ID, nyckel: NYCKEL } });
    expect(await screen.findByText(GASTFEL.aterkallad)).toBeInTheDocument();
    expect(onHamta).toHaveBeenCalledTimes(1);
    expect(onHamta).toHaveBeenCalledWith({ sessionsnyckel: SESSION });
    const l2 = lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID });
    rita({ lagring: l2, onHamta: vi.fn(async () => ({ ok: false, orsak: "for-manga" })) });
    expect(await screen.findAllByText(GASTFEL["for-manga"])).not.toHaveLength(0);
    expect(l2.d[`ops-gast:${ID}`]).toBe(SESSION);
  });

  it("⛔ återkallas gruppen medan sidan är öppen byts allt mot texten, och det som lästs står inte kvar i DOM:en", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const svar = [gruppSvar];
    const onHamta = vi.fn(async () => svar.shift() ?? { ok: false, orsak: "aterkallad" });
    rita({ lagring: lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID }), onHamta, intervallMs: 60_000 });
    expect(await screen.findByText("Gruppinnehåll")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(await screen.findByText(GASTFEL.aterkallad)).toBeInTheDocument();
    expect(screen.queryByText("Gruppinnehåll")).toBeNull();
    expect(document.querySelector("[data-grupp]")).toBeNull();
  });

  it("uppdatera ur renderGrupp hämtar om sidan direkt, så att en nekad åtgärd inte väntar en minut på beskedet", async () => {
    const svar = [gruppSvar];
    const onHamta = vi.fn(async () => svar.shift() ?? { ok: false, orsak: "aterkallad" });
    rita({ lagring: lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID }), onHamta });
    await klicka(await screen.findByRole("button", { name: "Uppdatera" }));
    expect(await screen.findByText(GASTFEL.aterkallad)).toBeInTheDocument();
  });

  it("återkallelse som upptäcks vid uppdatering faller tillbaka på en annan sparad session innan sidan ger upp", async () => {
    const lagring = lagringMed({ "ops-gast:senaste": ID, "ops-gast:alla": JSON.stringify([ID, ID2]), [`ops-gast:${ID}`]: SESSION, [`ops-gast:${ID2}`]: SESSION2 });
    let grupplevande = true;
    const onHamta = vi.fn(async ({ sessionsnyckel }) => (sessionsnyckel === SESSION ? (grupplevande ? gruppSvar : { ok: false, orsak: "aterkallad" }) : sakSvar));
    rita({ lagring, onHamta });
    await klicka(await screen.findByRole("button", { name: "Uppdatera" }));
    grupplevande = false;
    await klicka(screen.getByRole("button", { name: "Uppdatera" }));
    expect(await screen.findByText("Rep")).toBeInTheDocument();
  });
});

describe("OpsGastSida: integritet och radering", () => {
  const lagringMed = (start = {}) => {
    const d = { ...start };
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; }, d };
  };
  const klar = { ok: true, namn: "", funktion: "rosta", sak: { titel: "Rep" } };
  const rita = (props = {}) => {
    const lagring = props.lagring ?? lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID, "ops-gast:alla": JSON.stringify([ID]) });
    const utf = render(<OpsGastSida lank={null} onLos={vi.fn()} onHamta={vi.fn(async () => klar)} onNyLank={vi.fn()} renderSak={({ sak }) => <div>{sak.titel}</div>} intervallMs={0} {...props} lagring={lagring} />);
    return { ...utf, lagring };
  };

  it("texten om integritet säger vad som sparas och hur det raderas, och står på varje gästsida", async () => {
    rita({ onRaderaMig: vi.fn() });
    await screen.findByText("Rep");
    await klicka(screen.getByText("Integritet och dina uppgifter"));
    const lagrat = document.querySelector("[data-gast-integritet-lagrat]").textContent;
    // Varje sorts uppgift som tjänsten lagrar (docs/beslut/0012) nämns.
    for (const ord of ["e-postadress", "namnet", "bjudits in", "loggat in", "nyckeln", "svar och röster", "räknar", "platser", "utgående post"]) expect(lagrat, ord).toContain(ord);
    const radera = document.querySelector("[data-gast-integritet-radera]").textContent;
    for (const ord of ["knappen", "direkt", "alla grupper", "Inbjudningarna", "inloggningarna", "räknarna", "svar och röster", "plats", "inte att ångra", "dras tillbaka raderar ingenting"]) expect(radera, ord).toContain(ord);
    expect(document.body.textContent).not.toMatch(/—|–/);
  });

  it("utan onRaderaMig ritas ingen knapp och texten hänvisar till den som bjöd in, i stället för att lova en knapp", async () => {
    rita();
    await screen.findByText("Rep");
    await klicka(screen.getByText("Integritet och dina uppgifter"));
    expect(screen.queryByRole("button", { name: "Radera mina uppgifter" })).toBeNull();
    expect(document.querySelector("[data-gast-integritet-radera]").textContent).toContain("be den som bjöd in dig");
    expect(document.querySelector("[data-gast-integritet-radera]").textContent).not.toContain("tryck på knappen");
  });

  it("raderaMig frågar en gång, raderar med sessionen, glömmer sessionerna på enheten och säger att uppgifterna är borta", async () => {
    const onRaderaMig = vi.fn(async () => ({ ok: true }));
    const { lagring } = rita({ onRaderaMig });
    await screen.findByText("Rep");
    await klicka(screen.getByText("Integritet och dina uppgifter"));
    await klicka(screen.getByRole("button", { name: "Radera mina uppgifter" }));
    expect(onRaderaMig).not.toHaveBeenCalled();
    expect(screen.getByText("Radera allt vi har sparat om dig, i alla grupper? Det går inte att ångra.")).toBeInTheDocument();
    // Avbryt lämnar allt som det var.
    await klicka(screen.getByRole("button", { name: "Avbryt" }));
    expect(onRaderaMig).not.toHaveBeenCalled();
    await klicka(screen.getByRole("button", { name: "Radera mina uppgifter" }));
    await klicka(screen.getByRole("button", { name: "Ja, radera allt" }));
    await waitFor(() => expect(onRaderaMig).toHaveBeenCalledWith({ sessionsnyckel: SESSION }));
    expect(await screen.findByText(/Dina uppgifter är raderade/)).toBeInTheDocument();
    expect(screen.queryByText("Rep")).toBeNull();
    expect(lagring.d[`ops-gast:${ID}`]).toBeUndefined();
    expect(lagring.d["ops-gast:senaste"]).toBeUndefined();
    expect(JSON.parse(lagring.d["ops-gast:alla"] ?? "[]")).toEqual([]);
  });

  it("⛔ en radering som faller står kvar med felet och lämnar sessionen och sidan som de var", async () => {
    const { lagring } = rita({ onRaderaMig: vi.fn(async () => { throw new Error("nätet"); }) });
    await screen.findByText("Rep");
    await klicka(screen.getByText("Integritet och dina uppgifter"));
    await klicka(screen.getByRole("button", { name: "Radera mina uppgifter" }));
    await klicka(screen.getByRole("button", { name: "Ja, radera allt" }));
    expect(await screen.findByText("Det gick inte just nu. Försök igen.", { selector: "[data-gast-radera-fel]" })).toBeInTheDocument();
    expect(screen.getByText("Rep")).toBeInTheDocument();
    expect(lagring.d[`ops-gast:${ID}`]).toBe(SESSION);
    const { lagring: l2 } = rita({ onRaderaMig: vi.fn(async () => ({ ok: false, orsak: "nej" })) });
    expect(l2.d[`ops-gast:${ID}`]).toBe(SESSION);
  });
});
