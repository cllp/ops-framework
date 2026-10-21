import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsPlatsfiler } from "../components/OpsPlatsfiler.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { handelseBibliotek } from "../lib/bibliotek.js";

/**
 * Köra om och ta bort en utskrift på en händelses fil (0.133.0, lifehub.app#349): `OpsPlatsfiler` vidarebefordrar `onSkrivUtIgen` och `onTaBortUtskrift` till `OpsBibliotek`,
 * som den gör med `onSkrivUt`. Ett ljud på en händelse har en utskrift som ett ljud i gruppens bibliotek.
 */

const GRUPP = "travel";
const PLATS = handelseBibliotek(GRUPP, "h1");
const KIM = { uid: "uid-kim", roll: "medlem", groupId: GRUPP, status: "aktiv" };
const tid = 1_700_000_000_000;

function bygg() {
  const post = {
    id: "p1",
    groupId: PLATS,
    typ: "fil",
    rubrik: "Kupletten",
    fil: { sokvag: `grupper/${PLATS}/bibliotek/p1/p1.webm`, namn: "p1.webm", mime: "audio/webm", byte: 2048, klar: true },
    utskrift: "Vers ett",
    skapadAv: { uid: KIM.uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" },
    skapad: tid,
    andrad: tid,
  };
  return createBibliotekskalla({
    source: createMemorySource({ bibliotek: [post] }),
    collection: "bibliotek",
    groupId: PLATS,
    skapare: () => post.skapadAv,
    jag: () => KIM,
    anteckna: () => {},
    lagring: { laddaUpp: vi.fn(async () => {}) },
    sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
  });
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function oppna(extra = {}) {
  render(<OpsPlatsfiler kalla={bygg()} jag={KIM} kanLaggaTill filUrl={() => "https://exempel.se/p1.webm"} {...extra} />);
  fireEvent.click(await screen.findByRole("button", { name: "Kupletten" }));
  await screen.findByText("Vers ett");
}

describe("OpsPlatsfiler: utskriftens val når OpsBibliotek", () => {
  it("⛔ med propparna syns Skriv ut igen och Ta bort utskriften, och de anropas med id och PLATSEN som grupp", async () => {
    const onSkrivUtIgen = vi.fn(async () => {});
    const onTaBortUtskrift = vi.fn(async () => {});
    await oppna({ onSkrivUtIgen, onTaBortUtskrift });
    expect(screen.getByRole("button", { name: "Skriv ut igen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ta bort utskriften" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ta bort utskriften" }));
    await waitFor(() => expect(onTaBortUtskrift).toHaveBeenCalledWith({ id: "p1", groupId: PLATS }));
    expect(onSkrivUtIgen).not.toHaveBeenCalled();
  });

  it("⛔ utan propparna syns inga val", async () => {
    await oppna();
    expect(screen.queryByRole("button", { name: "Skriv ut igen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ta bort utskriften" })).toBeNull();
  });
});
