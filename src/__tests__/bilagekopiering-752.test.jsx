import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { KopieraBilagaKnapp, OpsBilagekopiering, TIDSGRANS_KOPIERING_MS } from "../components/BilageKopiering.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla, kopieraBilagaTillPlats } from "../data/bibliotekkalla.js";
import { platsBibliotek } from "../lib/bibliotek.js";

/**
 * Kopiera en bilaga till en plats: vad som pågår, och en tidsgräns (0.213.0, cllp/lifehub.app#752).
 *
 * CP 2026-11-10 från sin iPhone: knappen Kopiera snurrade utan att säga något, och "den första tog väldigt lång tid". Dialogen väntade på appen utan gräns.
 *
 * ⛔ RÖTT UTAN RÄTTNINGEN (regel 4): mot 0.212.1 ger `kopieraBilagaTillPlats` inga steg, dialogen visar inget läge, och en kopiering som aldrig svarar
 * lämnar knappen upptagen för alltid utan ett ord. Utfallen står i ändringsloggen.
 */

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const bild = () => ({ dataUrl: PNG, namn: "kvitto.png", typ: "image/png", tecken: PNG.length });
const PLATSER = [{ id: "g", namn: "Gruppens bibliotek" }];

afterEach(() => {
  vi.useRealTimers();
});

describe("kopieraBilagaTillPlats rapporterar stegen", () => {
  it("förbereder, posten, filen med andel och det sista steget, i den ordningen", async () => {
    const lagen = [];
    const k = createBibliotekskalla({
      source: createMemorySource({}),
      collection: "bibliotek",
      groupId: platsBibliotek("cps-ab", "demos"),
      skapare: () => ({ uid: "anna", namn: "Anna", typ: "manniska", kalla: "bibliotek" }),
      lagring: {
        laddaUpp: async (/** @type {any} */ i) => {
          i.rapportera?.(0.25);
          i.rapportera?.(1);
          return { url: "minne://x", sokvag: i.sokvag };
        },
        taBort: async () => {},
      },
      sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
    });
    const post = await kopieraBilagaTillPlats({ bilaga: bild(), till: k, rapportera: (l) => lagen.push(l) });
    expect(post.fil.klar).toBe(true);
    expect(lagen).toEqual([
      { steg: "forbereder" },
      { steg: "post" },
      { steg: "fil" },
      { steg: "fil", andel: 0.25 },
      { steg: "fil", andel: 1 },
      { steg: "klar" },
    ]);
  });
});

function rita(onKopiera) {
  render(
    <OpsBilagekopiering platser={PLATSER} onKopiera={onKopiera}>
      <KopieraBilagaKnapp bilaga={bild()} />
    </OpsBilagekopiering>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Kopiera till en plats/ }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Kopiera" }));
  return dialog;
}

describe("dialogen visar vad som pågår", () => {
  it("steget och andelen uppladdat står i dialogen medan appen arbetar", async () => {
    /** @type {(l: any) => void} */
    let rapportera = () => {};
    /** @type {() => void} */
    let klar = () => {};
    const dialog = rita(({ rapportera: r }) => {
      rapportera = r;
      return new Promise((ok) => {
        klar = () => ok(undefined);
      });
    });
    const lage = () => /** @type {HTMLElement} */ (dialog.querySelector("[data-bilaga-kopiering-lage]"));
    await waitFor(() => expect(lage()).toHaveTextContent("Kopierar…"));
    act(() => rapportera({ steg: "post" }));
    expect(lage()).toHaveTextContent("Skapar posten i Biblioteket…");
    act(() => rapportera({ steg: "fil", andel: 0.42 }));
    expect(lage()).toHaveTextContent("Laddar upp, 42 %");
    act(() => rapportera({ steg: "klar" }));
    expect(lage()).toHaveTextContent("Gör klart…");
    await act(async () => klar());
    expect(await screen.findByText("Kopierad till Gruppens bibliotek.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("⛔ tidsgränsen: ingen tyst snurra (regel 5)", () => {
  it("en kopiering som inte svarar säger det efter tidsgränsen, och knappen slutar snurra", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const dialog = rita(() => new Promise(() => {}));
    const kopiera = () => within(dialog).getByRole("button", { name: /Kopiera|Försök igen/ });
    await waitFor(() => expect(kopiera()).toHaveAttribute("aria-busy", "true"));
    act(() => vi.advanceTimersByTime(TIDSGRANS_KOPIERING_MS - 1000));
    expect(within(dialog).queryByRole("alert")).toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(`Kopieringen har inte kommit vidare på ${TIDSGRANS_KOPIERING_MS / 1000} sekunder`);
    expect(kopiera()).toHaveTextContent("Försök igen");
    expect(kopiera()).not.toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Avbryt" })).not.toBeDisabled();
  });

  it("tidsgränsen räknas från senaste tecknet på liv, och en sen lyckad kopiering ger kvittot", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    /** @type {(l: any) => void} */
    let rapportera = () => {};
    /** @type {() => void} */
    let klar = () => {};
    const dialog = rita(({ rapportera: r }) => {
      rapportera = r;
      return new Promise((ok) => {
        klar = () => ok(undefined);
      });
    });
    act(() => vi.advanceTimersByTime(TIDSGRANS_KOPIERING_MS - 1000));
    act(() => rapportera({ steg: "fil", andel: 0.5 }));
    act(() => vi.advanceTimersByTime(TIDSGRANS_KOPIERING_MS - 1000));
    expect(within(dialog).queryByRole("alert")).toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();
    await act(async () => klar());
    expect(await screen.findByText("Kopierad till Gruppens bibliotek.")).toBeInTheDocument();
  });
});
