import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsGruppSida } from "../components/OpsGruppSida.jsx";
import { OpsField, OpsInput } from "../components/OpsField.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * 0.236.0. Tre saker från Robs genomgång (cllp/lifehub.app#870 och #871):
 *
 * 1. Filer som släpps på bibliotekets lista laddas upp, en i taget, och en fil som inte tas emot står med namn och skäl.
 * 2. Gruppsidan kan bära en knapp i medlemmarnas rubrikrad, ⋯ per medlem och något direkt under listan, så att medlemmar och
 *    inbjudna står i samma sektion.
 * 3. OpsInput kan visa förslag medan man skriver: en kombinationsruta där pilarna markerar, Enter väljer och Escape stänger.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const poster = [{ ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade.", skapadAv: skapare, skapad: tid, andrad: tid }), id: "a" }];

/** @param {{ onLaddaUpp?: (p: { rubrik: string, fil: File }) => Promise<unknown>, jag?: { uid: string, roll: string } | null }} p */
function Bibliotek({ onLaddaUpp, jag = { uid: "uid-1", roll: "medlem" } }) {
  const [vald, setVald] = useState(/** @type {any} */ (null));
  return (
    <OpsBibliotek
      poster={poster}
      fel={null}
      jag={/** @type {any} */ (jag)}
      vald={vald}
      skapar={null}
      onOppna={(p) => setVald(p)}
      onStang={() => setVald(null)}
      onSkapa={() => {}}
      onSpara={() => {}}
      onLaddaUpp={onLaddaUpp}
      hubHref="/hub"
    />
  );
}

/** @param {File[]} filer */
const filData = (filer) => ({ dataTransfer: { types: ["Files"], files: filer, dropEffect: "none" } });
const slappyta = () => /** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-panel] [role='tablist']")?.parentElement ?? document.querySelector("[data-bibliotek-slapp], [data-bibliotek-panel] div"));

describe("Biblioteket: filer som släpps på listan (#870)", () => {
  it("⛔ två godkända filer laddas upp en i taget, med namnet utan ändelse som rubrik, och en fil i fel format står med namn och skäl", async () => {
    const onLaddaUpp = vi.fn(async () => {});
    render(<Bibliotek onLaddaUpp={onLaddaUpp} />);
    const yta = slappyta();
    const pdf = new File(["%PDF"], "Avtal.pdf", { type: "application/pdf" });
    const bild = new File(["x"], "kvitto.jpg", { type: "image/jpeg" });
    const rar = new File(["x"], "arkiv.rar", { type: "application/x-rar-compressed" });

    fireEvent.dragOver(yta, filData([pdf]));
    expect(document.querySelector("[data-bibliotek-slapp='drar']")).not.toBeNull();
    expect(document.querySelector("[data-bibliotek-slapp-har]")).not.toBeNull();

    fireEvent.drop(yta, filData([pdf, rar, bild]));
    await waitFor(() => expect(document.querySelector("[data-bibliotek-slapp-klar]")).not.toBeNull());
    expect(onLaddaUpp).toHaveBeenCalledTimes(2);
    expect(onLaddaUpp.mock.calls.map(([p]) => /** @type {any} */ (p).rubrik)).toEqual(["Avtal", "kvitto"]);
    expect(onLaddaUpp.mock.calls.map(([p]) => /** @type {any} */ (p).fil)).toEqual([pdf, bild]);
    const fel = /** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-slapp-fel]"));
    expect(fel.textContent).toMatch(/arkiv\.rar/);
    expect(fel.textContent).toMatch(/application\/x-rar-compressed/);
    expect(document.querySelector("[data-bibliotek-slapp='drar']")).toBeNull();
  });

  it("en uppladdning som faller står med filens namn, och de andra laddas upp ändå", async () => {
    const onLaddaUpp = vi.fn(async (/** @type {{ rubrik: string }} */ p) => {
      if (p.rubrik === "a") throw new Error("Lagringen svarade inte.");
    });
    render(<Bibliotek onLaddaUpp={onLaddaUpp} />);
    const yta = slappyta();
    fireEvent.drop(yta, filData([new File(["x"], "a.pdf", { type: "application/pdf" }), new File(["x"], "b.pdf", { type: "application/pdf" })]));
    await waitFor(() => expect(document.querySelector("[data-bibliotek-slapp-fel]")?.textContent).toMatch(/a\.pdf: Lagringen svarade inte\./));
    expect(onLaddaUpp).toHaveBeenCalledTimes(2);
  });

  it("utan onLaddaUpp säger listan att uppladdningen inte är kopplad, i stället för att släppet försvinner tyst", () => {
    render(<Bibliotek />);
    fireEvent.drop(slappyta(), filData([new File(["x"], "a.pdf", { type: "application/pdf" })]));
    expect(document.querySelector("[data-bibliotek-slapp-fel]")?.textContent).toMatch(/inte kopplad/);
  });

  it("text som dras över listan ritar ingen ram, och utan inloggning tas inget släpp emot", () => {
    const onLaddaUpp = vi.fn(async () => {});
    const { unmount } = render(<Bibliotek onLaddaUpp={onLaddaUpp} />);
    fireEvent.dragOver(slappyta(), { dataTransfer: { types: ["text/plain"], files: [] } });
    expect(document.querySelector("[data-bibliotek-slapp='drar']")).toBeNull();
    unmount();
    render(<Bibliotek onLaddaUpp={onLaddaUpp} jag={null} />);
    fireEvent.drop(slappyta(), filData([new File(["x"], "a.pdf", { type: "application/pdf" })]));
    expect(onLaddaUpp).not.toHaveBeenCalled();
  });
});

