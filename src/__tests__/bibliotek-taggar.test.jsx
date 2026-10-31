import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { MAX_TAGGAR, MAX_TAGGLANGD, TAGGFORM, allaTaggar, byggPost, filtreraBibliotek, normaliseraTaggar, postFel, taggarFel } from "../lib/bibliotek.js";
import { bibliotekregelfragment } from "../lib/regler.js";

/**
 * ⛔ TAGGAR I BIBLIOTEKET (0.100.0, lifehub.app#214 och #226).
 *
 * CP 2026-10-13: "Precis som i sessionstudio skall man kunna tagga artefakter så att det blir lättare att filtrera och hitta sina
 * saker även om det är mkt."
 *
 * ⛔ 0.102.0: taggarna ligger på kortet som i SessionStudio, inte i menyn. Taggrutan i ⋯ och raden med #tagg under sökfältet är
 * borta, och filtret är knappen Taggar bredvid sökfältet. Proven som gällde rutan prövar nu samma skydd på kortets taggrad: Enter
 * lägger till, förslagen, ta bort, oförändrat sparas inte, felet syns och taggarna går tillbaka, och den utan rätt kan inte ändra.
 *
 * Proven mäter modellen (formen, taket, dubbletterna), källan (en borttagen sista tagg försvinner ur dokumentet) och vyn (filtret
 * och kortets taggrad). Att regeln säger samma sak som modellen mäts i `rules/__tests__/bibliotek.test.mjs` mot emulatorn.
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

/**
 * Vyn med ett eget `onSpara` som skriver tillbaka i listan, som appen gör. `anrop` får varje inmatning, och `fel` gör att
 * sparandet avvisas med det felet (`false` betyder att källan svarar false).
 *
 * @param {{ start: any[], jag?: any, anrop?: any[], fel?: Error | false | null }} props
 */
function Harness({ start, jag = { uid: "uid-1", roll: "medlem" }, anrop = [], fel = null }) {
  const [poster, setPoster] = useState(start);
  return (
    <OpsBibliotek
      poster={poster}
      jag={jag}
      vald={null}
      skapar={null}
      onOppna={() => {}}
      onStang={() => {}}
      onSkapa={() => {}}
      onSpara={async (/** @type {any} */ inmatning) => {
        anrop.push(inmatning);
        if (fel === false) return false;
        if (fel) throw fel;
        setPoster((/** @type {any[]} */ nu) => nu.map((p) => (p.id === inmatning.id ? post(p.id, p.rubrik, inmatning.taggar) : p)));
        return undefined;
      }}
      hubHref="/hub"
    />
  );
}

