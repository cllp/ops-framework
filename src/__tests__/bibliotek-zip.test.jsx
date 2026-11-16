import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { delningsDisposition } from "../node/delning.js";
import { FILMIME, MAX_BIBLIOTEKFIL, ZIP_MIME, byggPost, filContentTypeMonster, filInmatningsfel, filMimeMonster, filSort, lagringsContentDisposition, mimeForFil, mimeUrFilnamn, normaliseraMime } from "../lib/bibliotek.js";
import { lagringsregelfragment } from "../lib/regler.js";

/**
 * ⛔ HÄNDELSEN (0.234.0). CP 2026-11-16: "Kan vi lägga till zip-filer i biblioteket? Vore bra." och "Yes, kör zip". Ett zip-arkiv tas emot upp till 25 MB,
 * visas som en fil med namn, storlek och Ladda ned, utan förhandsvisning, och laddas alltid upp som en bilaga så att en direktlänk laddar ned det.
 */

const KIM = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const tid = 1_700_000_000_000;
const REGEL = () => lagringsregelfragment({ bibliotek: { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" } });

describe("⛔ zip i biblioteket", () => {
  it("ett zip-arkiv tas emot upp till 25 MB, och reglerna släpper in samma typ", () => {
    expect(ZIP_MIME).toBe("application/zip");
    expect(FILMIME).toContain("application/zip");
    expect(filInmatningsfel({ namn: "Bilder.zip", mime: "application/zip", byte: MAX_BIBLIOTEKFIL })).toBeNull();
    expect(filInmatningsfel({ namn: "Bilder.zip", mime: "application/zip", byte: MAX_BIBLIOTEKFIL + 1 })).not.toBeNull();
    expect(new RegExp(filMimeMonster()).test("application/zip")).toBe(true);
    expect(new RegExp(filContentTypeMonster()).test("application/zip")).toBe(true);
    expect(filSort("application/zip")).toBe("dokument");
  });

  it("application/x-zip-compressed och en tom typ blir application/zip före lagringen", () => {
    expect(normaliseraMime("application/x-zip-compressed")).toBe("application/zip");
    expect(normaliseraMime("application/x-zip")).toBe("application/zip");
    expect(mimeForFil("Bilder.zip", "application/x-zip-compressed")).toBe("application/zip");
    expect(mimeForFil("Bilder.zip", "")).toBe("application/zip");
    expect(mimeUrFilnamn("BILDER.ZIP")).toBe("application/zip");
    expect(filInmatningsfel({ namn: "Bilder.zip", mime: "application/x-zip-compressed", byte: 10 })).toBeNull();
  });

  it("⛔ uppladdningen bär attachment, och Storage-regeln kräver det av ett arkiv", async () => {
    /** @type {any[]} */
    const uppladdat = [];
    const kalla = createBibliotekskalla({
      source: createMemorySource(),
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare: () => KIM,
      lagring: { laddaUpp: async (/** @type {any} */ i) => { uppladdat.push(i); return { url: "x", sokvag: i.sokvag }; }, taBort: async () => {} },
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    const sparad = await kalla.laddaUppFil({ rubrik: "Bilder", fil: { name: "Bilder.zip", type: "application/x-zip-compressed", size: 40 } });
    expect(sparad.fil.mime).toBe("application/zip");
    expect(uppladdat[0].contentType).toBe("application/zip");
    expect(uppladdat[0].contentDisposition).toBe("attachment; filename=\"Bilder.zip\"; filename*=UTF-8''Bilder.zip");
    expect(lagringsContentDisposition("application/zip", "")).toMatch(/^attachment; filename="arkiv.zip"/);
    expect(REGEL()).toContain("request.resource.contentType.matches('^(text/html|application/zip).*') || (request.resource.contentDisposition != null");
    // En delad länk till ett arkiv är också en bilaga, med eller utan nedladdning.
    expect(delningsDisposition("Bilder.zip", false, "application/zip")).toMatch(/^attachment/);
    expect(delningsDisposition("a.pdf", false, "application/pdf")).toBe("inline");
  });

  it("ett okänt format tas fortfarande inte emot", () => {
    for (const mime of ["application/x-rar-compressed", "application/x-7z-compressed", "application/gzip", "application/x-tar"]) {
      expect(filInmatningsfel({ namn: "a.bin", mime, byte: 10 }), mime).not.toBeNull();
      expect(new RegExp(filMimeMonster()).test(mime), mime).toBe(false);
    }
  });

  it("⛔ detaljen visar namn, storlek och Ladda ned, utan förhandsvisning", () => {
    const post = {
      ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Bilder", fil: { sokvag: "grupper/cps-ab/bibliotek/p1/Bilder.zip", namn: "Bilder.zip", mime: "application/zip", byte: 2048, klar: true }, skapadAv: KIM, skapad: tid, andrad: tid }),
      id: "p1",
    };
    render(<OpsBibliotek poster={[post]} jag={{ uid: "uid-1", roll: "medlem" }} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} filUrl={() => "https://exempel.se/Bilder.zip"} hubHref="/hub" />);
    expect(screen.getAllByText(/Bilder\.zip/).length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/2(,0)? kB|2 KB|2048/);
    expect(document.querySelector("[data-bibliotek-ladda-ned]")).not.toBeNull();
    expect(document.querySelector("iframe, img, audio, video, pre, [data-karta], [data-textforhandsvisning]")).toBeNull();
  });
});
