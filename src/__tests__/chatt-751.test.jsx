import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden, OpsSamtal } from "../components/OpsMeddelanden.jsx";
import { OpsMarkdown } from "../components/OpsMarkdown.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { MAX_BILAGENAMN } from "../lib/handelsemodell.js";

/**
 * Chattens bilagor och omnämnanden (0.213.0, cllp/lifehub.app#751, QA 2026-11-10 på live v1.0.1159, dator 1280 px).
 *
 *   1. Bifoga bild en andra gång ersatte den första utan ett ord. Modellen bär EN bilaga per meddelande, så nu sägs det, och den första står kvar.
 *   2. En giltig PNG stod som "Bilagan går inte att visa." Texten stod för tre saker (läsningen föll, filen syntes inte än, filen var ogiltig) och alla tre var
 *      för alltid. Nu läses de två första om, och står felet kvar säger raden det med "Försök igen". Det som inte går att skicka sägs redan vid valet.
 *   3. En vald @-nämning blev ren text i bubblan, och ett mellanslag hamnade före kolonet.
 *
 * ⛔ RÖTT UTAN RÄTTNINGEN (regel 4): utfallen mot 0.212.1 står i ändringsloggen.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];
const namnFor = (/** @type {string} */ uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const bild = (extra = {}) => ({ dataUrl: PNG, namn: "kvitto.png", typ: "image/png", tecken: PNG.length, ...extra });

afterEach(() => {
  vi.useRealTimers();
});

async function samtal() {
  let t = 1_700_000_000_000;
  const s = /** @type {any} */ (createSamtalskalla({ kalla: createMemorySource({}), klocka: () => (t += 1000), bilagor: true, bilagaSamling: "bilagor", omnamnanden: true }));
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  return { s, p };
}

const valjFil = (/** @type {File} */ fil) => {
  fireEvent.click(screen.getByRole("button", { name: "Bifoga" }));
  fireEvent.change(/** @type {HTMLInputElement} */ (document.querySelector('[data-plusval="fil"]')), { target: { files: [fil] } });
};