const grupp = { id: "g1", namn: { sv: "Alfa AB" }, roll: /** @type {const} */ ("agare") };
const medlemmar = [
  { id: "u-dan", namn: "Dan", bild: "", roll: /** @type {const} */ ("agare") },
  { id: "u-ann", namn: "Ann", bild: "", roll: /** @type {const} */ ("medlem") },
];

describe("Gruppsidan: medlemmar och inbjudna i samma sektion (#870 punkt 13)", () => {
  it("⛔ knappen står i medlemmarnas rubrikrad och det som står under ligger inne i sektionen, efter listan och före appens sektioner", () => {
    render(
      <OpsGruppSida grupp={grupp} medlemmar={medlemmar} medlemsknapp={<button type="button">Bjud in</button>} underMedlemmar={<p data-testid="vantar">Väntar på svar</p>}>
        <p data-testid="barn">Appens sektion</p>
      </OpsGruppSida>,
    );
    const sektion = /** @type {HTMLElement} */ (document.querySelector("[data-gruppsida-medlemmar]"));
    const knapp = screen.getByRole("button", { name: "Bjud in" });
    expect(knapp.closest("[data-gruppsida-medlemsknapp]")).not.toBeNull();
    const vantar = screen.getByTestId("vantar");
    expect(sektion.contains(vantar)).toBe(true);
    const sistaRaden = /** @type {Node} */ ([...sektion.querySelectorAll("[data-medlemsrad]")].at(-1));
    const fore = (/** @type {Node} */ a, /** @type {Node} */ b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(fore(knapp, sistaRaden)).toBe(true);
    expect(fore(sistaRaden, vantar)).toBe(true);
    expect(fore(vantar, screen.getByTestId("barn"))).toBe(true);
  });

  it("⛔ ⋯ står bara på de rader som har åtgärder, och Ta bort anropas med rätt medlem", async () => {
    const taBort = vi.fn();
    render(
      <OpsGruppSida
        grupp={grupp}
        medlemmar={medlemmar}
        medlemsAtgarder={(m) => (m.roll === "agare" ? [] : [{ id: "ta-bort", etikett: "Ta bort", onValj: () => taBort(m.id) }])}
      />,
    );
    const ann = /** @type {HTMLElement} */ (document.querySelector("[data-medlemsrad='u-ann']"));
    const dan = /** @type {HTMLElement} */ (document.querySelector("[data-medlemsrad='u-dan']"));
    expect(dan.querySelector("[data-ops-atgard-knapp]")).toBeNull();
    const knapp = /** @type {HTMLElement} */ (ann.querySelector("[data-ops-atgard-knapp]"));
    expect(knapp.getAttribute("aria-label")).toMatch(/Ann/);
    fireEvent.click(knapp);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Ta bort/ }));
    expect(taBort).toHaveBeenCalledWith("u-ann");
  });

  it("utan de nya propsen ritas ingen tom behållare och ingen ⋯", () => {
    render(<OpsGruppSida grupp={grupp} medlemmar={medlemmar} />);
    expect(document.querySelector("[data-gruppsida-medlemsknapp]")).toBeNull();
    expect(document.querySelector("[data-gruppsida-under-medlemmar]")).toBeNull();
    expect(document.querySelector("[data-ops-atgard-knapp]")).toBeNull();
  });
});

