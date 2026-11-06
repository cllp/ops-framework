import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/**
 * Samma tillåtna meny i listan och i detaljen, innan posten öppnats (lifehub.app#673).
 *
 * QA 2026-11-06, live v1.0.1125, gäst i Skarv:
 * - Oklart.Edit1: listan hade bara Kommentera före första öppning, och Kommentera plus Kopiera länk i detaljen och efter tillbaka.
 * - Andas.Edit2: listan hade bara Kommentera både före och efter, detaljen hade båda. Att ha varit inne ändrade inte listan.
 *
 * Båda är samma fel: listan och detaljen ska ha samma val, och valet ska inte bero på att adressen redan hämtats.
 * Nedladdning av ger ingen Kopiera länk, varken före eller efter, eftersom adressen är filen.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };

/** @param {string} id @param {string} rubrik @param {string} namn @param {string} mime */
function fil(id, rubrik, namn, mime) {
  return {
    ...byggPost({
      groupId: "skarv",
      typ: "fil",
      rubrik,
      fil: { sokvag: `grupper/skarv/bibliotek/${id}/${namn}`, namn, mime, byte: 1200, klar: true },
      skapadAv: skapare,
      skapad: tid,
      andrad: tid,
    }),
    id,
  };
}

const LJUD = fil("andas", "Andas.Edit2", "andas.wav", "audio/wav");
const DOKUMENT = fil("avtal", "Avtal.pdf", "avtal.pdf", "application/pdf");
const LANK = {
  ...byggPost({ groupId: "skarv", typ: "lank", rubrik: "Noterna", url: "https://exempel.se/not", skapadAv: skapare, skapad: tid, andrad: tid }),
  id: "not",
};
const PAGAENDE = {
  ...byggPost({
    groupId: "skarv",
    typ: "fil",
    rubrik: "Halv",
    fil: { sokvag: "grupper/skarv/bibliotek/halv/halv.wav", namn: "halv.wav", mime: "audio/wav", byte: 10, klar: false },
    skapadAv: skapare,
    skapad: Date.now(),
    andrad: Date.now(),
  }),
  id: "halv",
};

const kommentarer = {
  async las() {
    return { rader: [] };
  },
  async kommentera() {
    return {};
  },
};

/**
 * @param {{ utanNedladdning?: boolean, poster?: readonly any[], hamta?: (sokvag: string) => Promise<string> }} [p]
 */
function Sida({ utanNedladdning = false, poster = [LJUD, DOKUMENT, LANK, PAGAENDE], hamta = async (sokvag) => `https://filer.exempel.se/${sokvag}` } = {}) {
  const [vald, setVald] = useState(/** @type {any} */ (null));
  return (
    <OpsBibliotek
      poster={poster}
      jag={null}
      vald={vald}
      onOppna={setVald}
      onStang={() => setVald(null)}
      onSkapa={() => {}}
      onSpara={async () => false}
      hamtaAdress={hamta}
      adresserPaBegaran
      utanHubb
      utanNedladdning={utanNedladdning}
      kommentarer={kommentarer}
    />
  );
}

/** @param {string} rubrik Rubriken, eller början av den. Ett dokument tappar filändelsen i listan. */
function oppnaMeny(rubrik) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`Åtgärder för ${rubrik}`) }));
  return within(screen.getByRole("menu")).getAllByRole("menuitem").map((r) => (r.textContent ?? "").trim());
}

function stangMeny() {
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
}

beforeEach(() => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

describe("samma bibliotekmeny före och efter öppning (#673)", () => {
  it("⛔ ljud och dokument har Kommentera och Kopiera länk i listan innan någon post öppnats, och samma val i detaljen", async () => {
    const hamta = vi.fn(async (sokvag) => `https://filer.exempel.se/${sokvag}`);
    const { unmount } = render(<Sida hamta={hamta} />);
    expect(hamta, "listan hämtar ingen adress i förväg").not.toHaveBeenCalled();

    const ljudFore = oppnaMeny("Andas.Edit2");
    expect(ljudFore).toEqual(["Kommentera", "Kopiera länk"]);
    stangMeny();
    const dokFore = oppnaMeny("Avtal");
    expect(dokFore).toEqual(["Kommentera", "Kopiera länk"]);
    stangMeny();

    fireEvent.click(screen.getByRole("button", { name: "Andas.Edit2" }));
    await waitFor(() => expect(hamta).toHaveBeenCalled());
    const ljudDetalj = oppnaMeny("Andas.Edit2");
    expect(ljudDetalj).toEqual(ljudFore);
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));

    const ljudEfter = oppnaMeny("Andas.Edit2");
    expect(ljudEfter).toEqual(ljudFore);
    stangMeny();
    expect(oppnaMeny("Avtal")).toEqual(dokFore);
    stangMeny();

    // Andas.Edit2 i QA: listan efter tillbaka saknade Kopiera länk fast detaljen hade den. En ny ritning utan cachad adress ska ändå ha samma meny.
    unmount();
    render(<Sida hamta={hamta} />);
    expect(oppnaMeny("Andas.Edit2")).toEqual(ljudFore);
  });

  it("⛔ Kopiera länk i listan hämtar adressen först vid tryck, och skriver den", async () => {
    const hamta = vi.fn(async () => "https://filer.exempel.se/andas.wav");
    render(<Sida hamta={hamta} />);
    oppnaMeny("Andas.Edit2");
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
    await waitFor(() => expect(hamta).toHaveBeenCalledWith(LJUD.fil.sokvag));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://filer.exempel.se/andas.wav"));
  });

  it("⛔ nedladdning av: varken listan eller detaljen har Kopiera länk, och en länkpost har den ändå", async () => {
    const hamta = vi.fn(async (sokvag) => `https://filer.exempel.se/${sokvag}`);
    render(<Sida utanNedladdning hamta={hamta} />);
    expect(oppnaMeny("Andas.Edit2")).toEqual(["Kommentera"]);
    stangMeny();
    fireEvent.click(screen.getByRole("button", { name: "Andas.Edit2" }));
    await screen.findByRole("button", { name: "Tillbaka" });
    expect(oppnaMeny("Andas.Edit2")).toEqual(["Kommentera"]);
    fireEvent.click(screen.getByRole("button", { name: "Tillbaka" }));
    expect(oppnaMeny("Noterna")).toEqual(["Kommentera", "Kopiera länk"]);
  });

  it("⛔ en uppladdning som inte är klar har ingen Kopiera länk, i listan och i detaljen", () => {
    render(<Sida />);
    expect(oppnaMeny("Halv")).toEqual(["Kommentera"]);
    stangMeny();
    fireEvent.click(screen.getByRole("button", { name: "Halv" }));
    expect(oppnaMeny("Halv")).toEqual(["Kommentera"]);
  });
});