describe("1. en bilaga per meddelande, och det sägs", () => {
  it("⛔ ett andra val ersätter inte det första: beskedet står, den första ligger kvar och är den som skickas", async () => {
    const { s, p } = await samtal();
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    valjFil(new File(["png"], "forsta.png", { type: "image/png" }));
    expect(await screen.findByRole("button", { name: "Ta bort bilagan" })).toBeInTheDocument();
    valjFil(new File(["png"], "andra.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ett meddelande bär en bilaga. Skicka den här först, eller ta bort den och välj en annan.");
    const utkast = /** @type {HTMLElement} */ (document.querySelector("[data-bilageutkast]"));
    expect(within(utkast).getByRole("img").getAttribute("alt")).toMatch(/forsta\.png/);
    expect(within(utkast).queryByAltText(/andra\.png/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(async () => expect((await s.meddelanden(p.id)).at(-1)?.bilaga?.namn).toBe("forsta.png"));
  });

  it("⛔ en fil som inte går att skicka sägs vid valet, inte efter Skicka", async () => {
    const { s, p } = await samtal();
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    valjFil(new File(["hej"], `${"a".repeat(MAX_BILAGENAMN + 1)}.txt`, { type: "text/plain" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(`bilagans namn ska vara 1 till ${MAX_BILAGENAMN} tecken`);
    expect(screen.queryByRole("button", { name: "Ta bort bilagan" })).toBeNull();
  });
});

/** En källa vars `lasBilaga` först svarar som `forst` och sedan som den riktiga. */
async function samtalMedBilaga(/** @type {(n: number) => "fel" | "tom" | "ratt"} */ svar) {
  const { s, p } = await samtal();
  await s.skicka(p.id, { text: "Se här", av: "bo", bilaga: bild() });
  let n = 0;
  const riktig = s.lasBilaga.bind(s);
  const kalla = {
    ...s,
    lasBilaga: async (/** @type {any[]} */ ...a) => {
      n += 1;
      const vad = svar(n);
      if (vad === "fel") throw new Error("Failed to get document because the client is offline.");
      if (vad === "tom") return null;
      return riktig(...a);
    },
  };
  return { kalla: /** @type {any} */ (kalla), p, antal: () => n };
}

describe("2. ett glapp är inte en trasig fil", () => {
  it("⛔ en läsning som faller läses om, och bilden visas", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { kalla, p, antal } = await samtalMedBilaga((n) => (n === 1 ? "fel" : "ratt"));
    render(<OpsSamtal kalla={kalla} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    await screen.findByText("Se här");
    await act(async () => vi.advanceTimersByTime(1100));
    await waitFor(() => expect(document.querySelector('[data-meddelande-bilaga="bild"]')).not.toBeNull());
    expect(document.querySelector('[data-meddelande-bilaga="trasig"]')).toBeNull();
    expect(antal()).toBe(2);
  });

  it("⛔ en fil som inte syns än (null) läses om, och bilden visas", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { kalla, p } = await samtalMedBilaga((n) => (n === 1 ? "tom" : "ratt"));
    render(<OpsSamtal kalla={kalla} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    await screen.findByText("Se här");
    await act(async () => vi.advanceTimersByTime(1100));
    await waitFor(() => expect(document.querySelector('[data-meddelande-bilaga="bild"]')).not.toBeNull());
  });

  it("⛔ en läsning som faller hela tiden säger det, med Försök igen, och Försök igen läser om", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    let laget = /** @type {"fel" | "ratt"} */ ("fel");
    const { kalla, p, antal } = await samtalMedBilaga(() => laget);
    render(<OpsSamtal kalla={kalla} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    await screen.findByText("Se här");
    await act(async () => vi.advanceTimersByTime(1100));
    await act(async () => vi.advanceTimersByTime(3100));
    const rad = await waitFor(() => /** @type {HTMLElement} */ (document.querySelector('[data-meddelande-bilaga="fel"]')));
    expect(rad).toHaveTextContent("Bilagan kunde inte hämtas.");
    expect(document.querySelector('[data-meddelande-bilaga="trasig"]')).toBeNull();
    expect(antal()).toBe(3);
    // Felet når felrapporterna (konsolen alltid), med vilket meddelande det gällde.
    expect(fel.mock.calls.some((c) => JSON.stringify(c).includes("bilaga"))).toBe(true);
    laget = "ratt";
    fireEvent.click(within(rad).getByRole("button", { name: "Försök igen" }));
    await waitFor(() => expect(document.querySelector('[data-meddelande-bilaga="bild"]')).not.toBeNull());
    fel.mockRestore();
  });

  it("en ogiltig fil säger fortfarande att den inte går att visa, utan omförsök", async () => {
    const { s, p } = await samtal();
    await s.skicka(p.id, { text: "Se här", av: "bo", bilaga: bild() });
    let n = 0;
    const kalla = /** @type {any} */ ({ ...s, lasBilaga: async () => { n += 1; return { ...bild(), tecken: 3 }; } });
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<OpsSamtal kalla={kalla} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    await waitFor(() => expect(document.querySelector('[data-meddelande-bilaga="trasig"]')).toHaveTextContent("Bilagan går inte att visa."));
    expect(n).toBe(1);
    fel.mockRestore();
  });
});

describe("3. en vald nämning syns som nämning", () => {
  it("⛔ @Namn i ett meddelande som nämner personen ritas som ett omnämnande, också en API-agent och @alla", async () => {
    const kalla = createMemorySource({});
    const s = /** @type {any} */ (createSamtalskalla({ kalla, omnamnanden: true }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    await s.skicka(g.id, { text: "@Bo Lind: kan du titta?", av: "anna", namner: ["bo"] });
    await s.skicka(g.id, { text: "@claude-dev-ops-architect : granska", av: "anna", namner: ["k_claude"] });
    await s.skicka(g.id, { text: "@alla möte", av: "bo", namner: ["alla"] });
    await s.skicka(g.id, { text: "@Bo Lind utan namner är ren text", av: "anna" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} flerOmnamnbara={[{ userId: "k_claude", namn: "claude-dev-ops-architect", typ: "agent" }]} />);
    await screen.findByText(/utan namner/);
    const markerade = [...document.querySelectorAll("[data-bubbla] [data-omnamnande-i-text]")].map((e) => e.textContent);
    expect(markerade).toEqual(["@Bo Lind", "@claude-dev-ops-architect", "@alla"]);
    // Texten runt omnämnandet står kvar som den skrevs.
    const forsta = /** @type {HTMLElement} */ ([...document.querySelectorAll("[data-bubbla] [data-omnamnande-i-text]")][0]);
    expect(forsta.closest("p")?.textContent).toBe("@Bo Lind: kan du titta?");
  });

  it("bara fria @Namn: inte inne i ett längre ord eller en adress", () => {
    render(<OpsMarkdown chatt text={"@Bo och @Bonita, mejla bo@Bo.se"} omnamnanden={["Bo"]} />);
    expect([...document.querySelectorAll("[data-omnamnande-i-text]")].map((e) => e.textContent)).toEqual(["@Bo"]);
  });

  it("⛔ inget mellanslag före ett skiljetecken direkt efter ett valt namn, och nämningen skickas", async () => {
    const kalla = createMemorySource({});
    const s = /** @type {any} */ (createSamtalskalla({ kalla, omnamnanden: true }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const ruta = /** @type {HTMLTextAreaElement} */ (await screen.findByRole("textbox", { name: "Skriv ett meddelande" }));
    fireEvent.change(ruta, { target: { value: "Hej @bo", selectionStart: 7 } });
    await screen.findByRole("listbox", { name: "Nämn någon" });
    fireEvent.keyDown(ruta, { key: "Enter" });
    expect(ruta.value).toBe("Hej @Bo Lind ");
    fireEvent.change(ruta, { target: { value: "Hej @Bo Lind :", selectionStart: 14 } });
    expect(ruta.value).toBe("Hej @Bo Lind:");
    // Ett ord efter mellanslaget lämnas som det är.
    fireEvent.change(ruta, { target: { value: "Hej @Bo Lind: titta", selectionStart: 19 } });
    expect(ruta.value).toBe("Hej @Bo Lind: titta");
    fireEvent.keyDown(ruta, { key: "Enter" });
    await waitFor(async () => {
      const rader = await kalla.list(`samtal/${g.id}/meddelanden`);
      expect(rader.find((/** @type {any} */ r) => r.text.startsWith("Hej"))).toMatchObject({ text: "Hej @Bo Lind: titta", namner: ["bo"] });
    });
  });
});