const FORSLAG = [
  { id: "u-ann", etikett: "Ann Berg", under: "ann@exempel.se" },
  { id: "u-bo", etikett: "Bo Ek", under: "bo@exempel.se" },
];

/** @param {{ onValj: (id: string) => void, forslag?: typeof FORSLAG }} p */
function Falt({ onValj, forslag = FORSLAG }) {
  const [v, setV] = useState("");
  return (
    <OpsField label="E-post">
      <OpsInput value={v} onChange={setV} forslag={forslag} onValjForslag={onValj} />
    </OpsField>
  );
}

describe("OpsInput: förslag medan man skriver (#871)", () => {
  it("⛔ fältet är en kombinationsruta: listan syns med fokus, ArrowDown markerar och Enter väljer", () => {
    const onValj = vi.fn();
    render(<Falt onValj={onValj} />);
    const falt = screen.getByRole("combobox", { name: "E-post" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.focus(falt);
    const lista = screen.getByRole("listbox");
    expect(within(lista).getAllByRole("option").map((o) => o.textContent)).toEqual(["Ann Bergann@exempel.se", "Bo Ekbo@exempel.se"]);
    expect(falt.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(falt, { key: "ArrowDown" });
    fireEvent.keyDown(falt, { key: "ArrowDown" });
    expect(falt.getAttribute("aria-activedescendant")).toBe(within(lista).getAllByRole("option")[1].id);
    fireEvent.keyDown(falt, { key: "Enter" });
    expect(onValj).toHaveBeenCalledWith("u-bo");
  });

  it("ett tryck på ett förslag väljer det, och Escape stänger listan", () => {
    const onValj = vi.fn();
    render(<Falt onValj={onValj} />);
    const falt = screen.getByRole("combobox", { name: "E-post" });
    fireEvent.focus(falt);
    fireEvent.mouseDown(screen.getByRole("option", { name: /Ann Berg/ }));
    expect(onValj).toHaveBeenCalledWith("u-ann");
    fireEvent.keyDown(falt, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("en tom lista ritar ingenting, och högst åtta förslag visas", () => {
    const { unmount } = render(<Falt onValj={() => {}} forslag={[]} />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).toBeNull();
    unmount();
    const tolv = Array.from({ length: 12 }, (_, i) => ({ id: `u${i}`, etikett: `Person ${i}` }));
    render(<Falt onValj={() => {}} forslag={tolv} />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(8);
  });

  it("⛔ förslag utan onValjForslag kastar, och utan förslag är fältet en vanlig textruta", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsInput value="" onChange={() => {}} forslag={FORSLAG} ariaLabel="x" />)).toThrow(/onValjForslag/);
    vi.mocked(console.error).mockRestore();
    render(<OpsInput value="" onChange={() => {}} ariaLabel="Namn" />);
    expect(screen.getByRole("textbox", { name: "Namn" })).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
