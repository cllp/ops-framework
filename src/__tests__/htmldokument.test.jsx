import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsHtmlDokument } from "../components/OpsHtmlDokument.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { createHtmlDokumentService } from "../node/htmldokument.js";
import { delningsDisposition } from "../node/delning.js";
import { FILMIME, byggPost, filContentTypeMonster, filInmatningsfel, lagringsContentDisposition, lagringsContentType, mimeUrFilnamn, MAX_BIBLIOTEKFIL, postFel } from "../lib/bibliotek.js";
import { HTML_SANDBOX, HTML_UTSKRIFTSMEDDELANDE, HTML_UTSKRIFTSSKRIPT, HTML_LANKSKRIPT, arHtmlDokument, byggAterstallning, byggNyVersion, byggSrcdoc, htmlBytes, htmlText, nastaVersionssokvag, nuvarandeVersion, versionFel, versionslista, versionsnyckel } from "../lib/htmldokument.js";
import { bibliotekregelfragment, lagringsregelfragment, versionsregelfragment } from "../lib/regler.js";

/*
 * HTML-dokument i Biblioteket (0.156.0, cllp/ops-framework#472).
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: `text/html` finns inte bland formaten, rutan finns inte, och `htmldokument.js` och tjänsten saknas, så filen kan inte ens laddas. De enskilda skydden är mutationsprövade (se CHANGELOG 0.156.0):
 * med `allow-same-origin` i sandlådan, utan kontrollen av avsändaren i utskriftsskriptet, utan `attachment` och utan kravet på versionsnumret är de provsatser nedan som namnger dem röda.
 */

