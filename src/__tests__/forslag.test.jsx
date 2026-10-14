import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsForslag } from "../components/OpsForslag.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { forslagUrData, kontrolleraForslag, MAX_FORSLAG } from "../lib/forslag.js";

/*
 * Agentens förslag som knappar (0.105.0). CP 2026-10-14: agenten svarade på ett "ja gör det" med en lista över spärrens ord. Förslaget
 * CP godkände: en åtgärd agenten vill göra visas som en knapp under svaret, och trycket är personens begäran. Och sedan "Kör chatten":
 * knapparna står under agentens svar i chatten (`OpsMeddelanden`).
 */

const FORSLAG = [{ id: "f1", etikett: "Skapa ärendet: Fakturan saknas", ikon: /** @type {const} */ ("arende"), text: "Fakturan från mars har inte kommit." }];
const vanta = () => act(async () => {});

/** Ett löfte appen avgör själv. */
function utestaende() {
  /** @type {(v: any) => void} */
  let losa = () => {};
  /** @type {(e: any) => void} */
  let avvisa = () => {};
  const p = new Promise((a, b) => {
    losa = a;
    avvisa = b;
  });
  return { p, losa, avvisa };
}

describe("OpsForslag", () => {
  it("⛔ en knapp per förslag med etiketten, förhandsvisningen under och ett namn på gruppen", () => {
    render(<OpsForslag forslag={FORSLAG} onForslag={vi.fn()} />);
    const grupp = screen.getByRole("group", { name: "Förslag från agenten" });
    expect(within(grupp).getByRole("button", { name: "Skapa ärendet: Fakturan saknas" })).toBeTruthy();
    expect(within(grupp).getByText("Fakturan från mars har inte kommit.")).toBeTruthy();
  });

  it("⛔ ett tryck är ett anrop: dubbelklick ger ett, och efter Klart gör knappen ingenting mer", async () => {
    const svar = utestaende();
    const onForslag = vi.fn(() => svar.p);
    render(<OpsForslag forslag={FORSLAG} onForslag={onForslag} />);
    const knapp = screen.getByRole("button", { name: /Skapa ärendet/ });
    fireEvent.click(knapp);
    fireEvent.click(knapp);
    await vanta();
    expect(onForslag).toHaveBeenCalledTimes(1);
    expect(onForslag).toHaveBeenCalledWith("f1");
    expect(knapp).toHaveAttribute("aria-busy", "true");
    // ⛔ aria-disabled och inte disabled: fokus stannar på knappen.
    expect(knapp).toHaveAttribute("aria-disabled", "true");
    expect(knapp).not.toBeDisabled();
    await act(async () => svar.losa({ utfall: "ok", text: "Skapat: Fakturan saknas" }));
    expect(screen.getByRole("status").textContent).toBe("Skapat: Fakturan saknas");
    fireEvent.click(knapp);
    await vanta();
    expect(onForslag).toHaveBeenCalledTimes(1);
  });

  it("⛔ ett nej sägs, och knappen går inte att trycka igen", async () => {
    const onForslag = vi.fn(async () => ({ utfall: /** @type {const} */ ("nekad"), text: "Förslaget är redan använt." }));
    render(<OpsForslag forslag={FORSLAG} onForslag={onForslag} />);
    fireEvent.click(screen.getByRole("button", { name: /Skapa ärendet/ }));
    await vanta();
    expect(screen.getByRole("status").textContent).toBe("Förslaget är redan använt.");
    fireEvent.click(screen.getByRole("button", { name: /Skapa ärendet/ }));
    await vanta();
    expect(onForslag).toHaveBeenCalledTimes(1);
  });

  it("⛔ ett fel sägs och går att försöka igen, eftersom inget gjordes", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onForslag = vi.fn().mockRejectedValueOnce(new Error("Ingen kontakt med servern.")).mockResolvedValue({ utfall: "ok" });
      render(<OpsForslag forslag={FORSLAG} onForslag={onForslag} />);
      fireEvent.click(screen.getByRole("button", { name: /Skapa ärendet/ }));
      await vanta();
      expect(screen.getByRole("status").textContent).toBe("Ingen kontakt med servern.");
      fireEvent.click(screen.getByRole("button", { name: /Skapa ärendet/ }));
      await vanta();
      expect(onForslag).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("status").textContent).toBe("Klart");
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ ett svar med fel form från appen är ett fel, inte ett Klart", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<OpsForslag forslag={FORSLAG} onForslag={async () => /** @type {any} */ ("ja")} />);
      fireEvent.click(screen.getByRole("button", { name: /Skapa ärendet/ }));
      await vanta();
      expect(screen.getByRole("status").textContent).toMatch(/onForslag ska lösa till/);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ stängt API: fel form på förslagen och okända props kastar", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<OpsForslag forslag={[{ id: "", etikett: "x" }]} onForslag={vi.fn()} />)).toThrow(/id ska vara/);
      expect(() => render(<OpsForslag forslag={[{ id: "a", etikett: "x", ikon: /** @type {any} */ ("raket") }]} onForslag={vi.fn()} />)).toThrow(/ikon ska vara en av/);
      expect(() => render(<OpsForslag forslag={FORSLAG} onForslag={/** @type {any} */ (null)} />)).toThrow(/onForslag ska vara en funktion/);
      expect(() => render(<OpsForslag forslag={FORSLAG} onForslag={vi.fn()} {.../** @type {any} */ ({ className: "x" })} />)).toThrow(/okända props className/);
      expect(() => kontrolleraForslag([...FORSLAG, ...FORSLAG], "prov")).toThrow(/två gånger/);
      expect(() => kontrolleraForslag(Array.from({ length: MAX_FORSLAG + 1 }, (_, i) => ({ id: `f${i}`, etikett: "x" })), "prov")).toThrow(/högst/);
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ data ur databasen kastar inte: det som inte håller hoppas över och sägs", () => {
    const { forslag, fel } = forslagUrData([FORSLAG[0], { id: "x" }, { id: "f1", etikett: "igen" }]);
    expect(forslag).toEqual(FORSLAG);
    expect(fel).toHaveLength(2);
    expect(forslagUrData("trasigt").fel).toHaveLength(1);
    expect(forslagUrData(undefined)).toEqual({ forslag: [], fel: [] });
  });
});

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