/** Kortet för en post, ur listan. @param {string} rubrik */
const kortet = (rubrik) => /** @type {HTMLElement} */ (screen.getByRole("button", { name: rubrik }).closest("li"));
/** Taggarna på kortet, i ordning. @param {string} rubrik */
const taggarPa = (rubrik) => [...kortet(rubrik).querySelectorAll("[data-bibliotek-tagg]")].map((n) => n.getAttribute("data-bibliotek-tagg"));
/** Öppnar fältet "Ny tagg" på kortet. @param {string} rubrik */
function oppnaFalt(rubrik) {
  const k = kortet(rubrik);
  const knapp = within(k).queryByRole("button", { name: /^(Lägg till tagg|Tagg)$/ });
  if (knapp) fireEvent.click(knapp);
  else {
    // 0.165.0: utan taggar har kortet ingen taggrad; "Lägg till tagg" ligger i menyn och öppnar fältet direkt.
    fireEvent.click(within(k).getByRole("button", { name: `Åtgärder för ${rubrik}` }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Lägg till tagg" }));
  }
  return within(k).getByRole("textbox", { name: "Ny tagg" });
}

describe("⛔ taggförslagen med tangentbordet (#372)", () => {
  it("pil ned markerar ett förslag med aria-activedescendant, Enter väljer det, och fokus stannar i fältet", async () => {
    /** @type {any[]} */
    const anrop = [];
    render(<Harness start={[post("a", "Tankning", ["kvitto"]), post("b", "Lunch", ["mat", "middag"])]} anrop={anrop} />);
    const falt = oppnaFalt("Tankning");
    fireEvent.change(falt, { target: { value: "m" } });
    const lista = within(kortet("Tankning")).getByRole("listbox", { name: "Förslag" });
    expect(falt.getAttribute("aria-controls")).toBe(lista.id);
    expect(falt.getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.keyDown(falt, { key: "ArrowDown" });
    fireEvent.keyDown(falt, { key: "ArrowDown" });
    const andra = within(lista).getAllByRole("option")[1];
    // Rött före #372: inga pilar, inget markerat förslag.
    expect(falt.getAttribute("aria-activedescendant")).toBe(andra.id);
    expect(andra.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(falt, { key: "ArrowUp" });
    fireEvent.keyDown(falt, { key: "ArrowUp" });
    const sista = within(lista).getAllByRole("option").at(-1);
    expect(falt.getAttribute("aria-activedescendant")).toBe(sista?.id);
    fireEvent.keyDown(falt, { key: "ArrowDown" });
    const forsta = within(lista).getAllByRole("option")[0];
    fireEvent.keyDown(falt, { key: "Enter" });
    await waitFor(() => expect(anrop.at(-1)).toEqual({ id: "a", taggar: ["kvitto", forsta.textContent] }));
  });
});

describe("⛔ taggarna i vyn", () => {
  it("Taggar bredvid sökfältet filtrerar med flerval (OCH), räknar valen, Rensa alla släpper, och ett tryck till tar bort ett val", () => {
    render(<Harness start={[post("a", "Tankning", ["kvitto", "bil"]), post("b", "Lunch", ["kvitto"]), post("c", "Protokoll", undefined)]} />);
    const knapp = screen.getByRole("button", { name: "Taggar" });
    expect(knapp.closest(".flex.items-center")?.contains(screen.getByRole("searchbox", { name: "Sök i biblioteket" }))).toBe(true);
    fireEvent.click(knapp);
    const meny = screen.getByRole("menu", { name: "Taggar" });
    const rader = within(meny).getAllByRole("menuitemcheckbox");
    // Flest först, med antal.
    expect(rader.map((r) => r.textContent)).toEqual(["kvitto2", "bil1"]);
    expect(screen.queryByRole("button", { name: "Rensa alla" })).toBeNull();
    fireEvent.click(within(meny).getByRole("menuitemcheckbox", { name: /^bil/ }));
    expect(within(meny).getByRole("menuitemcheckbox", { name: /^bil/ })).toHaveAttribute("aria-checked", "true");
    expect(within(meny).getByRole("menuitemcheckbox", { name: /^kvitto/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Taggar, 1 valda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tankning" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lunch" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Protokoll" })).toBeNull();
    fireEvent.click(within(meny).getByRole("menuitemcheckbox", { name: /^kvitto/ }));
    expect(screen.getByRole("button", { name: "Taggar, 2 valda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tankning" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lunch" })).toBeNull();
    fireEvent.click(within(meny).getByRole("menuitemcheckbox", { name: /^bil/ }));
    expect(screen.getByRole("button", { name: "Lunch" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Protokoll" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rensa alla" }));
    expect(screen.getByRole("button", { name: "Taggar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
  });

  it("en tagg på kortet filtrerar på sig själv, och ett tryck till släpper", () => {
    render(<Harness start={[post("a", "Tankning", ["kvitto", "bil"]), post("b", "Lunch", ["kvitto"]), post("c", "Protokoll", undefined)]} />);
    const bil = within(kortet("Tankning")).getByRole("button", { name: "Visa bara bil" });
    expect(bil).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(bil);
    expect(within(kortet("Tankning")).getByRole("button", { name: "Visa bara bil" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Lunch" })).toBeNull();
    expect(screen.getByRole("button", { name: "Taggar, 1 valda" })).toBeInTheDocument();
    fireEvent.click(within(kortet("Tankning")).getByRole("button", { name: "Visa bara bil" }));
    expect(screen.getByRole("button", { name: "Protokoll" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Taggar" })).toBeInTheDocument();
  });

  it("utan taggar säger panelen det, och raden med #tagg under sökfältet finns inte", () => {
    const { unmount } = render(<Harness start={[post("c", "Protokoll", undefined)]} />);
    fireEvent.click(screen.getByRole("button", { name: "Taggar" }));
    expect(screen.getByText("Inga taggar ännu. Lägg till en på en post.")).toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
    unmount();
    render(<Harness start={[post("a", "Tankning", ["kvitto", "bil"])]} />);
    expect(screen.queryByRole("group", { name: "Taggar" })).toBeNull();
    expect(screen.queryByText(/#kvitto/)).toBeNull();
    // Taggarna står på kortet, i den ordning de skrevs, med sin färg.
    expect(taggarPa("Tankning")).toEqual(["kvitto", "bil"]);
    const kvitto = /** @type {HTMLElement} */ (kortet("Tankning").querySelector("[data-bibliotek-tagg='kvitto']"));
    expect(kvitto.className).toContain("bg-tagg-8");
    expect(/** @type {HTMLElement} */ (kortet("Tankning").querySelector("[data-bibliotek-tagg='bil']")).className).toContain("bg-tagg-6");
  });

  it("ingen Taggar i ⋯ längre, varken för författaren eller för andra", () => {
    render(<Harness start={[post("a", "Tankning", ["kvitto"])]} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Tankning" }));
    expect(screen.getByRole("menuitem", { name: "Byt namn" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Taggar" })).toBeNull();
  });

  it("kortets taggrad lägger till med Enter, föreslår gruppens andra, tar bort, och sparar direkt", async () => {
    /** @type {any[]} */
    const anrop = [];
    render(<Harness anrop={anrop} start={[post("a", "Tankning", ["kvitto"]), post("b", "Lunch", ["mat"])]} />);
    let falt = oppnaFalt("Tankning");
    // Förslagen är gruppens taggar som posten inte redan har.
    expect(within(kortet("Tankning")).getAllByRole("option").map((o) => o.textContent)).toEqual(["mat"]);
    fireEvent.change(falt, { target: { value: "#Bil" } });
    // Det som skrivs filtrerar förslagen.
    expect(within(kortet("Tankning")).queryByRole("option")).toBeNull();
    fireEvent.keyDown(falt, { key: "Enter" });
    await waitFor(() => expect(anrop).toEqual([{ id: "a", taggar: ["kvitto", "bil"] }]));
    await waitFor(() => expect(taggarPa("Tankning")).toEqual(["kvitto", "bil"]));
    // Fältet står kvar öppet och tömt, för nästa tagg.
    falt = within(kortet("Tankning")).getByRole("textbox", { name: "Ny tagg" });
    expect(falt).toHaveValue("");
    fireEvent.click(within(kortet("Tankning")).getByRole("option", { name: "mat" }));
    await waitFor(() => expect(anrop.at(-1)).toEqual({ id: "a", taggar: ["kvitto", "bil", "mat"] }));
    fireEvent.click(within(kortet("Tankning")).getByRole("button", { name: "Ta bort taggen kvitto" }));
    await waitFor(() => expect(anrop.at(-1)).toEqual({ id: "a", taggar: ["bil", "mat"] }));
    await waitFor(() => expect(taggarPa("Tankning")).toEqual(["bil", "mat"]));
    expect(anrop).toHaveLength(3);
    // Den andra posten rördes inte.
    expect(taggarPa("Lunch")).toEqual(["mat"]);
  });

  it("komma lägger till, Escape stänger fältet utan att spara, och Backspace i tomt fält tar bort den sista", async () => {
    /** @type {any[]} */
    const anrop = [];
    render(<Harness anrop={anrop} start={[post("a", "Tankning", ["kvitto"])]} />);
    let falt = oppnaFalt("Tankning");
    fireEvent.change(falt, { target: { value: "bil," } });
    await waitFor(() => expect(anrop).toEqual([{ id: "a", taggar: ["kvitto", "bil"] }]));
    falt = within(kortet("Tankning")).getByRole("textbox", { name: "Ny tagg" });
    fireEvent.change(falt, { target: { value: "halv" } });
    fireEvent.keyDown(falt, { key: "Escape" });
    expect(within(kortet("Tankning")).queryByRole("textbox", { name: "Ny tagg" })).toBeNull();
    await act(async () => {});
    expect(anrop).toHaveLength(1);
    await waitFor(() => expect(taggarPa("Tankning")).toEqual(["kvitto", "bil"]));
    falt = oppnaFalt("Tankning");
    fireEvent.keyDown(falt, { key: "Backspace" });
    await waitFor(() => expect(anrop.at(-1)).toEqual({ id: "a", taggar: ["kvitto"] }));
    await waitFor(() => expect(taggarPa("Tankning")).toEqual(["kvitto"]));
    // Backspace i ett fält med text tar inte bort en tagg.
    falt = within(kortet("Tankning")).getByRole("textbox", { name: "Ny tagg" });
    fireEvent.change(falt, { target: { value: "x" } });
    fireEvent.keyDown(falt, { key: "Backspace" });
    // Sparandet går i nästa mikrouppgift, så frånvaron mäts först efter att den hunnit köra.
    await act(async () => {});
    expect(anrop).toHaveLength(2);
    expect(taggarPa("Tankning")).toEqual(["kvitto"]);
  });

  it("⛔ Escape följt av blur i samma ögonblick sparar inte det avbrutna utkastet (som en webbläsare som tar fokus när fältet försvinner)", async () => {
    /** @type {any[]} */
    const anrop = [];
    render(<Harness anrop={anrop} start={[post("a", "Tankning", ["kvitto"])]} />);
    const falt = oppnaFalt("Tankning");
    fireEvent.change(falt, { target: { value: "avbruten" } });
    act(() => {
      fireEvent.keyDown(falt, { key: "Escape" });
      fireEvent.blur(falt);
    });
    await act(async () => {});
    expect(anrop).toHaveLength(0);
    expect(taggarPa("Tankning")).toEqual(["kvitto"]);
    // Nästa gång fältet öppnas sparar blur som vanligt.
    const igen = oppnaFalt("Tankning");
    fireEvent.change(igen, { target: { value: "bil" } });
    fireEvent.blur(igen);
    await waitFor(() => expect(anrop).toEqual([{ id: "a", taggar: ["kvitto", "bil"] }]));
  });

  it("oförändrade taggar sparas inte: en tagg posten redan har, samma tagg i en annan form, och ett tomt fält (granskningen av PR 363)", async () => {
    /** @type {any[]} */
    const anrop = [];
    render(<Harness anrop={anrop} start={[post("a", "Tankning", ["kvitto"])]} />);
    const falt = oppnaFalt("Tankning");
    fireEvent.keyDown(falt, { key: "Enter" });
    fireEvent.change(falt, { target: { value: "kvitto" } });
    fireEvent.keyDown(falt, { key: "Enter" });
    fireEvent.change(falt, { target: { value: "#KVITTO" } });
    fireEvent.keyDown(falt, { key: "Enter" });
    fireEvent.change(falt, { target: { value: "   " } });
    fireEvent.keyDown(falt, { key: "Enter" });
    await act(async () => {});
    expect(anrop).toEqual([]);
    expect(taggarPa("Tankning")).toEqual(["kvitto"]);
    // Golv: en ny tagg i samma fält sparas, så raderna ovan är inte gröna av ett fält som aldrig sparar.
    fireEvent.change(falt, { target: { value: "bil" } });
    fireEvent.keyDown(falt, { key: "Enter" });
    await waitFor(() => expect(anrop).toEqual([{ id: "a", taggar: ["kvitto", "bil"] }]));
  });

  it("ett sparande som faller syns, och taggarna går tillbaka till de sparade", async () => {
    /** @type {any[]} */
    const anrop = [];
    const { unmount } = render(<Harness anrop={anrop} fel={new Error("Nekades av reglerna.")} start={[post("a", "Tankning", ["kvitto"])]} />);
    const falt = oppnaFalt("Tankning");
    fireEvent.change(falt, { target: { value: "bil" } });
    fireEvent.keyDown(falt, { key: "Enter" });
    expect(await within(kortet("Tankning")).findByRole("alert")).toHaveTextContent("Nekades av reglerna.");
    expect(anrop).toEqual([{ id: "a", taggar: ["kvitto", "bil"] }]);
    expect(taggarPa("Tankning")).toEqual(["kvitto"]);
    // Att ta bort faller på samma sätt och står kvar.
    fireEvent.click(within(kortet("Tankning")).getByRole("button", { name: "Ta bort taggen kvitto" }));
    await waitFor(() => expect(anrop).toHaveLength(2));
    await waitFor(() => expect(taggarPa("Tankning")).toEqual(["kvitto"]));
    expect(within(kortet("Tankning")).getByRole("alert")).toHaveTextContent("Nekades av reglerna.");
    unmount();

    render(<Harness fel={false} start={[post("a", "Tankning", ["kvitto"])]} />);
    const falt2 = oppnaFalt("Tankning");
    fireEvent.change(falt2, { target: { value: "bil" } });
    fireEvent.keyDown(falt2, { key: "Enter" });
    expect(await within(kortet("Tankning")).findByRole("alert")).toHaveTextContent("Taggarna kunde inte sparas.");
    expect(taggarPa("Tankning")).toEqual(["kvitto"]);
  });

  it("en tagg som inte går att spara säger varför och skickas inte", async () => {
    /** @type {any[]} */
    const anrop = [];
    render(<Harness anrop={anrop} start={[post("a", "Tankning", undefined)]} />);
    const falt = oppnaFalt("Tankning");
    fireEvent.change(falt, { target: { value: "bil/2024" } });
    fireEvent.keyDown(falt, { key: "Enter" });
    expect(within(kortet("Tankning")).getByRole("alert")).toHaveTextContent(/går inte att spara/);
    await act(async () => {});
    expect(anrop).toEqual([]);
    expect(taggarPa("Tankning")).toEqual([]);
  });

  it("⛔ en post utan taggar har ingen taggrad men Lägg till tagg i menyn, och en med taggar har Tagg (0.165.0)", () => {
    render(<Harness start={[post("a", "Tankning", undefined), post("b", "Lunch", ["mat"])]} />);
    expect(kortet("Tankning").querySelector("[data-bibliotek-taggar]")).toBeNull();
    expect(within(kortet("Tankning")).queryByRole("button", { name: "Lägg till tagg" })).toBeNull();
    fireEvent.click(within(kortet("Tankning")).getByRole("button", { name: "Åtgärder för Tankning" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Lägg till tagg" }));
    const falt = within(kortet("Tankning")).getByRole("textbox", { name: "Ny tagg" });
    fireEvent.keyDown(falt, { key: "Escape" });
    expect(kortet("Tankning").querySelector("[data-bibliotek-taggar]")).toBeNull();
    expect(within(kortet("Lunch")).getByRole("button", { name: "Tagg" })).toBeInTheDocument();
    expect(within(kortet("Lunch")).queryByRole("button", { name: "Lägg till tagg" })).toBeNull();
  });

  it("en annan medlem ser taggarna och kan filtrera, men får inga kryss och ingen Lägg till tagg, och en admin får dem", () => {
    const poster = [post("a", "Tankning", ["kvitto"]), post("b", "Lunch", undefined)];
    const { unmount } = render(<Harness jag={{ uid: "uid-annan", roll: "medlem" }} start={poster} />);
    expect(taggarPa("Tankning")).toEqual(["kvitto"]);
    expect(within(kortet("Tankning")).getByRole("button", { name: "Visa bara kvitto" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ta bort taggen kvitto" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lägg till tagg" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tagg" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Ny tagg" })).toBeNull();
    // En post utan taggar har ingen taggrad alls för den som inte får ändra.
    expect(kortet("Lunch").querySelector("[data-bibliotek-taggar]")).toBeNull();
    unmount();

    render(<Harness jag={{ uid: "uid-annan", roll: "admin" }} start={poster} />);
    expect(screen.getByRole("button", { name: "Ta bort taggen kvitto" })).toBeInTheDocument();
    fireEvent.click(within(kortet("Lunch")).getByRole("button", { name: "Åtgärder för Lunch" }));
    expect(screen.getByRole("menuitem", { name: "Lägg till tagg" })).toBeInTheDocument();
  });

  it("den som inte är medlem (jag: null) ser taggarna men kan inte ändra dem", () => {
    const onSpara = vi.fn();
    render(<OpsBibliotek poster={[post("a", "Tankning", ["kvitto"])]} jag={null} vald={null} skapar={null} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={onSpara} hubHref="/hub" />);
    expect(taggarPa("Tankning")).toEqual(["kvitto"]);
    expect(screen.queryByRole("button", { name: "Ta bort taggen kvitto" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tagg" })).toBeNull();
  });
});
