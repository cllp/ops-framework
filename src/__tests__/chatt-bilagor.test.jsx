import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpsSamtal, OpsTrad, Plusmeny } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harBilagor } from "../data/samtalskalla.js";
import { MAX_KOMMENTARBILAGA } from "../lib/handelsemodell.js";
import { byggMeddelande } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";

/**
 * Bilagor i chattens plusmeny (0.77.0, #292).
 *
 * Ett meddelande bär `bilaga` i kommentarernas form. Regeln släpper in fältet bara med `bilagor: true`, och utan nyckeln är
 * texten byte för byte den gamla. Pluset ritas när appen skickar `onBifoga`, eller när källan har `bilagor` (då läser
 * ramverket filen). Utan båda ritas det inte.
 */

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const bild = (extra = {}) => ({ dataUrl: PNG, namn: "kvitto.png", typ: "image/png", tecken: PNG.length, ...extra });
const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];
const namnFor = (uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;

async function samtal(/** @type {{ bilagor?: boolean, tradar?: boolean }} */ val = {}) {
  let t = 1_700_000_000_000;
  const s = createSamtalskalla({
    kalla: createMemorySource({}),
    klocka: () => (t += 1000),
    ...(val.bilagor ? { bilagor: true } : {}),
    ...(val.tradar ? { tradar: "tradar" } : {}),
  });
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  return { s, p };
}

describe("meddelandets bilaga", () => {
  it("sparas och läses tillbaka, också utan text, i samtalet och i tråden", async () => {
    const { s, p } = await samtal({ bilagor: true, tradar: true });
    expect(harBilagor(s)).toBe(true);
    await s.skicka(p.id, { text: "Kvittot", av: "anna", bilaga: bild() });
    await s.skicka(p.id, { text: "", av: "anna", bilaga: bild({ namn: "tom.png" }) });
    const rader = await s.meddelanden(p.id);
    expect(rader.map((m) => m.bilaga?.namn)).toEqual(["kvitto.png", "tom.png"]);
    expect(rader[1].text).toBe("");
    const rot = rader[0];
    await s.skickaITrad(p.id, rot.id, { text: "", av: "bo", bilaga: bild({ namn: "svar.pdf", typ: "application/pdf", dataUrl: "data:application/pdf;base64,JVBERi0=", tecken: "data:application/pdf;base64,JVBERi0=".length }) });
    const svar = await s.tradmeddelanden(p.id, rot.id);
    expect(svar).toHaveLength(1);
    expect(svar[0].bilaga?.namn).toBe("svar.pdf");
  });

  it("⛔ utan bilagor på källan kastar en bilaga, och en ogiltig bilaga kastar med skälet", async () => {
    const { s, p } = await samtal();
    expect(harBilagor(s)).toBe(false);
    await expect(s.skicka(p.id, { text: "Hej", av: "anna", bilaga: bild() })).rejects.toThrow(/bilagor: true/);
    expect(() => byggMeddelande({ text: "Hej", av: "anna", tid: 1, bilaga: bild({ typ: "image/svg+xml", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=", tecken: "data:image/svg+xml;base64,PHN2Zz4=".length }) })).toThrow(/går inte att bifoga/);
    const stor = "data:application/pdf;base64," + "A".repeat(MAX_KOMMENTARBILAGA);
    expect(() => byggMeddelande({ text: "", av: "anna", tid: 1, bilaga: { dataUrl: stor, namn: "a.pdf", typ: "application/pdf", tecken: stor.length } })).toThrow(/för stor/);
    expect(byggMeddelande({ text: " hej ", av: "a", tid: 1 })).toEqual({ text: "hej", av: "a", tid: 1 });
  });

  it("regeln utan nyckel är den gamla, och med nyckel bär den samma typer och samma tak", () => {
    const gammal = fs.readFileSync(path.join(rot, "rules", "__fixturer__", "samtalsregelfragment-0.67.0.rules"), "utf8");
    expect(samtalsregelfragment()).toBe(gammal);
    expect(samtalsregelfragment()).not.toContain("opsMeddelandebilagaGiltig");
    expect(() => samtalsregelfragment({ bilagor: /** @type {any} */ ("ja") })).toThrow(/true eller utelämnat/);
    const bara = samtalsregelfragment({ bilagor: true });
    expect(bara).toContain("function opsMeddelandebilagaGiltig(b)");
    expect(bara).toContain(`b.dataUrl.size() <= ${MAX_KOMMENTARBILAGA}`);
    expect(bara).toContain('"image/jpeg"');
    expect(bara).toContain('"text/csv"');
    expect(bara).not.toContain("svg");
    expect(bara).toContain("|| 'bilaga' in request.resource.data");
    // Utan trådar finns bara samtalets meddelanden.
    expect(bara.split("opsMeddelandebilagaGiltig(request.resource.data.bilaga)").length - 1).toBe(1);
    // Trådens meddelanden och samtalets meddelanden prövas båda. Golv: två anrop.
    const r = samtalsregelfragment({ bilagor: true, tradar: "tradar" });
    expect(r.split("opsMeddelandebilagaGiltig(request.resource.data.bilaga)").length - 1).toBe(2);
  });
});

describe("pluset", () => {
  const texter = /** @type {any} */ ({ bifoga: "Bifoga", bifogaBild: "Bifoga bild", taFoto: "Ta foto", valjFil: "Välj fil" });

  it("⛔ Ta foto ritas bara när en kamera sägs finnas", () => {
    const { rerender } = render(<Plusmeny onBifoga={() => {}} texter={texter} kamera={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Bifoga" }));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Bifoga bild", "Välj fil"]);
    expect(document.querySelector('[data-plusval="foto"]')).toBeNull();
    rerender(<Plusmeny onBifoga={() => {}} texter={texter} kamera />);
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((r) => r.textContent)).toEqual(["Bifoga bild", "Ta foto", "Välj fil"]);
  });

  it("⛔ pluset ritas inte utan onBifoga och utan bilagor, och ritas med onBifoga", async () => {
    const utan = await samtal();
    const { rerender } = render(<OpsSamtal kalla={utan.s} uid="anna" samtal={utan.p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    expect(screen.queryByRole("button", { name: "Bifoga" })).toBeNull();
    const onBifoga = vi.fn();
    rerender(<OpsSamtal kalla={utan.s} uid="anna" samtal={utan.p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} onBifoga={onBifoga} />);
    fireEvent.click(screen.getByRole("button", { name: "Bifoga" }));
    const fil = new File(["x"], "anteckning.txt", { type: "text/plain" });
    fireEvent.change(/** @type {HTMLInputElement} */ (document.querySelector('[data-plusval="fil"]')), { target: { files: [fil] } });
    expect(onBifoga).toHaveBeenCalledWith([fil], "fil");
    expect(document.querySelector("[data-bilageutkast]")).toBeNull();
  });

  it("en vald fil sparas med meddelandet och ritas, och fel typ sägs", async () => {
    const { s, p } = await samtal({ bilagor: true });
    await s.skicka(p.id, { text: "Redan där", av: "bo" });
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    expect(screen.getByRole("button", { name: "Bifoga" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bifoga" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bifoga" }));
    fireEvent.change(/** @type {HTMLInputElement} */ (document.querySelector('[data-plusval="fil"]')), {
      target: { files: [new File(["<svg></svg>"], "bild.svg", { type: "image/svg+xml" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/går inte att bifoga/);
    fireEvent.click(screen.getByRole("button", { name: "Bifoga" }));
    fireEvent.change(/** @type {HTMLInputElement} */ (document.querySelector('[data-plusval="fil"]')), {
      target: { files: [new File(["hej"], "anteckning.txt", { type: "text/plain" })] },
    });
    expect(await screen.findByRole("link", { name: /anteckning\.txt/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Ta bort bilagan" })).toBeNull());
    expect(screen.getByRole("link", { name: /anteckning\.txt/ })).toHaveAttribute("data-meddelande-bilaga", "fil");
    const rader = await s.meddelanden(p.id);
    expect(rader.at(-1)?.bilaga?.namn).toBe("anteckning.txt");
    expect(rader.at(-1)?.text).toBe("");
  });

  it("tråden ritar pluset när källan har bilagor, och en befintlig bild visas", async () => {
    const { s, p } = await samtal({ bilagor: true, tradar: true });
    const rot = await s.skicka(p.id, { text: "Roten", av: "anna", bilaga: bild() });
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    const grot = await s.skicka(g.id, { text: "I gruppen", av: "anna" });
    render(
      <OpsTrad kalla={s} uid="anna" samtal={g} tid={grot.id} gruppNamn="Gruppen" namnFor={namnFor} medlemmar={MEDLEMMAR} onStang={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Bifoga" })).toBeInTheDocument();
    expect(rot.bilaga?.namn).toBe("kvitto.png");
  });
});
