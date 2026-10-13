import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { MAX_TAGGAR, MAX_TAGGLANGD, TAGGFORM, allaTaggar, byggPost, filtreraBibliotek, normaliseraTaggar, postFel, taggarFel } from "../lib/bibliotek.js";
import { bibliotekregelfragment } from "../lib/regler.js";

/**
 * ⛔ TAGGAR I BIBLIOTEKET (0.100.0, lifehub.app#214 och #226).
 *
 * CP 2026-10-13: "Precis som i sessionstudio skall man kunna tagga artefakter så att det blir lättare att filtrera och hitta sina
 * saker även om det är mkt." Och om långtrycket: "Man ska kunna hålla inne fingret ... och få upp menyn om att ändra namn eller ta
 * bort". Taggarna ligger därför i samma meny som Byt namn, och filtret är en rad under sökfältet.
 *
 * Proven mäter modellen (formen, taket, dubbletterna), källan (en borttagen sista tagg försvinner ur dokumentet) och vyn (filtret,
 * menyn och rutan). Att regeln säger samma sak som modellen mäts i `rules/__tests__/bibliotek.test.mjs` mot emulatorn.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const post = (/** @type {string} */ id, /** @type {string} */ rubrik, /** @type {string[] | undefined} */ taggar, andrad = tid) => ({
  ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik, text: "Text.", skapadAv: skapare, skapad: tid, andrad, ...(taggar ? { taggar } : {}) }),
  id,
});

