import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastArenden } from "../components/OpsGastArenden.jsx";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { OpsGastMottagare } from "../components/OpsGastMottagare.jsx";
import { OpsMottagare } from "../components/OpsMottagare.jsx";
import { GASTGRUPPATGARDER, gastId } from "../lib/gast.js";
import { byggArendemottagare, byggMottagare } from "../lib/samtal.js";

/**
 * Ärenden till en gäst, vyerna (0.132.0, cllp/lifehub.app#389, skiva 3): gästens ärendelista, fliken i gästens gränssnitt, väljaren för ansvarig och medlemmarnas märke.
 * jsdom mäter text, knappar, anrop och att rätt saker finns eller saknas; hur det SER UT mäts i skalytan (avsnitt 56, 390 och 1280 px).
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
});

const ANNA = gastId("anna@foretag.se");
const BO = gastId("bo@foretag.se");

/** Radens namn, utan avataren (vars initialer annars ingår i textContent). */
const namnPa = (rad) => rad.querySelector(".truncate").textContent;

const klicka = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};
const valjFlik = async (el) => {
  await act(async () => {
    fireEvent.mouseDown(el, { button: 0 });
  });
};

const POSTER = [
  {
    id: "a-1",
    rubrik: "Bygg scenen",
    text: "Skruvar saknas\nOch tejp",
    status: "ny",
    forfallodag: "2026-11-20",
    kommentarer: [
      { id: "c1", text: "Jag tar den", tid: Date.UTC(2026, 9, 19, 9, 0), av: { namn: "Agda Ägare" }, gast: false, egen: false },
      { id: "c2", text: "Fixat i morgon", tid: Date.UTC(2026, 9, 19, 9, 30), av: { namn: "Anna" }, gast: true, egen: true },
      { id: "c3", text: "Tack Anna", tid: Date.UTC(2026, 9, 19, 9, 40), av: { namn: "Bo" }, gast: true, egen: false },
    ],
  },
  { id: "a-2", rubrik: "Gammalt jobb", text: "", status: "hanterad", kommentarer: [] },
  { id: "a-3", rubrik: "Skrivet av", status: "avskriven", kommentarer: [], fler: true },
];

