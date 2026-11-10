import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { OpsGastLista } from "../components/OpsGastLista.jsx";
import { GASTGRUPPATGARDER, gastId } from "../lib/gast.js";
import { gastBehorighetsrader } from "../lib/gastBehorighet.js";

/**
 * Gästens vy och medlemmens lista för en gäst i ett projekt (0.215.0, cllp/lifehub.app#760 skiva 1). Samma vy som gruppgästens (`OpsGastGrupp`), med projektets kort på översikten,
 * orden om projektet, projektets egen chatt utan trådar (skiva 2) och ingen svarsrad. jsdom mäter text och knappar; hur det ser ut mäts inte här.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): mutationerna och utfallen står i PR-texten.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
});

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

const PROJEKT = {
  namn: "Ombyggnad av köket",
  // (skiva 2) Chatten är projektets egen: servern väljer samtalet ur inbjudan.
  funktioner: ["chatt", "kalender", "bibliotek", "arenden"],
  beskrivning: "",
  nedladdning: false,
  kommentera: false,
  projekt: {
    tagg: "koket",
    status: { sv: "Pågår", en: "In progress" },
    texter: [
      { rubrik: { sv: "Syfte", en: "Purpose" }, text: "Nytt kök före jul" },
      { rubrik: { sv: "Öppna frågor", en: "Open questions" }, text: "Vilken bänkskiva?" },
    ],
  },
};

const HANDELSE = { id: "h-koket", titel: "Snickaren kommer", beskrivning: null, plats: null, datum: "2026-11-12", slutDatum: null, tid: "08:00", slutTid: null, heldag: false, kalenderId: "kal-koket", kravSvar: true, ejSatt: false };

function apiMed(extra = {}) {
  const svar = {
    oversikt: async () => ({ ok: true, chatt: { nya: 0, fler: false, senaste: [] }, kalender: { nasta: { ...HANDELSE, mitt: null } }, bibliotek: { nya: 0, senaste: [], antal: 0, filer: 0, fler: false } }),
    kalender: async () => ({ ok: true, handelser: [HANDELSE], kalendrar: [], avkortad: false, ejVisade: 0 }),
    handelse: async () => ({ ok: true, handelse: HANDELSE }),
    bibliotek: async () => ({ ok: true, poster: [], avkortad: false }),
    arenden: async () => ({
      ok: true,
      avkortad: false,
      poster: [
        { id: "a1", rubrik: "Beställ luckor", text: "Vita", status: "ny", kommentarer: [], hosDig: false },
        { id: "a2", rubrik: "Mät väggen", text: "Före fredag", status: "ny", kommentarer: [], hosDig: true },
      ],
    }),
    ...extra,
  };
  return Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async (args) => (svar[a] ? svar[a](args ?? {}) : { ok: false, orsak: "nej" }))]));
}

const rita = (props = {}) => {
  const api = props.api ?? apiMed();
  const utf = render(<OpsGastGrupp grupp={PROJEKT} api={api} intervallMs={0} idag={new Date(2026, 10, 10)} {...props} />);
  return { ...utf, api };
};

describe("OpsGastGrupp för en projektgäst", () => {
  it("rubriken är projektets namn, översikten bär projektets kort, och Chatt-fliken är projektets", async () => {
    const { api } = rita();
    await waitFor(() => expect(api.arenden).toHaveBeenCalled());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ombyggnad av köket");
    expect(screen.getAllByRole("tab").map((f) => f.textContent)).toEqual(["Översikt", "Chatt", "Kalender", "Bibliotek", "Ärenden"]);
    expect(document.querySelector("[data-gast-roll]")).toHaveTextContent("Du är gäst i projektet.");
    const kort = document.querySelector("[data-gast-projektkort]");
    expect(kort).not.toBeNull();
    expect(kort.querySelector("[data-gast-projekt-lage]")).toHaveTextContent("Läge: Pågår");
    expect([...kort.querySelectorAll("[data-gast-projekt-text] h2")].map((h) => h.textContent)).toEqual(["Syfte", "Öppna frågor"]);
    expect(kort).toHaveTextContent("Nytt kök före jul");
    expect(document.querySelector("[data-gast-grupp-beskrivning]")).toBeNull();
    expect(document.querySelector('[data-gast-ruta="chatt"]')).not.toBeNull();
  });

  it("⛔ projektets chatt har ingen trådknapp: servern nekar trådar där, och en knapp som alltid nekas är död", async () => {
    const MEDDELANDE = { id: "k1", av: { namn: "Bo" }, text: "Kakel på onsdag?", tid: Date.UTC(2026, 10, 10, 9), gast: false, egen: false };
    const api = apiMed({ chatt: async () => ({ ok: true, meddelanden: [MEDDELANDE], fler: false }) });
    const forsta = rita({ api });
    await valjFlik(screen.getByRole("tab", { name: "Chatt" }));
    await screen.findByText("Kakel på onsdag?");
    expect(document.querySelectorAll("[data-tradrot]")).toHaveLength(0);
    forsta.unmount();
    // Gruppgästen med samma meddelande har knappen: provet mäter skillnaden, inte frånvaron av en knapp i allmänhet.
    rita({ api, grupp: { namn: "Källan", funktioner: ["chatt", "kalender", "bibliotek"], beskrivning: "" } });
    await valjFlik(screen.getByRole("tab", { name: "Chatt" }));
    await screen.findByText("Kakel på onsdag?");
    expect(document.querySelectorAll("[data-tradrot]").length).toBeGreaterThan(0);
  });

  it("en gruppgäst får inget projektkort, och har kvar sin Chatt-flik", () => {
    rita({ grupp: { namn: "Källan", funktioner: ["chatt", "kalender", "bibliotek"], beskrivning: "Vi övar på tisdagar." } });
    expect(document.querySelector("[data-gast-projektkort]")).toBeNull();
    expect(screen.getAllByRole("tab").map((f) => f.textContent)).toEqual(["Översikt", "Chatt", "Kalender", "Bibliotek"]);
    expect(document.querySelector("[data-gast-roll]")).toHaveTextContent("Du är gäst.");
  });

  it("kalenderrutan ber inte om svar, och händelsen ritas utan svarsrad (skiva 1)", async () => {
    const { api } = rita();
    await waitFor(() => expect(api.oversikt).toHaveBeenCalled());
    const ruta = await waitFor(() => {
      const r = document.querySelector('[data-gast-ruta="kalender"]');
      expect(r).toHaveTextContent("Snickaren kommer");
      return r;
    });
    expect(ruta).not.toHaveTextContent("Svara");
    await valjFlik(screen.getByRole("tab", { name: "Kalender" }));
    await klicka(await screen.findByRole("button", { name: "Snickaren kommer" }));
    await waitFor(() => expect(document.querySelector("[data-gast-handelse]")).not.toBeNull());
    expect(screen.queryByText("Svaren kunde inte hämtas.")).toBeNull();
    expect(screen.queryByRole("button", { name: /Kommer/ })).toBeNull();
  });

  it("ärendefliken heter projektets ärenden, och Markera klar finns bara på det som ligger hos gästen", async () => {
    rita();
    await valjFlik(await screen.findByRole("tab", { name: "Ärenden" }));
    await waitFor(() => expect(document.querySelectorAll("[data-gast-arende]")).toHaveLength(2));
    expect(screen.getByRole("region", { name: "Projektets ärenden" })).toBeInTheDocument();
    expect(document.querySelector("[data-gast-arenden-ingress]")).toHaveTextContent("Du ser projektets ärenden, inte gruppens andra.");
    expect(document.querySelector('[data-gast-arende="a1"] [data-gast-arende-klar]')).toBeNull();
    expect(document.querySelector('[data-gast-arende="a2"] [data-gast-arende-klar]')).not.toBeNull();
  });

  it("raderna om vad gästen kan göra säger projektet och lovar inga svar", () => {
    const rader = gastBehorighetsrader(PROJEKT, "sv");
    expect(rader).toContain("Du kan se vad som är på gång i projektet.");
    expect(rader).toContain("Du ser projektets ärenden och kan kommentera dem.");
    expect(rader).toContain("Du kan läsa och skriva i projektets chatt, från början. Gruppens egen chatt visas inte.");
    expect(rader.join(" ")).not.toMatch(/svara|i chatten/);
    expect(gastBehorighetsrader({ funktioner: ["kalender"] }, "sv")).toEqual(["Du kan se vad som är på gång och svara på händelser."]);
  });
});

describe("OpsGastLista på ett projekts sida", () => {
  const PER = gastId("per@extern.se");
  const person = { gastId: PER, epost: "per@extern.se", namn: "Per", status: "vantar", inbjudningar: [{ id: "i-p", omfang: { slag: "projekt", tagg: "koket" }, titel: null, status: "aterkallad", laddaNed: false }] };

  it("tomt säger projektet, och bjud in går via en bekräftelse som säger vad en projektgäst ser", async () => {
    const onBjudGrupp = vi.fn().mockResolvedValue(undefined);
    render(<OpsGastLista personer={[]} platser={{ anvanda: 2, totalt: 5 }} projekt={{ tagg: "koket" }} onBjudGrupp={onBjudGrupp} />);
    expect(screen.getByText("Inga gäster har bjudits in till projektet.")).toBeInTheDocument();
    expect(screen.getByText(/ser bara det här projektet/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "per@extern.se" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till projektet" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/alla ärenden med projektets tagg/)).toBeInTheDocument();
    expect(within(dialog).getByText(/inte gruppens chatt/)).toBeInTheDocument();
    // (skiva 2) Projektets egen chatt, aldrig gruppens med hela historiken.
    expect(within(dialog).getByText(/projektets egen chatt/)).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("ser gruppens chatt");
    await klicka(within(dialog).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(onBjudGrupp).toHaveBeenCalledWith({ epost: "per@extern.se", namn: "", laddaNed: false }));
  });

  it("en projektinbjudan heter Projekt: <tagg>, och Bjud in igen finns bara på projektets egen sida", () => {
    const { unmount } = render(<OpsGastLista personer={[person]} platser={{ anvanda: 0, totalt: 5 }} projekt={{ tagg: "koket" }} onBjudGrupp={() => {}} onAterkalla={() => {}} />);
    for (const b of document.querySelectorAll('[data-gast-vaxla][aria-expanded="false"]')) fireEvent.click(b);
    expect(screen.getAllByText("Projekt: koket").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Bjud in Per igen|Bjud in igen/ })).toBeInTheDocument();
    unmount();
    // På gruppens lista bjuder Bjud in igen in till hela gruppen, och ska därför inte stå på en projektrad.
    render(<OpsGastLista personer={[person]} platser={{ anvanda: 0, totalt: 5 }} onBjudGrupp={() => {}} onAterkalla={() => {}} />);
    for (const b of document.querySelectorAll('[data-gast-vaxla][aria-expanded="false"]')) fireEvent.click(b);
    expect(screen.queryByRole("button", { name: /Bjud in Per igen|Bjud in igen/ })).toBeNull();
  });

  it("projekt hör till gruppläget och kräver en tagg", () => {
    expect(() => render(<OpsGastLista gaster={[]} platser={{ anvanda: 0, totalt: 5 }} projekt={{ tagg: "koket" }} />)).toThrow(/gruppläget/);
    expect(() => render(<OpsGastLista personer={[]} platser={{ anvanda: 0, totalt: 5 }} projekt={{}} />)).toThrow(/tagg/);
  });
});