describe("⛔ taggarnas modell", () => {
  it("skrivs om till gemener, utan # och med ett mellanslag, i den ordning de skrevs och utan dubbletter", () => {
    expect(normaliseraTaggar(["#Kvitto", "kvitto", "  Bil   2024 ", "", "BIL 2024"])).toEqual(["kvitto", "bil 2024"]);
    // ⛔ NFD (granskningen av PR 363): "år" som a plus kombinerande ring, som inklistrad text från macOS kan bära, blir "år" och går att spara.
    const nfd = "a\u030Ar";
    expect(nfd).not.toBe("år");
    expect(normaliseraTaggar([nfd])).toEqual(["år"]);
    expect(taggarFel(normaliseraTaggar([nfd]))).toBeNull();
  });

  it("formen, taket och dubbletterna: samma skäl som regeln prövar", () => {
    expect(taggarFel(["kvitto", "bil 2024", "år-2025", "école"])).toBeNull();
    expect(taggarFel([])).toBeNull();
    for (const fel of [["Bil"], [" bil"], ["bil "], ["-bil"], ["a".repeat(MAX_TAGGLANGD + 1)], ["bil/2024"], [3], ["kvitto", "kvitto"]]) {
      expect(taggarFel(fel), JSON.stringify(fel)).not.toBeNull();
    }
    expect(taggarFel(Array.from({ length: MAX_TAGGAR }, (_, i) => `t${i}`))).toBeNull();
    expect(taggarFel(Array.from({ length: MAX_TAGGAR + 1 }, (_, i) => `t${i}`))).toMatch(/Taket är 8/);
    expect(taggarFel("kvitto")).toMatch(/lista/);
    // Golv: längsta tillåtna går igenom, annars hade raden ovan varit grön för att inget går.
    expect(TAGGFORM.test("a".repeat(MAX_TAGGLANGD))).toBe(true);
  });

  it("en post sparas med taggarna normaliserade, och utan fältet när listan är tom", () => {
    expect(post("a", "Kvitto", ["#Kvitto", "Bil"]).taggar).toEqual(["kvitto", "bil"]);
    expect("taggar" in post("b", "Utan", [])).toBe(false);
    expect("taggar" in post("c", "Aldrig", undefined)).toBe(false);
    expect(postFel({ ...post("d", "Fel", undefined), taggar: ["Bil"] })).toMatch(/går inte att spara/);
  });

  it("filtret är OCH, sökningen läser taggarna, och gruppens taggar räknas ur posterna", () => {
    const poster = [post("a", "Tankning", ["kvitto", "bil"]), post("b", "Lunch", ["kvitto"]), post("c", "Protokoll", undefined)];
    expect(filtreraBibliotek(poster, { taggar: ["kvitto"] }).map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(filtreraBibliotek(poster, { taggar: ["kvitto", "bil"] }).map((p) => p.id)).toEqual(["a"]);
    expect(filtreraBibliotek(poster, { sok: "bil" }).map((p) => p.id)).toEqual(["a"]);
    // Den som söker skriver det raden visar, med # (granskningen av PR 363).
    expect(filtreraBibliotek(poster, { sok: "#bil" }).map((p) => p.id)).toEqual(["a"]);
    expect(filtreraBibliotek(poster, {}).length).toBe(3);
    expect(allaTaggar(poster)).toEqual([{ tagg: "kvitto", antal: 2 }, { tagg: "bil", antal: 1 }]);
  });

  it("regeln bär samma mönster och samma tak som modellen, en plats per tagg", () => {
    const text = bibliotekregelfragment("bibliotek");
    expect(text).toContain(`t.size() <= ${MAX_TAGGAR}`);
    expect(text).toContain("t.toSet().size() == t.size()");
    expect(text.match(/\|\| t\[\d\]\.matches\(/g)?.length).toBe(MAX_TAGGAR);
    expect(text).toContain('"taggar"');
  });
});

describe("⛔ taggarna i källan", () => {
  it("sparas, står kvar när något annat ändras, och försvinner ur dokumentet när sista taggen tas bort", async () => {
    const source = createMemorySource();
    const kalla = createBibliotekskalla({ source, collection: "bibliotek", groupId: "cps-ab", skapare: () => skapare });
    const ny = await kalla.spara({ typ: "anteckning", rubrik: "Tankning", text: "350 kr.", taggar: ["#Kvitto", "bil"] });
    expect((await source.read("bibliotek", ny.id))?.taggar).toEqual(["kvitto", "bil"]);
    await kalla.spara({ id: ny.id, rubrik: "Tankning Visby" });
    await kalla.spara({ id: ny.id, taggar: undefined });
    expect((await source.read("bibliotek", ny.id))?.taggar).toEqual(["kvitto", "bil"]);
    await kalla.spara({ id: ny.id, taggar: [] });
    const efter = await source.read("bibliotek", ny.id);
    // ⛔ FÄLTET ÄR BORTA, INTE TOMT OCH INTE KVAR. En uppdatering slår ihop, så utan FALT_BORT hade de gamla taggarna stått kvar.
    expect(efter && "taggar" in efter).toBe(false);
    expect(efter?.rubrik).toBe("Tankning Visby");
  });
});

/** Vyn med ett eget `onSpara` som skriver tillbaka i listan, som appen gör. */
function Harness({ start }) {
  const [poster, setPoster] = useState(start);
  return (
    <OpsBibliotek
      poster={poster}
      jag={{ uid: "uid-1", roll: "medlem" }}
      vald={null}
      skapar={null}
      onOppna={() => {}}
      onStang={() => {}}
      onSkapa={() => {}}
      onSpara={async (/** @type {any} */ inmatning) => {
        setPoster((/** @type {any[]} */ nu) => nu.map((p) => (p.id === inmatning.id ? post(p.id, p.rubrik, inmatning.taggar) : p)));
      }}
      hubHref="/hub"
    />
  );
}

describe("⛔ taggarna i vyn", () => {
  it("raden under sökfältet filtrerar, och ett tryck till släpper", () => {
    render(<Harness start={[post("a", "Tankning", ["kvitto", "bil"]), post("b", "Lunch", ["kvitto"]), post("c", "Protokoll", undefined)]} />);
    const rad = screen.getByRole("group", { name: "Taggar" });
    const bil = within(rad).getByRole("button", { name: "#bil 1" });
    expect(within(rad).getByRole("button", { name: "#kvitto 2" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(bil);
    expect(bil).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tankning" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lunch" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Protokoll" })).toBeNull();
    fireEvent.click(bil);
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
  });

  it("utan taggar i gruppen ritas ingen rad, och raden visar postens taggar i texten", () => {
    const { unmount } = render(<Harness start={[post("c", "Protokoll", undefined)]} />);
    expect(screen.queryByRole("group", { name: "Taggar" })).toBeNull();
    unmount();
    render(<Harness start={[post("a", "Tankning", ["kvitto", "bil"])]} />);
    expect(screen.getByText(/#kvitto · #bil/)).toBeInTheDocument();
  });

  it("Taggar i ⋯ lägger till med Enter, föreslår gruppens andra, tar bort, och sparar", async () => {
    render(<Harness start={[post("a", "Tankning", ["kvitto"]), post("b", "Lunch", ["mat"])]} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Tankning" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Taggar" }));
    const ruta = await screen.findByRole("dialog", { name: "Taggar" });
    const falt = within(ruta).getByRole("textbox", { name: "Ny tagg" });
    fireEvent.change(falt, { target: { value: "#Bil" } });
    fireEvent.submit(falt.closest("form"));
    expect(within(ruta).getByText("#bil")).toBeInTheDocument();
    fireEvent.click(within(within(ruta).getByRole("group", { name: "Gruppens taggar" })).getByRole("button", { name: "#mat" }));
    fireEvent.click(within(ruta).getByRole("button", { name: "Ta bort taggen kvitto" }));
    fireEvent.click(within(ruta).getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Taggar" })).toBeNull());
    expect(screen.getByText(/#bil · #mat/)).toBeInTheDocument();
  });

  it("oförändrade taggar sparas inte: rutan stängs och posten flyttar inte överst (granskningen av PR 363)", async () => {
    let anrop = 0;
    render(
      <OpsBibliotek poster={[post("a", "Tankning", ["kvitto"])]} jag={{ uid: "uid-1", roll: "medlem" }} vald={null} skapar={null} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => { anrop += 1; }} hubHref="/hub" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Tankning" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Taggar" }));
    const ruta = await screen.findByRole("dialog", { name: "Taggar" });
    fireEvent.click(within(ruta).getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Taggar" })).toBeNull());
    expect(anrop).toBe(0);
  });

  it("ett förslag tömmer inte det personen håller på att skriva", async () => {
    render(<Harness start={[post("a", "Tankning", undefined), post("b", "Lunch", ["mat"])]} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Tankning" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Taggar" }));
    const ruta = await screen.findByRole("dialog", { name: "Taggar" });
    fireEvent.change(within(ruta).getByRole("textbox", { name: "Ny tagg" }), { target: { value: "kvi" } });
    fireEvent.click(within(within(ruta).getByRole("group", { name: "Gruppens taggar" })).getByRole("button", { name: "#mat" }));
    expect(within(ruta).getByRole("textbox", { name: "Ny tagg" })).toHaveValue("kvi");
  });

  it("en tagg som inte går att spara säger varför, och rutan står kvar", async () => {
    render(<Harness start={[post("a", "Tankning", undefined)]} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Tankning" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Taggar" }));
    const ruta = await screen.findByRole("dialog", { name: "Taggar" });
    expect(within(ruta).getByText("Posten har inga taggar.")).toBeInTheDocument();
    fireEvent.change(within(ruta).getByRole("textbox", { name: "Ny tagg" }), { target: { value: "bil/2024" } });
    fireEvent.click(within(ruta).getByRole("button", { name: "Lägg till" }));
    expect(within(ruta).getByRole("alert")).toHaveTextContent(/går inte att spara/);
  });

  it("en annan medlem får ingen Taggar i menyn", () => {
    render(
      <OpsBibliotek poster={[post("a", "Tankning", ["kvitto"])]} jag={{ uid: "uid-annan", roll: "medlem" }} vald={null} skapar={null} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Tankning" }));
    expect(screen.getByRole("menuitem", { name: "Öppna" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Taggar" })).toBeNull();
  });
});
