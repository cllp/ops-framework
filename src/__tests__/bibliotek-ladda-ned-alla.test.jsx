import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
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
  for (const [id, namn, mime] of [["txt", "ux-upload-test.txt", "text/plain"], ["film", "rep.mp4", "video/mp4"], ["zip", "arkiv.zip", "application/zip"]]) {
    // ⛔ (0.228.0, cllp/lifehub.app#765) Ladda ned var en länk med lagringens adress. Nu är den en knapp, och ingen länk i detaljen bär adressen.
    it(`⛔ ${namn} får Ladda ned, som knapp och utan lagringens adress`, () => {
      render(<Harness start={[post(id, `Post ${id}`, { namn, mime })]} />);
      fireEvent.click(screen.getByRole("button", { name: `Post ${id}` }));
      expect(screen.getByRole("button", { name: "Ladda ned" })).toBeTruthy();
      expect(screen.queryByRole("link", { name: "Ladda ned" })).toBeNull();
      for (const el of document.querySelectorAll("[href]")) expect(el.getAttribute("href")).not.toContain(`exempel.se/grupper/g/bibliotek/${id}`);
    });
  }
  // (0.193.0, cllp/ops-framework#530) En PDF ritas i appens egen vy, och Ladda ned står i dess rad som en knapp som sparar byten vyn redan har: lagringens adress ska inte stå i någon länk.
  it("⛔ avtal.pdf får Ladda ned i PDF-vyns rad, utan lagringens adress", async () => {
    render(<Harness start={[post("pdf", "Post pdf", { namn: "avtal.pdf", mime: "application/pdf" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Post pdf" }));
    expect(await screen.findByRole("button", { name: "Ladda ned" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ladda ned" })).toBeNull();
    for (const el of document.querySelectorAll("[href]")) expect(el.getAttribute("href")).not.toContain("exempel.se/grupper/g/bibliotek/pdf");
  });
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
  // ⛔ (0.228.0, #765) Knappen har ingen adress att följa, så ingen flik kan öppnas: klicket hämtar byten med appens hamtaFil.
  it("⛔ klick på Ladda ned i detaljen hämtar filen med hamtaFil och öppnar ingen flik", async () => {
    const hamtade = [];
    function HamtaHarness() {
      const [vald, setVald] = useState(null);
      const p = post("txt", "Post txt", { namn: "u.txt", mime: "text/plain" });
      return (
        <OpsBibliotek poster={[p]} jag={{ uid: "uid-1", roll: "medlem" }} vald={vald} skapar={null}
          onOppna={setVald} onStang={() => setVald(null)} onSkapa={() => {}} onSpara={() => {}}
          filUrl={(q) => `https://exempel.se/${q.fil.sokvag}`} hamtaFil={async (s) => { hamtade.push(s); return new Blob(["hej"], { type: "text/plain" }); }} hubHref="/hub" />
      );
    }
    render(<HamtaHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Post txt" }));
    await waitFor(() => expect(hamtade.length).toBeGreaterThan(0));
    const fore = hamtade.length;
    const oppnade = [];
    const spy = vi.spyOn(window, "open").mockImplementation((a) => { oppnade.push(a); return null; });
    const skapa = URL.createObjectURL; const aterkalla = URL.revokeObjectURL;
    URL.createObjectURL = () => "blob:x"; URL.revokeObjectURL = () => {};
    try {
      fireEvent.click(screen.getByRole("button", { name: "Ladda ned" }));
      await waitFor(() => expect(hamtade.length).toBe(fore + 1));
      expect(hamtade.at(-1)).toBe("grupper/g/bibliotek/txt/u.txt");
      expect(oppnade).toEqual([]);
    } finally {
      spy.mockRestore(); URL.createObjectURL = skapa; URL.revokeObjectURL = aterkalla;
    }
  });
});

/*
 * ⛔ LADDA NED UTAN hamtaFil (0.228.0, granskningen av PR 595). Utan appens `hamtaFil` hämtar knappen byten ur adressen Biblioteket redan har (`lasFilbytes`) och sparar dem via `sparaSomFil`.
 * Det är gästens enda väg, och förut en `<a href>`. Provet stubbar `fetch`, fångar blob-adressen och den tillfälliga länkens klick, och `window.open` för reserven.
 */
describe("Ladda ned utan hamtaFil hämtar ur adressen och sparar", () => {
  const ADRESS = (/** @type {string} */ id, /** @type {string} */ namn) => `https://exempel.se/grupper/g/bibliotek/${id}/${namn}`;

  function UtanHamta({ start, ...extra }) {
    const [vald, setVald] = useState(null);
    return (
      <OpsBibliotek poster={start} jag={{ uid: "uid-1", roll: "medlem" }} vald={vald} skapar={null}
        onOppna={setVald} onStang={() => setVald(null)} onSkapa={() => {}} onSpara={() => {}}
        filUrl={(p) => `https://exempel.se/${p.fil.sokvag}`} hubHref="/hub" {...extra} />
    );
  }

  /** @param {() => Promise<any>} svar */
  function stubba(svar) {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(svar);
    const oppnade = [];
    const openSpy = vi.spyOn(window, "open").mockImplementation((a) => { oppnade.push(a); return null; });
    const sparade = [];
    const klickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { sparade.push({ href: this.href, download: this.download }); });
    const typer = [];
    const skapa = URL.createObjectURL; const aterkalla = URL.revokeObjectURL;
    URL.createObjectURL = (b) => { typer.push(b.type); return "blob:x"; };
    URL.revokeObjectURL = () => {};
    const aterstall = () => { fetchSpy.mockRestore(); openSpy.mockRestore(); klickSpy.mockRestore(); URL.createObjectURL = skapa; URL.revokeObjectURL = aterkalla; };
    return { fetchSpy, oppnade, sparade, typer, aterstall };
  }

  for (const [fall, p, extra] of [
    ["en zip-fil", post("zip", "Post zip", { namn: "arkiv.zip", mime: "application/zip" }), {}],
    ["ett HTML-dokument (förut lagringens attachment-länk)", post("html", "Post html", { namn: "sida.html", mime: "text/html" }), { htmlVersioner: async () => [] }],
  ]) {
    it(`⛔ ${fall}: adressen hämtas och filen sparas med sitt namn som application/octet-stream`, async () => {
      const s = stubba(async () => ({ ok: true, status: 200, blob: async () => new Blob(["<b>hej</b>"], { type: "text/html" }) }));
      try {
        render(<UtanHamta start={[p]} {...extra} />);
        fireEvent.click(screen.getByRole("button", { name: p.rubrik }));
        fireEvent.click(await screen.findByRole("button", { name: "Ladda ned" }));
        await waitFor(() => expect(s.sparade).toEqual([{ href: "blob:x", download: p.fil.namn }]));
        expect(s.fetchSpy).toHaveBeenCalledWith(ADRESS(p.id, p.fil.namn));
        expect(s.typer).toEqual(["application/octet-stream"]);
        expect(s.oppnade).toEqual([]);
      } finally {
        s.aterstall();
      }
    });
  }

  it("⛔ faller hämtningen öppnas adressen som förut, och ingenting sparas", async () => {
    const p = post("zip", "Post zip", { namn: "arkiv.zip", mime: "application/zip" });
    const s = stubba(async () => ({ ok: false, status: 403, blob: async () => new Blob() }));
    try {
      render(<UtanHamta start={[p]} />);
      fireEvent.click(screen.getByRole("button", { name: "Post zip" }));
      fireEvent.click(await screen.findByRole("button", { name: "Ladda ned" }));
      await waitFor(() => expect(s.oppnade).toEqual([ADRESS("zip", "arkiv.zip")]));
      expect(s.fetchSpy).toHaveBeenCalledWith(ADRESS("zip", "arkiv.zip"));
      expect(s.sparade).toEqual([]);
    } finally {
      s.aterstall();
    }
  });
});
