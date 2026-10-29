import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { FILMIME, TEXTFORHANDS_BYTE, avkodaTextfil, byggPost, filContentTypeMonster, filMimeMonster, lagringsContentType } from "../lib/bibliotek.js";

/*
 * Textfil i Biblioteket (0.153.0, cllp/ops-framework#460 punkt 3, lifehub.app QA-fynd 5): "fÃ¶r" i stället för "för".
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: `lagringsContentType`, `filContentTypeMonster`, `avkodaTextfil` och `hamtaFil` finns inte, filen laddades upp som `text/plain` utan kodning, detaljen visade bara en länk och ritade inga taggar.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };

const fil = (/** @type {string} */ namn, /** @type {string} */ mime, extra = {}) => ({
  ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: namn, fil: { sokvag: `grupper/cps-ab/bibliotek/p/${namn}`, namn, mime, byte: 2048 }, skapadAv: skapare, skapad: tid, andrad: tid, ...extra }),
  id: "p",
});

/** @param {Blob | Error} svar */
function visa(post, hamtaFil, extra = {}) {
  return render(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} hamtaFil={hamtaFil} {...extra} />);
}
const blobAv = (/** @type {BlobPart[]} */ delar) => new Blob(delar, { type: "text/plain" });

describe("innehållstypen i lagringen", () => {
  it("⛔ en textfil får text/plain; charset=utf-8, allt annat sin MIME oförändrad", () => {
    expect(lagringsContentType("text/plain")).toBe("text/plain; charset=utf-8");
    expect(lagringsContentType("Text/Plain;charset=latin1")).toBe("text/plain; charset=utf-8");
    for (const m of FILMIME.filter((x) => !x.startsWith("text/"))) expect(lagringsContentType(m), m).toBe(m);
  });

  it("⛔ Storage-regelns uttryck släpper in båda formerna för text och bara dem, och Firestore-regelns uttryck är oförändrat", () => {
    const sluten = new RegExp(filContentTypeMonster());
    expect(sluten.test("text/plain")).toBe(true);
    expect(sluten.test("text/plain; charset=utf-8")).toBe(true);
    expect(sluten.test("text/plain; charset=iso-8859-1")).toBe(false);
    expect(sluten.test("image/png; charset=utf-8")).toBe(false);
    expect(sluten.test("text/html")).toBe(false);
    for (const m of FILMIME) expect(sluten.test(m), m).toBe(true);
    // Postens `fil.mime` bär aldrig en kodning: Firestore-regelns uttryck är det gamla.
    expect(new RegExp(filMimeMonster()).test("text/plain; charset=utf-8")).toBe(false);
    expect(new RegExp(filMimeMonster()).test("text/plain")).toBe(true);
  });

  it("⛔ uppladdningen bär kodningen i lagringen, och posten behåller text/plain", async () => {
    /** @type {any[]} */
    const uppladdat = [];
    const kalla = createBibliotekskalla({
      source: createMemorySource(),
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare: () => skapare,
      lagring: { laddaUpp: async (i) => { uppladdat.push(i); return { url: "x", sokvag: i.sokvag }; }, taBort: async () => {} },
      sokvag: ({ groupId, postId, namn }) => `grupper/${groupId}/bibliotek/${postId}/${namn}`,
    });
    const sparad = await kalla.laddaUppFil({ rubrik: "Anteckning", fil: { name: "a.txt", type: "text/plain", size: 20 } });
    expect(sparad.fil.mime).toBe("text/plain");
    expect(uppladdat[0].contentType).toBe("text/plain; charset=utf-8");
    await kalla.laddaUppFil({ rubrik: "Kvitto", fil: { name: "k.pdf", type: "application/pdf", size: 20 } });
    expect(uppladdat[1].contentType).toBe("application/pdf");
  });
});

describe("avkodaTextfil", () => {
  it("UTF-8 som UTF-8, och en fil som inte är giltig UTF-8 som Windows-1252", () => {
    expect(avkodaTextfil(new TextEncoder().encode("Hej, för vår skull."))).toBe("Hej, för vår skull.");
    expect(avkodaTextfil(new Uint8Array([0x66, 0xf6, 0x72]))).toBe("för");
  });
  it("början av en längre fil: ett tecken som klipps mitt i visas inte som en ersättningsruta", () => {
    const bytes = new TextEncoder().encode("vår");
    expect(avkodaTextfil(bytes.slice(0, 2), true)).toBe("v");
  });
  it("en BOM visas inte", () => {
    expect(avkodaTextfil(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x65, 0x6a]))).toBe("hej");
  });
});

