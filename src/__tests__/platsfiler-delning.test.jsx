import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsHandelsefiler } from "../components/OpsHandelsefiler.jsx";
import { OpsPlatsfiler } from "../components/OpsPlatsfiler.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { handelseBibliotek } from "../lib/bibliotek.js";

/**
 * Dela länk från en händelses filer (0.127.0): gruppdelen når dialogen.
 *
 * ⛔ HÄNDELSEN. `OpsPlatsfiler` vidarebefordrade inte `delningGruppdel` till `OpsBibliotek`, och platsen (`handelse~<grupp>~<händelse>`) bär inget gruppnamn.
 * En fil som delades från en händelsepanel fick därför ramverkets reserv "grupp" som gruppdel. En gruppdel tillhör den första plats som tar den för alltid:
 * den första gruppen som delade något därifrån fick ordet, och varje annan grupp fick "används av en annan grupp".
 *
 * Varje prov har setts falla (regel 4): rött med `OpsPlatsfiler` och `foreslaAdress` från origin/main, grönt med grenen. Utfallen står i PR-texten.
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
    rubrik: "Biljett Selma",
    fil: { sokvag: `grupper/${PLATS}/bibliotek/p1/p1.pdf`, namn: "p1.pdf", mime: "application/pdf", byte: 2048, klar: true },
    skapadAv: { uid: KIM.uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" },
    skapad: tid,
    andrad: tid,
  };
  const kalla = createBibliotekskalla({
    source: createMemorySource({ bibliotek: [post] }),
    collection: "bibliotek",
    groupId: PLATS,
    skapare: () => post.skapadAv,
    jag: () => KIM,
    anteckna: () => {},
    lagring: { laddaUpp: vi.fn(async () => {}) },
    sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
  });
  return kalla;
}

async function oppnaDialog(extra = {}, Komponent = OpsPlatsfiler) {
  const onDelaLank = vi.fn(async () => ({ id: "d1", url: "https://my.test/g/x" }));
  const kalla = bygg();
  render(
    <Komponent
      kalla={kalla}
      jag={KIM}
      kanLaggaTill
      onDelaLank={onDelaLank}
      onAndraNedladdning={vi.fn(async () => {})}
      onAterkalla={vi.fn(async () => {})}
      {...extra}
    />,
  );
  // Källan levererar först och prenumererar sedan: en omritning mellan klicket och läsningen stänger menyn. Klicka igen bara medan den är stängd.
  await waitFor(() => {
    if (!screen.queryByRole("menuitem", { name: "Dela länk" })) fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Biljett Selma" }));
    expect(screen.getByRole("menuitem", { name: "Dela länk" })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("menuitem", { name: "Dela länk" }));
  const dialog = await screen.findByRole("dialog", { name: "Dela länk" });
  return { dialog, onDelaLank };
}

const gruppdelFalt = (/** @type {HTMLElement} */ dialog) => within(dialog).getByRole("textbox", { name: "Gruppens del av adressen" });

describe("OpsPlatsfiler: gruppdelen i Dela länk", () => {
  it("⛔ delningGruppdel når dialogen och är det som skickas", async () => {
    const { dialog, onDelaLank } = await oppnaDialog({ delningGruppdel: "travel-ab", gruppnamn: "Travel" });
    expect(gruppdelFalt(dialog)).toHaveValue("travel-ab");
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(onDelaLank).toHaveBeenCalledTimes(1));
    expect(onDelaLank.mock.calls[0][0]).toMatchObject({ postId: "p1", gruppdel: "travel-ab" });
  });

  it("⛔ utan en gruppdel hos platsen kommer förslaget ur gruppens namn (foreslaAdress), inte ur ett fast ord", async () => {
    const { dialog, onDelaLank } = await oppnaDialog({ gruppnamn: "Travel Åre" });
    expect(gruppdelFalt(dialog)).toHaveValue("travel-are");
    expect(dialog.querySelector("[data-delalank-forhandsvisning]")?.textContent).toMatch(/^Adressen blir: \/g\/travel-are\/lib\//);
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(onDelaLank).toHaveBeenCalledTimes(1));
    expect(onDelaLank.mock.calls[0][0].gruppdel).toBe("travel-are");
  });

  it("⛔ delningGruppdel vinner över namnet, som i det fristående Biblioteket", async () => {
    const { dialog } = await oppnaDialog({ delningGruppdel: "resor", gruppnamn: "Travel" });
    expect(gruppdelFalt(dialog)).toHaveValue("resor");
  });

  it("⛔ varken gruppdel eller namn: fältet är tomt och ingen länk skapas med ett påhittat ord", async () => {
    const { dialog, onDelaLank } = await oppnaDialog();
    expect(gruppdelFalt(dialog)).toHaveValue("");
    expect(dialog.textContent).not.toMatch(/\/g\/grupp\//);
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    expect(await within(dialog).findByText(/Adressen kan inte vara tom/)).toBeInTheDocument();
    expect(onDelaLank).not.toHaveBeenCalled();
    // Personen kan skriva gruppdelen själv, och då går det att skapa.
    fireEvent.change(gruppdelFalt(dialog), { target: { value: "Egen Del" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skapa länk" }));
    await waitFor(() => expect(onDelaLank).toHaveBeenCalledTimes(1));
    expect(onDelaLank.mock.calls[0][0].gruppdel).toBe("egen-del");
  });

  it("OpsHandelsefiler (slaget låst till händelse) vidarebefordrar samma två propar", async () => {
    const { dialog } = await oppnaDialog({ delningGruppdel: "travel-ab" }, OpsHandelsefiler);
    expect(gruppdelFalt(dialog)).toHaveValue("travel-ab");
  });
});
