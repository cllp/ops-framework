import { useEffect, useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * 0.245.0, cllp/lifehub.app#900. CP 2026-11-19: "När man drar en fil till biblioteket så blir det en dubblett om man trycker på spara, för den
 * kommer upp utan att spara. Spara gör en dubblett, men då var taggarna bara under spara."
 *
 * Mätt: ett släpp hade två mottagare. Appen (lifehub.app `BibliotekInklistring`, sedan 2026-11-04) lyssnar på ytan runt Biblioteket, tar
 * släppet med `preventDefault` och öppnar en ruta med namn, taggar och Spara. Ramverket fick i 0.236.0 en egen mottagare på listan, som
 * laddade upp filen direkt. Samma släpp gav alltså en post utan taggar direkt och en till med taggarna vid Spara.
 *
 * Provet bygger appens yta som den ser ut: en vanlig lyssnare på ett element runt Biblioteket, som tar släppet och öppnar en ruta. Spara i
 * rutan skapar posten med taggarna. Efteråt ska det finnas exakt en post, och den ska ha taggarna.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const forsta = { ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade.", skapadAv: skapare, skapad: tid, andrad: tid }), id: "a" };

/** @param {File[]} filer */
const filData = (filer) => ({ dataTransfer: { types: ["Files"], files: filer, dropEffect: "none" } });

/**
 * Appen runt Biblioteket: lagringen (`sparade`), och en yta som tar emot släppet själv, som `BibliotekInklistring` i lifehub.app.
 * @param {{ sparade: { rubrik: string, taggar: string[] }[] }} p
 */
function AppMedEgenRuta({ sparade }) {
  const yta = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [ruta, setRuta] = useState(/** @type {File | null} */ (null));
  const [, rita] = useState(0);
  /** @param {{ rubrik: string, fil: File, taggar?: string[] }} inmatning */
  async function laddaUpp(inmatning) {
    sparade.push({ rubrik: inmatning.rubrik, taggar: inmatning.taggar ?? [] });
    rita((n) => n + 1);
  }
  useEffect(() => {
    const el = yta.current;
    if (!el) return undefined;
    /** @param {DragEvent} e */
    const filer = (e) => Boolean(e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes("Files"));
    /** @param {DragEvent} e */
    const over = (e) => {
      if (filer(e)) e.preventDefault();
    };
    /** @param {DragEvent} e */
    const slapp = (e) => {
      if (!filer(e)) return;
      e.preventDefault();
      setRuta(Array.from(e.dataTransfer?.files ?? [])[0] ?? null);
    };
    el.addEventListener("dragenter", over);
    el.addEventListener("dragover", over);
    el.addEventListener("drop", slapp);
    return () => {
      el.removeEventListener("dragenter", over);
      el.removeEventListener("dragover", over);
      el.removeEventListener("drop", slapp);
    };
  }, []);
  const poster = [forsta, ...sparade.map((s, i) => ({ ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: s.rubrik, text: "Uppladdad.", skapadAv: skapare, skapad: tid, andrad: tid }), id: `ny-${i}` }))];
  return (
    <div ref={yta}>
      {ruta ? (
        <div role="dialog" aria-label="Lägg i biblioteket">
          <button type="button" onClick={() => laddaUpp({ rubrik: "Avtal", fil: ruta, taggar: ["avtal"] }).then(() => setRuta(null))}>Spara</button>
        </div>
      ) : null}
      <OpsBibliotek
        poster={poster}
        fel={null}
        jag={/** @type {any} */ ({ uid: "uid-1", roll: "medlem" })}
        vald={null}
        skapar={null}
        onOppna={() => {}}
        onStang={() => {}}
        onSkapa={() => {}}
        onSpara={() => {}}
        onLaddaUpp={laddaUpp}
        hubHref="/hub"
      />
    </div>
  );
}

const lista = () => {
  const panel = document.querySelector("[data-bibliotek-panel]");
  if (!(panel instanceof HTMLElement)) throw new Error("Bibliotekets lista ritades inte.");
  return panel;
};

describe("Biblioteket: ett släpp blir en post (#900)", () => {
  it("⛔ en fil som släpps och sparas i appens ruta blir exakt en post, och den har taggarna", async () => {
    /** @type {{ rubrik: string, taggar: string[] }[]} */
    const sparade = [];
    render(<AppMedEgenRuta sparade={sparade} />);
    const pdf = new File(["%PDF"], "Avtal.pdf", { type: "application/pdf" });

    fireEvent.drop(lista(), filData([pdf]));
    const spara = await screen.findByRole("button", { name: "Spara" });
    // Låt en uppladdning som ramverket kunde ha startat på egen hand hinna klart före Spara, som i CP:s fall.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    fireEvent.click(spara);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(sparade).toEqual([{ rubrik: "Avtal", taggar: ["avtal"] }]);
    expect(document.querySelector("[data-bibliotek-slapp-laddar], [data-bibliotek-slapp-klar]")).toBeNull();
  });

  it("⛔ när appen tar släppet ritar listan ingen egen ram eller rad om att släppa", () => {
    render(<AppMedEgenRuta sparade={[]} />);
    fireEvent.dragOver(lista(), filData([new File(["x"], "a.pdf", { type: "application/pdf" })]));
    expect(document.querySelector("[data-bibliotek-slapp='drar']")).toBeNull();
    expect(document.querySelector("[data-bibliotek-slapp-har]")).toBeNull();
  });
});
