import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";

/** QA på lifehub.app 2026-11-01: txt-filen ux-upload-test hade bara en länk i detaljen, ingen Ladda ned. */
const post = (id, rubrik, fil) => ({ id, typ: "fil", rubrik, skapad: 1, skapadAv: { uid: "uid-1" }, fil: { byte: 10, sokvag: `grupper/g/bibliotek/${id}/${fil.namn}`, ...fil } });

function Harness({ start }) {
  const [vald, setVald] = useState(null);
  return (
    <OpsBibliotek poster={start} jag={{ uid: "uid-1", roll: "medlem" }} vald={vald} skapar={null}
      onOppna={setVald} onStang={() => setVald(null)} onSkapa={() => {}} onSpara={() => {}}
      filUrl={(p) => `https://exempel.se/${p.fil.sokvag}`} hamtaFil={async () => new Blob(["hej"], { type: "text/plain" })} hubHref="/hub" />
  );
}

describe("Ladda ned i detaljen för varje filtyp", () => {
  for (const [id, namn, mime] of [["txt", "ux-upload-test.txt", "text/plain"], ["pdf", "avtal.pdf", "application/pdf"], ["film", "rep.mp4", "video/mp4"], ["zip", "arkiv.zip", "application/zip"]]) {
    it(`⛔ ${namn} får Ladda ned med download`, () => {
      render(<Harness start={[post(id, `Post ${id}`, { namn, mime })]} />);
      fireEvent.click(screen.getByRole("button", { name: `Post ${id}` }));
      const knapp = screen.getByRole("link", { name: "Ladda ned" });
      expect(knapp).toHaveAttribute("download", namn);
      expect(knapp).toHaveAttribute("href", `https://exempel.se/grupper/g/bibliotek/${id}/${namn}`);
    });
  }
});

describe("Ladda ned sparar via blob (QA 2026-11-01, download ignoreras cross-origin)", () => {
  it("⛔ klick hämtar blob och sparar med filnamnet, öppnar ingen flik", async () => {
    const { sparaSomFil } = await import("../lib/sparaFil.js");
    const klick = []; const oppnade = [];
    const doc = { body: { appendChild: () => {} }, createElement: () => ({ click() { klick.push(this.download); }, remove() {} }) };
    const url = { createObjectURL: () => "blob:x", revokeObjectURL: () => {} };
    let typ = ""; url.createObjectURL = (b) => { typ = b.type; return "blob:x"; };
    const ok = await sparaSomFil({ hamta: async () => new Blob(["<b>hej</b>"], { type: "text/html" }), sokvag: "s", namn: "a.txt", adress: "https://x", doc, url, oppna: (a) => oppnade.push(a) });
    expect(typ).toBe("application/octet-stream");
    expect(ok).toBe(true); expect(klick).toEqual(["a.txt"]); expect(oppnade).toEqual([]);
  });
  it("⛔ fel i hämtningen öppnar adressen som förut", async () => {
    const { sparaSomFil } = await import("../lib/sparaFil.js");
    const oppnade = [];
    const ok = await sparaSomFil({ hamta: async () => { throw new Error("cors"); }, sokvag: "s", namn: "a.txt", adress: "https://x", oppna: (a) => oppnade.push(a) });
    expect(ok).toBe(false); expect(oppnade).toEqual(["https://x"]);
  });
  it("⛔ klick på Ladda ned i detaljen förhindrar flik när hamtaFil finns", () => {
    render(<Harness start={[post("txt", "Post txt", { namn: "u.txt", mime: "text/plain" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Post txt" }));
    const knapp = screen.getByRole("link", { name: "Ladda ned" });
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    knapp.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
