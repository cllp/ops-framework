import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { byggPost } from "../lib/bibliotek.js";

/*
 * Bild i en anteckning, del två (0.207.0, cllp/lifehub.app#696):
 *
 * 1. Rutan med "Lägg till bild" läses in när den behövs (`BibliotekAnteckningsbildLat`). ⛔ DET HÄR MÄTER BETEENDET, INTE KÄLLTEXTEN: modulen
 *    `BibliotekAnteckningsbild.jsx` ersätts av en som räknar hur många gånger den utvärderats, som för snabbmenyn (`snabbmeny-lat.test.jsx`).
 *    Bytesmåttet i bundeln (`check:delbarhet`) är det andra benet.
 * 2. Tillbaka, en annan post eller en ny vy mitt i en uppladdning tappar inte bilden: raden skrivs in i den sparade posten med `onSpara`.
 */

afterEach(() => {
  cleanup();
  vi.resetModules();
});

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };

/** @param {Record<string, any>} [extra] */
function anteckning(extra = {}) {
  return { ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Kvitton", text: "Taxi i juli.", skapadAv: skapare, skapad: tid, andrad: tid }), id: "a1", ...extra };
}

/** Biblioteket och modulen som räknas, inlästa på nytt för varje prov så att den lata modulen inte redan ligger i cachen. */
async function iBeredskap() {
  const utvarderad = vi.fn();
  vi.doMock("../components/BibliotekAnteckningsbild.jsx", async () => {
    utvarderad();
    return vi.importActual("../components/BibliotekAnteckningsbild.jsx");
  });
  const { OpsBibliotek } = await import("../components/OpsBibliotek.jsx");
  /** @param {{ start?: any[], onLaggBildIAnteckning?: any, onSpara?: any, lagra?: (text: string) => string }} props `lagra`: appen normaliserar texten när den sparas. */
  function Harness({ start = [anteckning()], onLaggBildIAnteckning, onSpara = () => {}, lagra = (t) => t }) {
    const [vald, setVald] = useState(/** @type {any} */ (null));
    const [poster, setPoster] = useState(start);
    return (
      <>
        <OpsBibliotek
          poster={poster}
          jag={{ uid: "uid-1", roll: "medlem" }}
          vald={vald}
          onOppna={setVald}
          onStang={() => setVald(null)}
          onSkapa={() => {}}
          onSpara={(/** @type {any} */ p) => {
            const svar = onSpara(p);
            setPoster((nu) => nu.map((x) => (x.id === p.id ? { ...x, ...p, ...(typeof p.text === "string" ? { text: lagra(p.text) } : {}) } : x)));
            return svar;
          }}
          hubHref="/hub"
          onLaggBildIAnteckning={onLaggBildIAnteckning}
        />
        {/* Appen byter vy utan ramverkets Tillbaka, som telefonens bakåtgest gör. */}
        <button type="button" onClick={() => setVald(null)}>Appens bakåt</button>
        {/* En annan medlem tar bort posten, eller ändrar dess text, medan bilden laddas upp. */}
        <button type="button" onClick={() => setPoster([])}>Någon tar bort</button>
        <button type="button" onClick={() => setPoster((nu) => nu.map((x) => ({ ...x, text: "Någon annans text." })))}>Någon ändrar</button>
      </>
    );
  }
  return { Harness, utvarderad };
}

function redigera() {
  fireEvent.click(screen.getByRole("button", { name: "Kvitton" }));
  fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Kvitton" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
}

const textruta = () => /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Text" }));
const bild = () => new File([new Uint8Array([1, 2, 3])], "foto.png", { type: "image/png" });

describe("BibliotekAnteckningsbildLat: rutan läses in när den behövs", () => {
  /** @type {Array<() => void>} */
  let idle;
  beforeEach(() => {
    idle = [];
    window.requestIdleCallback = /** @type {any} */ ((/** @type {() => void} */ fn) => {
      idle.push(fn);
      return idle.length;
    });
    window.cancelIdleCallback = /** @type {any} */ (() => {});
  });

  it("⛔ biblioteket hämtar inte modulen när det ritas, och utan uppladdningen aldrig: redigeringen är då en vanlig textruta", async () => {
    const { Harness, utvarderad } = await iBeredskap();
    render(<Harness />);
    expect(idle).toHaveLength(0);
    redigera();
    expect(textruta()).toHaveValue("Taxi i juli.");
    expect(screen.queryByRole("button", { name: "Lägg till bild" })).toBeNull();
    await act(async () => {});
    expect(utvarderad).not.toHaveBeenCalled();
  });

  it("⛔ med uppladdningen hämtas modulen först när webbläsaren har tid över, och modulen hämtas inte en gång till när någon redigerar", async () => {
    const { Harness, utvarderad } = await iBeredskap();
    render(<Harness onLaggBildIAnteckning={async () => ({ namn: "x.png" })} />);
    expect(utvarderad).not.toHaveBeenCalled();
    expect(idle).toHaveLength(1);
    idle[0]();
    await waitFor(() => expect(utvarderad).toHaveBeenCalledTimes(1));
    redigera();
    expect(await screen.findByRole("button", { name: "Lägg till bild" })).toBeInTheDocument();
    expect(utvarderad).toHaveBeenCalledTimes(1);
  });

  it("⛔ efter förladdningen ritas rutan direkt: knappen finns vid första ritningen, och textrutan är SAMMA nod före och efter (fokus tappas inte)", async () => {
    const { Harness, utvarderad } = await iBeredskap();
    render(<Harness onLaggBildIAnteckning={async () => ({ namn: "x.png" })} />);
    idle[0]();
    await waitFor(() => expect(utvarderad).toHaveBeenCalledTimes(1));
    await act(async () => {});
    redigera();
    expect(screen.getByRole("button", { name: "Lägg till bild" })).toBeInTheDocument();
    const fore = textruta();
    fore.focus();
    await act(async () => {});
    await act(async () => {});
    expect(textruta()).toBe(fore);
    expect(document.activeElement).toBe(fore);
    expect(fore.isConnected).toBe(true);
  });

  it("⛔ Redigera före förladdningen: textrutan står där med texten medan modulen hämtas, och en bild som klistras in under tiden når inte appen", async () => {
    const { Harness } = await iBeredskap();
    const dokumentet = vi.fn();
    document.addEventListener("paste", dokumentet);
    try {
      render(<Harness onLaggBildIAnteckning={async () => ({ namn: "x.png" })} />);
      redigera();
      expect(textruta()).toHaveValue("Taxi i juli.");
      expect(screen.queryByRole("button", { name: "Lägg till bild" })).toBeNull();
      fireEvent.paste(textruta(), { clipboardData: { files: [bild()], getData: () => "" } });
      expect(dokumentet).not.toHaveBeenCalled();
      expect(screen.getByText("Bildverktyget hämtas. Klistra in bilden igen om en stund.")).toBeInTheDocument();
      // Text i urklippet är text, som förut.
      fireEvent.paste(textruta(), { clipboardData: { files: [bild()], getData: () => "en mening" } });
      expect(dokumentet).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("button", { name: "Lägg till bild" })).toBeInTheDocument();
      expect(textruta()).toHaveValue("Taxi i juli.");
    } finally {
      document.removeEventListener("paste", dokumentet);
    }
  });
});

