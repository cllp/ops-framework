import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsDeladHandelse } from "../components/OpsDeladHandelse.jsx";
import { OpsGastLista } from "../components/OpsGastLista.jsx";
import { OpsGastSida } from "../components/OpsGastSida.jsx";
import { GASTDELTASVAR, GASTFEL } from "../lib/gast.js";

/**
 * Gästens sida för en händelse, och medlemmens lista med svaret (0.146.0, cllp/ops-framework#445, skiva 1). jsdom mäter att rätt text och rätt knappar finns och att anropen går rätt; hur det SER UT mäts inte här
 * utan i skärmbilden (`scripts/delta-montage.mjs`, 390 px).
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött utan ändringen (sidan ritar ingen delta-händelse), och för vakterna rött med koden muterad. Utfallen står i PR-texten.
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
const SESSION = "S".repeat(43);

const HANDELSE = { titel: "Möte", plats: "Salen, Visby", datum: "2026-12-02", slutDatum: null, tid: "18:00", slutTid: "20:00", heldag: false };
const delta = (mitt = null, handelse = HANDELSE) => ({ ok: true, namn: "", funktion: "delta", delta: { handelse, mitt } });

describe("OpsGastSida: en händelse att svara på (delta)", () => {
  const lagringMed = () => {
    const d = { "ops-gast:senaste": ID, [`ops-gast:${ID}`]: SESSION };
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; } };
  };
  const rita = (props = {}) => {
    const onHamta = props.onHamta ?? vi.fn(async () => delta());
    const onSvara = "onSvara" in props ? props.onSvara : vi.fn(async ({ val }) => ({ ok: true, mitt: val }));
    const utf = render(
      <OpsGastSida lank={null} onLos={vi.fn()} onHamta={onHamta} onNyLank={vi.fn()} onSvara={onSvara} intervallMs={0} {...props} lagring={lagringMed()} />,
    );
    return { ...utf, onHamta, onSvara };
  };
  const klicka = async (el) => {
    await act(async () => {
      fireEvent.click(el);
    });
  };

  it("visar rubrik, dag, klockslag och plats, frågan och tre knappar, och innan svar står det att gästen inte svarat (tomt är ett svar)", async () => {
    rita();
    expect(await screen.findByRole("heading", { level: 1, name: "Möte" })).toBeInTheDocument();
    expect(document.querySelector("[data-dh-datum]").textContent).toBe("ons 2 dec 2026");
    expect(document.querySelector("[data-dh-klockslag]").textContent).toBe("18:00 - 20:00");
    expect(document.querySelector("[data-dh-plats]").textContent).toContain("Salen, Visby");
    expect(screen.getByRole("heading", { level: 2, name: "Kommer du?" })).toBeInTheDocument();
    const grupp = screen.getByRole("group", { name: "Kommer du?" });
    expect(within(grupp).getAllByRole("button").map((b) => b.textContent)).toEqual(["Jag kommer", "Kan inte", "Kanske"]);
    expect(screen.getByRole("status")).toHaveTextContent("Du har inte svarat än.");
    expect(document.querySelector("[data-gast-delta-svarat]").getAttribute("data-gast-delta-svarat")).toBe("");
  });

  it("⛔ inget annat än händelsen: ingen beskrivning, ingen grupp, ingen omröstning, och inga knappar utöver tre", async () => {
    const onHamta = vi.fn(async () => ({ ...delta(), beskrivning: "HEMLIG-BESKRIVNING", grupp: { namn: "HEMLIG-GRUPP" }, sak: { titel: "HEMLIGT-FORSLAG" } }));
    rita({ onHamta });
    await screen.findByRole("heading", { level: 1, name: "Möte" });
    const kropp = document.body.textContent;
    for (const hemligt of ["HEMLIG-BESKRIVNING", "HEMLIG-GRUPP", "HEMLIGT-FORSLAG"]) expect(kropp, hemligt).not.toContain(hemligt);
    expect(document.querySelectorAll("[data-gast-delta-knappar] button")).toHaveLength(3);
  });

  it("varje knapp anropar onSvara med sessionsnyckeln och sitt värde, och efteråt står det vad som svarades och knappen är vald", async () => {
    const { onSvara } = rita();
    await screen.findByRole("heading", { level: 1, name: "Möte" });
    const ord = { kommer: "Jag kommer", kommerInte: "Kan inte", kanske: "Kanske" };
    const rad = { kommer: "Du har svarat: Jag kommer.", kommerInte: "Du har svarat: Kan inte.", kanske: "Du har svarat: Kanske." };
    for (const val of GASTDELTASVAR) {
      await klicka(screen.getByRole("button", { name: ord[val] }));
      await waitFor(() => expect(onSvara).toHaveBeenLastCalledWith({ sessionsnyckel: SESSION, val }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(rad[val]));
      // Den valda knappen är den fyllda och bär det i sitt namn; de andra två är det inte.
      expect(screen.getByRole("button", { name: `${ord[val]}, valt` })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /, valt$/ })).toHaveLength(1);
    }
    expect(onSvara).toHaveBeenCalledTimes(3);
  });

  it("ett svar som redan finns står där från början, och servern har sista ordet: svaret som kom tillbaka gäller", async () => {
    rita({ onHamta: vi.fn(async () => delta("kanske")) });
    expect(await screen.findByText("Du har svarat: Kanske.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kanske, valt" })).toBeInTheDocument();
  });

  it("⛔ ett svar som inte sparades står som ett fel vid knapparna, och knapparna är tryckbara igen utan att något ser besvarat ut", async () => {
    const onSvara = vi.fn(async () => {
      throw new Error("nätet");
    });
    rita({ onSvara });
    await screen.findByRole("heading", { level: 1, name: "Möte" });
    await klicka(screen.getByRole("button", { name: "Jag kommer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Det gick inte just nu. Försök igen.");
    expect(screen.getByRole("status")).toHaveTextContent("Du har inte svarat än.");
    for (const b of document.querySelectorAll("[data-gast-delta-knappar] button")) expect(b).not.toBeDisabled();
  });

  it("ett nekande svar utan skäl är ett fel och sparar ingenting i vyn", async () => {
    rita({ onSvara: vi.fn(async () => ({ ok: false, orsak: "for-manga" })) });
    await screen.findByRole("heading", { level: 1, name: "Möte" });
    await klicka(screen.getByRole("button", { name: "Kan inte" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Det gick inte just nu");
    expect(screen.getByRole("status")).toHaveTextContent("Du har inte svarat än.");
  });

  it("⛔ en återkallad inbjudan under svaret: sidan hämtar om och byts mot beskedet, inte mot ett fel vid knapparna", async () => {
    const onHamta = vi.fn().mockResolvedValueOnce(delta()).mockResolvedValue({ ok: false, orsak: "aterkallad" });
    rita({ onHamta, onSvara: vi.fn(async () => ({ ok: false, orsak: "aterkallad" })) });
    await screen.findByRole("heading", { level: 1, name: "Möte" });
    await klicka(screen.getByRole("button", { name: "Jag kommer" }));
    expect(await screen.findByText(GASTFEL.aterkallad)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jag kommer" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("knappen väntar medan svaret skrivs (verbet står i den), de andra två är spärrade, och ett andra tryck gör ingenting", async () => {
    let klart;
    const onSvara = vi.fn(() => new Promise((res) => { klart = () => res({ ok: true, mitt: "kommer" }); }));
    rita({ onSvara });
    await screen.findByRole("heading", { level: 1, name: "Möte" });
    await klicka(screen.getByRole("button", { name: "Jag kommer" }));
    const knappar = [...document.querySelectorAll("[data-gast-delta-knappar] button")];
    expect(knappar[0]).toHaveAttribute("aria-busy", "true");
    expect(knappar[0].textContent).toContain("Sparar…");
    expect(knappar[1]).toBeDisabled();
    expect(knappar[2]).toBeDisabled();
    await klicka(knappar[0]);
    expect(onSvara).toHaveBeenCalledTimes(1);
    await act(async () => { klart(); });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Du har svarat: Jag kommer."));
    for (const b of document.querySelectorAll("[data-gast-delta-knappar] button")) expect(b).not.toBeDisabled();
  });

  it("engelska: rubrikens ord, frågan, knapparna och raden är engelska, och rubriken är händelsens egen", async () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-GB");
    rita({ onHamta: vi.fn(async () => delta("kommerInte")) });
    expect(await screen.findByRole("heading", { level: 1, name: "Möte" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Are you coming?" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Are you coming?" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["I'm coming", "Can't make it", "Maybe"]);
    expect(screen.getByRole("status")).toHaveTextContent("You answered: Can't make it.");
    expect(document.querySelector("[data-dh-datum]").textContent).toBe("Wed 2 Dec 2026");
    expect(document.querySelector("[data-dh-tid]").getAttribute("aria-label")).toBe("When and where");
  });

  it("en händelse över flera dagar, en heldag och en utan datum ritas med sin dag, och utan datum står det", async () => {
    const { unmount } = rita({ onHamta: vi.fn(async () => delta(null, { ...HANDELSE, datum: "2026-12-30", slutDatum: "2027-01-02", tid: null, slutTid: null, heldag: true, plats: null })) });
    await screen.findByRole("heading", { level: 1, name: "Möte" });
    expect(document.querySelector("[data-dh-datum]").textContent).toContain("ons 30 dec 2026");
    expect(document.querySelector("[data-dh-datum]").textContent).toContain("lör 2 jan 2027");
    expect(document.querySelector("[data-dh-klockslag]").textContent).toBe("Heldag");
    expect(document.querySelector("[data-dh-plats]")).toBeNull();
    unmount();
    rita({ onHamta: vi.fn(async () => delta(null, { ...HANDELSE, datum: null, slutDatum: null, tid: null, slutTid: null })) });
    await screen.findByRole("heading", { level: 1, name: "Möte" });
    expect(document.querySelector("[data-dh-datum]").textContent).toBe("Datum ej satt");
  });

  it("utan onSvara visas inbjudan inte (en text i stället för knappar som inte gör något), och onSvara som inte är en funktion kastar", async () => {
    rita({ onSvara: undefined });
    expect(await screen.findByText("Den här inbjudan går inte att visa i den här versionen av appen.")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-gast-delta-knappar] button")).toHaveLength(0);
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsGastSida lank={null} onLos={() => {}} onHamta={() => {}} onNyLank={() => {}} onSvara="nej" />)).toThrow(/onSvara måste vara en funktion/);
    tyst.mockRestore();
  });

  it("⛔ rösta-sidan och rubriken vid adressfrågan är oförändrade i sak: omröstningens kort ritas av appen och delta ritar inte det", async () => {
    const onHamta = vi.fn(async () => ({ ok: true, namn: "", funktion: "rosta", sak: { titel: "Rep" } }));
    rita({ onHamta, renderSak: ({ sak }) => <div data-sak="">{sak.titel}</div> });
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(document.querySelector("[data-gast-delta]")).toBeNull();
  });

  it("adressfrågan före inloggningen är neutral, för sidan vet ännu inte vad inbjudan gäller", async () => {
    render(<OpsGastSida lank={{ id: ID, nyckel: "N".repeat(43) }} onLos={vi.fn()} onHamta={vi.fn()} onNyLank={vi.fn()} onSvara={vi.fn()} lagring={null} />);
    const rubrik = await screen.findByRole("heading", { level: 1 });
    expect(rubrik).toHaveTextContent("Du är inbjuden");
    expect(rubrik.textContent).not.toMatch(/rösta/);
    expect(document.body.textContent).not.toMatch(/omröstningen/);
  });
});

describe("OpsDeladHandelse: rubriken är oförändrad efter att ha brutits ut", () => {
  it("rubrik, dag, klockslag och plats ritas med samma markering som förut", () => {
    render(<OpsDeladHandelse delning={{ titel: "Möte", beskrivning: "Vi ses", plats: "Salen", datum: "2026-12-02", slutDatum: null, tid: "18:00", slutTid: "20:00", filer: [] }} sprak="sv" />);
    expect(document.querySelector("h1[data-dh-titel]").textContent).toBe("Möte");
    expect(document.querySelector("section[data-dh-tid]").getAttribute("aria-label")).toBe("När och var");
    expect(document.querySelector("p[data-dh-datum]").textContent).toBe("ons 2 dec 2026");
    expect(document.querySelector("p[data-dh-klockslag]").textContent).toBe("18:00 - 20:00");
    expect(document.querySelector("p[data-dh-plats]").textContent).toBe("Plats: Salen");
  });
});

describe("OpsGastLista: en delta-inbjudan och vad gästen svarat", () => {
  const platser = { anvanda: 1, totalt: 5 };
  const person = (extra = {}) => ({
    gastId: "g_" + "1".repeat(40),
    epost: "anna@foretag.se",
    namn: "Anna",
    status: "inloggad",
    inbjudningar: [
      { id: "i1", omfang: { slag: "sak", funktion: "delta", handelseId: "h1" }, titel: "Möte", status: "inloggad", deltasvar: "kanske", ...extra },
      { id: "i2", omfang: { slag: "sak", funktion: "rosta", handelseId: "h2" }, titel: "Fika", status: "vantar" },
    ],
  });

  it("⛔ en delta-inbjudan heter inte Omröstning: den heter Svar på händelse, och svaret står som ett märke vid den, bara vid den", () => {
    render(<OpsGastLista personer={[person()]} platser={platser} />);
    const [delta, rosta] = document.querySelectorAll("[data-gast-inbjudan]");
    expect(within(delta).getByText("Svar på händelse: Möte")).toBeInTheDocument();
    expect(delta.querySelector("[data-gast-svar]").getAttribute("data-gast-svar")).toBe("kanske");
    expect(within(delta).getByText("Kanske")).toBeInTheDocument();
    expect(within(rosta).getByText("Omröstning: Fika")).toBeInTheDocument();
    expect(rosta.querySelector("[data-gast-svar]")).toBeNull();
  });

  it("alla fyra lägena har ett ord, också att gästen inte svarat (tomt är ett svar), och engelska följer språket", () => {
    const ord = { kommer: "Kommer", kommerInte: "Kommer inte", kanske: "Kanske", osvarat: "Har inte svarat" };
    for (const [nyckel, text] of Object.entries(ord)) {
      const { unmount } = render(<OpsGastLista personer={[person({ deltasvar: nyckel === "osvarat" ? null : nyckel })]} platser={platser} />);
      const svar = document.querySelector("[data-gast-inbjudan] [data-gast-svar]");
      expect(svar.getAttribute("data-gast-svar"), nyckel).toBe(nyckel);
      expect(svar.textContent, nyckel).toBe(text);
      unmount();
    }
    render(<OpsGastLista personer={[person({ deltasvar: "kommerInte" })]} platser={platser} sprak="en" />);
    expect(screen.getByText("Reply to event: Möte")).toBeInTheDocument();
    expect(screen.getByText("Not coming")).toBeInTheDocument();
  });

  it("i listan över en händelses gäster står svaret vid gästen, och en rad utan deltasvar har inget märke", () => {
    render(
      <OpsGastLista
        gaster={[
          { id: "g1", epost: "anna@foretag.se", namn: "", aterkallad: null, forstInloggad: 5, lankGiltigTill: 9, deltasvar: "kommer", status: "inloggad" },
          { id: "g2", epost: "bo@foretag.se", namn: "", aterkallad: null, forstInloggad: null, lankGiltigTill: 9, status: "vantar" },
        ]}
        platser={{ anvanda: 2, totalt: 5 }}
      />,
    );
    expect(document.querySelector('[data-gast="g1"] [data-gast-svar]').textContent).toBe("Kommer");
    expect(document.querySelector('[data-gast="g2"] [data-gast-svar]')).toBeNull();
  });
});