/** Chatten med agenten: personens fråga och agentens svar med ett förslag, och en persons meddelande med samma fält. */
async function chatten(/** @type {Record<string, any>} */ props = {}) {
  const kalla = createMemorySource({});
  const s = /** @type {any} */ (createSamtalskalla({ kalla }));
  const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
  await kalla.create(`samtal/${a.id}/meddelanden`, { id: "m1", text: "ja gör det", av: "anna", tid: 1000, forslag: [{ id: "falsk", etikett: "Personens falska förslag" }] });
  await kalla.create(`samtal/${a.id}/meddelanden`, { id: "m1-agent", text: "Jag kan skapa ärendet åt dig.", av: "ops", tid: 2000, forslag: [...FORSLAG, { id: "trasig" }] });
  render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} {...props} />);
  await within(await screen.findByRole("log")).findByText("Jag kan skapa ärendet åt dig.");
  return { sid: a.id };
}

describe("förslagen i chatten", () => {
  it("⛔ under agentens svar står knapparna, och ett tryck ger appen samtalet, meddelandet och förslaget", async () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onForslag = vi.fn(async () => ({ utfall: /** @type {const} */ ("ok"), text: "Skapat" }));
      const { sid } = await chatten({ onForslag });
      const knapp = screen.getByRole("button", { name: "Skapa ärendet: Fakturan saknas" });
      expect(screen.getByText("Fakturan från mars har inte kommit.")).toBeTruthy();
      // ⛔ En persons meddelande med fältet `forslag` får inga knappar: ett förslag lägger agenten fram.
      expect(screen.queryByRole("button", { name: "Personens falska förslag" })).toBeNull();
      // Det trasiga förslaget hoppades över och rapporterades.
      expect(konsol.mock.calls.map((c) => c.map(String).join(" ")).join("\n")).toContain("förslag i meddelandet hoppades över");
      fireEvent.click(knapp);
      await vanta();
      expect(onForslag).toHaveBeenCalledTimes(1);
      expect(onForslag).toHaveBeenCalledWith({ sid, mid: "m1-agent", id: "f1" });
    } finally {
      konsol.mockRestore();
    }
  });

  it("⛔ utan onForslag ritas inga knappar", async () => {
    await chatten();
    expect(screen.queryByRole("button", { name: /Skapa ärendet/ })).toBeNull();
    expect(document.querySelector("[data-ops-forslag]")).toBeNull();
  });

  it("⛔ nyttUtkast står i fältet när läget nytt öppnas, och ingenting skickas", async () => {
    const kalla = createMemorySource({});
    const s = /** @type {any} */ (createSamtalskalla({ kalla }));
    const skicka = vi.fn((/** @type {any[]} */ ...x) => s.skicka(...x));
    render(<OpsMeddelanden kalla={{ ...s, skicka }} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} nytt nyttUtkast="Boka rep med bandet" />);
    await vanta();
    expect(/** @type {HTMLTextAreaElement} */ (screen.getByDisplayValue("Boka rep med bandet"))).toBeTruthy();
    expect(skicka).not.toHaveBeenCalled();
  });
});