describe("OpsGastArenden", () => {
  const rita = (props = {}) => render(<OpsGastArenden poster={POSTER} onKommentera={vi.fn(async () => {})} onKlar={vi.fn(async () => {})} {...props} />);

  it("ritar varje ärende med rubrik, status, förfallodag, text och kommentarer, märker gästens kommentarer Gäst och den egna Du, och säger när äldre kommentarer inte visas", () => {
    rita();
    const kort = document.querySelectorAll("[data-gast-arende]");
    expect(kort).toHaveLength(3);
    const forsta = kort[0];
    expect(within(forsta).getByRole("heading", { level: 3, name: "Bygg scenen" })).toBeInTheDocument();
    expect(forsta.querySelector("[data-gast-arende-status]").textContent).toBe("Öppet");
    expect(forsta.querySelector("[data-gast-arende-forfaller]").textContent).toBe("Förfaller 2026-11-20");
    expect(forsta.querySelector("[data-gast-arende-text]").textContent).toBe("Skruvar saknas\nOch tejp");
    const k = forsta.querySelectorAll("[data-gast-arende-kommentar]");
    expect([...k].map((x) => x.getAttribute("data-gast-arende-kommentar"))).toEqual(["c1", "c2", "c3"]);
    // Agda är medlem (inget märke), Anna är gästens egen (Du + Gäst), Bo är en gäst (namn + Gäst).
    expect(within(k[0]).getByText("Agda Ägare")).toBeInTheDocument();
    expect(k[0].querySelector("[data-gast-markning]")).toBeNull();
    expect(within(k[1]).getByText("Du")).toBeInTheDocument();
    expect(within(k[1]).queryByText("Anna")).toBeNull();
    expect(k[1].querySelector("[data-gast-markning]").textContent).toBe("Gäst");
    expect(within(k[2]).getByText("Bo")).toBeInTheDocument();
    expect(k[2].querySelector("[data-gast-markning]").textContent).toBe("Gäst");
    expect(kort[1].querySelector("[data-gast-arende-status]").textContent).toBe("Klart");
    expect(kort[2].querySelector("[data-gast-arende-status]").textContent).toBe("Avskrivet");
    expect(kort[2].querySelector("[data-gast-arende-fler]").textContent).toBe("Äldre kommentarer visas inte.");
    expect(kort[0].querySelector("[data-gast-arende-fler]")).toBeNull();
    expect(kort[1].textContent).toContain("Inga kommentarer än.");
    expect(screen.getByText(/Du ser inte gruppens andra ärenden/)).toBeInTheDocument();
  });

  it("⛔ vyn gör inget urval och visar ingen länk: GitHub-adressen finns inte i vyn, och inga länkar leder ut", () => {
    rita({ poster: [{ ...POSTER[0], url: "https://github.com/HEMLIGT/x/issues/1" }] });
    // Vyn ritar bara fälten den känner; ett fält servern aldrig skulle skicka ritas ändå inte.
    expect(document.body.textContent).not.toContain("github.com");
    expect(document.querySelectorAll("a[href]")).toHaveLength(0);
  });

  it("⛔ Markera klar frågar först, finns bara på ett öppet ärende, och anropar onKlar med ärendets id först efter Ja", async () => {
    const onKlar = vi.fn(async () => {});
    rita({ onKlar });
    // Bara det öppna ärendet har knappen.
    expect(screen.getAllByRole("button", { name: "Markera klar" })).toHaveLength(1);
    await klicka(screen.getByRole("button", { name: "Markera klar" }));
    expect(onKlar).not.toHaveBeenCalled();
    expect(screen.getByText("Markera ärendet som klart? Du kan inte öppna det igen.")).toBeInTheDocument();
    await klicka(screen.getByRole("button", { name: "Avbryt" }));
    expect(onKlar).not.toHaveBeenCalled();
    expect(screen.queryByText(/Du kan inte öppna det igen/)).toBeNull();
    await klicka(screen.getByRole("button", { name: "Markera klar" }));
    await klicka(screen.getByRole("button", { name: "Ja, markera klart" }));
    expect(onKlar).toHaveBeenCalledTimes(1);
    expect(onKlar).toHaveBeenCalledWith("a-1");
  });

  it("⛔ ett fel vid Markera klar står utskrivet, ärendet står kvar öppet och frågan kvar", async () => {
    const onKlar = vi.fn().mockRejectedValue(new Error("Ärendet ligger inte längre hos dig, eller är redan klart."));
    rita({ onKlar });
    await klicka(screen.getByRole("button", { name: "Markera klar" }));
    await klicka(screen.getByRole("button", { name: "Ja, markera klart" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ärendet ligger inte längre hos dig, eller är redan klart.");
    expect(document.querySelector("[data-gast-arende='a-1']").getAttribute("data-status")).toBe("ny");
  });

  it("kommentaren skickas med ärendets id och trimmad text, fältet töms, och ett fel står under fältet med texten kvar", async () => {
    const onKommentera = vi.fn(async () => {});
    rita({ poster: [POSTER[0]], onKommentera });
    expect(screen.getByText("Din kommentar märks Gäst. Du kan inte bifoga filer.")).toBeInTheDocument();
    // Inget som bifogar eller spelar in: samma skrivfält som chattens, utan bilagor och mikrofon.
    expect(screen.queryByRole("button", { name: /Bifoga|bild|foto/i })).toBeNull();
    expect(document.querySelector("input[type=file]")).toBeNull();
    const falt = screen.getByRole("textbox", { name: /Skriv en kommentar/ });
    fireEvent.change(falt, { target: { value: "  Klart snart  " } });
    await klicka(screen.getByRole("button", { name: "Skicka" }));
    expect(onKommentera).toHaveBeenCalledWith("a-1", "Klart snart");
    await waitFor(() => expect(falt).toHaveValue(""));
    onKommentera.mockRejectedValueOnce(new Error("För många anrop."));
    fireEvent.change(falt, { target: { value: "Igen" } });
    await klicka(screen.getByRole("button", { name: "Skicka" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("För många anrop.");
    expect(falt).toHaveValue("Igen");
  });

  it("⛔ en kommentar som skrivs i ett ärende hamnar inte i ett annat, och över taket (1000 tecken) är Skicka spärrad", async () => {
    const onKommentera = vi.fn(async () => {});
    rita({ poster: [POSTER[0], { ...POSTER[0], id: "a-9", rubrik: "Det andra" }], onKommentera });
    const falten = screen.getAllByRole("textbox", { name: /Skriv en kommentar/ });
    expect(falten).toHaveLength(2);
    fireEvent.change(falten[0], { target: { value: "Bara i det första" } });
    expect(falten[1]).toHaveValue("");
    const knappar = screen.getAllByRole("button", { name: "Skicka" });
    expect(knappar[0]).not.toBeDisabled();
    expect(knappar[1]).toBeDisabled();
    fireEvent.change(falten[1], { target: { value: "x".repeat(1001) } });
    expect(screen.getAllByRole("button", { name: "Skicka" })[1]).toBeDisabled();
    expect(onKommentera).not.toHaveBeenCalled();
  });

  it("⛔ tomt är ett svar, ett fel är inte tomt, och avkortad säger att listan kan sakna något", () => {
    const { rerender } = rita({ poster: [] });
    expect(screen.getByText("Inga ärenden ligger hos dig just nu.")).toBeInTheDocument();
    rerender(<OpsGastArenden poster={[]} fel="x" onKommentera={() => {}} onKlar={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ärendena kunde inte hämtas just nu.");
    expect(screen.queryByText("Inga ärenden ligger hos dig just nu.")).toBeNull();
    rerender(<OpsGastArenden poster={POSTER} avkortad onKommentera={() => {}} onKlar={() => {}} />);
    expect(document.querySelector("[data-gast-arenden-avkortad]").textContent).toMatch(/Det kan finnas ärenden hos dig som inte visas/);
    rerender(<OpsGastArenden poster={POSTER} onKommentera={() => {}} onKlar={() => {}} />);
    expect(document.querySelector("[data-gast-arenden-avkortad]")).toBeNull();
  });

  it("kastar för indata som gör listan till en gissning, och engelska", () => {
    expect(() => render(<OpsGastArenden poster={null} onKommentera={() => {}} onKlar={() => {}} />)).toThrow(/måste vara en lista/);
    expect(() => render(<OpsGastArenden poster={[{ rubrik: "x" }]} onKommentera={() => {}} onKlar={() => {}} />)).toThrow(/varje ärende har/);
    expect(() => render(<OpsGastArenden poster={[]} />)).toThrow(/onKommentera och onKlar krävs/);
    render(<OpsGastArenden poster={[POSTER[0]]} onKommentera={() => {}} onKlar={() => {}} sprak="en" />);
    expect(document.querySelector("[data-gast-arende-status]").textContent).toBe("Open");
    expect(screen.getByRole("button", { name: "Mark done" })).toBeInTheDocument();
    expect(document.querySelector("[data-gast-arende-forfaller]").textContent).toBe("Due 20/11/2026");
  });
});

describe("OpsGastGrupp: ärendefliken", () => {
  const GRUPP = { namn: "Källan", funktioner: ["chatt", "arenden"] };
  const MEDDELANDEN = [{ id: "m1", av: { namn: "Agda Ägare" }, text: "Välkommen", tid: Date.UTC(2026, 9, 19, 9, 0) }];

  /** Ett api som svarar som tjänsten. `poster` är ett lagrat läge som kan ändras av provet. */
  function apiMed({ poster = POSTER, ...extra } = {}) {
    const lage = { poster: structuredClone(poster) };
    const svar = {
      chatt: async () => ({ ok: true, meddelanden: MEDDELANDEN, fler: false }),
      kalender: async () => ({ ok: true, handelser: [], kalendrar: [], avkortad: false, ejVisade: 0 }),
      handelse: async () => ({ ok: false, orsak: "saknas" }),
      svara: async () => ({ ok: true }),
      rosta: async () => ({ ok: true }),
      skrivChatt: async () => ({ ok: false, orsak: "nej" }),
      bibliotek: async () => ({ ok: true, poster: [], avkortad: false }),
      fil: async () => ({ ok: false, orsak: "saknas" }),
      arenden: async () => ({ ok: true, poster: structuredClone(lage.poster), avkortad: false }),
      kommenteraArende: async ({ arendeId, text }) => ({ ok: true, kommentar: { id: "ny", text, tid: Date.UTC(2026, 9, 20, 8, 0), av: { namn: "Anna" }, gast: true, egen: true }, arendeId }),
      markeraArendeKlart: async ({ arendeId }) => {
        lage.poster = lage.poster.map((p) => (p.id === arendeId ? { ...p, status: "hanterad" } : p));
        return { ok: true };
      },
      ...extra,
    };
    const api = Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async (args) => svar[a](args ?? {}))]));
    return { api, lage };
  }
  const rita = (m, props = {}) => render(<OpsGastGrupp grupp={GRUPP} api={m.api} intervallMs={0} idag={new Date(2026, 9, 20)} {...props} />);

  it("⛔ fliken Ärenden hämtas direkt vid start och finns bara när gästen har minst ett ärende: med ärenden fyra flikar, utan ärenden ingen alls", async () => {
    const m = apiMed();
    const { unmount } = rita(m);
    await waitFor(() => expect(screen.getAllByRole("tab").map((f) => f.textContent)).toEqual(["Chatt", "Ärenden"]));
    expect(m.api.arenden).toHaveBeenCalledTimes(1);
    unmount();
    const tom = apiMed({ poster: [] });
    rita(tom);
    await waitFor(() => expect(tom.api.arenden).toHaveBeenCalledTimes(1));
    await screen.findByText("Välkommen", { selector: "[data-bubbla] *" });
    expect(screen.getAllByRole("tab").map((f) => f.textContent)).toEqual(["Chatt"]);
    expect(screen.queryByRole("tab", { name: "Ärenden" })).toBeNull();
  });

  it("ingressen säger att gästen bara ser de ärenden gruppen gett hen", async () => {
    rita(apiMed());
    expect(screen.getByText(/Du ser inte gruppens ärenden, bara de som gruppen har gett dig\./)).toBeInTheDocument();
  });

  it("⛔ ett fel vid hämtningen ger fliken med felet, inte en flik som saknas", async () => {
    const m = apiMed({ arenden: async () => ({ ok: false, orsak: "for-manga" }) });
    rita(m);
    const flik = await screen.findByRole("tab", { name: "Ärenden" });
    await valjFlik(flik);
    expect(await screen.findByText("Ärendena kunde inte hämtas just nu.")).toBeInTheDocument();
    expect(screen.queryByText("Inga ärenden ligger hos dig just nu.")).toBeNull();
  });

  it("ärendena ritas i fliken, och en kommentar anropar kommenteraArende med ärendets id och läggs in i listan", async () => {
    const m = apiMed();
    rita(m);
    await valjFlik(await screen.findByRole("tab", { name: "Ärenden" }));
    const kort = await screen.findByRole("article", { name: "Bygg scenen" });
    fireEvent.change(within(kort).getByRole("textbox", { name: /Skriv en kommentar/ }), { target: { value: "Nu är det gjort" } });
    await klicka(within(kort).getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(m.api.kommenteraArende).toHaveBeenCalledWith({ arendeId: "a-1", text: "Nu är det gjort" }));
    expect(await within(kort).findByText("Nu är det gjort")).toBeInTheDocument();
    expect(within(kort).getAllByText("Du").length).toBeGreaterThan(0);
    // Ingen ny hämtning behövdes för att visa kommentaren.
    expect(m.api.arenden).toHaveBeenCalledTimes(1);
  });

  it("Markera klar anropar markeraArendeKlart och hämtar om listan, så att statusen är serverns och knappen försvinner", async () => {
    const m = apiMed();
    rita(m);
    await valjFlik(await screen.findByRole("tab", { name: "Ärenden" }));
    const kort = await screen.findByRole("article", { name: "Bygg scenen" });
    await klicka(within(kort).getByRole("button", { name: "Markera klar" }));
    await klicka(within(kort).getByRole("button", { name: "Ja, markera klart" }));
    await waitFor(() => expect(m.api.markeraArendeKlart).toHaveBeenCalledWith({ arendeId: "a-1" }));
    await waitFor(() => expect(m.api.arenden).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("article", { name: "Bygg scenen" }).getAttribute("data-status")).toBe("hanterad"));
    expect(within(screen.getByRole("article", { name: "Bygg scenen" })).queryByRole("button", { name: "Markera klar" })).toBeNull();
  });

  it("⛔ ett nej på ett ärende är tvetydigt: sidan blir INTE 'återkallad' om listan visar att åtkomsten finns, men gästen får veta att ärendet flyttat; är åtkomsten borta säger sidan till", async () => {
    const onNekad = vi.fn();
    const m = apiMed({ markeraArendeKlart: async () => ({ ok: false, orsak: "nej" }) });
    rita(m, { onNekad });
    await valjFlik(await screen.findByRole("tab", { name: "Ärenden" }));
    let kort = await screen.findByRole("article", { name: "Bygg scenen" });
    await klicka(within(kort).getByRole("button", { name: "Markera klar" }));
    await klicka(within(kort).getByRole("button", { name: "Ja, markera klart" }));
    // Åtkomsten finns (arenden svarar ok), så onNekad anropas aldrig och felet står under ärendet.
    expect(await screen.findByText("Ärendet ligger inte längre hos dig, eller är redan klart.")).toBeInTheDocument();
    expect(onNekad).not.toHaveBeenCalled();
    expect(m.api.arenden).toHaveBeenCalledTimes(2);
    // Nu är sessionen borta: åtgärdens nej följs av listans nej, och DEN säger till sidan.
    m.api.arenden.mockResolvedValue({ ok: false, orsak: "aterkallad" });
    kort = screen.getByRole("article", { name: "Bygg scenen" });
    await klicka(within(kort).getByRole("button", { name: "Ja, markera klart" }));
    await waitFor(() => expect(onNekad).toHaveBeenCalledWith("aterkallad"));
  });

  it("⛔ försvinner det sista ärendet vid en ny hämtning försvinner fliken och vyn hoppar till första fliken", async () => {
    const m = apiMed({ poster: [POSTER[0]] });
    rita(m);
    await valjFlik(await screen.findByRole("tab", { name: "Ärenden" }));
    await screen.findByRole("article", { name: "Bygg scenen" });
    m.api.arenden.mockResolvedValue({ ok: true, poster: [], avkortad: false });
    const kort = screen.getByRole("article", { name: "Bygg scenen" });
    m.api.markeraArendeKlart.mockResolvedValue({ ok: true });
    await klicka(within(kort).getByRole("button", { name: "Markera klar" }));
    await klicka(within(kort).getByRole("button", { name: "Ja, markera klart" }));
    await waitFor(() => expect(screen.queryByRole("tab", { name: "Ärenden" })).toBeNull());
    expect(screen.getByRole("tab", { name: "Chatt" })).toHaveAttribute("aria-selected", "true");
  });

  it("⛔ en gäst som kommenterar får servern fel (för många anrop) utskrivet under fältet, och sidan säger inte att åtkomsten är borta", async () => {
    const onNekad = vi.fn();
    const m = apiMed({ kommenteraArende: async () => ({ ok: false, orsak: "for-manga" }) });
    rita(m, { onNekad });
    await valjFlik(await screen.findByRole("tab", { name: "Ärenden" }));
    const kort = await screen.findByRole("article", { name: "Bygg scenen" });
    fireEvent.change(within(kort).getByRole("textbox", { name: /Skriv en kommentar/ }), { target: { value: "För mycket" } });
    await klicka(within(kort).getByRole("button", { name: "Skicka" }));
    expect(await within(kort).findByText("För många anrop. Vänta en stund och försök igen.")).toBeInTheDocument();
    expect(onNekad).not.toHaveBeenCalled();
    expect(within(kort).getByRole("textbox", { name: /Skriv en kommentar/ })).toHaveValue("För mycket");
  });
});

describe("OpsMottagare med gäster och byggArendemottagare", () => {
  const medlemmar = [
    { userId: "u1", namn: "Agda Ägare", typ: "person", status: "aktiv" },
    { userId: "u2", namn: "Maja Medlem", typ: "person", status: "aktiv" },
  ];
  const gaster = [{ gastId: ANNA, namn: "Anna" }, { gastId: BO }];

  it("gästerna står sist i ärendeläget med märket Gäst, och valet ger { slag: gast, gastId, namn } som byggArendemottagare godtar", async () => {
    const onChange = vi.fn();
    render(<OpsMottagare medlemmar={medlemmar} uid="u1" value={null} onChange={onChange} gaster={gaster} />);
    const rader = screen.getAllByRole("radio");
    expect(rader.map(namnPa)).toEqual(["Gruppen", "Agda Ägare (du)", "Maja Medlem", "Anna", "Gäst"]);
    expect(rader[3].querySelector("[data-gast-markning]").textContent).toBe("Gäst");
    await klicka(rader[3]);
    expect(onChange).toHaveBeenCalledWith({ slag: "gast", gastId: ANNA, namn: "Anna" });
    expect(byggArendemottagare(onChange.mock.calls[0][0], { gaster })).toEqual({ slag: "gast", gastId: ANNA, namn: "Anna" });
    // En gäst utan namn väljs som "Gäst".
    await klicka(rader[4]);
    expect(onChange).toHaveBeenLastCalledWith({ slag: "gast", gastId: BO, namn: "Gäst" });
  });

  it("den valda gästen markeras, och en annan gästs rad är inte vald", () => {
    render(<OpsMottagare medlemmar={medlemmar} uid="u1" value={{ slag: "gast", gastId: ANNA, namn: "Anna" }} onChange={() => {}} gaster={gaster} />);
    const [, , , anna, bo] = screen.getAllByRole("radio");
    expect(anna).toHaveAttribute("aria-checked", "true");
    expect(bo).toHaveAttribute("aria-checked", "false");
    for (const r of screen.getAllByRole("radio").slice(0, 3)) expect(r).toHaveAttribute("aria-checked", "false");
  });

  it("⛔ utan gaster finns inga gästrader, i personläget ritas aldrig en gäst, och ett id som inte är en gäst filtreras bort", () => {
    const { rerender } = render(<OpsMottagare medlemmar={medlemmar} uid="u1" value={null} onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(document.querySelector("[data-gast-markning]")).toBeNull();
    rerender(<OpsMottagare lage="person" medlemmar={medlemmar} uid="u1" value={null} onChange={() => {}} gaster={gaster} />);
    expect(screen.getAllByRole("radio").map(namnPa)).toEqual(["Maja Medlem"]);
    rerender(<OpsMottagare medlemmar={medlemmar} uid="u1" value={null} onChange={() => {}} gaster={[{ gastId: "uid-123", namn: "En medlem" }, { gastId: ANNA, namn: "Anna" }]} />);
    expect(screen.getAllByRole("radio").map(namnPa)).toEqual(["Gruppen", "Agda Ägare (du)", "Maja Medlem", "Anna"]);
  });

  it("byggArendemottagare: som byggMottagare plus slaget gast, och ett MEDDELANDE kan fortfarande inte få en gäst som mottagare", () => {
    expect(byggArendemottagare({ slag: "grupp" })).toEqual({ slag: "grupp" });
    expect(byggArendemottagare({ slag: "person", uid: "u1" }, { medlemmar })).toEqual({ slag: "person", uid: "u1" });
    expect(byggArendemottagare({ slag: "gast", gastId: ANNA, namn: "Anna" })).toEqual({ slag: "gast", gastId: ANNA, namn: "Anna" });
    expect(() => byggArendemottagare({ slag: "gast", gastId: ANNA }, { gaster: [{ gastId: BO }] })).toThrow(/ingen levande gruppinbjudan/);
    expect(() => byggArendemottagare({ slag: "person", uid: "u9" }, { medlemmar })).toThrow(/inte en aktiv medlem/);
    expect(() => byggMottagare({ slag: "gast", gastId: ANNA, namn: "Anna" })).toThrow(/slaget "gast" finns inte/);
  });
});

describe("OpsGastMottagare: gästen som ansvarig, så som medlemmarna ser den", () => {
  const m = { slag: "gast", gastId: ANNA, namn: "Anna" };

  it("en levande gäst: namnet och märket Gäst", () => {
    render(<OpsGastMottagare mottagare={m} levande={[{ gastId: ANNA, namn: "Anna" }]} />);
    const el = document.querySelector(`[data-gast-mottagare='${ANNA}']`);
    expect(el.getAttribute("data-aterkallad")).toBe("false");
    expect(el.textContent).toBe("AnnaGäst");
  });

  it("⛔ en gäst som saknas bland de levande: märket 'Gäst (inbjudan återkallad)', med namnet från ärendet", () => {
    render(<OpsGastMottagare mottagare={m} levande={[{ gastId: BO, namn: "Bo" }]} />);
    const el = document.querySelector(`[data-gast-mottagare='${ANNA}']`);
    expect(el.getAttribute("data-aterkallad")).toBe("true");
    expect(el.textContent).toBe("AnnaGäst (inbjudan återkallad)");
  });

  it("⛔ utan levande-listan är det okänt och märket är bara Gäst, aldrig återkallad", () => {
    render(<OpsGastMottagare mottagare={m} />);
    const el = document.querySelector(`[data-gast-mottagare='${ANNA}']`);
    expect(el.getAttribute("data-aterkallad")).toBe("okand");
    expect(el.textContent).toBe("AnnaGäst");
    expect(el.textContent).not.toMatch(/återkallad/);
  });

  it("en annan mottagare än en gäst ger ingenting, utanNamn ritar bara märket, och engelska", () => {
    const { container, rerender } = render(<OpsGastMottagare mottagare={{ slag: "person", uid: "u1" }} />);
    expect(container.innerHTML).toBe("");
    rerender(<OpsGastMottagare mottagare={null} />);
    expect(container.innerHTML).toBe("");
    rerender(<OpsGastMottagare mottagare={m} levande={[]} utanNamn />);
    expect(container.textContent).toBe("Gäst (inbjudan återkallad)");
    rerender(<OpsGastMottagare mottagare={m} levande={[]} sprak="en" />);
    expect(container.textContent).toBe("AnnaGuest (invitation withdrawn)");
  });
});
