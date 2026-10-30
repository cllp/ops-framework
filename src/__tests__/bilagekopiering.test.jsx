import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsSamtal } from "../components/OpsMeddelanden.jsx";
import { OpsBilagekopiering } from "../components/BilageKopiering.jsx";
import { createMemorySource } from "../data/adapters.js";
import { bilagaKanKopieras, createBibliotekskalla, kopieraBilagaTillPlats } from "../data/bibliotekkalla.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { bilagaTillBlob } from "../lib/file.js";
import { arendeBibliotek, handelseBibliotek, platsBibliotek } from "../lib/bibliotek.js";

/**
 * Kopiera en chattbilaga till en plats (0.155.0, cllp/ops-framework#469): funktionen, och knappen under bilagan i chatten.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött mot 0.154.0 (funktionerna och komponenten finns inte), och rött med varje skydd uttaget (typkontrollen, objektplatsen, avkodningen). Utfallen står i PR-texten.
 */

const GRUPP = "cps-ab";
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const CSV = "data:text/csv;base64,YTpi";
const bild = (extra = {}) => ({ dataUrl: PNG, namn: "kvitto.png", typ: "image/png", tecken: PNG.length, ...extra });
const csv = () => ({ dataUrl: CSV, namn: "tabell.csv", typ: "text/csv", tecken: CSV.length });
const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];
const namnFor = (uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;

function kalla(groupId = platsBibliotek(GRUPP, "demos")) {
  const uppladdat = [];
  const blobbar = [];
  const k = createBibliotekskalla({
    source: createMemorySource({}),
    collection: "bibliotek",
    groupId,
    skapare: () => ({ uid: "anna", namn: "Anna", typ: "manniska", kalla: "bibliotek" }),
    lagring: {
      laddaUpp: async (/** @type {any} */ i) => {
        uppladdat.push(i);
        blobbar.push(i.fil);
        return { url: "minne://x", sokvag: i.sokvag };
      },
      taBort: async () => {},
    },
    sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
  });
  return { k, uppladdat, blobbar };
}

describe("bilagaTillBlob", () => {
  it("avkodar en data-URL till byten och typen", async () => {
    const b = bilagaTillBlob(bild());
    expect(b.type).toBe("image/png");
    expect(b.size).toBe(8);
    const bytes = await new Promise((ok, fel) => {
      const l = new FileReader();
      l.onload = () => ok(new Uint8Array(/** @type {ArrayBuffer} */ (l.result)));
      l.onerror = () => fel(l.error);
      l.readAsArrayBuffer(b);
    });
    expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
  it("kastar för en bilaga utan giltig data-URL, med ogiltig base64 och för en tom", () => {
    expect(() => bilagaTillBlob({ dataUrl: "http://x/a.png" })).toThrow(/ingen giltig data-URL/);
    expect(() => bilagaTillBlob({})).toThrow(/ingen giltig data-URL/);
    expect(() => bilagaTillBlob({ dataUrl: "data:image/png;base64," })).toThrow(/tom/);
  });
});

describe("kopieraBilagaTillPlats", () => {
  it("lägger bilagan som en vanlig fil på platsen: samma namn, typ och byte, och sökvägen bär platsen", async () => {
    const { k, uppladdat } = kalla();
    const post = await kopieraBilagaTillPlats({ bilaga: bild(), till: k });
    expect(post.groupId).toBe(platsBibliotek(GRUPP, "demos"));
    expect(post.fil.mime).toBe("image/png");
    expect(post.fil.sokvag).toBe(`grupper/plats~cps-ab~demos/bibliotek/${post.id}/kvitto.png`);
    expect(uppladdat).toHaveLength(1);
    expect(uppladdat[0].contentType).toBe("image/png");
    expect((await k.las()).poster.map((p) => p.id)).toContain(post.id);
  });

  it("⛔ en typ Biblioteket inte tar emot (text/csv) kastar med skälet, och ingenting skrivs", async () => {
    const { k, uppladdat } = kalla();
    expect(bilagaKanKopieras(csv())).toBe(false);
    expect(bilagaKanKopieras(bild())).toBe(true);
    await expect(kopieraBilagaTillPlats({ bilaga: csv(), till: k })).rejects.toThrow(/text\/csv/);
    expect(uppladdat).toHaveLength(0);
    expect((await k.las()).poster).toHaveLength(0);
  });

  it("⛔ en händelses och ett ärendes plats tar inte emot kopian, och en bilaga som inte klarar chattens prövning kopieras inte", async () => {
    for (const g of [handelseBibliotek(GRUPP, "h1"), arendeBibliotek(GRUPP, "a1")]) {
      const { k, uppladdat } = kalla(g);
      await expect(kopieraBilagaTillPlats({ bilaga: bild(), till: k })).rejects.toThrow(/tar inte emot/);
      expect(uppladdat).toHaveLength(0);
    }
    const { k } = kalla();
    await expect(kopieraBilagaTillPlats({ bilaga: bild({ tecken: 3 }), till: k })).rejects.toThrow(/storlek/);
    await expect(kopieraBilagaTillPlats({ bilaga: null, till: k })).rejects.toThrow(/inte en bilaga/);
    await expect(kopieraBilagaTillPlats({ bilaga: bild() })).rejects.toThrow(/till krävs/);
  });
});

async function samtalMedBilaga(b) {
  let t = 1_700_000_000_000;
  const s = createSamtalskalla({ kalla: createMemorySource({}), klocka: () => (t += 1000), bilagor: true, bilagaSamling: "bilagor" });
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  await s.skicka(p.id, { text: "Se här", av: "bo", bilaga: b });
  return { s, p };
}

const PLATSER = [{ id: "g", namn: "Gruppens bibliotek" }, { id: platsBibliotek(GRUPP, "demos"), namn: "Demos" }];

describe("knappen under bilagan i chatten", () => {
  it("⛔ utan OpsBilagekopiering ritas ingen knapp: chatten ser ut som förut", async () => {
    const { s, p } = await samtalMedBilaga(bild());
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    await screen.findByText("Se här");
    await waitFor(() => expect(document.querySelector("[data-meddelande-bilaga]")).not.toBeNull());
    expect(screen.queryByRole("button", { name: /Kopiera till en plats/ })).toBeNull();
  });

  it("⛔ för text/csv ritas ingen knapp, och för en bild ritas den", async () => {
    const a = await samtalMedBilaga(csv());
    const { unmount } = render(
      <OpsBilagekopiering platser={PLATSER} onKopiera={vi.fn()}>
        <OpsSamtal kalla={a.s} uid="anna" samtal={a.p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />
      </OpsBilagekopiering>,
    );
    await screen.findByText("Se här");
    await waitFor(() => expect(document.querySelector("[data-meddelande-bilaga]")).not.toBeNull());
    expect(screen.queryByRole("button", { name: /Kopiera till en plats/ })).toBeNull();
    unmount();
    const b = await samtalMedBilaga(bild());
    render(
      <OpsBilagekopiering platser={PLATSER} onKopiera={vi.fn()}>
        <OpsSamtal kalla={b.s} uid="anna" samtal={b.p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />
      </OpsBilagekopiering>,
    );
    expect(await screen.findByRole("button", { name: /Kopiera till en plats/ })).toBeInTheDocument();
  });

  it("väljer en plats och anropar appen med bilagan och platsen, och säger vart den kopierades", async () => {
    const { s, p } = await samtalMedBilaga(bild());
    const onKopiera = vi.fn(async () => {});
    render(
      <OpsBilagekopiering platser={PLATSER} onKopiera={onKopiera}>
        <OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />
      </OpsBilagekopiering>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Kopiera till en plats/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Kopiera" }));
    await waitFor(() => expect(onKopiera).toHaveBeenCalledTimes(1));
    expect(onKopiera.mock.calls[0][0]).toMatchObject({ platsId: "g", bilaga: { namn: "kvitto.png", typ: "image/png" } });
    expect(await screen.findByText("Kopierad till Gruppens bibliotek.")).toBeInTheDocument();
  });

  it("⛔ ett fel från appen visas i dialogen och dialogen står kvar", async () => {
    const { s, p } = await samtalMedBilaga(bild());
    render(
      <OpsBilagekopiering platser={PLATSER} onKopiera={async () => { throw new Error("Nekad av databasen."); }}>
        <OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />
      </OpsBilagekopiering>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Kopiera till en plats/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Kopiera" }));
    expect(await within(dialog).findByText("Nekad av databasen.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("provider kastar utan lista och utan funktion", () => {
    expect(() => render(<OpsBilagekopiering platser={/** @type {any} */ (null)} onKopiera={vi.fn()} />)).toThrow(/platser/);
    expect(() => render(<OpsBilagekopiering platser={[]} onKopiera={/** @type {any} */ (null)} />)).toThrow(/onKopiera/);
  });
});