describe("en uppladdning som överlever rutan", () => {
  /** @param {{ Harness: any }} b @param {any} onSpara */
  async function borjaUppladdning({ Harness }, onSpara, /** @type {{ lagra?: (t: string) => string }} */ extra = {}) {
    /** @type {Array<(v: { namn: string }) => void>} */
    const svar = [];
    const onLagg = vi.fn(() => new Promise((los) => svar.push(los)));
    render(<Harness onLaggBildIAnteckning={onLagg} onSpara={onSpara} {...extra} />);
    redigera();
    const input = await screen.findByLabelText("Lägg till bild", { selector: "input" });
    fireEvent.change(input, { target: { files: [bild(), bild()] } });
    await waitFor(() => expect(onLagg).toHaveBeenCalledTimes(1));
    return { svar, onLagg };
  }

  it("⛔ Tillbaka mitt i en uppladdning: bilden skrivs in sist i den sparade texten när den är klar, också den andra", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const { svar, onLagg } = await borjaUppladdning(b, onSpara);
    // Tillbaka är inte spärrad. Det som skrevs men inte sparades sparas inte.
    fireEvent.change(textruta(), { target: { value: "Ändrat men inte sparat." } });
    const tillbaka = screen.getByRole("button", { name: /Tillbaka/ });
    expect(tillbaka).not.toBeDisabled();
    fireEvent.click(tillbaka);
    expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull();
    expect(onSpara).not.toHaveBeenCalled();
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
    expect(onSpara).toHaveBeenLastCalledWith({ typ: "anteckning", rubrik: "Kvitton", text: "Taxi i juli.\n![](kvitto-1.jpg)", id: "a1" });
    // Den andra bilden laddas upp efter den första och hamnar i samma text, utan att skriva över den första.
    await waitFor(() => expect(onLagg).toHaveBeenCalledTimes(2));
    await act(async () => svar[1]({ namn: "kvitto-2.jpg" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(2));
    expect(onSpara).toHaveBeenLastCalledWith({ typ: "anteckning", rubrik: "Kvitton", text: "Taxi i juli.\n![](kvitto-1.jpg)\n![](kvitto-2.jpg)", id: "a1" });
    // Posten bär båda bilderna när den öppnas igen.
    fireEvent.click(screen.getByRole("button", { name: "Kvitton" }));
    expect(document.querySelectorAll("[data-ops-markdown-bild]")).toHaveLength(2);
  });

  it("⛔ appen byter vy mitt i en uppladdning (telefonens bakåtgest): bilden skrivs in ändå", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const { svar } = await borjaUppladdning(b, onSpara);
    fireEvent.click(screen.getByRole("button", { name: "Appens bakåt" }));
    expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull();
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
    expect(onSpara).toHaveBeenLastCalledWith({ typ: "anteckning", rubrik: "Kvitton", text: "Taxi i juli.\n![](kvitto-1.jpg)", id: "a1" });
  });

  it("⛔ Tillbaka, öppna igen och spara en ny text mitt i uppladdningen: bilden skrivs in i den NYA texten, som inte försvinner (granskningen av 0.207.0)", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const { svar } = await borjaUppladdning(b, onSpara);
    fireEvent.click(screen.getByRole("button", { name: /Tillbaka/ }));
    redigera();
    fireEvent.change(textruta(), { target: { value: "Sparat efter stängningen." } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
    expect(onSpara).toHaveBeenLastCalledWith(expect.objectContaining({ text: "Sparat efter stängningen.", id: "a1" }));
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(2));
    expect(onSpara).toHaveBeenLastCalledWith({ typ: "anteckning", rubrik: "Kvitton", text: "Sparat efter stängningen.\n![](kvitto-1.jpg)", id: "a1" });
  });

  it("⛔ öppnas anteckningen för redigering igen medan bilden laddas upp, och sparas efteråt, står bildraden kvar i den nya texten (0.208.0)", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const { svar } = await borjaUppladdning(b, onSpara);
    fireEvent.click(screen.getByRole("button", { name: /Tillbaka/ }));
    redigera();
    fireEvent.change(textruta(), { target: { value: "Taxi i juli, 245 kr." } });
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
    // Den nya redigeringen sparar sin text, och bildraden som skrevs in under tiden följer med sist.
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(2));
    expect(onSpara).toHaveBeenLastCalledWith(expect.objectContaining({ text: "Taxi i juli, 245 kr.\n![](kvitto-1.jpg)", id: "a1" }));
    // Nästa redigering börjar från det som sparades, med bildraden, och en ny sparning tappar den inte.
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Kvitton" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
    expect(textruta()).toHaveValue("Taxi i juli, 245 kr.\n![](kvitto-1.jpg)");
    fireEvent.change(textruta(), { target: { value: "Taxi i juli, 245 kr. Kort.\n![](kvitto-1.jpg)" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(3));
    expect(onSpara).toHaveBeenLastCalledWith(expect.objectContaining({ text: "Taxi i juli, 245 kr. Kort.\n![](kvitto-1.jpg)" }));
  });

  it("⛔ appen normaliserar den sparade texten (blanksteg sist på raden): nästa redigering har bildraden, och den dubbleras inte (granskningen av PR 553)", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const lagra = (/** @type {string} */ t) => t.replace(/ +(\n|$)/g, "$1");
    const { svar } = await borjaUppladdning(b, onSpara, { lagra });
    fireEvent.click(screen.getByRole("button", { name: /Tillbaka/ }));
    redigera();
    fireEvent.change(textruta(), { target: { value: "Taxi i juli, 245 kr.  " } });
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(2));
    expect(onSpara).toHaveBeenLastCalledWith(expect.objectContaining({ text: "Taxi i juli, 245 kr.  \n![](kvitto-1.jpg)" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Kvitton" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
    expect(textruta()).toHaveValue("Taxi i juli, 245 kr.\n![](kvitto-1.jpg)");
    fireEvent.change(textruta(), { target: { value: "Taxi i juli, 245 kr. Kort.\n![](kvitto-1.jpg)" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(3));
    expect(onSpara).toHaveBeenLastCalledWith(expect.objectContaining({ text: "Taxi i juli, 245 kr. Kort.\n![](kvitto-1.jpg)" }));
  });

  it("⛔ en sparning som normaliseras bort helt kommer aldrig tillbaka: nästa redigering väntar inte på den, och bilden som kommer under tiden tappas inte (andra granskningen av PR 553)", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const lagra = (/** @type {string} */ t) => t.replace(/ +(\n|$)/g, "$1");
    const { svar } = await borjaUppladdning(b, onSpara, { lagra });
    fireEvent.click(screen.getByRole("button", { name: /Tillbaka/ }));
    redigera();
    // Bara blanksteg sist: appen sparar samma text som förut, och ingenting ändras i posten.
    fireEvent.change(textruta(), { target: { value: "Taxi i juli.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Kvitton" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Redigera" }));
    fireEvent.change(textruta(), { target: { value: "Taxi i juli. Mer." } });
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(3));
    expect(onSpara).toHaveBeenLastCalledWith(expect.objectContaining({ text: "Taxi i juli. Mer.\n![](kvitto-1.jpg)" }));
  });

  it("⛔ en redigering som inte ändrats följer den sparade texten: bildraden syns i rutan när den skrivits in (0.208.0)", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const { svar } = await borjaUppladdning(b, onSpara);
    fireEvent.click(screen.getByRole("button", { name: /Tillbaka/ }));
    redigera();
    expect(textruta()).toHaveValue("Taxi i juli.");
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(textruta()).toHaveValue("Taxi i juli.\n![](kvitto-1.jpg)"));
  });

  it("⛔ en annan medlem ändrar texten medan bilden laddas upp: bilden skrivs in i hens text", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const { svar } = await borjaUppladdning(b, onSpara);
    fireEvent.click(screen.getByRole("button", { name: /Tillbaka/ }));
    fireEvent.click(screen.getByRole("button", { name: "Någon ändrar" }));
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(onSpara).toHaveBeenCalledTimes(1));
    expect(onSpara).toHaveBeenLastCalledWith({ typ: "anteckning", rubrik: "Kvitton", text: "Någon annans text.\n![](kvitto-1.jpg)", id: "a1" });
  });

  it("⛔ posten tas bort medan bilden laddas upp: ingenting sparas, och den väcks inte", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const { svar, onLagg } = await borjaUppladdning(b, onSpara);
    fireEvent.click(screen.getByRole("button", { name: /Tillbaka/ }));
    fireEvent.click(screen.getByRole("button", { name: "Någon tar bort" }));
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(onLagg).toHaveBeenCalledTimes(2));
    await act(async () => svar[1]({ namn: "kvitto-2.jpg" }));
    await act(async () => {});
    expect(onSpara).not.toHaveBeenCalled();
  });

  it("med rutan kvar skrivs bilden in i rutan som förut, och ingenting sparas av sig självt", async () => {
    const b = await iBeredskap();
    const onSpara = vi.fn(() => true);
    const { svar } = await borjaUppladdning(b, onSpara);
    textruta().setSelectionRange(12, 12);
    await act(async () => svar[0]({ namn: "kvitto-1.jpg" }));
    await waitFor(() => expect(textruta()).toHaveValue("Taxi i juli.\n![](kvitto-1.jpg)"));
    expect(onSpara).not.toHaveBeenCalled();
  });
});