const rot = path.resolve(__dirname, "..", "..");
const tid = 1_700_000_000_000;
const KIM = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const ANNA = { uid: "uid-2", namn: "Anna", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const PLATS = "cps-ab";

const html = (/** @type {string} */ namn = "rapport.html", extra = {}) => ({
  ...byggPost({ groupId: PLATS, typ: "fil", rubrik: "Rapport", fil: { sokvag: `grupper/${PLATS}/bibliotek/p1/${namn}`, namn, mime: "text/html", byte: 20, klar: true }, skapadAv: KIM, skapad: tid, andrad: tid, ...extra }),
  id: "p1",
});

describe("text/html som filtyp", () => {
  it("är ett giltigt format med samma tak som text, och namnet .html ger typen", () => {
    expect(FILMIME).toContain("text/html");
    expect(filInmatningsfel({ namn: "r.html", mime: "text/html", byte: 100 })).toBeNull();
    expect(filInmatningsfel({ namn: "r.html", mime: "text/html; charset=utf-8", byte: MAX_BIBLIOTEKFIL })).toBeNull();
    expect(filInmatningsfel({ namn: "r.html", mime: "text/html", byte: MAX_BIBLIOTEKFIL + 1 })).toMatch(/Taket är/);
    expect(filInmatningsfel({ namn: "r.html", mime: "text/html", byte: 0 })).toMatch(/tom/);
    expect(mimeUrFilnamn("rapport.html")).toBe("text/html");
    expect(mimeUrFilnamn("rapport.HTM")).toBe("text/html");
  });

  it("⛔ lagras som text/html; charset=utf-8 och Storage-regelns uttryck släpper in båda formerna, och bara dem", () => {
    expect(lagringsContentType("text/html")).toBe("text/html; charset=utf-8");
    const sluten = new RegExp(filContentTypeMonster());
    expect(sluten.test("text/html")).toBe(true);
    expect(sluten.test("text/html; charset=utf-8")).toBe(true);
    expect(sluten.test("text/html; charset=iso-8859-1")).toBe(false);
    expect(sluten.test("application/xhtml+xml")).toBe(false);
    expect(lagringsregelfragment({ bibliotek: { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" } })).toContain("text/html(; charset=utf-8)?");
  });

  it("⛔ en direktlänk laddas ned: uppladdningen bär attachment med filnamnet, bara för HTML", () => {
    const d = lagringsContentDisposition("text/html", "Rapport över året.html");
    expect(d).toMatch(/^attachment; filename="Rapport _ver _ret.html"; filename\*=UTF-8''/);
    expect(d).toContain("Rapport%20%C3%B6ver%20%C3%A5ret.html");
    expect(lagringsContentDisposition("text/html; charset=utf-8", 'a"b.html')).toMatch(/^attachment; filename="a_b.html"/);
    expect(lagringsContentDisposition("application/pdf", "a.pdf")).toBeUndefined();
    expect(lagringsContentDisposition("text/plain", "a.txt")).toBeUndefined();
    // Reglerna kräver det på Storage, och kräver det bara av HTML.
    const regel = lagringsregelfragment({ bibliotek: { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" } });
    expect(regel).toContain("request.resource.contentDisposition.matches('^attachment(;.*)?$')");
    expect(regel).toContain("resource == null || !resource.contentType.matches('^text/html.*')");
  });

  it("⛔ uppladdningen av ett HTML-dokument bär typ, teckenkodning och attachment, en PDF bär ingen rubrik", async () => {
    /** @type {any[]} */
    const uppladdat = [];
    const kalla = createBibliotekskalla({
      source: createMemorySource(),
      collection: "bibliotek",
      groupId: PLATS,
      skapare: () => KIM,
      lagring: { laddaUpp: async (i) => { uppladdat.push(i); return { url: "x", sokvag: i.sokvag }; }, taBort: async () => {} },
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    const sparad = await kalla.laddaUppFil({ rubrik: "Rapport", fil: { name: "rapport.html", type: "text/html", size: 40 } });
    expect(sparad.fil.mime).toBe("text/html");
    expect(uppladdat[0].contentType).toBe("text/html; charset=utf-8");
    expect(uppladdat[0].contentDisposition).toBe('attachment; filename="rapport.html"; filename*=UTF-8\'\'rapport.html');
    await kalla.laddaUppFil({ rubrik: "Kvitto", fil: { name: "k.pdf", type: "application/pdf", size: 20 } });
    expect(uppladdat[1].contentType).toBe("application/pdf");
    expect("contentDisposition" in uppladdat[1]).toBe(false);
    // Typen kommer ur namnet när webbläsaren inte säger någon.
    const ur = await kalla.laddaUppFil({ rubrik: "Namn", fil: { name: "x.html", type: "", size: 10 } });
    expect(ur.fil.mime).toBe("text/html");
  });

  it("ett HTML-dokument ersätts inte med en ny fil på den gamla vägen: det är en ny version, och skälet sägs", async () => {
    const source = createMemorySource();
    const kalla = createBibliotekskalla({
      source,
      collection: "bibliotek",
      groupId: PLATS,
      skapare: () => KIM,
      lagring: { laddaUpp: async (i) => ({ url: "x", sokvag: i.sokvag }), taBort: async () => {} },
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    const ny = await kalla.laddaUppFil({ rubrik: "Rapport", fil: { name: "rapport.html", type: "text/html", size: 40 } });
    await expect(kalla.laddaUppFil({ id: ny.id, fil: { name: "rapport.html", type: "text/html", size: 41 } })).rejects.toThrow(/ny version/);
  });

  it("posten bär version bara på ett HTML-dokument, och byggPost släpper igenom den", () => {
    const med = { nr: 2, av: ANNA, tid: tid + 1 };
    expect(postFel({ ...html(), version: med })).toBeNull();
    expect(byggPost({ ...html(), version: med }).version).toEqual(med);
    expect(postFel({ ...html(), version: { ...med, nr: 1 } })).toMatch(/från 2/);
    expect(postFel({ ...html(), version: { ...med, extra: 1 } })).toMatch(/extra/);
    expect(postFel({ ...html(), version: { ...med, av: { ...ANNA, typ: "agent" } } })).toMatch(/manniska/);
    expect(postFel({ ...html("kvitto.pdf"), fil: { sokvag: "g/x/bibliotek/p1/k.pdf", namn: "k.pdf", mime: "application/pdf", byte: 4 }, version: med })).toMatch(/Bara ett HTML-dokument/);
    expect(postFel({ groupId: PLATS, typ: "anteckning", rubrik: "A", text: "x", skapadAv: KIM, skapad: tid, andrad: tid, version: med })).toMatch(/hör inte dit/);
  });
});

describe("Rutan", () => {
  it("⛔ sandboxen är exakt allow-scripts allow-modals, och allow-same-origin och de andra saknas", () => {
    expect(HTML_SANDBOX).toBe("allow-scripts allow-modals");
    render(<OpsHtmlDokument html="<h1>Hej</h1>" namn="rapport.html" skapadAv={KIM} />);
    const ram = document.querySelector("iframe");
    expect(ram?.getAttribute("sandbox")).toBe("allow-scripts allow-modals");
    const delar = (ram?.getAttribute("sandbox") ?? "").split(/\s+/);
    for (const forbjudet of ["allow-same-origin", "allow-top-navigation", "allow-top-navigation-by-user-activation", "allow-popups", "allow-popups-to-escape-sandbox", "allow-forms", "allow-pointer-lock", "allow-presentation", "allow-downloads"]) {
      expect(delar, forbjudet).not.toContain(forbjudet);
    }
  });

  it("⛔ innehållet ges som srcdoc, aldrig som adress, och skriptet för utskriften ligger först", () => {
    render(<OpsHtmlDokument html="<!doctype html><html><body><h1>Hej</h1></body></html>" namn="rapport.html" skapadAv={KIM} />);
    const ram = /** @type {HTMLIFrameElement} */ (document.querySelector("iframe"));
    expect(ram.hasAttribute("src")).toBe(false);
    const doc = ram.getAttribute("srcdoc") ?? "";
    expect(doc).toContain("<h1>Hej</h1>");
    expect(doc.indexOf("<script>")).toBeGreaterThanOrEqual(0);
    expect(doc.indexOf("<script>")).toBeLessThan(doc.indexOf("<h1>"));
  });

  it("byggSrcdoc lägger skriptet först, men efter en inledande doctype", () => {
    expect(byggSrcdoc("<p>x</p>").startsWith("<script>")).toBe(true);
    expect(byggSrcdoc("<!DOCTYPE html><p>x</p>")).toBe(`<!DOCTYPE html><script>${HTML_UTSKRIFTSSKRIPT}${HTML_LANKSKRIPT}</script><p>x</p>`);
    expect(byggSrcdoc("﻿  <!doctype html>\n<p>x</p>").indexOf("<script>")).toBeGreaterThan(0);
    expect(byggSrcdoc("")).toBe(`<script>${HTML_UTSKRIFTSSKRIPT}${HTML_LANKSKRIPT}</script>`);
  });

  it("⛔ rutan är märkt med filens namn och vem som laddade upp den, och med att innehållet inte är appens", () => {
    render(<OpsHtmlDokument html="<p>x</p>" namn="Årsrapport.html" skapadAv={{ ...KIM, via: { nyckelId: "k1", namn: "Byggagent" } }} />);
    const markning = document.querySelector("[data-html-dokument-markning]")?.textContent ?? "";
    expect(markning).toContain("Årsrapport.html");
    expect(markning).toContain("Kim via Byggagent");
    expect(markning).toMatch(/avskilt från appen/);
    expect(markning).toMatch(/lösenord/);
    expect(document.querySelector("iframe")?.getAttribute("title")).toBe("HTML-dokument: Årsrapport.html");
  });

  it("⛔ Spara som PDF skickar ett utskriftsmeddelande till rutan", () => {
    render(<OpsHtmlDokument html="<p>x</p>" namn="rapport.html" />);
    const ram = /** @type {HTMLIFrameElement} */ (document.querySelector("iframe"));
    const skicka = vi.fn();
    Object.defineProperty(ram, "contentWindow", { value: { postMessage: skicka }, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "Spara som PDF" }));
    expect(skicka).toHaveBeenCalledTimes(1);
    expect(skicka).toHaveBeenCalledWith({ typ: HTML_UTSKRIFTSMEDDELANDE }, "*");
  });

  /** Kör skriptet som det körs i rutan: `window` och `parent` är parametrar, så vi bestämmer vem som är föräldern. */
  function kor(/** @type {object} */ foralder) {
    /** @type {Array<(e: any) => void>} */
    const lyssnare = [];
    const print = vi.fn();
    const fonster = { addEventListener: (/** @type {string} */ typ, /** @type {(e: any) => void} */ f) => { if (typ === "message") lyssnare.push(f); }, print };
    new Function("window", "parent", HTML_UTSKRIFTSSKRIPT)(fonster, foralder);
    return { print, skicka: (/** @type {any} */ e) => lyssnare.forEach((f) => f(e)) };
  }

  it("⛔ utskriften körs bara för ett meddelande från föräldern, och bara med rätt typ", () => {
    const foralder = {};
    const { print, skicka } = kor(foralder);
    skicka({ source: foralder, data: { typ: HTML_UTSKRIFTSMEDDELANDE } });
    expect(print).toHaveBeenCalledTimes(1);
    // Ett annat fönster, rutans egen kod och en ram utan avsändare gör ingenting.
    skicka({ source: {}, data: { typ: HTML_UTSKRIFTSMEDDELANDE } });
    skicka({ source: null, data: { typ: HTML_UTSKRIFTSMEDDELANDE } });
    skicka({ source: undefined, data: { typ: HTML_UTSKRIFTSMEDDELANDE } });
    expect(print).toHaveBeenCalledTimes(1);
    // Rätt avsändare men fel eller saknad typ.
    skicka({ source: foralder, data: { typ: "annat" } });
    skicka({ source: foralder, data: "ops-framework:skriv-ut" });
    skicka({ source: foralder, data: null });
    skicka({ source: foralder });
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("detaljen i Biblioteket ritar HTML i rutan med hamtaFil, och länken under är en nedladdning", async () => {
    const post = html("rapport.html");
    const hamtaFil = vi.fn(async () => new Blob(["<h1>Årets siffror</h1>"], { type: "text/html" }));
    render(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} hamtaFil={hamtaFil} />);
    await waitFor(() => expect(document.querySelector("iframe")).not.toBeNull());
    expect(hamtaFil).toHaveBeenCalledWith(post.fil.sokvag);
    expect(document.querySelector("iframe")?.getAttribute("srcdoc")).toContain("Årets siffror");
    expect(document.querySelector("iframe")?.getAttribute("sandbox")).toBe("allow-scripts allow-modals");
    const lank = screen.getByRole("link", { name: /rapport\.html/ });
    expect(lank).toHaveAttribute("href", "https://lagring.example/fil");
    expect(lank).toHaveAttribute("download", "rapport.html");
    expect(document.body.textContent).toContain("Skriven av Kim");
  });

  it("utan hamtaFil ritas ingen ruta: bara nedladdningen", async () => {
    const post = html("rapport.html");
    render(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} />);
    await screen.findByRole("link", { name: /rapport\.html/ });
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("ett fel vid hämtningen och en tom fil säger det, i stället för en tom ruta", async () => {
    const post = html("rapport.html");
    const { unmount } = render(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} hamtaFil={async () => { throw new Error("nätet"); }} />);
    expect(await screen.findByText(/Dokumentet gick inte att visa/)).toBeTruthy();
    unmount();
    render(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} hamtaFil={async () => new Blob([""])} />);
    expect(await screen.findByText("Dokumentet är tomt.")).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("Delning och gäster: en HTML-fil är alltid en nedladdning", () => {
  it("⛔ delningsDisposition är attachment för HTML också när nedladdning är av", () => {
    expect(delningsDisposition("r.html", false, "text/html")).toMatch(/^attachment; filename="r.html"/);
    expect(delningsDisposition("r.html", false, "text/html; charset=utf-8")).toMatch(/^attachment/);
    expect(delningsDisposition("r.pdf", false, "application/pdf")).toBe("inline");
    expect(delningsDisposition("r.pdf", false)).toBe("inline");
    expect(delningsDisposition("r.pdf", true, "application/pdf")).toMatch(/^attachment/);
  });
});

describe("Versionsmodellen", () => {
  const ny = (/** @type {Record<string, any>} */ post, sokvag = `grupper/${PLATS}/bibliotek/p1/v2-rapport.html`, av = ANNA, nu = tid + 5000) => byggNyVersion({ post, postId: "p1", sokvag, byte: 30, av, nu });

  it("ett dokument som aldrig uppdaterats är version 1, skriven av skaparen när den skapades", () => {
    const v = nuvarandeVersion(html());
    expect(v.nr).toBe(1);
    expect(v.av.uid).toBe("uid-1");
    expect(v.tid).toBe(tid);
    expect(() => nuvarandeVersion({ typ: "fil", fil: { mime: "application/pdf" } })).toThrow(/bara ett HTML-dokument/);
    expect(arHtmlDokument(html())).toBe(true);
    expect(arHtmlDokument({ typ: "anteckning" })).toBe(false);
  });

  it("en ny version ger det ersatta versionsdokumentet (exakt posten som den var) och postens nya fält", () => {
    const post = html();
    const v = ny(post);
    expect(v.id).toBe("p1|1");
    expect(v.nr).toBe(1);
    expect(v.version).toEqual({ groupId: PLATS, postId: "p1", nr: 1, fil: post.fil, av: post.skapadAv, tid });
    expect(v.post.version).toEqual({ nr: 2, av: ANNA, tid: tid + 5000 });
    expect(v.post.andrad).toBe(tid + 5000);
    expect(v.post.fil).toEqual({ sokvag: `grupper/${PLATS}/bibliotek/p1/v2-rapport.html`, namn: "rapport.html", mime: "text/html", byte: 30, klar: true });
    expect(versionFel(v.version)).toBeNull();
    // En andra uppdatering: version 2:s dokument bär 2:s skrivare och tid.
    const efter = { ...post, ...v.post };
    const v3 = ny(efter, `grupper/${PLATS}/bibliotek/p1/v3-rapport.html`, KIM, tid + 9000);
    expect(v3.id).toBe("p1|2");
    expect(v3.version.av).toEqual(ANNA);
    expect(v3.version.tid).toBe(tid + 5000);
    expect(v3.post.version.nr).toBe(3);
  });

  it("kastar för det som inte är en ny version: samma fil, en annan mapp, en tom fil, ingen skrivare, en agent, ett dokument som inte är klart", () => {
    const post = html();
    expect(() => ny(post, post.fil.sokvag)).toThrow(/samma fil/);
    expect(() => ny(post, "grupper/andra/bibliotek/p1/x.html")).toThrow(/samma mapp/);
    expect(() => ny(post, `grupper/${PLATS}/bibliotek/p1/../x.html`)).toThrow(/går inte att läsa/);
    expect(() => byggNyVersion({ post, postId: "p1", sokvag: `grupper/${PLATS}/bibliotek/p1/v2.html`, byte: 0, av: ANNA, nu: tid })).toThrow(/tom/);
    expect(() => byggNyVersion({ post, postId: "p1", sokvag: `grupper/${PLATS}/bibliotek/p1/v2.html`, byte: MAX_BIBLIOTEKFIL + 1, av: ANNA, nu: tid })).toThrow(/Taket/);
    expect(() => ny(post, undefined, { namn: "Ingen" })).toThrow(/saknar vem/);
    expect(() => ny(post, undefined, { ...ANNA, typ: "agent" })).toThrow(/manniska/);
    expect(() => ny({ ...post, fil: { ...post.fil, klar: false } })).toThrow(/inte uppladdad/);
    expect(() => byggNyVersion({ post: html("k.html"), postId: "a|b", sokvag: "x", byte: 1, av: ANNA, nu: 1 })).toThrow();
  });

  it("nyckeln är postId och nr, och ett postid med skiljetecknet är inget postid", () => {
    expect(versionsnyckel("p1", 3)).toBe("p1|3");
    expect(() => versionsnyckel("p|1", 1)).toThrow(/inte ett postid/);
    expect(() => versionsnyckel("p1", 0)).toThrow(/heltal/);
    expect(() => versionsnyckel("p1", 1.5)).toThrow();
  });

  it("versionslistan är härledd: den nuvarande ur posten, de ersatta ur dokumenten, och en som saknas står med saknas", () => {
    const v1 = html();
    const s2 = ny(v1);
    const v2 = { ...v1, ...s2.post };
    const s3 = ny(v2, `grupper/${PLATS}/bibliotek/p1/v3-rapport.html`, KIM, tid + 9000);
    const v3 = { ...v2, ...s3.post };
    const hel = versionslista({ post: v3, postId: "p1", versioner: [s2.version, s3.version] });
    expect(hel.nuvarande).toBe(3);
    expect(hel.versioner.map((v) => [v.nr, v.nuvarande, v.saknas])).toEqual([[3, true, false], [2, false, false], [1, false, false]]);
    expect(hel.saknas).toEqual([]);
    expect(hel.versioner[0].fil?.sokvag).toBe(v3.fil.sokvag);
    // Version 2:s dokument borta: raden finns kvar och säger det.
    const lucka = versionslista({ post: v3, postId: "p1", versioner: [s2.version] });
    expect(lucka.saknas).toEqual([2]);
    expect(lucka.versioner.find((v) => v.nr === 2)).toMatchObject({ saknas: true, fil: null, av: null, tid: null });
    // Ett dokument som hör till en annan post eller plats räknas inte.
    const fel = versionslista({ post: v3, postId: "p1", versioner: [{ ...s3.version, postId: "p9" }, { ...s2.version, groupId: "andra" }] });
    expect(fel.saknas).toEqual([2, 1]);
    // Ett dokument som aldrig uppdaterats har en rad.
    expect(versionslista({ post: v1, postId: "p1", versioner: [] })).toEqual({ nuvarande: 1, versioner: [{ nr: 1, nuvarande: true, fil: v1.fil, av: v1.skapadAv, tid, saknas: false }], saknas: [] });
  });

  it("en återställning är en NY version som pekar på det gamla objektet, och historiken är rak", () => {
    const v1 = html();
    const s2 = ny(v1);
    const v2 = { ...v1, ...s2.post };
    const s3 = ny(v2, `grupper/${PLATS}/bibliotek/p1/v3-rapport.html`, KIM, tid + 9000);
    const v3 = { ...v2, ...s3.post };
    const att = byggAterstallning({ post: v3, postId: "p1", versioner: [s2.version, s3.version], nr: 1, av: ANNA, nu: tid + 20000 });
    expect(att.post.version.nr).toBe(4);
    expect(att.post.fil.sokvag).toBe(v1.fil.sokvag);
    expect(att.version.nr).toBe(3);
    expect(att.id).toBe("p1|3");
    expect(() => byggAterstallning({ post: v3, postId: "p1", versioner: [s2.version, s3.version], nr: 3, av: ANNA, nu: tid })).toThrow(/redan den nuvarande/);
    expect(() => byggAterstallning({ post: v3, postId: "p1", versioner: [s2.version, s3.version], nr: 9, av: ANNA, nu: tid })).toThrow(/ingen version 9/);
    expect(() => byggAterstallning({ post: v3, postId: "p1", versioner: [s3.version], nr: 1, av: ANNA, nu: tid })).toThrow(/saknas i historiken/);
    expect(() => byggAterstallning({ post: v3, postId: "p1", versioner: [s2.version, s3.version], nr: 0, av: ANNA, nu: tid })).toThrow(/heltal/);
  });

  it("texten blir byte och tillbaka, med svenska tecken hela, och en tom eller för stor text avvisas", () => {
    expect(htmlText(htmlBytes("<p>Här är vår rapport</p>"))).toBe("<p>Här är vår rapport</p>");
    expect(htmlText(new Uint8Array([0x68, 0xe4, 0x72]))).toBe("här");
    expect(() => htmlBytes("   ")).toThrow(/tomt/);
    expect(() => htmlBytes(5)).toThrow(/text/);
    expect(() => htmlBytes("a".repeat(MAX_BIBLIOTEKFIL + 1))).toThrow(/Taket/);
  });

  it("nästa sökväg är v<nr>-<slump>-<namn> i dokumentets egen mapp", () => {
    expect(nastaVersionssokvag(html())).toBe(`grupper/${PLATS}/bibliotek/p1/v2-rapport.html`);
    expect(nastaVersionssokvag(html(), "3f9a1c2e")).toBe(`grupper/${PLATS}/bibliotek/p1/v2-3f9a1c2e-rapport.html`);
    expect(() => nastaVersionssokvag(html(), "../x")).toThrow(/slump/);
  });
});

describe("Regelfragmenten för versionerna", () => {
  it("utan versioner går ett HTML-dokuments fil inte att byta alls, och med versioner kräver steget versionsdokumentet", () => {
    const utan = bibliotekregelfragment("bibliotek");
    expect(utan).toContain("|| false;");
    expect(utan).not.toContain("existsAfter(/databases");
    const med = bibliotekregelfragment("bibliotek", { versioner: "bibliotekversioner" });
    expect(med).toContain("existsAfter(/databases/$(database)/documents/bibliotekversioner/$(postId + '|' + string(opsBibliotekVersionNr(fore))))");
    expect(med).not.toContain("|| false;");
    expect(med).toContain("efter.version.nr == opsBibliotekVersionNr(fore) + 1");
  });

  it("versionsfragmentet är bara en skrivning: ingen ändring och ingen radering, och namnen prövas", () => {
    const f = versionsregelfragment("bibliotekversioner", { bibliotek: "bibliotek" });
    expect(f).toContain("allow update, delete: if false;");
    expect(f).toContain("getAfter(/databases/$(database)/documents/bibliotek/$(d.postId)).data.fil.sokvag != d.fil.sokvag");
    expect(() => versionsregelfragment("bibliotek", { bibliotek: "bibliotek" })).toThrow(/dela samling/);
    expect(() => versionsregelfragment("memberships", { bibliotek: "bibliotek" })).toThrow(/ramverkets egna/);
    expect(() => versionsregelfragment("../x", { bibliotek: "bibliotek" })).toThrow();
  });

  it("fixturerna för reglerna utan versioner är de sparade", () => {
    const fixtur = (/** @type {string} */ n) => fs.readFileSync(path.join(rot, "rules", "__fixturer__", n), "utf8");
    expect(bibliotekregelfragment("bibliotek")).toBe(fixtur("bibliotekregelfragment-0.128.0.rules"));
    expect(lagringsregelfragment({ bibliotek: { gruppPrefix: "grupper", postPrefix: "bibliotek", samling: "bibliotek" } })).toBe(fixtur("lagringsregelfragment-0.127.0.rules"));
  });
});

/** En lagring i minnet som vägrar skriva över, som Storage-regeln. */
function minneslagring() {
  /** @type {Map<string, Uint8Array>} */
  const objekt = new Map();
  /** @type {any[]} */
  const skrivna = [];
  return {
    objekt,
    skrivna,
    las: async (/** @type {string} */ sokvag) => {
      const b = objekt.get(sokvag);
      if (!b) throw new Error(`objektet ${sokvag} finns inte`);
      return b;
    },
    skriv: async (/** @type {any} */ i) => {
      if (objekt.has(i.sokvag)) throw new Error(`objektet ${i.sokvag} finns redan och skrivs inte över`);
      objekt.set(i.sokvag, i.bytes);
      skrivna.push(i);
    },
  };
}

async function tjanst(text = "<h1>Version ett</h1>") {
  const source = createMemorySource();
  const lagring = minneslagring();
  let klocka = tid + 1000;
  const post = html();
  lagring.objekt.set(post.fil.sokvag, new TextEncoder().encode(text));
  const { id, ...rad } = post;
  await source.create("bibliotek", { ...rad, id: "p1" });
  const service = createHtmlDokumentService({ kalla: source, samlingar: { bibliotek: "bibliotek", versioner: "bibliotekversioner" }, lagring, klocka: () => (klocka += 1000) });
  return { source, lagring, service };
}

describe("Servern: läsa, uppdatera, lista och återställa", () => {
  it("läser dokumentet som text, med vilken version det är och vem som skrev den", async () => {
    const { service } = await tjanst("<h1>Här är vår rapport</h1>");
    const l = await service.las({ plats: PLATS, postId: "p1" });
    expect(l).toMatchObject({ postId: "p1", plats: PLATS, namn: "rapport.html", rubrik: "Rapport", nr: 1, text: "<h1>Här är vår rapport</h1>" });
    expect(l.av.uid).toBe("uid-1");
  });

  it("⛔ ett dokument på en annan plats, som inte finns eller som inte är HTML svarar finns-inte eller inte-html", async () => {
    const { service, source } = await tjanst();
    await expect(service.las({ plats: "andra-ab", postId: "p1" })).rejects.toMatchObject({ kod: "finns-inte" });
    await expect(service.las({ plats: PLATS, postId: "saknas" })).rejects.toMatchObject({ kod: "finns-inte" });
    await source.create("bibliotek", { id: "a1", groupId: PLATS, typ: "anteckning", rubrik: "A", text: "x", skapadAv: KIM, skapad: tid, andrad: tid });
    await expect(service.las({ plats: PLATS, postId: "a1" })).rejects.toMatchObject({ kod: "inte-html" });
    await expect(service.uppdatera({ plats: "andra-ab", postId: "p1", text: "<p>x</p>", av: ANNA, skarpt: true })).rejects.toMatchObject({ kod: "finns-inte" });
    await expect(service.versioner({ plats: "andra-ab", postId: "p1" })).rejects.toMatchObject({ kod: "finns-inte" });
  });

  it("⛔ en uppdatering skapar en ny version, den förra finns kvar och läses som text, och objekten har egna sökvägar", async () => {
    const { service, lagring, source } = await tjanst();
    const r = await service.uppdatera({ plats: PLATS, postId: "p1", text: "<h1>Version två</h1>", av: ANNA, skarpt: true });
    expect(r).toMatchObject({ skarpt: true, ny: true, nr: 2, tidigareNr: 1, sokvag: expect.stringMatching(/^grupper\/cps-ab\/bibliotek\/p1\/v2-[0-9a-f]{8}-rapport\.html$/) });
    expect((await service.las({ plats: PLATS, postId: "p1" })).text).toBe("<h1>Version två</h1>");
    expect((await service.lasVersion({ plats: PLATS, postId: "p1", nr: 1 })).text).toBe("<h1>Version ett</h1>");
    expect((await service.lasVersion({ plats: PLATS, postId: "p1", nr: 2 })).nuvarande).toBe(true);
    // Filen lades upp som en bilaga med rätt typ.
    expect(lagring.skrivna[0]).toMatchObject({ contentType: "text/html; charset=utf-8" });
    expect(lagring.skrivna[0].contentDisposition).toMatch(/^attachment/);
    // Versionsdokumentet för den ersatta versionen ligger i sin samling med rätt nyckel.
    expect(await source.read("bibliotekversioner", "p1|1")).toMatchObject({ postId: "p1", nr: 1, groupId: PLATS });
    const lista = await service.versioner({ plats: PLATS, postId: "p1" });
    expect(lista.versioner.map((v) => [v.nr, v.nuvarande])).toEqual([[2, true], [1, false]]);
    expect(lista.versioner[0].av?.uid).toBe("uid-2");
  });

  it("⛔ torrt skriver ingenting men svarar vad som hade hänt, och skarpt måste sägas", async () => {
    const { service, lagring, source } = await tjanst();
    const torrt = await service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>ny</p>", av: ANNA, skarpt: false });
    expect(torrt).toMatchObject({ skarpt: false, ny: true, nr: 2, tidigareNr: 1 });
    expect(lagring.skrivna).toHaveLength(0);
    expect(await source.list("bibliotekversioner", {})).toHaveLength(0);
    expect((await service.las({ plats: PLATS, postId: "p1" })).nr).toBe(1);
    await expect(service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>ny</p>", av: ANNA })).rejects.toMatchObject({ kod: "ogiltigt" });
    await expect(service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>ny</p>", av: ANNA, skarpt: "true" })).rejects.toMatchObject({ kod: "ogiltigt" });
    await expect(service.aterstall({ plats: PLATS, postId: "p1", nr: 1, av: ANNA })).rejects.toMatchObject({ kod: "ogiltigt" });
  });

  it("⛔ oförändrad text är ingen ny version, så en omsändning ger aldrig en dubblett", async () => {
    const { service, lagring } = await tjanst();
    const a = await service.uppdatera({ plats: PLATS, postId: "p1", text: "<h1>Version två</h1>", av: ANNA, skarpt: true });
    const b = await service.uppdatera({ plats: PLATS, postId: "p1", text: "<h1>Version två</h1>", av: ANNA, skarpt: true });
    expect(a.ny).toBe(true);
    expect(b).toMatchObject({ ny: false, orsak: "oforandrad", nr: 2 });
    // Samma sak torrt, och med fran: omsändningen av ett anrop som redan lyckats är ingen konflikt.
    expect(await service.uppdatera({ plats: PLATS, postId: "p1", text: "<h1>Version två</h1>", av: ANNA, fran: 1, skarpt: false })).toMatchObject({ ny: false });
    expect(lagring.skrivna).toHaveLength(1);
    expect((await service.versioner({ plats: PLATS, postId: "p1" })).versioner).toHaveLength(2);
  });

  it("⛔ fran: den som utgick från en äldre version får en konflikt och ingenting skrivs", async () => {
    const { service, lagring } = await tjanst();
    await service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>två</p>", av: ANNA, fran: 1, skarpt: true });
    await expect(service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>tre annat</p>", av: KIM, fran: 1, skarpt: true })).rejects.toMatchObject({ kod: "konflikt" });
    expect(lagring.skrivna).toHaveLength(1);
    expect((await service.las({ plats: PLATS, postId: "p1" })).text).toBe("<p>två</p>");
    await service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>tre</p>", av: KIM, fran: 2, skarpt: true });
    await expect(service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>fyra</p>", av: KIM, fran: "2", skarpt: true })).rejects.toMatchObject({ kod: "ogiltigt" });
  });

  it("⛔ två som skriver samtidigt ur samma version: den ena lyckas, den andra får konflikt, och historiken är hel", async () => {
    const { service, source } = await tjanst();
    const [a, b] = await Promise.allSettled([
      service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>A</p>", av: ANNA, fran: 1, skarpt: true }),
      service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>B</p>", av: KIM, fran: 1, skarpt: true }),
    ]);
    const utfall = [a, b].map((r) => r.status);
    expect(utfall.filter((s) => s === "fulfilled")).toHaveLength(1);
    const fel = [a, b].find((r) => r.status === "rejected");
    expect(/** @type {any} */ (fel).reason.kod).toBe("konflikt");
    const lista = await service.versioner({ plats: PLATS, postId: "p1" });
    expect(lista.versioner.map((v) => v.nr)).toEqual([2, 1]);
    expect(lista.saknas).toEqual([]);
    expect(await source.list("bibliotekversioner", {})).toHaveLength(1);
  });

  it("en text som är tom eller för stor avvisas med en kod", async () => {
    const { service } = await tjanst();
    await expect(service.uppdatera({ plats: PLATS, postId: "p1", text: "  ", av: ANNA, skarpt: true })).rejects.toMatchObject({ kod: "tomt" });
    await expect(service.uppdatera({ plats: PLATS, postId: "p1", text: "a".repeat(MAX_BIBLIOTEKFIL + 1), av: ANNA, skarpt: true })).rejects.toMatchObject({ kod: "for-stor" });
    await expect(service.uppdatera({ plats: PLATS, postId: "p1", text: 7, av: ANNA, skarpt: true })).rejects.toMatchObject({ kod: "ogiltigt" });
    await expect(service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>x</p>", av: { namn: "Ingen" }, skarpt: true })).rejects.toMatchObject({ kod: "ogiltigt" });
  });

  it("⛔ en återställning är en ny version med det gamla innehållet, och alla versioner finns kvar", async () => {
    const { service, lagring } = await tjanst("<h1>Ett</h1>");
    await service.uppdatera({ plats: PLATS, postId: "p1", text: "<h1>Två</h1>", av: ANNA, skarpt: true });
    await service.uppdatera({ plats: PLATS, postId: "p1", text: "<h1>Tre</h1>", av: ANNA, skarpt: true });
    const torrt = await service.aterstall({ plats: PLATS, postId: "p1", nr: 1, av: KIM, skarpt: false });
    expect(torrt).toMatchObject({ ny: true, nr: 4, aterstallning: 1 });
    expect((await service.versioner({ plats: PLATS, postId: "p1" })).nuvarande).toBe(3);
    const r = await service.aterstall({ plats: PLATS, postId: "p1", nr: 1, av: KIM, fran: 3, skarpt: true });
    expect(r).toMatchObject({ ny: true, nr: 4, tidigareNr: 3, aterstallning: 1 });
    expect((await service.las({ plats: PLATS, postId: "p1" })).text).toBe("<h1>Ett</h1>");
    const lista = await service.versioner({ plats: PLATS, postId: "p1" });
    expect(lista.versioner.map((v) => v.nr)).toEqual([4, 3, 2, 1]);
    for (const [nr, text] of [[1, "<h1>Ett</h1>"], [2, "<h1>Två</h1>"], [3, "<h1>Tre</h1>"], [4, "<h1>Ett</h1>"]]) {
      expect((await service.lasVersion({ plats: PLATS, postId: "p1", nr: /** @type {number} */ (nr) })).text, `version ${nr}`).toBe(text);
    }
    // Ingen ny fil skrevs för återställningen: bara version 2 och 3 har skrivits.
    expect(lagring.skrivna).toHaveLength(2);
    // Igen: nuvarande har redan det innehållet.
    expect(await service.aterstall({ plats: PLATS, postId: "p1", nr: 1, av: KIM, skarpt: true })).toMatchObject({ ny: false, orsak: "oforandrad" });
    expect(await service.aterstall({ plats: PLATS, postId: "p1", nr: 4, av: KIM, skarpt: true })).toMatchObject({ ny: false });
    await expect(service.aterstall({ plats: PLATS, postId: "p1", nr: 9, av: KIM, skarpt: true })).rejects.toMatchObject({ kod: "version-saknas" });
    await expect(service.lasVersion({ plats: PLATS, postId: "p1", nr: 9 })).rejects.toMatchObject({ kod: "version-saknas" });
  });

  it("en historik med lucka säger det i stället för att tiga, och en saknad version går inte att återställa", async () => {
    const { service, source } = await tjanst();
    await service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>två</p>", av: ANNA, skarpt: true });
    await source.remove("bibliotekversioner", "p1|1");
    const lista = await service.versioner({ plats: PLATS, postId: "p1" });
    expect(lista.saknas).toEqual([1]);
    await expect(service.aterstall({ plats: PLATS, postId: "p1", nr: 1, av: KIM, skarpt: true })).rejects.toMatchObject({ kod: "version-saknas" });
  });

  it("⛔ faller flyttningen av posten tas versionsnumret tillbaka, och ingen annan versions dokument rörs", async () => {
    const { service, source } = await tjanst();
    const verklig = source.updateIf;
    source.updateIf = async (...a) => {
      throw new Error("databasen föll");
    };
    await expect(service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>två</p>", av: ANNA, skarpt: true })).rejects.toThrow("databasen föll");
    expect(await source.list("bibliotekversioner", {})).toHaveLength(0);
    source.updateIf = verklig;
    // Nästa försök går igenom.
    expect((await service.uppdatera({ plats: PLATS, postId: "p1", text: "<p>två</p>", av: ANNA, skarpt: true })).nr).toBe(2);
  });

  it("tjänsten kräver sina delar och kastar med skälet", () => {
    const källa = createMemorySource();
    const lagring = minneslagring();
    expect(() => createHtmlDokumentService({ kalla: {}, samlingar: { bibliotek: "b", versioner: "v" }, lagring })).toThrow(/saknar read/);
    expect(() => createHtmlDokumentService({ kalla: källa, samlingar: { bibliotek: "b" }, lagring })).toThrow(/samlingar/);
    expect(() => createHtmlDokumentService({ kalla: källa, samlingar: { bibliotek: "b", versioner: "b" }, lagring })).toThrow(/dela samling/);
    expect(() => createHtmlDokumentService({ kalla: källa, samlingar: { bibliotek: "b", versioner: "v" } })).toThrow(/lagring/);
  });
});