describe("textfilen i detaljen", () => {
  it("⛔ visas som text med svenska tecken hela, hämtad med hamtaFil", async () => {
    const hamtaFil = vi.fn(async () => blobAv(["Hej, för vår skull.\nRad två."]));
    const post = fil("anteckning.txt", "text/plain");
    visa(post, hamtaFil);
    const text = await screen.findByLabelText("Innehållet i anteckning.txt");
    expect(text.textContent).toBe("Hej, för vår skull.\nRad två.");
    expect(hamtaFil).toHaveBeenCalledWith("grupper/cps-ab/bibliotek/p/anteckning.txt");
    // Länken står kvar under texten.
    expect(screen.getByRole("link", { name: /anteckning\.txt/ })).toHaveAttribute("href", "https://lagring.example/fil");
  });

  it("en fil sparad som ANSI visas rätt", async () => {
    visa(fil("ansi.txt", "text/plain"), async () => blobAv([new Uint8Array([0x68, 0xe4, 0x72, 0x20, 0x66, 0xf6, 0x72])]));
    expect((await screen.findByLabelText("Innehållet i ansi.txt")).textContent).toBe("här för");
  });

  it("⛔ bara början av en stor fil, och raden säger att resten finns i filen", async () => {
    visa(fil("stor.txt", "text/plain"), async () => blobAv(["a".repeat(TEXTFORHANDS_BYTE + 5000)]));
    const text = await screen.findByLabelText("Innehållet i stor.txt");
    expect(text.textContent).toHaveLength(TEXTFORHANDS_BYTE);
    expect(document.querySelector("[data-bibliotek-text-avkortad]")?.textContent).toContain("början av filen");
  });

  it("⛔ orden följer språket (granskningen av PR 464)", async () => {
    const { unmount } = render(
      <OpsSprakProvider sprak="en">
        <OpsBibliotek poster={[fil("stor.txt", "text/plain")]} jag={JAG} vald={fil("stor.txt", "text/plain")} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} hamtaFil={async () => blobAv(["a".repeat(TEXTFORHANDS_BYTE + 1)])} />
      </OpsSprakProvider>,
    );
    expect(await screen.findByLabelText("The contents of stor.txt")).toBeTruthy();
    expect(document.querySelector("[data-bibliotek-text-avkortad]")?.textContent).toBe("This is the start of the file. The rest is in the file.");
    unmount();
    render(
      <OpsSprakProvider sprak="en">
        <OpsBibliotek poster={[fil("tom.txt", "text/plain")]} jag={JAG} vald={fil("tom.txt", "text/plain")} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} hamtaFil={async () => blobAv([])} />
      </OpsSprakProvider>,
    );
    expect(await screen.findByText("The file is empty.")).toBeTruthy();
  });

  it("⛔ en tom fil säger det, och ett fel säger varför med länken kvar", async () => {
    const { unmount } = visa(fil("tom.txt", "text/plain"), async () => blobAv([]));
    expect(await screen.findByText("Filen är tom.")).toBeTruthy();
    unmount();
    visa(fil("fel.txt", "text/plain"), async () => {
      throw Object.assign(new Error("nej"), { code: "storage/unauthorized" });
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Texten gick inte att visa.");
    expect(alert.textContent).toContain("behörighet");
    expect(screen.getByRole("link", { name: /fel\.txt/ })).toBeTruthy();
  });

  it("⛔ en ny hamtaFil-funktion vid varje rendering hämtar inte om texten", async () => {
    const hamta = vi.fn(async () => blobAv(["Hej"]));
    const post = fil("ref.txt", "text/plain");
    const { rerender } = visa(post, (/** @type {string} */ s) => hamta(s));
    await screen.findByLabelText("Innehållet i ref.txt");
    for (let i = 0; i < 3; i += 1) {
      rerender(<OpsBibliotek poster={[post]} jag={JAG} vald={post} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/fil"} hamtaFil={(/** @type {string} */ s) => hamta(s)} />);
    }
    expect(screen.getByLabelText("Innehållet i ref.txt")).toBeTruthy();
    expect(hamta).toHaveBeenCalledTimes(1);
  });

  it("utan hamtaFil visas bara länken, som förut", async () => {
    visa(fil("utan.txt", "text/plain"), undefined);
    expect(await screen.findByRole("link", { name: /utan\.txt/ })).toBeTruthy();
    expect(document.querySelector("[data-bibliotek-text]")).toBeNull();
  });

  it("en PDF och en bild förhandsvisas inte som text: hamtaFil anropas inte", async () => {
    const hamtaFil = vi.fn(async () => blobAv(["x"]));
    visa(fil("avtal.pdf", "application/pdf"), hamtaFil);
    await screen.findByRole("link", { name: /avtal\.pdf/ });
    expect(hamtaFil).not.toHaveBeenCalled();
  });
});

describe("taggarna i detaljen", () => {
  it("⛔ en post med taggar visar dem under innehållet, för varje sort", async () => {
    visa(fil("a.txt", "text/plain", { taggar: ["ekonomi", "2026"] }), async () => blobAv(["x"]));
    const rad = await waitFor(() => /** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-detalj-taggar]")));
    expect(within(rad).getByText("ekonomi")).toBeTruthy();
    expect(within(rad).getByText("2026")).toBeTruthy();
  });

  it("en anteckning visar sina taggar i läsläget", () => {
    const anteckning = { ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Beslut.", taggar: ["styrelse"], skapadAv: skapare, skapad: tid, andrad: tid }), id: "p" };
    render(<OpsBibliotek poster={[anteckning]} jag={JAG} vald={anteckning} onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" />);
    expect(within(/** @type {HTMLElement} */ (document.querySelector("[data-bibliotek-detalj-taggar]"))).getByText("styrelse")).toBeTruthy();
  });

  it("en ny post har ingen taggrad: det finns inget att tagga än", () => {
    render(<OpsBibliotek poster={[]} jag={JAG} skapar="anteckning" onOppna={() => {}} onStang={() => {}} onSpara={() => {}} hubHref="/hub" />);
    expect(document.querySelector("[data-bibliotek-detalj-taggar]")).toBeNull();
  });
});
